import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeEvent } from "@natalia/contracts";
import {
  NativeTerminalRegistry,
  createWezTermHost,
  reclaimStaleMuxRuntimeDirs,
  startNativeInputBroker,
  writeWezTermNativeDomainConfig,
  type NativeInputBroker,
} from "@natalia/native-terminal";

/**
 * The native terminal resource controller — cut of the resource controllers
 * split (mainline plan §15). It owns the `NativeTerminalRegistry` and the
 * input broker, and their lifecycle: the WezTerm host bootstrap, the
 * one-shot recovery when the mux server was killed or the runtime dirs were
 * deleted, and teardown. An externally provided registry (the host's own
 * `options.nativeTerminal`) is installed as-is and never rebuilt.
 *
 * Multi-session shape (plan §41.9): the registry is reached by accessor;
 * when sessions become per-session panes (TERM-M I3), only this module's
 * init changes.
 */
export function createTerminalController(input: {
  workspaceRoot: string;
  publish(event: RuntimeEvent): void;
  onPerformance(name: string, durationMs: number): void;
  runtimeID(): string;
  userRuntimeHome(): string | undefined;
  external?: NativeTerminalRegistry;
}) {
  let nativeTerminal: NativeTerminalRegistry | undefined = input.external;
  let nativeInputBroker: NativeInputBroker | undefined;

  function broker() {
    const runtimeHome = input.userRuntimeHome();
    const nativeRuntimeDir = runtimeHome
      ? join(runtimeHome, "natalia")
      : join(input.workspaceRoot, ".natalia", "native-input");
    const nativeMuxRuntimeDir = join(
      nativeRuntimeDir,
      "wezterm-runtime",
      input.runtimeID(),
    );
    const nativeMuxSocket = join(nativeMuxRuntimeDir, "wezterm", "sock");
    return { nativeRuntimeDir, nativeMuxRuntimeDir, nativeMuxSocket };
  }

  async function installRegistry(
    nativeRuntimeDir: string,
    nativeMuxRuntimeDir: string,
    nativeMuxSocket: string,
    nativeDomain: Awaited<ReturnType<typeof writeWezTermNativeDomainConfig>>,
  ) {
    nativeTerminal = new NativeTerminalRegistry(
      createWezTermHost({
        // The GUI, CLI, and mux server must share this socket. Otherwise
        // Open terminal can attach a real window to the user's unrelated
        // default mux while Natalia controls a different pane.
        environment: { WEZTERM_UNIX_SOCKET: nativeMuxSocket },
        muxRuntimeDir: nativeMuxRuntimeDir,
        nativeDomain,
        onPerformance: input.onPerformance,
      }),
      {
        onAudit: (event) => {
          input.publish({
            type: "terminal.action",
            id: event.id,
            action: event.action,
            redacted: event.redacted,
            target: { kind: "host", cwd: event.cwd },
          });
          input.publish({
            type: "terminal.timeline",
            id: event.id,
            actor: event.actor === "human" ? "user" : event.actor,
            action: event.action,
            status: "executed",
            summary:
              event.action === "write"
                ? "native terminal input accepted"
                : event.action === "secure_input"
                  ? "native terminal secure input state changed"
                  : `native terminal ${event.action} executed`,
            at: event.at,
          });
        },
        autoOpenHub: true,
        persistPath: join(nativeMuxRuntimeDir, "native-terminal-sessions.json"),
      },
    );
    nativeInputBroker = await startNativeInputBroker({
      registry: nativeTerminal,
      runtimeDir: nativeRuntimeDir,
      daemonID: randomUUID(),
      onInput: ({ terminalID, paneID, kind, byteLength }) => {
        const summary = `native human input claim accepted: terminal=${terminalID} pane=${paneID} kind=${kind} bytes=${byteLength}`;
        input.publish({
          type: "diagnostic",
          level: "info",
          message: summary,
        });
        input.publish({
          type: "terminal.timeline",
          id: terminalID,
          actor: "user",
          action: "write",
          status: "executed",
          summary,
          at: new Date().toISOString(),
        });
      },
      onDenied: ({ terminalID, paneID, tokenAccepted, paneAccepted }) =>
        input.publish({
          type: "diagnostic",
          level: "warning",
          message: `native input claim denied: terminal=${terminalID} pane=${paneID} token=${tokenAccepted} paneKnown=${paneAccepted}`,
        }),
    });
    nativeTerminal.setHumanInputBridge(nativeInputBroker);
  }

  async function init() {
    if (nativeTerminal) return;
    const { nativeRuntimeDir, nativeMuxRuntimeDir, nativeMuxSocket } = broker();
    let nativeDomain: Awaited<
      ReturnType<typeof writeWezTermNativeDomainConfig>
    >;
    try {
      await mkdir(nativeRuntimeDir, { recursive: true, mode: 0o700 });
      await mkdir(nativeMuxRuntimeDir, { recursive: true, mode: 0o700 });
      // Each runtime owns one of these directories and removes it on dispose,
      // so anything left from a runtime that was killed accumulates for as
      // long as the host stays up. Reclaiming is best effort and must not
      // delay or fail startup.
      void reclaimStaleMuxRuntimeDirs({
        root: join(nativeRuntimeDir, "wezterm-runtime"),
        keep: input.runtimeID(),
      }).catch(() => undefined);
      nativeDomain = await writeWezTermNativeDomainConfig({
        directory: nativeMuxRuntimeDir,
        socketPath: nativeMuxSocket,
      });
      await installRegistry(
        nativeRuntimeDir,
        nativeMuxRuntimeDir,
        nativeMuxSocket,
        nativeDomain,
      );
    } catch {
      // Native Terminal recovery: if the mux server was killed or runtime
      // dirs were deleted (e.g. by rm -rf), recreate dirs and retry once.
      input.publish({
        type: "diagnostic",
        level: "info",
        message: "native terminal first init failed; attempting recovery",
      });
      try {
        await mkdir(nativeRuntimeDir, { recursive: true, mode: 0o700 });
        await mkdir(nativeMuxRuntimeDir, { recursive: true, mode: 0o700 });
        nativeDomain = await writeWezTermNativeDomainConfig({
          directory: nativeMuxRuntimeDir,
          socketPath: nativeMuxSocket,
        });
        await installRegistry(
          nativeRuntimeDir,
          nativeMuxRuntimeDir,
          nativeMuxSocket,
          nativeDomain,
        );
      } catch {
        // Recovery failed; native terminal remains unavailable for this
        // session. Its canonical tools report an actionable error when
        // invoked.
      }
    }
  }

  /** The registry, or undefined when no native host is available. */
  function get(): NativeTerminalRegistry | undefined {
    return nativeTerminal;
  }

  async function close() {
    await nativeTerminal?.dispose();
    nativeTerminal = undefined;
    await nativeInputBroker?.stop();
    nativeInputBroker = undefined;
  }

  return { init, get, close };
}
