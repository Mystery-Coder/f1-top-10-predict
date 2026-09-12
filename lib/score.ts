export type Multiplier = 1 | 2 | 3;

export interface ScorableResult {
  driverId: string;
  /** Raw numeric position if the API supplied one, else null. */
  position: number | null;
  positionText: string;
  status: string;
}

export interface ScoreInputSlot {
  slot: number;
  driverId: string;
  multiplier: number;
}

export interface SlotScoreResult {
  slot: number;
  driverId: string;
  multiplier: number;
  actualPosition: number | null;
  finished: boolean;
  status: string;
  basePoints: number;
  points: number;
}

export interface RoundScoreResult {
  total: number;
  maxTotal: number;
  slots: SlotScoreResult[];
}

/**
 * True when a status means the driver actually completed the race
 * (classified finisher), possibly lapped.
 */
export function isFinishedStatus(status: string): boolean {
  return status === "Finished" || /^Lapped/.test(status) || /^\+\d+ Lap/.test(status);
}

/** Parse a raw API position into a positive integer, or null. */
export function numericPosition(position: string | null | undefined): number | null {
  if (position == null || position === "") return null;
  const n = Number(position);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * A driver has a usable classification position when the API confirms a
 * completed run. Driving the rule from `positionText` distinguishes real
 * finishers (and lapped classified drivers) from retirees/DSQs, who often
 * still carry a positional placeholder like 22 with text "R".
 */
export function classifiedPosition(
  position: number | null,
  positionText: string,
  status: string,
): number | null {
  if (typeof position !== "number") return null;
  if (/^\d+$/.test(positionText) || isFinishedStatus(status)) return position;
  return null;
}

/**
 * Score a set of 10 predicted slots against the full race classification.
 *
 * Per slot:
 *   actual classification position == i        -> 10 base points
 *   |actual classification position - i| == 1 -> 5 base points
 *   anything else (incl. DNF/DSQ/DNS)         -> 0 base points
 * base points are then multiplied by the slot multiplier (1x/2x/3x).
 */
export function scoreRound(
  predictionSlots: ScoreInputSlot[],
  resultEntries: ScorableResult[],
): RoundScoreResult {
  const byDriver = new Map<string, ScorableResult>();
  for (const r of resultEntries) byDriver.set(r.driverId, r);

  const scored: SlotScoreResult[] = predictionSlots
    .sort((a, b) => a.slot - b.slot)
    .map((slot) => {
      const actual = byDriver.get(slot.driverId);
      const actualPosition = actual
        ? classifiedPosition(actual.position, actual.positionText, actual.status)
        : null;

      let basePoints = 0;
      if (actualPosition != null) {
        if (actualPosition === slot.slot) basePoints = 10;
        else if (Math.abs(actualPosition - slot.slot) === 1) basePoints = 5;
      }

      const multiplier = (slot.multiplier ?? 1) as Multiplier;
      return {
        slot: slot.slot,
        driverId: slot.driverId,
        multiplier,
        actualPosition,
        finished: actualPosition != null,
        status: actual?.status ?? "Did not appear",
        basePoints,
        points: basePoints * multiplier,
      };
    });

  const total = scored.reduce((sum, s) => sum + s.points, 0);
  const maxTotal = scored.reduce((sum, s) => sum + 10 * s.multiplier, 0);

  return { total, maxTotal, slots: scored };
}