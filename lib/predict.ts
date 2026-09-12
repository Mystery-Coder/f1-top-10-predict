export interface PredictionSlotInput {
  slot: number;
  driverId: string;
  multiplier: 1 | 2 | 3;
}

export interface SlotLike {
  slot?: unknown;
  driverId?: unknown;
  multiplier?: unknown;
}

export type SlotsValidation =
  | { ok: true; slots: PredictionSlotInput[] }
  | { ok: false; error: string };

export const MULTIPLIERS = [1, 2, 3] as const;

export function validateSlots(value: unknown): SlotsValidation {
  if (!Array.isArray(value) || value.length !== 10) {
    return { ok: false, error: "Provide exactly 10 slots (P1–P10)." };
  }

  const slots: PredictionSlotInput[] = [];
  const seenSlots = new Set<number>();
  const seenDrivers = new Set<string>();
  const multiplierCounts = new Map<number, number>();

  for (const item of value) {
    const s = item as SlotLike;
    const slot = Number(s.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 10) {
      return { ok: false, error: `Invalid slot value: ${String(s.slot)}` };
    }
    if (seenSlots.has(slot)) {
      return { ok: false, error: `Duplicate slot ${slot}.` };
    }
    if (typeof s.driverId !== "string" || s.driverId.trim() === "") {
      return { ok: false, error: `Slot ${slot} is missing a driver.` };
    }
    const driverId = s.driverId.trim();
    if (seenDrivers.has(driverId)) {
      return { ok: false, error: `${driverId} appears more than once.` };
    }
    const multiplier = Number(s.multiplier);
    if (!MULTIPLIERS.includes(multiplier as 1 | 2 | 3)) {
      return { ok: false, error: `Slot ${slot} has an invalid multiplier.` };
    }
    seenSlots.add(slot);
    seenDrivers.add(driverId);
    multiplierCounts.set(multiplier, (multiplierCounts.get(multiplier) ?? 0) + 1);
    slots.push({
      slot,
      driverId,
      multiplier: multiplier as 1 | 2 | 3,
    });
  }

  if ((multiplierCounts.get(2) ?? 0) !== 1 || (multiplierCounts.get(3) ?? 0) !== 1) {
    return { ok: false, error: "Assign exactly one 2x slot and one 3x slot." };
  }

  return { ok: true, slots: slots.sort((a, b) => a.slot - b.slot) };
}

export function isValidMultiplier(multiplier: number): multiplier is 1 | 2 | 3 {
  return MULTIPLIERS.includes(multiplier as 1 | 2 | 3);
}