export type TempStatus = "ok" | "warn" | "fail";

export function evaluateTemp(params: {
  kind: "fridge" | "freezer" | "food" | "delivery";
  valueC: number;
  foodStandardC?: number; // 75 default, 82 Scotland
}): { status: TempStatus; requiresAction: boolean; message: string } {
  const { kind, valueC } = params;

  if (kind === "fridge") {
    if (valueC <= 5) return { status: "ok", requiresAction: false, message: "Fridge OK (≤5°C)" };
    if (valueC <= 8) return { status: "warn", requiresAction: false, message: "Fridge warning (5–8°C)" };
    return { status: "fail", requiresAction: true, message: "Fridge FAIL (>8°C) — corrective action required" };
  }

  if (kind === "freezer") {
    if (valueC <= -18) return { status: "ok", requiresAction: false, message: "Freezer OK (≤-18°C)" };
    if (valueC <= -15) return { status: "warn", requiresAction: false, message: "Freezer warning (-18 to -15°C)" };
    return { status: "fail", requiresAction: true, message: "Freezer FAIL (> -15°C) — corrective action required" };
  }

  if (kind === "food") {
    const standard = params.foodStandardC ?? 75;
    if (valueC >= standard) return { status: "ok", requiresAction: false, message: `Food OK (≥${standard}°C)` };
    return { status: "fail", requiresAction: true, message: `Food FAIL (<${standard}°C) — corrective action required` };
  }

  // delivery: choose a simple default for now (you can refine)
  // Common: chilled deliveries should be <= 5°C; frozen deliveries <= -18°C; hot delivery >= 63°C.
  // For MVP, treat as fridge rule unless you add delivery type.
  if (valueC <= 5) return { status: "ok", requiresAction: false, message: "Delivery OK (≤5°C)" };
  if (valueC <= 8) return { status: "warn", requiresAction: false, message: "Delivery warning (5–8°C)" };
  return { status: "fail", requiresAction: true, message: "Delivery FAIL (>8°C) — corrective action required" };
}
