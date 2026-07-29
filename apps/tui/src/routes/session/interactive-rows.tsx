import { TextAttributes } from "@opentui/core";
import { createSignal, For, Show } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import { useAppState, type MessageBlock } from "../../context/state";
import { themeTokens as darkTheme } from "../../theme/theme";
import { useDialog } from "../../dialog/provider";
import { DialogPrompt } from "../../dialog/DialogPrompt";

function InlineAction(props: {
  label: string;
  detail?: string;
  onSelect(): void;
}) {
  return (
    <box flexDirection="column" onMouseUp={props.onSelect} paddingRight={1}>
      <text fg={darkTheme.accent}>{props.label}</text>
      <Show when={props.detail}>
        <text fg={darkTheme.muted} paddingLeft={2} wrapMode="word">
          {props.detail}
        </text>
      </Show>
    </box>
  );
}

export function InlineInteractiveBlock(props: {
  block: MessageBlock;
  backend?: RuntimeClient;
}) {
  const dialog = useDialog();
  const interactive = () => props.block.interactive!;
  const resolved = () => Boolean(interactive().response);
  const approval = () => {
    const value = interactive();
    return value.kind === "approval" ? value : undefined;
  };
  const question = () => {
    const value = interactive();
    return value.kind === "question" ? value : undefined;
  };
  const [answers, setAnswers] = createSignal<string[][]>([]);
  const answer = (index: number, value: string, multiple = false) => {
    const next = [...answers()];
    const current = next[index] ?? [];
    next[index] = multiple
      ? current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
      : [value];
    setAnswers(next);
  };
  const respondApproval = (decision: "once" | "session" | "reject") => {
    const value = interactive();
    if (value.kind !== "approval" || resolved()) return;
    props.backend?.respondApproval({ requestID: value.request.id, decision });
  };
  const respondQuestion = (rejected = false) => {
    const value = interactive();
    if (value.kind !== "question" || resolved()) return;
    props.backend?.respondQuestion({
      requestID: value.request.id,
      answers: rejected
        ? []
        : (value.request.questions?.map(
            (_, index) => answers()[index] ?? [],
          ) ?? []),
      rejected,
    });
  };
  const addCustomAnswer = (questionIndex: number, multiple: boolean) => {
    void DialogPrompt.show(dialog, "Type your own answer", {
      placeholder: "Enter answer",
    }).then((value) => {
      if (value === null || !value.trim() || resolved()) return;
      answer(questionIndex, value.trim(), multiple);
    });
  };

  return (
    <box
      flexDirection="column"
      border={["left"]}
      borderColor={
        interactive().kind === "approval" ? darkTheme.warning : darkTheme.accent
      }
      paddingLeft={1}
      marginTop={1}
    >
      <Show when={interactive().kind === "approval"}>
        <box flexDirection="column" gap={1}>
          <text fg={darkTheme.warning} attributes={TextAttributes.BOLD}>
            △ Permission {resolved() ? props.block.status : "required"}
          </text>
          <text fg={darkTheme.text} wrapMode="word">
            {approval()?.request.title}
          </text>
          <text fg={darkTheme.muted} wrapMode="word">
            {approval()?.request.preview}
          </text>
          <Show when={approval()?.response}>
            <text fg={darkTheme.muted}>{props.block.text}</text>
          </Show>
          <Show when={!resolved()}>
            <box flexDirection="row" gap={1}>
              <InlineAction
                label="Allow once"
                onSelect={() => respondApproval("once")}
              />
              <InlineAction
                label="Allow session"
                onSelect={() => respondApproval("session")}
              />
              <InlineAction
                label="Reject"
                onSelect={() => respondApproval("reject")}
              />
            </box>
          </Show>
        </box>
      </Show>
      <Show when={interactive().kind === "question"}>
        <box flexDirection="column" gap={1}>
          <text fg={darkTheme.accent} attributes={TextAttributes.BOLD}>
            ? {resolved() ? props.block.status : "Question"}
          </text>
          <text fg={darkTheme.text} wrapMode="word">
            {question()?.request.title}
          </text>
          <Show when={!resolved()}>
            <For each={question()?.request.questions ?? []}>
              {(question, questionIndex) => (
                <box flexDirection="column" paddingLeft={1}>
                  <text fg={darkTheme.text} wrapMode="word">
                    {question.question}
                  </text>
                  <For each={question.options}>
                    {(option) => (
                      <InlineAction
                        label={`${(answers()[questionIndex()] ?? []).includes(option.label) ? "[x]" : "[ ]"} ${option.label}`}
                        detail={option.description}
                        onSelect={() =>
                          answer(
                            questionIndex(),
                            option.label,
                            question.multiple,
                          )
                        }
                      />
                    )}
                  </For>
                  <Show when={question.custom !== false}>
                    <InlineAction
                      label={`[ ] Type your own answer${(answers()[questionIndex()] ?? []).some((answer) => !question.options.some((option) => option.label === answer)) ? " (added)" : ""}`}
                      onSelect={() =>
                        addCustomAnswer(
                          questionIndex(),
                          question.multiple === true,
                        )
                      }
                    />
                  </Show>
                </box>
              )}
            </For>
            <box flexDirection="row" gap={1}>
              <InlineAction
                label="Submit answers"
                onSelect={() => respondQuestion()}
              />
              <InlineAction
                label="Reject"
                onSelect={() => respondQuestion(true)}
              />
            </box>
          </Show>
          <Show when={resolved()}>
            <text fg={darkTheme.muted}>{props.block.text}</text>
          </Show>
        </box>
      </Show>
    </box>
  );
}
