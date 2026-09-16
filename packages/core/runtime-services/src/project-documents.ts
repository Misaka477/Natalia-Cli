/**
 * The project-document snapshot contract (EI §8.5 / ADR D2): the workspace
 * `AGENTS.md` and `.natalia/constitution.md` loaded for a session. The runtime
 * face is just the shape; the client loads the files and injects the rendered
 * `<runtime_context source="project">` block. Declared here so the runner and
 * the client share one type without a client dependency in the contract.
 */
export type LoadedProjectDocument = {
  source: "constitution" | "agents";
  path: string;
  content: string;
  hash: string;
};

export type ProjectDocumentSnapshot = {
  documents: LoadedProjectDocument[];
  hash: string;
};
