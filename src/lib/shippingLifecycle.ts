export type LabelPurchaseDecision = "claim" | "replay_completed" | "block_processing" | "block_existing_label";

export function decideLabelPurchase(commandStatus: string | undefined, orderHasLabel: boolean): LabelPurchaseDecision {
  if (commandStatus === "completed") return "replay_completed";
  if (commandStatus) return "block_processing";
  if (orderHasLabel) return "block_existing_label";
  return "claim";
}

export type TrackingNotificationKind = "delivered" | "delayed" | "exception" | null;

export function classifyShippoTracking(status: unknown, substatusCode: unknown, details: unknown): TrackingNotificationKind {
  const normalizedStatus = String(status || "").toUpperCase();
  const context = `${String(substatusCode || "")} ${String(details || "")}`.toLowerCase();
  if (normalizedStatus === "DELIVERED") return "delivered";
  if (normalizedStatus === "FAILURE" || normalizedStatus === "RETURNED") return "exception";
  if (/delay|late|weather/.test(context)) return "delayed";
  if (/exception|undeliver|address issue|damag|held|return to sender/.test(context)) return "exception";
  return null;
}

export function normalizeShippoTrackingStatus(status: unknown) {
  const normalized = String(status || "UNKNOWN").toUpperCase();
  const statuses: Record<string, string> = {
    UNKNOWN: "unknown",
    PRE_TRANSIT: "pre_transit",
    TRANSIT: "in_transit",
    DELIVERED: "delivered",
    RETURNED: "returned",
    FAILURE: "failure",
  };
  return statuses[normalized] || "unknown";
}
