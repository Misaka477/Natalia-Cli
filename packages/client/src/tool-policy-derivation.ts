/**
 * Tool policy derivation.
 *
 * These are the pure config→policy computations that build a hook layer's
 * allow/exclude sets before they are handed to the tool policy service. Keeping
 * the derivation separate from the hook-layer construction makes the
 * agent/mode/profile precedence rules testable without the policy service.
 */
import type { ConfigV3, PermissionProfile } from "@natalia/contracts";
import type { AgentDefinition } from "@natalia/agent-plugin";

type RuntimeMode = ConfigV3["modes"][string];

export function deriveAgentToolPolicy(input: {
  agent: AgentDefinition | undefined;
  mode: RuntimeMode | undefined;
}): { allow: string[]; exclude: string[] } {
  const { agent, mode } = input;
  return {
    allow: [
      ...(agent?.allowedTools ?? mode?.allowedTools ?? []),
      ...(agent?.permissions?.tools?.allow ?? []),
    ],
    exclude: [
      ...(agent?.excludedTools ?? mode?.excludedTools ?? []),
      ...(agent?.permissions?.tools?.exclude ?? []),
    ],
  };
}

export function deriveProfileToolPolicy(input: {
  profile: PermissionProfile | undefined;
}): { allow: string[] | undefined; exclude: string[] | undefined } {
  const { profile } = input;
  return {
    allow: profile?.permissions?.tools?.allow,
    exclude: profile?.permissions?.tools?.exclude,
  };
}
