import { useMemo } from "react";
import { Markdown } from "@getpaseo/plugin/client/ui";
import {
  useAgent,
  type PluginClientContext,
  type PluginTimelineItemProps,
} from "@getpaseo/plugin/client";
import { z } from "zod";
import { richParts } from "./client/rich.mjs";
import { MathReply } from "./client/math-reply";
import { Question } from "./client/question";

const richSchema = z.object({ text: z.string(), complete: z.boolean() });
const questionSchema = z.object({ id: z.uuid(), live: z.boolean() });

function RichMessage({
  agentId,
  item,
  layout,
  theme,
}: PluginTimelineItemProps<z.infer<typeof richSchema>>) {
  const provider = useAgent(agentId, (a) => a.provider);
  const { text, complete } = item.data;
  const parts = useMemo(() => richParts(text), [text]);
  if (provider !== "antigravity" || layout.platform !== "web" || !parts.length)
    return <Markdown>{text}</Markdown>;
  return (
    <MathReply
      parts={parts}
      complete={complete}
      background={theme.colors.surface0}
      color={theme.colors.foreground}
      linkColor={theme.colors.accent}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  client.addTimelineTransformer({
    id: "agy-form",
    query: { itemType: "tool_call" },
    transform({ item }) {
      if (item.name !== "paseo_agy_question" || item.detail.type !== "unknown")
        return;
      const parsed = z.object({ id: z.uuid() }).safeParse(item.detail.input);
      if (parsed.success)
        return {
          items: [
            {
              type: "plugin",
              kind: "agy-question",
              version: 1,
              data: { ...parsed.data, live: item.status === "running" },
            },
          ],
        };
    },
  });
  client.addTimelineRenderer({
    kind: "agy-question",
    version: 1,
    schema: questionSchema,
    Component: Question,
  });
  client.addTimelineTransformer({
    id: "agy-rich-text",
    query: { itemType: "assistant_message" },
    transform({ item, phase }) {
      if (!richParts(item.text).length) return;
      return {
        items: [
          {
            type: "plugin",
            kind: "agy-rich-text",
            version: 1,
            data: { text: item.text, complete: phase === "complete" },
          },
        ],
      };
    },
  });
  client.addTimelineRenderer({
    kind: "agy-rich-text",
    version: 1,
    schema: richSchema,
    Component: RichMessage,
  });
  return () => {};
}
