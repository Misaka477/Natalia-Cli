import { SyntaxStyle, TextAttributes } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import {
  collapseToolOutput,
  parseTodoItems,
  stripAnsiOutput,
} from "@natalia/ui-model";
import type { MessageBlock } from "../../context/state";
import { themeTokens as darkTheme } from "../../theme/theme";
import { useRouteController } from "../../context/route";
import { useDialog } from "../../dialog/provider";
import {
  filetype,
  formatPrimitiveArgs,
  formatToolPath,
  parseExecuteCalls,
  parseQuestionAnswers,
  parseResultRecord,
  stringField,
  toolColor,
  toolIcon,
  toolInput,
  toolPath,
  toolRecord,
} from "./tool-utils";

export function markdownSyntax() {
  return SyntaxStyle.fromStyles({
    heading: { fg: darkTheme.accent, bold: true },
    strong: { bold: true },
    code: { fg: darkTheme.warning },
    link: { fg: darkTheme.accent, underline: true },
  });
}

export function ToolBlockView(props: {
  block: MessageBlock;
  toolDetails: "expanded" | "collapsed";
  diffStyle: "auto" | "stacked";
  terminalWidth: number;
  toolPreviewLines: number;
}) {
  if (props.block.tool?.kind === "shell")
    return (
      <ShellToolView
        block={props.block}
        toolDetails={props.toolDetails}
        terminalWidth={props.terminalWidth}
        previewLines={props.toolPreviewLines}
      />
    );
  if (["read", "write", "grep", "glob"].includes(props.block.tool?.kind ?? ""))
    return <FileToolView block={props.block} />;
  if (
    [
      "webfetch",
      "websearch",
      "subagent",
      "todo",
      "question",
      "skill",
      "execute",
    ].includes(props.block.tool?.kind ?? "")
  )
    return <InteractionToolView block={props.block} />;
  return (
    <FallbackToolBlock
      block={props.block}
      toolDetails={props.toolDetails}
      diffStyle={props.diffStyle}
      terminalWidth={props.terminalWidth}
    />
  );
}

/**
 * The fallback tool card. A diff or a failing call keeps its block — that is
 * the content worth reading. A completed, non-diff tool collapses to a single
 * line once the preference is "collapsed": a closed card is not a canvas for
 * more chrome, it is one line that reads as a fact.
 */
function FallbackToolBlock(props: {
  block: MessageBlock;
  toolDetails: "expanded" | "collapsed";
  diffStyle: "auto" | "stacked";
  terminalWidth: number;
}) {
  const dialog = useDialog();
  const tool = () => props.block.tool!;
  const [expanded, setExpanded] = createSignal(
    props.toolDetails === "expanded",
  );
  const [argumentsExpanded, setArgumentsExpanded] = createSignal(false);
  const [hover, setHover] = createSignal(false);
  const diff = () => tool().kind === "diff" && tool().result?.detail;
  const succeeded = () => tool().status === "succeeded";
  const openDetail = () => {
    const content = tool().result?.detail || tool().redactedArguments;
    if (!content) return;
    dialog.push(() => (
      <ToolDetailDialog
        title={`${tool().name} details`}
        content={content}
        argumentsRaw={
          tool().redactedArguments !== content
            ? tool().redactedArguments
            : undefined
        }
      />
    ));
  };
  // A completed, non-diff tool with details collapsed is one line, not a card.
  if (props.toolDetails === "collapsed" && succeeded() && !diff())
    return <CompactToolLine tool={tool()} onOpen={openDetail} />;

  const path = () => toolPath(tool().redactedArguments);
  const diffView = () =>
    props.diffStyle === "stacked" || props.terminalWidth <= 120
      ? "unified"
      : "split";
  const title = () => {
    const operation = tool().name === "apply_patch" ? "Patched" : "Edit";
    return `← ${operation}${path() ? ` ${path()}` : ""}`;
  };

  useBindings(() => ({
    mode: "base",
    enabled: () => hover() && !diff(),
    bindings: [
      {
        key: "a",
        desc: "Toggle tool arguments",
        group: "Tool",
        cmd: () => setArgumentsExpanded((value) => !value),
      },
      {
        key: "d",
        desc: "Open tool details",
        group: "Tool",
        cmd: openDetail,
      },
    ],
  }));

  return (
    <box
      flexDirection="column"
      border={["left"]}
      borderColor={darkTheme.background}
      backgroundColor={darkTheme.panel}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      marginTop={1}
      marginBottom={1}
      gap={1}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => {
        if (diff()) return;
        setExpanded((value) => !value);
      }}
    >
      <text paddingLeft={3} fg={darkTheme.muted}>
        {diff() ? title() : `${toolIcon(tool().kind)} ${tool().name}`}
        {tool().elapsed ? ` · ${tool().elapsed}` : ""}
      </text>
      <Show when={diff()}>
        {(content) => (
          <box paddingLeft={1}>
            <diff
              diff={content()}
              view={diffView()}
              filetype={filetype(path())}
              syntaxStyle={markdownSyntax()}
              showLineNumbers={true}
              width="100%"
              wrapMode="word"
              fg={darkTheme.text}
              addedBg={darkTheme.diffAddedBg}
              removedBg={darkTheme.diffRemovedBg}
              contextBg={darkTheme.diffContextBg}
              addedSignColor={darkTheme.diffHighlightAdded}
              removedSignColor={darkTheme.diffHighlightRemoved}
              lineNumberFg={darkTheme.diffLineNumber}
              lineNumberBg={darkTheme.diffContextBg}
              addedLineNumberBg={darkTheme.diffAddedLineNumberBg}
              removedLineNumberBg={darkTheme.diffRemovedLineNumberBg}
            />
          </box>
        )}
      </Show>
      <Show when={!diff()}>
        <Show when={!tool().result}>
          <text fg={darkTheme.text} wrapMode="word">
            {props.block.text}
          </text>
        </Show>
        <Show when={!tool().argumentsComplete}>
          <text fg={darkTheme.muted}>
            arguments pending; partial JSON hidden
          </text>
        </Show>
        <Show when={tool().argumentsComplete && tool().redactedArguments}>
          <text fg={darkTheme.muted} wrapMode="word">
            args: {tool().keyArguments.join(", ") || "{}"}
          </text>
          <Show when={argumentsExpanded()}>
            <text fg={darkTheme.text} wrapMode="word">
              {tool().redactedArguments}
            </text>
          </Show>
        </Show>
        <Show when={tool().result}>
          {(result) => (
            <Show when={tool().kind !== "diff"}>
              <Show
                when={expanded()}
                fallback={
                  <text fg={darkTheme.text} wrapMode="word">
                    {result().preview.split("\n").slice(0, 2).join("\n")}
                  </text>
                }
              >
                <text fg={darkTheme.text} wrapMode="word">
                  {result().detail}
                </text>
              </Show>
            </Show>
          )}
        </Show>
        <Show when={tool().status === "failed"}>
          <text fg={darkTheme.danger} wrapMode="word">
            {tool().result?.detail || tool().result?.preview || tool().summary}
          </text>
        </Show>
      </Show>
    </box>
  );
}

function CompactToolLine(props: {
  tool: NonNullable<MessageBlock["tool"]>;
  onOpen(): void;
}) {
  const tool = () => props.tool;
  const [hover, setHover] = createSignal(false);
  return (
    <box
      paddingLeft={3}
      marginTop={1}
      flexDirection="row"
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={props.onOpen}
    >
      <text width={2} fg={darkTheme.muted}>
        ✓
      </text>
      <text
        flexGrow={1}
        fg={hover() ? darkTheme.text : darkTheme.muted}
        wrapMode="word"
      >
        {toolIcon(tool().kind)} {tool().name}
        {tool().keyArguments.length ? ` ${tool().keyArguments.join(", ")}` : ""}
        {tool().elapsed ? ` · ${tool().elapsed}` : ""}
      </text>
    </box>
  );
}

function ToolDetailDialog(props: {
  title: string;
  content: string;
  argumentsRaw?: string;
}) {
  const dialog = useDialog();
  const [tab, setTab] = createSignal<"result" | "arguments">("result");
  return (
    <box
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingBottom={1}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
          {props.title}
        </text>
        <text fg={darkTheme.muted} onMouseUp={() => dialog.pop()}>
          esc
        </text>
      </box>
      <box flexDirection="row" gap={1} paddingTop={1} paddingBottom={1}>
        <text
          fg={tab() === "result" ? darkTheme.accent : darkTheme.muted}
          attributes={tab() === "result" ? TextAttributes.BOLD : undefined}
          onMouseUp={() => setTab("result")}
        >
          result
        </text>
        <Show when={props.argumentsRaw}>
          <text
            fg={tab() === "arguments" ? darkTheme.accent : darkTheme.muted}
            attributes={tab() === "arguments" ? TextAttributes.BOLD : undefined}
            onMouseUp={() => setTab("arguments")}
          >
            arguments
          </text>
        </Show>
      </box>
      <scrollbox
        maxHeight={18}
        border={["left"]}
        borderColor={darkTheme.muted}
        paddingLeft={1}
      >
        <Show when={tab() === "result"}>
          <text fg={darkTheme.text} wrapMode="word">
            {props.content}
          </text>
        </Show>
        <Show when={tab() === "arguments" && props.argumentsRaw}>
          <text fg={darkTheme.muted} wrapMode="word">
            {props.argumentsRaw}
          </text>
        </Show>
      </scrollbox>
      <text fg={darkTheme.muted}>↑↓ result/arguments tab · escape close</text>
    </box>
  );
}

function InteractionToolView(props: { block: MessageBlock }) {
  const route = useRouteController();
  const tool = () => props.block.tool!;
  const input = createMemo(() => toolRecord(tool().redactedArguments));
  const result = createMemo(() => parseResultRecord(tool().result?.detail));
  const running = () => tool().status === "running";

  if (tool().kind === "execute") {
    const calls = () => parseExecuteCalls(tool().metadata.toolCalls);
    const runtimeError = () => tool().metadata.error === true;
    return (
      <>
        <InlineToolRow
          icon={
            runtimeError() ? "✗" : tool().status === "succeeded" ? "✓" : "│"
          }
          pending="execute"
          complete={true}
          spinner={running()}
          tool={tool()}
        >
          execute
          <For each={calls()}>
            {(call) => (
              <>{`\n↳ ${call.tool}${formatPrimitiveArgs(call.input)}${call.status === "error" ? " (failed)" : ""}`}</>
            )}
          </For>
        </InlineToolRow>
        <Show when={runtimeError() && tool().result?.preview}>
          <text paddingLeft={6} fg={darkTheme.danger} wrapMode="word">
            ↳ {tool().result?.preview}
          </text>
        </Show>
      </>
    );
  }

  if (tool().kind === "webfetch")
    return (
      <InlineToolRow
        icon="%"
        pending="Fetching from the web..."
        complete={Boolean(stringField(input(), "url"))}
        spinner={running()}
        tool={tool()}
      >
        WebFetch {stringField(input(), "url")}
      </InlineToolRow>
    );

  if (tool().kind === "websearch")
    return (
      <InlineToolRow
        icon="◈"
        pending="Searching web..."
        complete={Boolean(stringField(input(), "query"))}
        spinner={running()}
        tool={tool()}
      >
        Web Search "{stringField(input(), "query")}"
      </InlineToolRow>
    );

  if (tool().kind === "subagent") {
    const task = () => stringField(input(), "task", "description");
    const mode = () => stringField(input(), "mode", "subagent_type") || "Agent";
    const record = () => result();
    return (
      <InlineToolRow
        icon={tool().status === "succeeded" ? "✓" : "│"}
        pending="Delegating..."
        complete={Boolean(task())}
        spinner={running()}
        tool={tool()}
        onClick={
          record().id
            ? () => route.push({ kind: "subagent", id: String(record().id) })
            : undefined
        }
      >
        {mode()} Task — {task()}
        <Show when={record().id || record().status}>
          {`\n↳ ${[record().id, record().status].filter(Boolean).join(" · ")}`}
        </Show>
      </InlineToolRow>
    );
  }

  if (tool().kind === "todo") {
    const todos = () =>
      parseTodoItems(input().items ?? result().items ?? result());
    if (todos().length)
      return (
        <ToolPanel title="# Todos" tool={tool()}>
          <box flexDirection="column">
            <For each={todos()}>
              {(todo) => (
                <box flexDirection="row">
                  <text
                    width={4}
                    fg={
                      todo.status === "in_progress"
                        ? darkTheme.warning
                        : darkTheme.muted
                    }
                  >
                    {todo.status === "completed"
                      ? "[✓]"
                      : todo.status === "in_progress"
                        ? "[•]"
                        : "[ ]"}
                  </text>
                  <text fg={darkTheme.text} wrapMode="word">
                    {todo.content}
                  </text>
                </box>
              )}
            </For>
          </box>
        </ToolPanel>
      );
    return (
      <InlineToolRow
        icon="⚙"
        pending="Updating todos..."
        complete={false}
        spinner={running()}
        tool={tool()}
      >
        Updating todos...
      </InlineToolRow>
    );
  }

  if (tool().kind === "question") {
    const question = () => stringField(input(), "question");
    const answers = () => parseQuestionAnswers(result().answers);
    if (answers().length)
      return (
        <ToolPanel title="# Questions" tool={tool()}>
          <box gap={1} flexDirection="column">
            <text fg={darkTheme.muted}>{question()}</text>
            <text fg={darkTheme.text}>
              {answers()[0]?.join(", ") || "(no answer)"}
            </text>
          </box>
        </ToolPanel>
      );
    return (
      <InlineToolRow
        icon="→"
        pending="Asking questions..."
        complete={Boolean(question())}
        spinner={running()}
        tool={tool()}
      >
        Asked 1 question
      </InlineToolRow>
    );
  }

  return (
    <InlineToolRow
      icon="→"
      pending="Loading skill..."
      complete={Boolean(stringField(input(), "name"))}
      spinner={running()}
      tool={tool()}
    >
      Skill "{stringField(input(), "name")}"
    </InlineToolRow>
  );
}

function FileToolView(props: { block: MessageBlock }) {
  const tool = () => props.block.tool!;
  const input = createMemo(() => toolRecord(tool().redactedArguments));
  const path = () => stringField(input(), "path", "filePath");
  const pattern = () => stringField(input(), "pattern");
  const running = () => tool().status === "running";
  const resultLines = () =>
    (tool().result?.detail ?? "")
      .split("\n")
      .filter((line) => line.trim().length > 0).length;

  if (
    tool().kind === "write" &&
    tool().result &&
    stringField(input(), "content")
  )
    return (
      <ToolPanel title={`# Wrote ${formatToolPath(path())}`} tool={tool()}>
        <line_number fg={darkTheme.muted} minWidth={3} paddingRight={1}>
          <code
            conceal={false}
            fg={darkTheme.text}
            filetype={filetype(path())}
            syntaxStyle={markdownSyntax()}
            content={stringField(input(), "content")}
          />
        </line_number>
      </ToolPanel>
    );

  if (tool().kind === "read")
    return (
      <InlineToolRow
        icon="→"
        pending="Reading file..."
        complete={Boolean(path())}
        spinner={running()}
        tool={tool()}
      >
        Read {formatToolPath(path())}
      </InlineToolRow>
    );

  if (tool().kind === "write")
    return (
      <InlineToolRow
        icon="←"
        pending="Preparing write..."
        complete={Boolean(path())}
        tool={tool()}
      >
        Write {formatToolPath(path())}
      </InlineToolRow>
    );

  if (tool().kind === "grep")
    return (
      <InlineToolRow
        icon="✱"
        pending="Searching content..."
        complete={Boolean(pattern())}
        spinner={running()}
        tool={tool()}
      >
        Grep "{pattern()}"
        <Show when={stringField(input(), "include")}>
          {` in ${stringField(input(), "include")}`}
        </Show>
        <Show when={tool().result}>
          {` (${resultLines()} ${resultLines() === 1 ? "match" : "matches"})`}
        </Show>
      </InlineToolRow>
    );

  return (
    <InlineToolRow
      icon="✱"
      pending="Finding files..."
      complete={Boolean(pattern())}
      spinner={running()}
      tool={tool()}
    >
      Glob "{pattern()}"
      <Show when={tool().result}>
        {` (${resultLines()} ${resultLines() === 1 ? "match" : "matches"})`}
      </Show>
    </InlineToolRow>
  );
}

function InlineToolRow(props: {
  icon: string;
  pending: string;
  complete: boolean;
  spinner?: boolean;
  tool: NonNullable<MessageBlock["tool"]>;
  children: unknown;
  onClick?: () => void;
}) {
  const [errorExpanded, setErrorExpanded] = createSignal(false);
  const failed = () =>
    props.tool.status === "failed" || props.tool.status === "cancelled";
  const denied = () => props.tool.status === "rejected";
  const permission = () => props.tool.status === "awaiting_approval";
  const color = () =>
    permission()
      ? darkTheme.warning
      : failed()
        ? darkTheme.danger
        : props.complete
          ? darkTheme.muted
          : darkTheme.text;
  return (
    <box
      paddingLeft={3}
      marginTop={1}
      flexDirection="column"
      onMouseUp={() => failed() && setErrorExpanded((value) => !value)}
    >
      <Show
        when={props.complete || failed() || denied()}
        fallback={
          props.spinner ? (
            <ShellSpinner command={props.pending} />
          ) : (
            <text fg={darkTheme.muted}>~ {props.pending}</text>
          )
        }
      >
        <box flexDirection="row" onMouseUp={props.onClick}>
          <text width={2} fg={color()}>
            {props.icon}
          </text>
          <text
            flexGrow={1}
            fg={color()}
            attributes={denied() ? TextAttributes.STRIKETHROUGH : undefined}
            wrapMode="word"
          >
            {props.children as never}
          </text>
        </box>
      </Show>
      <Show when={failed() && errorExpanded()}>
        <text paddingLeft={2} fg={darkTheme.danger} wrapMode="word">
          {props.tool.result?.detail || props.tool.summary}
        </text>
      </Show>
    </box>
  );
}

function ToolPanel(props: {
  title: string;
  tool: NonNullable<MessageBlock["tool"]>;
  children: unknown;
}) {
  const renderer = useRenderer();
  const [hover, setHover] = createSignal(false);
  const [errorExpanded, setErrorExpanded] = createSignal(false);
  const failed = () =>
    props.tool.status === "failed" || props.tool.status === "cancelled";
  const error = () =>
    props.tool.result?.detail ||
    props.tool.result?.preview ||
    props.tool.summary;
  return (
    <box
      border={["left"]}
      borderColor={darkTheme.background}
      backgroundColor={hover() ? darkTheme.background : darkTheme.panel}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      marginTop={1}
      gap={1}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => {
        if (renderer.getSelection()?.getSelectedText()) return;
        if (failed()) setErrorExpanded((value) => !value);
      }}
    >
      <text paddingLeft={3} fg={darkTheme.muted}>
        {props.title}
        {props.tool.elapsed ? ` · ${props.tool.elapsed}` : ""}
      </text>
      {props.children as never}
      <Show when={failed()}>
        <box flexDirection="column" gap={1}>
          <text fg={darkTheme.danger} wrapMode="word">
            {props.tool.summary}
          </text>
          <Show when={errorExpanded() && error() !== props.tool.summary}>
            <text fg={darkTheme.danger} wrapMode="word">
              {error()}
            </text>
          </Show>
        </box>
      </Show>
    </box>
  );
}

function ShellToolView(props: {
  block: MessageBlock;
  toolDetails: "expanded" | "collapsed";
  terminalWidth: number;
  previewLines: number;
}) {
  const renderer = useRenderer();
  const tool = () => props.block.tool!;
  const input = createMemo(() => toolInput(tool().redactedArguments));
  const output = createMemo(() =>
    stripAnsiOutput(tool().result?.detail ?? "").trim(),
  );
  const [expanded, setExpanded] = createSignal(false);
  const [hover, setHover] = createSignal(false);
  const collapsed = createMemo(() =>
    collapseToolOutput(
      output(),
      props.previewLines,
      props.previewLines * Math.max(20, props.terminalWidth - 6),
    ),
  );
  const visibleOutput = createMemo(() =>
    expanded() || !collapsed().overflow ? output() : collapsed().output,
  );
  const failed = () =>
    tool().status === "failed" ||
    tool().status === "rejected" ||
    tool().status === "cancelled";
  const running = () => tool().status === "running";
  const pending = () =>
    tool().status === "receiving_arguments" || tool().status === "queued";

  if (!tool().result)
    return (
      <box paddingLeft={3} marginTop={1} flexDirection="row">
        <text width={2} fg={failed() ? darkTheme.danger : darkTheme.muted}>
          {running() ? "│" : failed() ? "✗" : "$"}
        </text>
        <text
          flexGrow={1}
          fg={
            failed()
              ? darkTheme.danger
              : tool().status === "awaiting_approval"
                ? darkTheme.warning
                : pending()
                  ? darkTheme.text
                  : darkTheme.muted
          }
          attributes={
            tool().status === "rejected"
              ? TextAttributes.STRIKETHROUGH
              : undefined
          }
        >
          {input().command ||
            (pending() ? "Writing command..." : tool().summary)}
        </text>
      </box>
    );

  // A completed shell with details collapsed is one line; click opens the block.
  if (
    props.toolDetails === "collapsed" &&
    tool().status === "succeeded" &&
    !expanded()
  )
    return (
      <box
        paddingLeft={3}
        marginTop={1}
        flexDirection="row"
        onMouseOver={() => setHover(true)}
        onMouseOut={() => setHover(false)}
        onMouseUp={() => {
          if (renderer.getSelection()?.getSelectedText()) return;
          setExpanded(true);
        }}
      >
        <text width={2} fg={darkTheme.muted}>
          ✓
        </text>
        <text
          flexGrow={1}
          fg={hover() ? darkTheme.text : darkTheme.muted}
          wrapMode="word"
        >
          $ {input().command || tool().name}
          {tool().elapsed ? ` · ${tool().elapsed}` : ""}
        </text>
      </box>
    );

  return (
    <box
      border={["left"]}
      borderColor={darkTheme.background}
      backgroundColor={hover() ? darkTheme.background : darkTheme.panel}
      paddingTop={1}
      paddingBottom={1}
      paddingLeft={2}
      marginTop={1}
      gap={1}
      onMouseOver={() => collapsed().overflow && setHover(true)}
      onMouseOut={() => setHover(false)}
      onMouseUp={() => {
        if (renderer.getSelection()?.getSelectedText()) return;
        if (collapsed().overflow) setExpanded((value) => !value);
        else if (
          props.toolDetails === "collapsed" &&
          tool().status === "succeeded"
        )
          setExpanded(false);
      }}
    >
      <Show when={input().workdir && input().workdir !== "."}>
        <text paddingLeft={3} fg={darkTheme.muted}>
          # Running in {input().workdir}
        </text>
      </Show>
      <box gap={1}>
        <Show
          when={running()}
          fallback={
            <text fg={failed() ? darkTheme.danger : darkTheme.text}>
              $ {input().command || tool().name}
              {tool().elapsed ? ` · ${tool().elapsed}` : ""}
            </text>
          }
        >
          <ShellSpinner command={input().command || tool().name} />
        </Show>
        <Show when={output()}>
          <text
            fg={failed() ? darkTheme.danger : darkTheme.text}
            wrapMode="word"
          >
            {visibleOutput()}
          </text>
        </Show>
        <Show when={collapsed().overflow}>
          <text fg={darkTheme.muted}>
            {expanded() ? "Click to collapse" : "Click to expand"}
          </text>
        </Show>
      </box>
    </box>
  );
}

function ShellSpinner(props: { command: string }) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const [index, setIndex] = createSignal(0);
  createEffect(() => {
    const timer = setInterval(
      () => setIndex((value) => (value + 1) % frames.length),
      80,
    );
    onCleanup(() => clearInterval(timer));
  });
  return (
    <text fg={darkTheme.text}>
      {frames[index()]} {props.command}
    </text>
  );
}
