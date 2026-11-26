import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const field = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  multi: z.boolean(),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string(), label: z.string() })),
});
export const formSchema = z.object({
  message: z.string(),
  fields: z.array(field),
});
export type Form = z.infer<typeof formSchema>;
const target = z.object({ id: z.uuid(), agentId: z.string().min(1) });
export const inspect = defineRpc({
  name: "form.inspect",
  input: target,
  output: formSchema.nullable(),
});
export const answer = defineRpc({
  name: "form.answer",
  input: target.extend({
    reply: z.object({
      action: z.enum(["accept", "cancel"]),
      content: z
        .record(z.string(), z.union([z.string(), z.array(z.string())]))
        .optional(),
    }),
  }),
  output: z.boolean(),
});
