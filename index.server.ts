import type { PluginServerContext } from "@getpaseo/plugin/server";
import { answer, inspect } from "./shared/contracts";
import { formRpc } from "./server/socket.mjs";

export default function contribute(server: PluginServerContext) {
  server.addHook("agent.open.before", async ({ request }) => {
    if (request.provider !== "antigravity" || request.purpose !== "interactive")
      return;
    return {
      ...request,
      env: { ...request.env, PASEO_AGY_FORM_AGENT: request.agentId },
    };
  });
  server.handle(inspect, async (input) => {
    try {
      return (await formRpc({ ...input, op: "inspect" })).form;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        ["ENOENT", "ECONNREFUSED"].includes(String(error.code))
      )
        return null;
      throw error;
    }
  });
  server.handle(answer, async (input) =>
    Boolean((await formRpc({ ...input, op: "submit" })).ok),
  );
  return () => {};
}
