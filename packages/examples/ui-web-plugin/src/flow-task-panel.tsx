import { createSignal, Show, onCleanup, onMount, For } from "solid-js";

type FlowModule = {
  id: string;
  type: string;
  displayName: string;
  enabled: boolean;
  instructions: string;
  minimumConditions: string[];
  idealConditions: string[];
  commandMode: "none" | "blacklist" | "whitelist";
  commandRules: string[];
};

type Flow = {
  flowID: string;
  displayName: string;
  permissionProfile: string;
  directRunProfile?: string;
  usedBy: string[];
  modules: FlowModule[];
};

type Task = {
  taskID: string;
  displayName: string;
  schedule: string;
  prompt: string;
  permissionProfile: string;
  flowID: string;
  retry: string;
  alerts: string[];
};

const moduleTypes = [
  "read_search",
  "terminal",
  "shell_command",
  "workspace_changes",
  "web_fetch",
  "skills",
  "mcp",
  "plugins",
  "subagents",
  "report_output",
];

const initialFlows: Flow[] = [
  {
    flowID: "code-review-flow",
    displayName: "代码审查",
    permissionProfile: "default",
    directRunProfile: "default",
    usedBy: ["release-checklist"],
    modules: [
      { id: "m1", type: "read_search", displayName: "搜索上下文", enabled: true, instructions: "读取变更文件并理解上下文", minimumConditions: [], idealConditions: [], commandMode: "none", commandRules: [] },
      { id: "m2", type: "terminal", displayName: "运行检查", enabled: true, instructions: "运行 tsc 和测试", minimumConditions: [], idealConditions: [], commandMode: "whitelist", commandRules: ["bun install", "bun test"] },
      { id: "m3", type: "report_output", displayName: "生成报告", enabled: true, instructions: "输出审查结论", minimumConditions: [], idealConditions: [], commandMode: "none", commandRules: [] },
    ],
  },
  {
    flowID: "rollback-verify",
    displayName: "回滚验证",
    permissionProfile: "default",
    directRunProfile: "read_only",
    usedBy: [],
    modules: [
      { id: "r1", type: "workspace_changes", displayName: "检查变更", enabled: true, instructions: "检查 checkpoint 状态", minimumConditions: ["存在 checkpoint"], idealConditions: [], commandMode: "none", commandRules: [] },
      { id: "r2", type: "shell_command", displayName: "验证回滚", enabled: true, instructions: "执行回滚验证命令", minimumConditions: [], idealConditions: [], commandMode: "blacklist", commandRules: ["rm -rf /", "git push --force"] },
    ],
  },
];

const initialTasks: Task[] = [
  {
    taskID: "release-checklist",
    displayName: "发布检查",
    schedule: "0 9 * * 1",
    prompt: "执行发布前检查清单",
    permissionProfile: "default",
    flowID: "code-review-flow",
    retry: "once",
    alerts: ["blocked_by_policy", "ultimately_failed"],
  },
  {
    taskID: "daily-triage",
    displayName: "每日日志分诊",
    schedule: "0 8 * * *",
    prompt: "分析昨天的运行日志并汇总问题",
    permissionProfile: "read_only",
    flowID: "rollback-verify",
    retry: "twice",
    alerts: ["task_started", "succeeded"],
  },
];

export function FlowTaskPanel(props: {
  open: boolean;
  onClose: () => void;
  onSaveFlow?: (flow: Flow) => unknown;
  onDeleteFlow?: (flowID: string) => unknown;
  onSaveTask?: (task: Task) => unknown;
  onDeleteTask?: (taskID: string) => unknown;
}) {
  const [tab, setTab] = createSignal<"flows" | "tasks">("flows");
  const [flows, setFlows] = createSignal<Flow[]>(initialFlows.map((flow) => ({ ...flow, modules: flow.modules.map((mod) => ({ ...mod })) })));
  const [taskRows, setTaskRows] = createSignal<Task[]>(
    initialTasks.map((task) => ({ ...task })),
  );
  const [showTaskForm, setShowTaskForm] = createSignal(false);
  const [newTaskID, setNewTaskID] = createSignal("");
  const [newTaskName, setNewTaskName] = createSignal("");
  const [newTaskSchedule, setNewTaskSchedule] = createSignal("");
  const [newTaskPrompt, setNewTaskPrompt] = createSignal("");
  const [newTaskProfile, setNewTaskProfile] = createSignal("default");
  const [newTaskFlow, setNewTaskFlow] = createSignal("");
  const [newTaskRetry, setNewTaskRetry] = createSignal("none");
  const [selectedFlow, setSelectedFlow] = createSignal<Flow | null>(null);
  const [selectedTask, setSelectedTask] = createSignal<Task | null>(null);
  const [editingModule, setEditingModule] = createSignal<FlowModule | null>(null);
  const [flowName, setFlowName] = createSignal("");
  const [permissionProfile, setPermissionProfile] = createSignal("default");
  const [moduleType, setModuleType] = createSignal("read_search");
  const [moduleName, setModuleName] = createSignal("");
  const [moduleInstructions, setModuleInstructions] = createSignal("");
  const [minimumConditions, setMinimumConditions] = createSignal("");
  const [idealConditions, setIdealConditions] = createSignal("");
  const [commandMode, setCommandMode] = createSignal<"none" | "blacklist" | "whitelist">("none");
  const [commandRules, setCommandRules] = createSignal("");
  const [showPermissionPreview, setShowPermissionPreview] = createSignal(false);
  const [directRunProfile, setDirectRunProfile] = createSignal("");

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => window.removeEventListener("keydown", handleKeydown));
  });

  function openFlow(flow: Flow) {
    setSelectedFlow(flow);
    setFlowName(flow.displayName);
    setPermissionProfile(flow.permissionProfile);
    setDirectRunProfile(flow.directRunProfile ?? "");
    setShowPermissionPreview(false);
  }

  function saveFlow() {
    if (!selectedFlow()) return;
    const flow = selectedFlow();
    if (!flow) return;
    const nextFlow: Flow = {
      ...flow,
      displayName: flowName().trim() || flow.displayName,
      permissionProfile: permissionProfile(),
      modules: flow.modules,
    };
    setFlows((prev) =>
      prev.map((entry) =>
        entry.flowID === nextFlow.flowID ? nextFlow : entry,
      ),
    );
    props.onSaveFlow?.(nextFlow);
    setSelectedFlow(null);
  }

  function deleteFlow() {
    if (!selectedFlow()) return;
    const flowID = selectedFlow()?.flowID;
    if (flowID) props.onDeleteFlow?.(flowID);
    setFlows((prev) => prev.filter((flow) => flow.flowID !== flowID));
    setSelectedFlow(null);
  }

  function saveNewTask() {
    const taskID = newTaskID().trim();
    if (!taskID || !newTaskName().trim() || !newTaskPrompt().trim()) return;
    const task: Task = {
      taskID,
      displayName: newTaskName().trim(),
      schedule: newTaskSchedule().trim() || "0 9 * * *",
      prompt: newTaskPrompt().trim(),
      permissionProfile: newTaskProfile(),
      flowID: newTaskFlow().trim() || "code-review-flow",
      retry: newTaskRetry(),
      alerts: [],
    };
    setTaskRows((prev) => [task, ...prev]);
    props.onSaveTask?.(task);
    setShowTaskForm(false);
    setNewTaskID("");
    setNewTaskName("");
    setNewTaskSchedule("");
    setNewTaskPrompt("");
    setNewTaskProfile("default");
    setNewTaskFlow("");
    setNewTaskRetry("none");
  }

  function startAddModule() {
    setEditingModule({ id: `m${Date.now()}`, type: "read_search", displayName: "", enabled: true, instructions: "", minimumConditions: [], idealConditions: [], commandMode: "none", commandRules: [] });
    setModuleType("read_search");
    setModuleName("");
    setModuleInstructions("");
    setMinimumConditions("");
    setIdealConditions("");
    setCommandMode("none");
    setCommandRules("");
  }

  function saveModule() {
    if (!editingModule() || !moduleName().trim()) return;
    const module: FlowModule = {
      ...editingModule()!,
      displayName: moduleName().trim(),
      type: moduleType(),
      instructions: moduleInstructions().trim(),
      minimumConditions: minimumConditions().split("\n").map((line) => line.trim()).filter(Boolean),
      idealConditions: idealConditions().split("\n").map((line) => line.trim()).filter(Boolean),
      commandMode: commandMode(),
      commandRules: commandRules().split("\n").map((line) => line.trim()).filter(Boolean),
    };
    setSelectedFlow((flow) => {
      if (!flow) return flow;
      const exists = flow.modules.some((mod) => mod.id === module.id);
      return {
        ...flow,
        modules: exists
          ? flow.modules.map((mod) => (mod.id === module.id ? module : mod))
          : [...flow.modules, module],
      };
    });
    setEditingModule(null);
  }

  return (
    <Show when={props.open}>
      <div class="neu-settings-backdrop" onClick={props.onClose}>
        <div class="neu-flow-window" onClick={(event) => event.stopPropagation()}>
          <div class="neu-settings-header">
            <span class="neu-settings-title">Flow / Task</span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭 Flow / Task"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
          <div class="neu-flow-tabs">
            <button
              type="button"
              class="neu-settings-category"
              data-active={tab() === "flows"}
              onClick={() => { setTab("flows"); setSelectedFlow(null); setSelectedTask(null); }}
            >
              Flows
            </button>
            <button
              type="button"
              class="neu-settings-category"
              data-active={tab() === "tasks"}
              onClick={() => { setTab("tasks"); setSelectedFlow(null); setSelectedTask(null); }}
            >
              Tasks
            </button>
          </div>
          <div class="neu-flow-content">
            <Show when={tab() === "flows" && !selectedFlow()}>
              <For each={flows()}>
                {(flow) => (
                  <button type="button" class="neu-flow-card" onClick={() => openFlow(flow)}>
                    <span class="neu-flow-card-title">{flow.displayName}</span>
                    <span class="neu-flow-card-id">{flow.flowID}</span>
                    <span class="neu-flow-card-meta">
                      {flow.modules.filter((mod) => mod.enabled).length}/{flow.modules.length} stages
                      {flow.usedBy.length ? ` · used by ${flow.usedBy.join(", ")}` : ""}
                    </span>
                  </button>
                )}
              </For>
              <div class="neu-extension-actions">
                <button type="button" class="neu-extension-add">新建 Flow</button>
              </div>
            </Show>

            <Show when={tab() === "flows" && selectedFlow() && !editingModule()}>
              <button type="button" class="neu-flow-back" onClick={() => setSelectedFlow(null)}>← 返回</button>
              <div class="neu-form-field">
                <label class="neu-form-label">Flow 名称</label>
                <input class="neu-form-input" value={flowName()} onInput={(event) => setFlowName(event.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Permission Profile</label>
                <input class="neu-form-input" value={permissionProfile()} onInput={(event) => setPermissionProfile(event.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Direct Run Profile</label>
                <input class="neu-form-input" value={directRunProfile()} placeholder="例如 default / read_only / 留空" onInput={(event) => setDirectRunProfile(event.currentTarget.value)} />
              </div>
              <button type="button" class="neu-extension-btn" onClick={() => setShowPermissionPreview((value) => !value)}>
                Permission Preview
              </button>
              <Show when={showPermissionPreview()}>
                <div class="neu-flow-preview">
                  <div class="neu-flow-preview-title">Permission Preview</div>
                  <div class="neu-flow-detail-field">permissionProfile：{permissionProfile()}</div>
                  <div class="neu-flow-detail-field">directRunProfile：{directRunProfile() || "未启用"}</div>
                  <div class="neu-flow-detail-field">modules：{selectedFlow()?.modules.length ?? 0} 个</div>
                </div>
              </Show>
              <div class="neu-flow-section-title">Problems</div>
              <div class="neu-flow-problems">
                <Show
                  when={(selectedFlow()?.modules ?? []).some((mod) => !mod.instructions.trim())}
                  fallback={<div class="neu-flow-problem">未发现问题</div>}
                >
                  <div class="neu-flow-problem">部分模块缺少 instructions</div>
                </Show>
              </div>
              <div class="neu-flow-section-title">Modules</div>
              <For each={selectedFlow()?.modules ?? []}>
                {(module) => (
                  <div class="neu-flow-module">
                    <div class="neu-flow-module-head">
                      <span class="neu-flow-module-name">{module.displayName}</span>
                      <span class="neu-flow-module-type">{module.type}</span>
                      <button
                        type="button"
                        class="neu-extension-btn"
                        onClick={() => {
                          setEditingModule(module);
                          setModuleType(module.type);
                          setModuleName(module.displayName);
                          setModuleInstructions(module.instructions);
                          setMinimumConditions(module.minimumConditions.join("\n"));
                          setIdealConditions(module.idealConditions.join("\n"));
                          setCommandMode(module.commandMode);
                          setCommandRules(module.commandRules.join("\n"));
                        }}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        class="neu-extension-btn neu-extension-remove"
                        onClick={() =>
                          setSelectedFlow((flow) =>
                            flow
                              ? { ...flow, modules: flow.modules.filter((mod) => mod.id !== module.id) }
                              : flow,
                          )
                        }
                      >
                        删除
                      </button>
                    </div>
                    <div class="neu-flow-module-instructions">{module.instructions}</div>
                  </div>
                )}
              </For>
              <button type="button" class="neu-extension-add neu-extension-add-full" onClick={startAddModule}>+ 添加 Module</button>
              <div class="neu-form-actions">
                <button type="button" class="neu-form-btn neu-form-cancel" onClick={() => setSelectedFlow(null)}>取消</button>
                <button type="button" class="neu-form-btn neu-form-primary" onClick={saveFlow}>保存 Flow</button>
                <button type="button" class="neu-form-btn neu-form-cancel" onClick={deleteFlow}>删除</button>
              </div>
            </Show>

            <Show when={tab() === "flows" && selectedFlow() && editingModule()}>
              <button type="button" class="neu-flow-back" onClick={() => setEditingModule(null)}>← 返回模块</button>
              <div class="neu-form-field">
                <label class="neu-form-label">Module 类型</label>
                <select class="neu-form-input neu-form-select" value={moduleType()} onChange={(event) => setModuleType(event.currentTarget.value)}>
                  <For each={moduleTypes}>{(type) => <option value={type}>{type}</option>}</For>
                </select>
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">显示名称</label>
                <input class="neu-form-input" value={moduleName()} placeholder="模块名称" onInput={(event) => setModuleName(event.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Instructions</label>
                <textarea class="neu-form-input neu-stash-textarea" value={moduleInstructions()} onInput={(event) => setModuleInstructions(event.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Minimum Conditions（每行一个）</label>
                <textarea class="neu-form-input neu-stash-textarea" value={minimumConditions()} onInput={(event) => setMinimumConditions(event.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Ideal Conditions（每行一个）</label>
                <textarea class="neu-form-input neu-stash-textarea" value={idealConditions()} onInput={(event) => setIdealConditions(event.currentTarget.value)} />
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Command Rules Mode</label>
                <select class="neu-form-input neu-form-select" value={commandMode()} onChange={(event) => setCommandMode(event.currentTarget.value as "none" | "blacklist" | "whitelist")}>
                  <option value="none">none</option>
                  <option value="blacklist">blacklist</option>
                  <option value="whitelist">whitelist</option>
                </select>
              </div>
              <div class="neu-form-field">
                <label class="neu-form-label">Command Rules（每行一个命令）</label>
                <textarea class="neu-form-input neu-stash-textarea" value={commandRules()} onInput={(event) => setCommandRules(event.currentTarget.value)} />
              </div>
              <div class="neu-form-actions">
                <button type="button" class="neu-form-btn neu-form-cancel" onClick={() => setEditingModule(null)}>取消</button>
                <button type="button" class="neu-form-btn neu-form-primary" onClick={saveModule}>保存 Module</button>
              </div>
            </Show>

            <Show when={tab() === "tasks" && !selectedTask()}>
              <For each={taskRows()}>
                {(task) => (
                  <button type="button" class="neu-flow-card" onClick={() => setSelectedTask(task)}>
                    <span class="neu-flow-card-title">{task.displayName}</span>
                    <span class="neu-flow-card-id">{task.taskID}</span>
                    <span class="neu-flow-card-meta">{task.schedule} · retry {task.retry}</span>
                  </button>
                )}
              </For>
              <Show when={showTaskForm()}>
                <div class="neu-form">
                  <div class="neu-form-field">
                    <label class="neu-form-label">Task ID</label>
                    <input class="neu-form-input" value={newTaskID()} onInput={(event) => setNewTaskID(event.currentTarget.value)} />
                  </div>
                  <div class="neu-form-field">
                    <label class="neu-form-label">显示名称</label>
                    <input class="neu-form-input" value={newTaskName()} onInput={(event) => setNewTaskName(event.currentTarget.value)} />
                  </div>
                  <div class="neu-form-field">
                    <label class="neu-form-label">Schedule</label>
                    <input class="neu-form-input" value={newTaskSchedule()} placeholder="0 9 * * *" onInput={(event) => setNewTaskSchedule(event.currentTarget.value)} />
                  </div>
                  <div class="neu-form-field">
                    <label class="neu-form-label">Prompt</label>
                    <textarea class="neu-form-input neu-stash-textarea" value={newTaskPrompt()} onInput={(event) => setNewTaskPrompt(event.currentTarget.value)} />
                  </div>
                  <div class="neu-form-field">
                    <label class="neu-form-label">Permission Profile</label>
                    <input class="neu-form-input" value={newTaskProfile()} onInput={(event) => setNewTaskProfile(event.currentTarget.value)} />
                  </div>
                  <div class="neu-form-field">
                    <label class="neu-form-label">Flow ID</label>
                    <input class="neu-form-input" value={newTaskFlow()} onInput={(event) => setNewTaskFlow(event.currentTarget.value)} />
                  </div>
                  <div class="neu-form-field">
                    <label class="neu-form-label">Retry</label>
                    <select class="neu-form-input neu-form-select" value={newTaskRetry()} onChange={(event) => setNewTaskRetry(event.currentTarget.value)}>
                      <option value="none">none</option>
                      <option value="once">once</option>
                      <option value="twice">twice</option>
                      <option value="three_times">three_times</option>
                    </select>
                  </div>
                  <div class="neu-form-actions">
                    <button type="button" class="neu-form-btn neu-form-cancel" onClick={() => setShowTaskForm(false)}>取消</button>
                    <button type="button" class="neu-form-btn neu-form-primary" onClick={saveNewTask}>保存 Task</button>
                  </div>
                </div>
              </Show>
              <div class="neu-extension-actions">
                <button type="button" class="neu-extension-add" onClick={() => setShowTaskForm((value) => !value)}>新建 Task</button>
              </div>
            </Show>
            <Show when={tab() === "tasks" && selectedTask()}>
              <button type="button" class="neu-flow-back" onClick={() => setSelectedTask(null)}>← 返回</button>
              <div class="neu-flow-detail-title">{selectedTask()?.displayName}</div>
              <div class="neu-flow-detail-id">{selectedTask()?.taskID}</div>
              <div class="neu-flow-detail-field">schedule：{selectedTask()?.schedule}</div>
              <div class="neu-flow-detail-field">permissionProfile：{selectedTask()?.permissionProfile}</div>
              <div class="neu-flow-detail-field">flow：{selectedTask()?.flowID}</div>
              <div class="neu-flow-detail-field">retry：{selectedTask()?.retry}</div>
              <div class="neu-flow-detail-field">alerts：{selectedTask()?.alerts.join(", ")}</div>
              <div class="neu-flow-prompt">{selectedTask()?.prompt}</div>
              <div class="neu-form-actions">
                <button
                  type="button"
                  class="neu-form-btn neu-form-cancel"
                  onClick={() => {
                    const task = selectedTask();
                    if (task) {
                      props.onDeleteTask?.(task.taskID);
                      setTaskRows((prev) => prev.filter((entry) => entry.taskID !== task.taskID));
                    }
                    setSelectedTask(null);
                  }}
                >
                  删除 Task
                </button>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
