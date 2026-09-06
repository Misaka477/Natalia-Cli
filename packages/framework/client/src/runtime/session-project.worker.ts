import { parentPort } from "node:worker_threads";
import {
  projectSession,
  projectSessionMessages,
  projectedCanonicalTools,
  projectedPlanDocs,
  projectedEvidenceRecords,
  projectedConstitutionRules,
  projectedDecisionRecords,
  projectedWorkGraphNodes,
  projectedWorkGraphEdges,
  projectedMailboxMessages,
  projectedCollabMessages,
  type SessionProjection,
} from "@natalia/session";

export type SessionProjectWorkerRequest =
  | {
      id: number;
      op: "project";
      session: import("@natalia/session").SessionRecord;
    }
  | {
      id: number;
      op: "messages";
      session: import("@natalia/session").SessionRecord;
      options: { limit?: number; order?: "asc" | "desc"; cursor?: string };
    }
  | {
      id: number;
      op: "canonicalTools";
      events: import("@natalia/contracts").RuntimeEvent[];
    }
  | {
      id: number;
      op: "projection";
      name:
        | "planDocs"
        | "evidenceRecords"
        | "constitutionRules"
        | "decisionRecords"
        | "workGraphNodes"
        | "workGraphEdges"
        | "mailboxMessages"
        | "collabMessages";
      events: import("@natalia/contracts").RuntimeEvent[];
    };

export type SessionProjectWorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

const port = parentPort;
if (!port) throw new Error("session-project worker requires parentPort");

port.on("message", (request: SessionProjectWorkerRequest) => {
  try {
    let result: unknown;
    if (request.op === "project") {
      result = projectSession(request.session);
    } else if (request.op === "messages") {
      result = projectSessionMessages(request.session, request.options);
    } else if (request.op === "canonicalTools") {
      result = projectedCanonicalTools(request.events);
    } else {
      switch (request.name) {
        case "planDocs":
          result = projectedPlanDocs(request.events);
          break;
        case "evidenceRecords":
          result = projectedEvidenceRecords(request.events);
          break;
        case "constitutionRules":
          result = projectedConstitutionRules(request.events);
          break;
        case "decisionRecords":
          result = projectedDecisionRecords(request.events);
          break;
        case "workGraphNodes":
          result = projectedWorkGraphNodes(request.events);
          break;
        case "workGraphEdges":
          result = projectedWorkGraphEdges(request.events);
          break;
        case "mailboxMessages":
          result = projectedMailboxMessages(request.events);
          break;
        case "collabMessages":
          result = projectedCollabMessages(request.events);
          break;
      }
    }
    const response: SessionProjectWorkerResponse = {
      id: request.id,
      ok: true,
      result,
    };
    port.postMessage(response);
  } catch (error) {
    const response: SessionProjectWorkerResponse = {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    port.postMessage(response);
  }
});

export {};
