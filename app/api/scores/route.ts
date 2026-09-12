import { NextRequest } from "next/server";
import { fetchResults, fetchSchedule } from "@/lib/jolpica";
import { numericPosition, scoreRound, type ScorableResult } from "@/lib/score";
import { raceStartTs } from "@/lib/schedule";
import { validateSlots } from "@/lib/predict";

export const dynamic = "force-dynamic";

interface RoundSlotsRequest {
  year?: unknown;
  predictions?: unknown;
}

export async function POST(req: NextRequest) {
  let body: RoundSlotsRequest;
  try {
    body = (await req.json()) as RoundSlotsRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const year = Number(body.year);
  if (!Number.isInteger(year)) {
    return Response.json({ error: "year is required and must be an integer" }, { status: 400 });
  }

  const predictions = body.predictions;
  if (!predictions || Array.isArray(predictions)) {
    return Response.json({ error: "predictions must be an object keyed by round" }, { status: 400 });
  }

  try {
    let schedule: Awaited<ReturnType<typeof fetchSchedule>> = [];
    try {
      schedule = await fetchSchedule(year);
    } catch {
      schedule = [];
    }
    const startByRound = new Map(
      schedule.filter((r) => raceStartTs(r.date) != null).map((r) => [r.round, raceStartTs(r.date) as number]),
    );

    const entries = Object.entries(predictions as Record<string, unknown>);
    const scores: Record<
      string,
      { resultsAvailable: boolean; raceName?: string; startTs: number | null; locked: boolean; score: ReturnType<typeof scoreRound> | null }
    > = {};

    for (const [round, value] of entries) {
      const slotBag = value as { slots?: unknown };
      const validation = validateSlots(slotBag?.slots);
      if (!validation.ok) {
        scores[round] = {
          resultsAvailable: false,
          startTs: null,
          locked: false,
          score: null,
        };
        continue;
      }

      const startTs = startByRound.get(String(round)) ?? null;
      const now = Date.now();
      const locked = startTs == null ? true : now > startTs;

      const races = await fetchResults(year, round, 3600);
      const rawResults = races[0]?.Results ?? [];
      const resultsAvailable = rawResults.length > 0;

      let result: ReturnType<typeof scoreRound> | null = null;
      if (resultsAvailable) {
        const scorable: ScorableResult[] = rawResults.map((r) => ({
          driverId: r.Driver.driverId,
          position: numericPosition(r.position ?? null),
          positionText: r.positionText ?? "",
          status: r.status ?? "",
        }));
        result = scoreRound(validation.slots, scorable);
      }

      scores[round] = {
        resultsAvailable,
        raceName: races[0]?.raceName,
        startTs,
        locked,
        score: result,
      };
    }

    return Response.json({ year, scores });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}