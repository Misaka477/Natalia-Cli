import { unlink } from "node:fs/promises";
import { createServer } from "node:net";

const endpoint = process.env.NATALIA_FORK_SMOKE_SOCKET;
if (!endpoint) throw new Error("NATALIA_FORK_SMOKE_SOCKET is required");
await unlink(endpoint).catch(() => undefined);
const server = createServer((socket) => {
  let frame = "";
  socket.on("data", (chunk) => {
    frame += chunk;
    if (!frame.includes("\n")) return;
    const claim = JSON.parse(frame) as {
      version: number;
      type: string;
      nonce: string;
      terminalID: string;
      paneID: number;
      kind: string;
      byteLength: number;
      data?: unknown;
    };
    console.log(
      JSON.stringify({
        type: claim.type,
        terminalID: claim.terminalID,
        paneID: claim.paneID,
        kind: claim.kind,
        byteLength: claim.byteLength,
        hasData: Object.hasOwn(claim, "data"),
      }),
    );
    socket.end(
      `${JSON.stringify({
        version: claim.version,
        type: "decision",
        nonce: claim.nonce,
        permit: true,
        reason: "accepted",
      })}\n`,
    );
  });
});
server.listen(endpoint, () => console.log(`listening ${endpoint}`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
