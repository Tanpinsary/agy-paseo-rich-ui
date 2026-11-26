// agy uses q1/q1_other pairs. Keep the property's wire key and option value,
// since the displayed question and labels may repeat or contain punctuation.
export function parseForm(params) {
  if (params.mode !== "form" || params.requestedSchema?.type !== "object")
    throw new Error("Unsupported elicitation");
  const schema = params.requestedSchema;
  const fields = Object.entries(schema.properties ?? {}).map(([key, prop]) => {
    const multi = prop.type === "array";
    if (prop.type !== "string" && !multi)
      throw new Error("Unsupported form field " + key);
    const source = multi ? prop.items : prop;
    const options = (source?.oneOf ?? source?.anyOf ?? source?.enum ?? []).map(
      (option) =>
        typeof option === "string"
          ? { value: option, label: option }
          : { value: option.const, label: option.title ?? option.const },
    );
    if (
      options.some(
        (o) => typeof o.value !== "string" || typeof o.label !== "string",
      )
    )
      throw new Error("Invalid choice");
    return {
      key,
      title: prop.title || key,
      description: prop.description || "",
      multi,
      options,
      required: schema.required?.includes(key) ?? false,
    };
  });
  if (!fields.length) throw new Error("Empty form");
  return { message: params.message || "Ask question", fields };
}

export function validateReply(form, reply) {
  if (reply?.action === "cancel" || reply?.action === "decline")
    return { action: reply.action };
  if (
    reply?.action !== "accept" ||
    !reply.content ||
    typeof reply.content !== "object"
  )
    throw new Error("Invalid form answer");
  const content = Object.create(null);
  for (const field of form.fields) {
    const value = reply.content[field.key];
    if (
      value == null ||
      value === "" ||
      (Array.isArray(value) && !value.length)
    ) {
      const hasOther =
        form.fields.some((f) => f.key === field.key + "_other") &&
        typeof reply.content[field.key + "_other"] === "string" &&
        reply.content[field.key + "_other"].trim();
      if (field.required || (/^q\d+$/.test(field.key) && !hasOther))
        throw new Error(field.title);
      continue;
    }
    const values = field.multi ? value : [value];
    if (
      !Array.isArray(values) ||
      values.some(
        (v) =>
          typeof v !== "string" ||
          (field.options.length && !field.options.some((o) => o.value === v)),
      )
    )
      throw new Error(field.title);
    content[field.key] = value;
  }
  return { action: "accept", content };
}
