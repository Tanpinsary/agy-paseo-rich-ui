import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { TextInput } from "@getpaseo/plugin/client/ui";
import { useRpc, type PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { answer, inspect, type Form } from "../shared/contracts";
import { validateReply } from "../shared/forms.mjs";
import { QuestionDock } from "./question-dock";

type Answers = Record<string, string | string[]>;
type QuestionProps = PluginTimelineItemProps<{ id: string; live: boolean }>;

function questionsOf(form: Form) {
  const fields = new Map(form.fields.map((f) => [f.key, f]));
  return form.fields
    .filter(
      (f) => !(f.key.endsWith("_other") && fields.has(f.key.slice(0, -6))),
    )
    .map((field) => ({ field, other: fields.get(field.key + "_other") }));
}

function FormCard({
  form,
  theme,
  onRespond,
}: {
  form: Form;
  theme: QuestionProps["theme"];
  onRespond: (action: "accept" | "cancel", values: Answers) => Promise<void>;
}) {
  const questions = useMemo(() => questionsOf(form), [form]);
  const [page, setPage] = useState(0);
  const [values, setValues] = useState<Answers>({});
  const [custom, setCustom] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { field, other } = questions[page];
  const colors = theme.colors;
  const selected = values[field.key];
  const typed = other && values[other.key];
  const hasAnswer =
    (Array.isArray(selected)
      ? selected.length > 0
      : Boolean(selected?.trim())) ||
    (typeof typed === "string" && Boolean(typed.trim()));
  const required = field.required || /^q\d+$/.test(field.key);
  const enabled = !busy && (!required || hasAnswer);
  const last = page === questions.length - 1;
  const useCustom = Boolean(other && custom[field.key]);

  async function respond(action: "accept" | "cancel") {
    if (busy) return;
    try {
      if (action === "accept") validateReply(form, { action, content: values });
      setBusy(true);
      setError("");
      await onRespond(action, values);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function choose(value: string) {
    setValues((old) => {
      const next = { ...old };
      if (field.multi) {
        const prior = old[field.key];
        const list = Array.isArray(prior) ? prior : [];
        next[field.key] = list.includes(value)
          ? list.filter((v) => v !== value)
          : [...list, value];
      } else {
        next[field.key] = value;
        if (other) delete next[other.key];
      }
      return next;
    });
    if (!field.multi) setCustom((old) => ({ ...old, [field.key]: false }));
  }
  function chooseOther() {
    if (!other) return;
    const show = field.multi ? !useCustom : true;
    setCustom((old) => ({ ...old, [field.key]: show }));
    setValues((old) => {
      const next = { ...old };
      if (!field.multi) delete next[field.key];
      if (!show) delete next[other.key];
      return next;
    });
  }
  function option(
    label: string,
    checked: boolean,
    press: () => void,
    key: string,
  ) {
    return (
      <Pressable
        key={key}
        accessibilityRole={field.multi ? "checkbox" : "radio"}
        accessibilityLabel={label}
        accessibilityState={{ checked, disabled: busy }}
        aria-checked={checked}
        disabled={busy}
        onPress={press}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 9,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 6,
          backgroundColor: pressed || checked ? colors.surface2 : "transparent",
        })}
      >
        <View
          style={{
            width: 15,
            height: 15,
            marginTop: 2,
            borderWidth: 1,
            borderRadius: field.multi ? 4 : 8,
            borderColor: checked ? colors.accent : colors.foregroundMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checked && (
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: field.multi ? 1 : 4,
                backgroundColor: colors.accent,
              }}
            />
          )}
        </View>
        <Text
          style={{
            color: colors.foreground,
            fontSize: 14,
            lineHeight: 19,
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
  function action(
    label: string,
    press: () => void,
    primary = false,
    disabled = busy,
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={press}
        style={({ pressed }) => ({
          paddingHorizontal: primary ? 13 : 6,
          paddingVertical: 6,
          borderRadius: 7,
          backgroundColor: primary ? colors.accent : "transparent",
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        })}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: primary ? "600" : "400",
            color: primary ? colors.accentForeground : colors.foregroundMuted,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
  function move(index: number) {
    setPage(index);
    setError("");
  }
  const inputKey = field.options.length && other ? other.key : field.key;
  return (
    <View
      testID="agy-question-card"
      style={{
        backgroundColor: colors.surface1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            color: colors.foreground,
            fontWeight: "600",
            fontSize: 15,
            lineHeight: 21,
          }}
        >
          {field.title}
        </Text>
        {questions.length > 1 && (
          <Text
            accessibilityLabel={`第 ${page + 1} 题，共 ${questions.length} 题`}
            style={{ fontSize: 12, color: colors.foregroundMuted }}
          >
            {page + 1} / {questions.length}
          </Text>
        )}
      </View>
      {field.description ? (
        <Text style={{ fontSize: 13, color: colors.foregroundMuted }}>
          {field.description}
        </Text>
      ) : null}
      {field.options.length > 0 && (
        <View
          accessibilityRole={field.multi ? undefined : "radiogroup"}
          accessibilityLabel={field.title}
          style={{ gap: 1 }}
        >
          {field.options.map((o) =>
            option(
              o.label,
              Array.isArray(selected)
                ? selected.includes(o.value)
                : selected === o.value,
              () => choose(o.value),
              o.value,
            ),
          )}
          {other &&
            option("自定义回答", useCustom, chooseOther, "__write_in__")}
        </View>
      )}
      {(!field.options.length || useCustom) && (
        <TextInput
          key={inputKey}
          accessibilityLabel={field.options.length ? "自定义回答" : field.title}
          value={String(values[inputKey] ?? "")}
          placeholder="输入回答…"
          editable={!busy}
          multiline
          onChangeText={(text) =>
            setValues((old) => ({ ...old, [inputKey]: text }))
          }
          style={{
            fontSize: 14,
            color: colors.foreground,
            padding: 8,
            borderWidth: 1,
            borderRadius: 6,
            borderColor: colors.border,
          }}
        />
      )}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.statusDanger, fontSize: 13 }}
        >
          {error}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {action("跳过", () => void respond("cancel"))}
        <View style={{ flex: 1 }} />
        {page > 0 && action("上一题", () => move(page - 1))}
        {action(
          last ? "提交回答" : "下一题",
          () => (last ? void respond("accept") : move(page + 1)),
          true,
          !enabled,
        )}
      </View>
    </View>
  );
}

export function Question({ agentId, item, theme, layout }: QuestionProps) {
  const { id, live } = item.data;
  const lookup = useRpc(inspect),
    submit = useRpc(answer);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setForm(null);
    setError("");
    if (live)
      lookup({ id, agentId })
        .then((f) => {
          if (active) setForm(f);
        })
        .catch((e) => {
          if (active) setError(String(e));
        });
    return () => {
      active = false;
    };
  }, [id, agentId, live, lookup]);
  if (!live) return null;
  if (error)
    return <Text style={{ color: theme.colors.statusDanger }}>{error}</Text>;
  if (!form) return null;
  const card = (
    <FormCard
      key={id}
      form={form}
      theme={theme}
      onRespond={async (action, content) => {
        await submit({ id, agentId, reply: { action, content } });
        setForm(null);
      }}
    />
  );
  return layout.platform === "web" ? <QuestionDock>{card}</QuestionDock> : card;
}
