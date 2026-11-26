import assert from "node:assert/strict";
import test from "node:test";
import { liteAdaptor } from "@mathjax/src/js/adaptors/liteAdaptor.js";
import { typesetReply } from "../client/mathjax.mjs";
import { richParts } from "../client/rich.mjs";

test("forward and backward references resolve inside each reply, with repeated label names", () => {
  const source = String.raw`See \eqref{two}.

$$A = 1 \label{one}$$

\begin{equation}
B = A + 1 \label{two}
\end{equation}

See \ref{one} and \eqref{two}.`;
  const html = richParts(source)
    .map((part) => part.html ?? "")
    .join("");
  const adaptor = liteAdaptor();
  const document = adaptor.parse(
    "<main>" + html + "</main><main>" + html + "</main>",
  );
  const replies = adaptor.tags(adaptor.body(document), "main");
  for (const [i, reply] of replies.entries()) {
    const others = replies
      .filter((node) => node !== reply)
      .map((node) => adaptor.innerHTML(node));
    const slots = adaptor
      .tags(reply, "span")
      .filter((node) => adaptor.hasAttribute(node, "data-agy-tex"));
    typesetReply(document, slots, "reply" + i, adaptor);
    const ids = ["one", "two"].map(
      (label) => "mjx-eqn:reply" + i + "-" + label,
    );
    const anchors = adaptor.tags(reply, "a");
    assert.deepEqual(
      anchors.map((a) =>
        decodeURIComponent(adaptor.getAttribute(a, "href").slice(1)),
      ),
      [ids[1], ids[0], ids[1]],
    );
    assert.deepEqual(
      anchors.map((a) =>
        adaptor
          .tags(a, "path")
          .map((p) => adaptor.getAttribute(p, "data-c"))
          .join(" "),
      ),
      ["28 32 29", "31", "28 32 29"],
    );
    const rendered = adaptor.innerHTML(reply);
    for (const id of ids) assert.ok(rendered.includes('id="' + id + '"'));
    assert.ok(rendered.includes("<mjx-assistive-mml"));
    assert.ok(!rendered.includes('data-mml-node="merror"'));
    assert.deepEqual(
      replies
        .filter((node) => node !== reply)
        .map((node) => adaptor.innerHTML(node)),
      others,
    );
  }
});

test("references in code or escaped prose stay literal; Markdown HTML stays escaped", () => {
  for (const text of [
    "`\\eqref{x}`",
    "```tex\n\\label{x}\n```",
    String.raw`escaped \\eqref{x}`,
  ])
    assert.deepEqual(richParts(text), []);
  const p = richParts(String.raw`<b>see</b> \eqref{x}`)[0];
  assert.match(p.html, /&lt;b&gt;/);
  assert.match(p.html, /data-agy-tex="inline"/);
});
