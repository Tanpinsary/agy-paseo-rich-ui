import test from "node:test";
import assert from "node:assert/strict";
import { openForm, formRpc } from "../server/socket.mjs";
import { parseForm, validateReply } from "../shared/forms.mjs";
import { richParts, widgetDocument } from "../client/rich.mjs";

test("two agy questions retain choice IDs, write-ins and multi-select arrays", () => {
  const form = parseForm({
    mode: "form",
    requestedSchema: {
      type: "object",
      properties: {
        q1: {
          type: "string",
          title: "颜色",
          oneOf: [{ const: "1", title: "蓝色" }],
        },
        q1_other: { type: "string", title: "Other" },
        q2: {
          type: "array",
          items: {
            anyOf: [
              { const: "2", title: "A, B" },
              { const: "3", title: "C" },
            ],
          },
        },
      },
    },
  });
  const user = {
    action: "accept",
    content: { q1_other: "紫色", q2: ["2", "3"] },
  };
  assert.equal(JSON.stringify(validateReply(form, user)), JSON.stringify(user));
  assert.throws(() =>
    validateReply(form, { action: "accept", content: { q1: "蓝色" } }),
  );
  assert.throws(() => validateReply(form, { action: "accept", content: {} }));
  assert.deepEqual(validateReply(form, { action: "cancel" }), {
    action: "cancel",
  });
});
test("one answer reaches only its owning session", async () => {
  const replies = [];
  const endpoint = await openForm("owner", { message: "Hello" }, (reply) =>
    replies.push(reply),
  );
  const req = { id: endpoint.id, agentId: "owner" };
  try {
    await assert.rejects(formRpc({ ...req, op: "inspect", agentId: "other" }));
    assert.deepEqual(await formRpc({ ...req, op: "inspect" }), {
      form: { message: "Hello" },
    });
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        formRpc({ ...req, op: "submit", reply: { action: "cancel" } }),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(replies.length, 1);
  } finally {
    endpoint.close();
  }
});
test("render screenshot notation, bracket math and display math without changing currency or code", () => {
  for (const source of [
    String.raw`预算 $> 64\text{k}$ 的难例`,
    "word$x$word",
    String.raw`行内 \(a^2\)`,
    String.raw`\[\frac{a}{b}\]`,
    "$$\na+b\n$$",
    "\x60\x60\x60math\nx^2\n\x60\x60\x60",
  ]) {
    assert.match(richParts(source)[0].html, /data-agy-tex=/);
  }
  for (const source of [
    "$20 to $35",
    "\x60$x$\x60",
    "\x60\x60\x60js\nlet a='$x$';\n\x60\x60\x60",
  ])
    assert.deepEqual(richParts(source), []);
  assert.ok(!richParts("<b>hi</b> $x$")[0].html.includes("<b>"));
});
test("only a closed, explicitly tagged widget becomes interactive", () => {
  const start = "\x60\x60\x60paseo-widget\n<button>Demo</button>\n";
  assert.equal(richParts(start).length, 0);
  assert.equal(richParts(start + "\x60\x60\x60")[0].kind, "widget");
  assert.equal(
    richParts(start.replace("paseo-widget", "html") + "\x60\x60\x60").length,
    0,
  );
  assert.match(widgetDocument("<button>Demo</button>"), /connect-src 'none'/);
});
