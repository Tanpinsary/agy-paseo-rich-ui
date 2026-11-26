import MarkdownIt from "markdown-it";
import { tex } from "@mdit/plugin-tex";

const md = new MarkdownIt({ html: false, breaks: true });
function mathPlaceholder(source, display) {
  const body = md.utils.escapeHtml(source);
  const mode = display ? "display" : "inline";
  const delimited = display ? "\\[" + body + "\\]" : "\\(" + body + "\\)";
  return '<span data-agy-tex="' + mode + '">' + delimited + "</span>";
}
md.use(tex, { delimiters: "all", render: mathPlaceholder });

// Existing transcripts can have an inline formula touching an English word.
// Keep that notation while excluding digit-adjacent currency and escaped dollars.
const adjacentInline = /\$((?:\\[^\n]|[^$\\\n])+?)\$/y;
md.inline.ruler.before(
  "math_inline_dollar",
  "agy_adjacent_dollar",
  (state, silent) => {
    const start = state.pos;
    if (state.src[start] !== "$" || /[\d$\\]/.test(state.src[start - 1] ?? ""))
      return false;
    adjacentInline.lastIndex = start;
    const match = adjacentInline.exec(state.src);
    if (!match || /^\s|\s$/.test(match[1])) return false;
    const end = adjacentInline.lastIndex;
    const next = state.src[end] ?? "";
    if (
      end > state.posMax ||
      /[\d$]/.test(next) ||
      !/[a-z_]/i.test((state.src[start - 1] ?? "") + next)
    )
      return false;
    if (!silent) state.push("math_inline", "math", 0).content = match[1];
    state.pos = end;
    return true;
  },
);

// Let Markdown handle code and escapes before MathJax sees the reply. These
// forms can also occur in prose, outside a dollar- or bracket-delimited block.
const extraTex =
  /\\(?:eqref|ref)\{[^{}\n]+\}|\\begin\{(equation\*?|align\*?|alignat\*?|gather\*?|multline\*?|flalign\*?)\}[\s\S]*?\\end\{\1\}|\$\$([^\n]+?)\$\$|\\\[([^\n]+?)\\\]/y;
md.inline.ruler.before("escape", "agy_tex", (state, silent) => {
  extraTex.lastIndex = state.pos;
  const match = extraTex.exec(state.src);
  if (!match || extraTex.lastIndex > state.posMax) return false;
  const end = extraTex.lastIndex;
  if (!silent) {
    const token = state.push("math_extra", "", 0);
    token.content = match[2] ?? match[3] ?? match[0];
    token.block = !/^\\(?:eqref|ref)\{/.test(match[0]);
  }
  state.pos = end;
  return true;
});
md.renderer.rules.math_extra = (tokens, i) =>
  mathPlaceholder(tokens[i].content, tokens[i].block);
// Keep remote resources out of rich text. Normal Markdown blocks use Paseo's renderer.
md.renderer.rules.image = (tokens, i) => md.utils.escapeHtml(tokens[i].content);
md.validateLink = (href) => /^https?:\/\//i.test(href);
md.renderer.rules.link_open = (tokens, i, options, env, renderer) => {
  tokens[i].attrSet("target", "_blank");
  tokens[i].attrSet("rel", "noopener noreferrer");
  return renderer.renderToken(tokens, i, options);
};

export function richParts(source) {
  if (!/[\x24\\]|paseo-widget|\x60\x60\x60math/.test(source)) return [];
  const lines = source.split("\n");
  const tokens = md.parse(source, {});
  const parts = [];
  let line = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.level !== 0 || !t.map) continue;
    let end = i;
    if (t.nesting === 1) {
      while (
        end + 1 < tokens.length &&
        !(tokens[end + 1].level === 0 && tokens[end + 1].nesting === -1)
      )
        end++;
      if (end + 1 < tokens.length) end++;
    }
    const group = tokens.slice(i, end + 1);
    const math = group.some(
      (n) =>
        n.type.startsWith("math_") ||
        n.children?.some((c) => c.type.startsWith("math_")),
    );
    const info = t.type === "fence" ? t.info.trim() : "";
    const widget = info === "paseo-widget";
    if (!math && !widget && info !== "math") {
      i = end;
      continue;
    }
    const [start, stop] = t.map;
    const raw = lines.slice(start, stop).join("\n");
    // Markdown parsers accept unfinished fences. Execute only a closed, explicitly tagged widget.
    if (
      widget &&
      (stop <= start + 1 ||
        !new RegExp(
          "^ {0,3}" + t.markup[0] + "{" + t.markup.length + ",}\\s*$",
        ).test(lines[stop - 1]))
    )
      continue;
    if (start > line)
      parts.push({ kind: "md", raw: lines.slice(line, start).join("\n") });
    if (widget) parts.push({ kind: "widget", raw, html: t.content });
    else
      parts.push({
        kind: "math",
        raw,
        html:
          info === "math"
            ? mathPlaceholder(t.content, true)
            : md.renderer.render(group, md.options, {}),
      });
    line = stop;
    i = end;
  }
  if (!parts.length) return [];
  if (line < lines.length)
    parts.push({ kind: "md", raw: lines.slice(line).join("\n") });
  return parts;
}

// Measure the body rather than the root scrollHeight, whose lower bound is
// the current viewport. That lets a collapsed widget shrink again.
const measureWidget = `<script>
addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  function measure() {
    const css = getComputedStyle(body);
    const margin = (parseFloat(css.marginTop) || 0) + (parseFloat(css.marginBottom) || 0);
    const height = Math.max(body.getBoundingClientRect().height, body.scrollHeight) + margin;
    parent.postMessage({type:"agy-widget-height", height}, "*");
  }
  new ResizeObserver(measure).observe(body);
  addEventListener("load", measure);
  addEventListener("message", event => {
    if (event.source === parent && event.data?.type === "agy-widget-measure") measure();
  });
  measure();
});
</script>`;

export function widgetDocument(html, background = "#ffffff") {
  const policy =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; worker-src 'none'";
  return (
    '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' +
    policy +
    '"><meta name="referrer" content="no-referrer"><style>:root{color-scheme:' +
    (/^#[0-7][0-9a-f]{5}$/i.test(background) ? "dark" : "light") +
    ";font:15px system-ui;background:transparent}body{margin:0;display:flow-root}button,input,select{font:inherit}svg,canvas{max-width:100%}</style>" +
    measureWidget +
    "</head><body>" +
    html +
    "</body></html>"
  );
}
