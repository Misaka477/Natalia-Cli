import { EGRESS_ADVISORY } from "@natalia/client";
import { createRecordedFetch, readCassette } from "@natalia/transport";
import {
  deleteLocalSession,
  duplicateLocalSession,
  exportLocalSessionMetadata,
  importLocalSessionMetadata,
  doctorReport,
  listLocalSessions,
  plainStatus,
  renameLocalSession,
  setLocalSessionPinned,
  sessionTable,
  trustList,
  trustRemove,
  workspaceFilesystemCommand,
  showLocalSession,
  startupDiagnostics,
  localWorkGraph,
  workGraphLines,
} from "./index";
import { valueAfter } from "./command-helpers";
import { captureDebugBundle } from "./debug-bundle";
import { createInterface } from "node:readline/promises";
import {
  exportStores,
  listPurgeTargets,
  nataliaHome,
  purgeConfirmation,
  purgeData,
  resolvePurgeGate,
  uninstallProgram,
} from "./store-maintenance";

export async function handleLocalCommands(argv: string[]) {
  const subcommand = argv[0];
  if (
    !new Set([
      "diagnose",
      "--diagnostics",
      "status",
      "workgraph",
      "doctor",
      "session",
      "fs",
      "trust",
      "replay",
      "uninstall",
      "purge",
      "store",
      "debug-bundle",
    ]).has(subcommand ?? "")
  )
    return false;
  const configPath =
    process.env.NATALIA_CONFIG ?? `${process.cwd()}/.natalia/config.json`;
  switch (subcommand) {
    case "uninstall": {
      // The app-level uninstall takes NO arguments — and the dead
      // `uninstall <tool> --workspace` form must fail before anything
      // touches the filesystem (a CLI test asserts that exit, and an
      // argument-bearing call here would otherwise operate on the real
      // home while "succeeding").
      if (argv.slice(1).filter((arg) => !arg.startsWith("-")).length > 0) {
        console.error(
          "usage: natalia uninstall (the old top-level `uninstall <tool>` form is gone)",
        );
        process.exit(1);
      }
      // Study §5: uninstall removes the PROGRAM and states where the
      // rescue ring stays. Nothing under stores/ is opened for deletion.
      const home = nataliaHome();
      const report = await uninstallProgram(home);
      for (const entry of report.removed) console.log(`removed ${entry}/`);
      if (!report.programPresent)
        console.log(`no program files under ${home} (bin/, versions/)`);
      console.log(report.message);
      break;
    }
    case "purge": {
      // 火化要明确: the full list prints BEFORE any confirmation.
      const home = nataliaHome();
      const targets = await listPurgeTargets(home);
      console.log(JSON.stringify({ willDelete: targets }, null, 2));
      const gate = resolvePurgeGate({
        yes: argv.includes("--yes"),
        isTTY: Boolean(process.stdin.isTTY),
      });
      if (gate.ask) {
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const answer = await rl.question('type "purge" to confirm: ');
        rl.close();
        if (!purgeConfirmation(answer)) {
          console.error("purge cancelled — nothing was deleted");
          process.exit(1);
        }
      } else if (!gate.proceed) {
        console.error(gate.reason);
        process.exit(1);
      }
      const { removed } = await purgeData(home);
      console.log(`purged: ${removed.join(", ") || "(nothing present)"}`);
      console.log(
        "the program is not this command's business — run natalia uninstall for bin/ and versions/",
      );
      break;
    }
    case "debug-bundle": {
      // One-key capture (decisions §5): journal slice + operational log +
      // redacted configs + doctor + a queried recents summary, inventoried
      // with SHA256SUMS. Usage: natalia debug-bundle <dest-dir> [--workspace]
      const dest = argv.filter((arg) => !arg.startsWith("--"))[1];
      if (!dest) {
        console.error(
          "usage: natalia debug-bundle <dest-dir> [--workspace <root>]",
        );
        process.exit(1);
      }
      try {
        const report = await captureDebugBundle({
          workspaceRoot: valueAfter(argv, "--workspace") ?? process.cwd(),
          dest,
        });
        console.log(JSON.stringify(report, null, 2));
        console.log(
          `debug bundle at ${report.dest} — journal + logs + config (redacted)`,
        );
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
      break;
    }
    case "store": {
      const action = argv[1];
      if (action === "export" && argv[2]) {
        try {
          const report = await exportStores(nataliaHome(), argv[2]);
          console.log(JSON.stringify(report, null, 2));
        } catch (error) {
          console.error(error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
        break;
      }
      console.error("usage: natalia store export <dest-dir>");
      process.exit(1);
    }
    case "diagnose":
    case "--diagnostics": {
      console.log(
        JSON.stringify(await startupDiagnostics(configPath), null, 2),
      );
      break;
    }

    case "status": {
      console.log(JSON.stringify(await plainStatus(configPath), null, 2));
      break;
    }

    case "workgraph": {
      const action = argv[1] ?? "list";
      const sessionID = argv[2];
      if (action !== "list" || !sessionID)
        throw new Error("workgraph list requires a session ID");
      const graph = await localWorkGraph(
        sessionID,
        valueAfter(argv, "--workspace") ?? process.cwd(),
      );
      console.log(
        argv.includes("--json")
          ? JSON.stringify(graph, null, 2)
          : workGraphLines(graph).join("\n"),
      );
      break;
    }

    case "doctor": {
      const report = await doctorReport({
        configPath,
        workspaceRoot: valueAfter(argv, "--workspace"),
      });
      console.log(
        argv.includes("--json")
          ? JSON.stringify(report, null, 2)
          : [
              `config: ${report.configPath}`,
              `migration: ${report.migration}`,
              `default model: ${report.defaultModel.key} (${report.defaultModel.selected ? "selected" : (report.defaultModel.reason ?? "unavailable")})`,
              `sessions: ${report.sessions.count} (${report.sessions.pendingInputs} pending inputs)`,
              EGRESS_ADVISORY,
            ].join("\n"),
      );
      break;
    }

    case "session": {
      const action = argv[1] ?? "list";
      const workspaceRoot = valueAfter(argv, "--workspace");
      if (action === "list") {
        const sessions = await listLocalSessions(workspaceRoot);
        console.log(
          argv.includes("--json")
            ? JSON.stringify(sessions, null, 2)
            : sessionTable(sessions),
        );
        break;
      }
      if (action === "delete") {
        const id = argv[2];
        if (!id) throw new Error("session delete requires an ID");
        console.log(
          JSON.stringify(await deleteLocalSession(id, workspaceRoot), null, 2),
        );
        break;
      }
      if (action === "show") {
        const id = argv[2];
        if (!id) throw new Error("session show requires an ID");
        const result = await showLocalSession(id, workspaceRoot);
        console.log(
          argv.includes("--json")
            ? JSON.stringify(result, null, 2)
            : [
                `id: ${result.id}`,
                `title: ${result.title}`,
                `events: ${result.events}`,
                `pending inputs: ${result.pendingInputs}`,
                `pinned: ${result.pinned ? "yes" : "no"}`,
                `resumable: ${result.resumable ? "yes" : "no"}`,
              ].join("\n"),
        );
        break;
      }
      if (action === "rename") {
        const id = argv[2];
        const workspaceIndex = argv.indexOf("--workspace");
        const title = argv
          .slice(3, workspaceIndex >= 0 ? workspaceIndex : undefined)
          .join(" ");
        if (!id || !title)
          throw new Error("session rename requires an ID and title");
        console.log(
          JSON.stringify(
            await renameLocalSession(id, title, workspaceRoot),
            null,
            2,
          ),
        );
        break;
      }
      if (action === "pin" || action === "unpin") {
        const id = argv[2];
        if (!id) throw new Error(`session ${action} requires an ID`);
        console.log(
          JSON.stringify(
            await setLocalSessionPinned(id, action === "pin", workspaceRoot),
            null,
            2,
          ),
        );
        break;
      }
      if (action === "duplicate") {
        const id = argv[2];
        if (!id) throw new Error("session duplicate requires an ID");
        console.log(
          JSON.stringify(
            await duplicateLocalSession(id, {
              title: valueAfter(argv, "--title"),
              newID: valueAfter(argv, "--id"),
              workspaceRoot,
            }),
            null,
            2,
          ),
        );
        break;
      }
      if (action === "export") {
        const id = argv[2];
        if (!id) throw new Error("session export requires an ID");
        console.log(
          JSON.stringify(
            await exportLocalSessionMetadata(id, workspaceRoot),
            null,
            2,
          ),
        );
        break;
      }
      if (action === "import") {
        const raw = argv[2];
        if (!raw)
          throw new Error("session import requires a metadata JSON value");
        const bundle = JSON.parse(
          raw,
        ) as import("./index").SessionMetadataBundle;
        console.log(
          JSON.stringify(
            await importLocalSessionMetadata(bundle, {
              workspaceRoot,
              id: valueAfter(argv, "--id"),
              title: valueAfter(argv, "--title"),
            }),
            null,
            2,
          ),
        );
        break;
      }
      throw new Error(`unknown session action: ${action}`);
    }

    case "fs": {
      const action = argv[1] as "list" | "read" | "glob" | "search" | undefined;
      if (!action || !["list", "read", "glob", "search"].includes(action))
        throw new Error("fs requires list, read, glob, or search");
      const positional = argv.filter(
        (value, index) =>
          index > 1 &&
          !value.startsWith("--") &&
          argv[index - 1] !== "--workspace" &&
          argv[index - 1] !== "--path" &&
          argv[index - 1] !== "--include" &&
          argv[index - 1] !== "--limit",
      );
      console.log(
        JSON.stringify(
          await workspaceFilesystemCommand({
            action,
            workspaceRoot: valueAfter(argv, "--workspace"),
            path:
              valueAfter(argv, "--path") ??
              (action === "read" ? positional[0] : undefined),
            pattern: action === "glob" ? positional[0] : undefined,
            query: action === "search" ? positional[0] : undefined,
            include: valueAfter(argv, "--include"),
            offset: valueAfter(argv, "--offset")
              ? Number(valueAfter(argv, "--offset"))
              : undefined,
            limit: valueAfter(argv, "--limit")
              ? Number(valueAfter(argv, "--limit"))
              : undefined,
          }),
          null,
          2,
        ),
      );
      break;
    }
    case "trust": {
      const action = argv[1] as "list" | "remove" | undefined;
      const workspaceRoot = valueAfter(argv, "--workspace") ?? process.cwd();
      if (action === "list") {
        console.log(JSON.stringify(await trustList(workspaceRoot), null, 2));
        break;
      }
      if (action === "remove") {
        const key = argv[2];
        if (!key) throw new Error("trust remove requires a key");
        console.log(
          JSON.stringify(await trustRemove(workspaceRoot, key), null, 2),
        );
        break;
      }
      throw new Error("trust requires list or remove");
    }

    case "replay": {
      const cassettePath = argv[1];
      if (!cassettePath) throw new Error("replay requires a cassette path");
      const replay = createRecordedFetch({ mode: "replay", cassettePath });
      const cassette = await readCassette(cassettePath);
      console.log(
        `replaying ${cassette.interactions.length} recorded requests`,
      );
      for (const entry of cassette.interactions) {
        const response = await replay(entry.request.url, entry.request);
        console.log(
          `${entry.request.method} ${entry.request.url} -> ${response.status}`,
        );
      }
      break;
    }
  }
  return true;
}
