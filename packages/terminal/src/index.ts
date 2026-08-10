/**
 * Terminal simulation surface.
 *
 * The xterm emulator line (XtermTerminalEmulator, TerminalRegistry,
 * PersistentTerminalRegistry, the screen diff/patch helpers and the external
 * launchers) is retired: no production code can create a session in
 * TerminalRegistry — `interactive_terminal_start` requires the native WezTerm
 * host unconditionally, the TUI human window goes through the native hub, and
 * the RPC surface for the line was removed with it. What remains is the
 * simulation model the fixture uses to drive TUI terminal rendering.
 */
export * from "./terminal-registry";
