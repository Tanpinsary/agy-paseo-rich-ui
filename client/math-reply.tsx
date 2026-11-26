import { useId, useLayoutEffect, useRef, type CSSProperties } from "react";
import { Markdown } from "@getpaseo/plugin/client/ui";
import { typesetReply } from "./mathjax.mjs";
import type { richParts } from "./rich.mjs";
import { Widget } from "./widget";

type Props = {
  parts: ReturnType<typeof richParts>;
  complete: boolean;
  background: string;
  color: string;
  linkColor: string;
};

export function MathReply({
  parts,
  complete,
  background,
  color,
  linkColor,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const scope = useId();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root: HTMLDivElement = element;
    const groups = Array.from(
      root.querySelectorAll<HTMLElement>("[data-agy-math-part]"),
    );
    if (!groups.length) return;

    function restoreSource() {
      for (const group of groups) {
        group.innerHTML = parts[Number(group.dataset.agyMathPart)].html ?? "";
      }
    }
    let lastWidth = -1;
    function render() {
      const width = Math.round(root.getBoundingClientRect().width);
      if (width === lastWidth || width === 0) return;
      lastWidth = width;
      restoreSource();
      try {
        typesetReply(
          root.ownerDocument,
          Array.from(root.querySelectorAll("[data-agy-tex]")),
          scope,
        );
      } catch (error) {
        restoreSource();
        console.error("MathJax could not typeset this reply", error);
      }
    }
    // Coalesce streaming updates and width changes before touching the DOM.
    let frame = requestAnimationFrame(render);
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [parts, scope]);

  return (
    <div
      ref={ref}
      style={
        {
          "--agy-math-link": linkColor,
          minWidth: 0,
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 6,
          color,
        } as CSSProperties
      }
      onClick={(event) => {
        const link = (event.target as Element).closest("[data-agy-tex] a");
        const href =
          link?.getAttribute("href") ?? link?.getAttribute("xlink:href");
        if (!href?.startsWith("#")) return;
        const target = event.currentTarget.ownerDocument.getElementById(
          decodeURIComponent(href.slice(1)),
        );
        if (target && event.currentTarget.contains(target)) {
          event.preventDefault();
          target.scrollIntoView({ block: "nearest" });
        }
      }}
    >
      <style>{`
        [data-agy-tex="display"] { display: block; }
        [data-agy-tex] mjx-container[jax="SVG"] > svg a {
          fill: var(--agy-math-link);
          stroke: var(--agy-math-link);
          cursor: pointer;
        }
      `}</style>
      {parts.map((part, i) => {
        if (part.kind === "math") {
          return (
            <div
              key={i}
              data-agy-math-part={i}
              style={{ minWidth: 0, lineHeight: 1.5, overflowX: "auto" }}
            />
          );
        }
        if (part.kind === "widget" && complete) {
          return <Widget key={i} html={part.html!} background={background} />;
        }
        return part.raw.trim() ? <Markdown key={i}>{part.raw}</Markdown> : null;
      })}
    </div>
  );
}
