// argv is the original provider command, including any configured agy flags.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { openForm } from "./server/socket.mjs";
import { parseForm, validateReply } from "./shared/forms.mjs";

const [command, ...args] = process.argv.slice(2);
const agentId = process.env.PASEO_AGY_FORM_AGENT;
const env = { ...process.env };
delete env.PASEO_AGY_FORM_AGENT;
const interactive = Boolean(agentId && args.includes("acp"));
const child = spawn(command, args, {
  env,
  stdio: interactive ? ["pipe", "pipe", "inherit"] : "inherit",
});
const pending = new Map();
const send = (stream, data) => stream.write(JSON.stringify(data) + "\n");
const toAgent = (data) => send(child.stdin, data);
const toPaseo = (data) => send(process.stdout, data);
function row(sessionId, id, status) {
  const name = "paseo_agy_question";
  toPaseo({
    jsonrpc: "2.0",
    method: "session/update",
    params: {
      sessionId,
      update: {
        sessionUpdate:
          status === "in_progress" ? "tool_call" : "tool_call_update",
        toolCallId: name + ":" + id,
        name,
        title: "Ask question",
        kind: "other",
        status,
        rawInput: { id },
      },
    },
  });
}

async function elicit(message) {
  const { id, params } = message;
  const state = {
    sessionId: params.sessionId,
    toolCallId: params.toolCallId,
    endpoint: null,
    done: false,
    finish,
  };
  function finish(result) {
    if (state.done) return;
    state.done = true;
    pending.delete(id);
    toAgent({ jsonrpc: "2.0", id, result });
    if (state.endpoint) {
      row(params.sessionId, state.endpoint.id, "completed");
      state.endpoint.close();
    }
  }
  pending.set(id, state);
  try {
    const form = parseForm(params);
    const endpoint = await openForm(agentId, form, (reply) =>
      finish(validateReply(form, reply)),
    );
    if (state.done) {
      endpoint.close();
      return;
    }
    state.endpoint = endpoint;
    row(params.sessionId, endpoint.id, "in_progress");
  } catch (error) {
    console.error("Paseo elicitation:", error.message);
    finish({ action: "cancel" });
  }
}

const widgetPrompt =
  "Build the requested interactive widget directly in your answer. Output one complete, self-contained HTML fragment with inline styles and inline JavaScript inside a fenced code block labeled paseo-widget. Use HTML, SVG or canvas. No external URLs, libraries, network requests, files or tools. Include accessible labels. Request:\n";
function fromPaseo(m) {
  if (m.method === "initialize") {
    const caps = (m.params.clientCapabilities ??= {});
    caps.elicitation = { ...caps.elicitation, form: {} };
  } else if (m.method === "session/cancel" || m.method === "session/close") {
    for (const entry of pending.values())
      if (entry.sessionId === m.params.sessionId)
        entry.finish({ action: "cancel" });
  } else if (m.method === "session/prompt") {
    const first = m.params.prompt?.find((block) => block.type === "text");
    if (first && /^\/generative_ui(?:\s|$)/.test(first.text)) {
      first.text =
        widgetPrompt + first.text.slice("/generative_ui".length).trim();
    }
  }
  toAgent(m);
}
function fromAgy(m) {
  if (m.method === "elicitation/create" && m.id != null) {
    void elicit(m);
    return;
  }
  const update = m.method === "session/update" && m.params?.update;
  if (
    update?.sessionUpdate === "tool_call_update" &&
    ["completed", "failed"].includes(update.status)
  ) {
    for (const entry of pending.values()) {
      if (
        entry.sessionId === m.params.sessionId &&
        entry.toolCallId === update.toolCallId
      )
        entry.finish({ action: "cancel" });
    }
  }
  if (
    update?.sessionUpdate === "available_commands_update" &&
    !update.availableCommands.some((entry) => entry.name === "generative_ui")
  ) {
    update.availableCommands.push({
      name: "generative_ui",
      description: "Build an interactive widget in Paseo",
      input: { hint: "Describe the widget" },
    });
  }
  toPaseo(m);
}
function relay(input, handler) {
  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on("line", (line) => {
    if (!line.trim()) return;
    try {
      handler(JSON.parse(line));
    } catch (error) {
      console.error("Invalid ACP frame:", error.message);
      child.kill();
    }
  });
  return lines;
}
if (interactive) {
  relay(process.stdin, fromPaseo).on("close", () => {
    for (const entry of pending.values()) entry.finish({ action: "cancel" });
    child.stdin.end();
  });
  relay(child.stdout, fromAgy);
  child.stdin.on("error", () => child.kill());
  process.stdout.on("error", () => child.kill());
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
  process.on(signal, () => child.kill(signal));
child.on("error", (err) => {
  console.error(err.message);
  process.exitCode = 1;
});
child.on("close", (code) => {
  for (const entry of pending.values()) {
    entry.done = true;
    entry.endpoint?.close();
  }
  process.stdin.destroy();
  process.exitCode = code ?? 1;
});
