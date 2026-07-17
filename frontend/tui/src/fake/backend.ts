import { lineCount, makeDigest } from "../testing/data";
import type {
  FakeBackend,
  RuntimeEvent,
  SessionID,
  SubmittedTurn,
} from "./contract";

export function createFakeBackend(): FakeBackend {
  const sessionID: SessionID = "ses_m0_spike";
  let sink: ((event: RuntimeEvent) => void) | undefined;
  let activeTurn: string | undefined;
  let submission: SubmittedTurn | undefined;
  const publish = (event: RuntimeEvent) => sink?.(event);
  const checkActive = (id: string) => activeTurn === id;

  async function shortResponse(id: string) {
    publish({
      type: "status.update",
      status: "thinking",
      detail: "streaming fixture",
    });
    for (const chunk of [
      "分析输入完整性",
      "，准备展示工具占位",
      "，生成最终内容。",
    ]) {
      await Bun.sleep(15);
      if (!checkActive(id)) return;
      publish({ type: "thinking.delta", id, text: chunk });
    }
    publish({
      type: "tool.update",
      id,
      name: "fake_snapshot",
      status: "running",
      summary: "collecting workspace snapshot",
    });
    await Bun.sleep(15);
    publish({
      type: "approval.request",
      id: "apr_m0",
      title: "Approval placeholder",
      preview: "fake tool would inspect workspace state",
    });
    publish({
      type: "question.request",
      id: "q_m0",
      title: "Question placeholder",
      options: ["继续", "取消"],
    });
    publish({
      type: "tool.update",
      id,
      name: "fake_snapshot",
      status: "succeeded",
      summary: "snapshot fixture ready",
    });
    for (const chunk of [
      "收到 ",
      `${submission!.byteLength} bytes`,
      "，SHA-256 已验证，",
      "这是 final content。",
    ]) {
      publish({ type: "content.delta", id, text: chunk });
    }
  }

  async function longResponse(id: string) {
    publish({
      type: "status.update",
      status: "thinking",
      detail: "generating long test output",
    });
    const thinkingParas = [
      "正在分析输入内容的结构和语义特征。",
      "检测到测试指令，将生成包含多段思考、多次工具调用和大量最终内容的输出。",
      "第一步：识别输入中的关键信息点。",
      "第二步：按优先级排序需要处理的任务。",
      "第三步：构建处理策略和工具调用序列。",
      "第四步：验证各步骤的前置条件和依赖关系。",
      "第五步：整体方案确认，开始执行。",
    ];
    for (const para of thinkingParas) {
      if (!checkActive(id)) return;
      publish({ type: "thinking.delta", id, text: para + "\n\n" });
      await Bun.sleep(40);
    }

    for (let toolIndex = 0; toolIndex < 3; toolIndex++) {
      if (!checkActive(id)) return;
      const toolName = ["read_file", "grep_search", "list_directory"][
        toolIndex
      ];
      publish({
        type: "tool.update",
        id,
        name: toolName,
        status: "running",
        summary: `executing ${toolName} on workspace`,
      });
      await Bun.sleep(30);
      publish({
        type: "tool.update",
        id,
        name: toolName,
        status: "succeeded",
        summary: `${toolName} completed (${Math.floor(Math.random() * 50) + 10} results)`,
      });
      await Bun.sleep(20);
    }

    publish({
      type: "approval.request",
      id: "apr_long",
      title: "Approve batch file edit?",
      preview: "This would modify 3 files in the workspace.",
    });
    publish({
      type: "question.request",
      id: "q_long",
      title: "Select output format",
      options: ["plain text", "markdown", "json"],
    });

    publish({
      type: "status.update",
      status: "streaming",
      detail: "writing final output",
    });

    const line =
      "这是超长输出测试内容。OpenTUI 需要稳定处理持续流式内容，包含中文、English、emoji 🙂 和组合字符 e\u0301。";
    const paragraph = Array.from(
      { length: 20 },
      (_, i) => `第 ${i + 1} 段：${line}`,
    ).join("\n\n");
    const totalLines = 200;

    for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
      if (!checkActive(id)) return;
      const chunk = `[${lineIndex + 1}/${totalLines}] ${paragraph}\n\n`;
      publish({ type: "content.delta", id, text: chunk });
      if (lineIndex % 20 === 0) await Bun.sleep(15);
    }

    publish({
      type: "snapshot.created",
      id: "snap_long",
      files: [
        "frontend/tui/src",
        "frontend/tui/test",
        ".kilo/plans/execution/m00-terminal-spike.zh-CN.md",
      ],
    });

    publish({
      type: "status.update",
      status: "ready",
      detail: `long output test complete (~${totalLines} blocks)`,
    });
  }

  return {
    start(onEvent) {
      sink = onEvent;
      publish({
        type: "session.created",
        sessionID,
        title: "M0 OpenTUI spike",
      });
      publish({
        type: "status.update",
        status: "ready",
        detail: "fake backend connected",
      });
      publish({ type: "session.ready", sessionID });
    },
    async submit(text) {
      const id = `turn_${Date.now().toString(36)}`;
      activeTurn = id;
      submission = {
        type: "turn.submitted",
        id,
        text,
        byteLength: new TextEncoder().encode(text).byteLength,
        lineCount: lineCount(text),
        sha256: makeDigest(text),
      };
      publish(submission);
      if (text.trim().toLowerCase().startsWith("/long")) {
        await longResponse(id);
      } else {
        await shortResponse(id);
      }
      publish({
        type: "snapshot.created",
        id: "snap_m0",
        files: [
          "frontend/tui",
          ".kilo/plans/execution/m00-terminal-spike.zh-CN.md",
        ],
      });
      publish({
        type: "status.update",
        status: "ready",
        detail: "fake turn finished",
      });
      publish({ type: "turn.finished", id, stopReason: "done" });
      activeTurn = undefined;
      return submission;
    },
    cancel(reason = "user cancel") {
      if (!activeTurn) return;
      const id = activeTurn;
      activeTurn = undefined;
      publish({ type: "turn.cancelled", id, reason });
      publish({ type: "turn.finished", id, stopReason: "cancelled" });
      publish({ type: "status.update", status: "ready", detail: "cancelled" });
    },
    snapshot() {
      const event: RuntimeEvent = {
        type: "snapshot.created",
        id: `snap_${Date.now().toString(36)}`,
        files: ["frontend/tui/src", "frontend/tui/test"],
      };
      publish(event);
      return event;
    },
    lastSubmission() {
      return submission;
    },
  };
}
