import { For, Show } from "solid-js";
import type { SessionController } from "./session";
import type { AppState } from "@natalia/view-store";

export function PromptCards(props: {
  state: AppState;
  session: SessionController;
  rejecting?: string;
  rejectFeedback: string;
  onRejecting(id: string | undefined): void;
  onFeedback(value: string): void;
}) {
  return (
    <>
      <For each={props.state.pendingQuestions}>
        {(question) => (
          <div class="natalia-web__card">
            <h3>{question.title}</h3>
            <div class="natalia-web__actions">
              <button
                type="button"
                onClick={() =>
                  void props.session.answerQuestion(question.id, [["continue"]])
                }
              >
                Continue
              </button>
              <button
                type="button"
                data-kind="reject"
                onClick={() =>
                  void props.session.answerQuestion(question.id, [], true)
                }
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </For>
      <For each={props.state.pendingApprovals}>
        {(approval) => (
          <div class="natalia-web__card">
            <h3>{approval.title}</h3>
            <p>{approval.preview}</p>
            <Show when={props.rejecting === approval.id}>
              <input
                value={props.rejectFeedback}
                placeholder="Optional reject feedback"
                onInput={(event) => props.onFeedback(event.currentTarget.value)}
              />
            </Show>
            <div class="natalia-web__actions">
              <button
                type="button"
                onClick={() => void props.session.approve(approval.id, "once")}
              >
                Allow once
              </button>
              <button
                type="button"
                data-kind="ghost"
                onClick={() =>
                  void props.session.approve(approval.id, "session")
                }
              >
                Allow for session
              </button>
              <Show
                when={props.rejecting === approval.id}
                fallback={
                  <button
                    type="button"
                    data-kind="reject"
                    onClick={() => props.onRejecting(approval.id)}
                  >
                    Reject
                  </button>
                }
              >
                <button
                  type="button"
                  data-kind="reject"
                  onClick={() => {
                    void props.session.approve(
                      approval.id,
                      "reject",
                      props.rejectFeedback || undefined,
                    );
                    props.onRejecting(undefined);
                    props.onFeedback("");
                  }}
                >
                  Confirm reject
                </button>
              </Show>
            </div>
          </div>
        )}
      </For>
    </>
  );
}
