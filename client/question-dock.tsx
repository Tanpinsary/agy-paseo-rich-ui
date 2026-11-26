import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// The question belongs to the same chat surface as its timeline row. Stop at
// the pane boundary so a retained tab never takes over the next pane's input.
function findComposer(marker: HTMLElement): HTMLElement | null {
  const pane = marker.closest('[data-testid^="workspace-pane-"]');
  for (
    let node = marker.parentElement;
    node && node !== pane && node !== document.body;
    node = node.parentElement
  ) {
    const inputs = node.querySelectorAll<HTMLElement>(
      '[data-testid="message-input-root"]',
    );
    if (inputs.length) {
      const streams = node.querySelectorAll(
        '[data-testid="agent-chat-scroll"]',
      );
      return streams.length === 1 && inputs.length === 1 ? inputs[0] : null;
    }
  }
  return null;
}

export function QuestionDock({ children }: { children: ReactNode }) {
  const marker = useRef<HTMLSpanElement>(null);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const node = marker.current;
    if (!node) return;
    let current = findComposer(node);
    setRoot(current);
    const pane = node.closest('[data-testid^="workspace-pane-"]');
    if (!pane) return;
    const observer = new MutationObserver(() => {
      if (current?.isConnected) return;
      const next = findComposer(node);
      if (next !== current) {
        current = next;
        setRoot(next);
      }
    });
    observer.observe(pane, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <span ref={marker} hidden />
      {root
        ? createPortal(
            <div
              data-agy-question-dock=""
              style={{
                order: -1,
                minWidth: 0,
                maxHeight: "min(52vh, 460px)",
                overflowY: "auto",
              }}
            >
              <style>
                {
                  '[data-testid="message-input-root"]:has(> [data-agy-question-dock]) > :not([data-agy-question-dock]) { display:none !important; }'
                }
              </style>
              {children}
            </div>,
            root,
          )
        : children}
    </>
  );
}
