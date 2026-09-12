import type { Multiplier, SlotPrediction } from "./types";

const STORAGE_KEY = (year: number) => `f1p.preds.${year}`;
const SCORE_KEY = (year: number) => `f1p.scores.${year}`;

export type SavedPredMap = Record<string, SlotPrediction[]>;

export function loadPredictions(year: number): SavedPredMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY(year)) ?? "{}");
  } catch {
    return {};
  }
}

export function savePrediction(year: number, round: string, slots: SlotPrediction[]) {
  const all = loadPredictions(year);
  all[round] = slots;
  localStorage.setItem(STORAGE_KEY(year), JSON.stringify(all));
}

export function clearPrediction(year: number, round: string) {
  const all = loadPredictions(year);
  delete all[round];
  localStorage.setItem(STORAGE_KEY(year), JSON.stringify(all));
}

export interface CachedScore {
  score: {
    total: number;
    maxTotal: number;
    slots: Array<{
      slot: number;
      driverId: string;
      multiplier: number;
      actualPosition: number | null;
      finished: boolean;
      status: string;
      basePoints: number;
      points: number;
    }>;
  } | null;
  resultsAvailable: boolean;
  raceName?: string;
}

export type SavedScoreMap = Record<string, CachedScore>;

export function loadScores(year: number): SavedScoreMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SCORE_KEY(year)) ?? "{}");
  } catch {
    return {};
  }
}

export function saveScores(year: number, scores: SavedScoreMap) {
  localStorage.setItem(SCORE_KEY(year), JSON.stringify(scores));
}

export function driverDisplay(d: { driverId: string; code: string; givenName: string; familyName: string }) {
  return `${d.code} ${d.familyName}`;
}