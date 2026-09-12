import type { RaceScheduleEntry } from "./types";

export interface RawRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit?: { circuitId: string; circuitName: string };
}

export function raceStartTs(date: string, time?: string): number | null {
  if (!date) return null;
  const ts = Date.parse(`${date}T${time || "00:00:00Z"}`);
  return Number.isNaN(ts) ? null : ts;
}

export function toScheduleEntry(
  race: RawRace,
  now: number = Date.now(),
): RaceScheduleEntry {
  const ts = raceStartTs(race.date, race.time);
  return {
    round: race.round,
    raceName: race.raceName,
    circuitName: race.Circuit?.circuitName ?? "",
    date: race.date,
    time: race.time ?? "",
    startTs: ts,
    locked: ts == null ? true : now > ts,
  };
}

export function formatLocal(ts: number | null): string {
  if (ts == null) return "unknown";
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}