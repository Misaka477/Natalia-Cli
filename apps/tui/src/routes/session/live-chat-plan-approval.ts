type PlanAuthorLookup = Record<string, { author?: string }>;

type ApprovalLike = {
  kind?: string;
  type?: string;
  title?: string;
  keyArguments?: string[];
  permissionFamily?: { id?: string };
};

export function isLiveChatPlanApproval(
  request: ApprovalLike | undefined,
  plans?: PlanAuthorLookup,
) {
  if (!request) return false;
  if (request.kind !== "approval" && request.type !== "approval.request")
    return false;
  if (request.permissionFamily?.id !== "planning") return false;
  const planID = request.keyArguments?.[0];
  if (!planID) return false;
  return plans?.[planID]?.author === "live_chat";
}
