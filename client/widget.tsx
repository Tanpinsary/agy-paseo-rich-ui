import { useEffect, useMemo, useRef, useState } from "react";
import { widgetDocument } from "./rich.mjs";

export function Widget({
  html,
  background,
}: {
  html: string;
  background: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(48);
  const document = useMemo(
    () => widgetDocument(html, background),
    [html, background],
  );
  useEffect(() => {
    function resize(event: MessageEvent) {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.type !== "agy-widget-height"
      )
        return;
      const value = event.data.height;
      if (typeof value === "number" && Number.isFinite(value)) {
        setHeight(Math.max(24, Math.min(520, Math.ceil(value))));
      }
    }
    window.addEventListener("message", resize);
    frame.current?.contentWindow?.postMessage(
      { type: "agy-widget-measure" },
      "*",
    );
    return () => window.removeEventListener("message", resize);
  }, []);
  return (
    <iframe
      ref={frame}
      title="交互组件"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={document}
      onLoad={() =>
        frame.current?.contentWindow?.postMessage(
          { type: "agy-widget-measure" },
          "*",
        )
      }
      style={{
        display: "block",
        width: "100%",
        height,
        border: 0,
        background: "transparent",
      }}
    />
  );
}
