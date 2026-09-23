"use strict";
/**
 * The project-document snapshot contract (EI §8.5 / ADR D2): the workspace
 * `AGENTS.md` and `.natalia/constitution.md` loaded for a session. The runtime
 * face is just the shape; the client loads the files and injects the rendered
 * `<runtime_context source="project">` block. Declared here so the runner and
 * the client share one type without a client dependency in the contract.
 */
Object.defineProperty(exports, "__esModule", { value: true });
