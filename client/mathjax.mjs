import { AssistiveMmlHandler } from "@mathjax/src/js/a11y/assistive-mml.js";
import { HTMLAdaptor } from "@mathjax/src/js/adaptors/HTMLAdaptor.js";
import { HTMLHandler } from "@mathjax/src/js/handlers/html/HTMLHandler.js";
import { TeX } from "@mathjax/src/js/input/tex.js";
import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js";
import "@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js";
import "@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js";
import { SVG } from "@mathjax/src/js/output/svg.js";
import { MathJaxTexFont } from "@mathjax/mathjax-tex-font/js/svg.js";
import { SafeHandler } from "@mathjax/src/js/ui/safe/SafeHandler.js";

// Render the placeholders in document order so the TeX pass can resolve
// forward references, including ones separated by ordinary Markdown or widgets.
export function typesetReply(
  owner,
  elements,
  scope,
  adaptor = new HTMLAdaptor(owner.defaultView),
) {
  if (!elements.length) return;
  const tex = new TeX({
    packages: [
      "base",
      "ams",
      "newcommand",
      "mathtools",
      "textmacros",
      "boldsymbol",
    ],
    tags: "all",
    maxMacros: 500,
    maxBuffer: 16 * 1024,
  });
  const tags = tex.parseOptions.tags;
  const originalId = tags.formatId.bind(tags);
  tags.formatId = (label) => originalId(scope + "-" + label);
  const svg = new SVG({
    fontData: MathJaxTexFont,
    fontCache: "none",
    displayOverflow: "linebreak",
    // Leave room for the SVG edge padding and the right-hand equation tag.
    linebreaks: { inline: true, width: "96%" },
  });
  const handler = AssistiveMmlHandler(SafeHandler(new HTMLHandler(adaptor)));
  const doc = handler.create(owner, {
    InputJax: tex,
    OutputJax: svg,
    safeOptions: { safeProtocols: { file: false } },
  });
  doc.findMath({ elements });
  doc.render();
}
