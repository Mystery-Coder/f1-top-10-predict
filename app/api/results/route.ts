import { NextRequest } from "next/server";
import { fetchResults } from "@/lib/jolpica";
import { raceStartTs } from "@/lib/schedule";

export const dynamic = "force-dynamic";

function enrichResults(results: NonNullable<import("@/lib/jolpica").RawResult[]>) {
  return results.map((r) => ({
    position: r.position ?? null,
    positionText: r.positionText ?? null,
    status: r.status ?? "",
    laps: r.laps ?? "",
    Driver: {
      driverId: r.Driver.driverId,
      code: r.Driver.code,
      givenName: r.Driver.givenName,
      familyName: r.Driver.familyName,
    },
    Constructor: r.Constructor ? { name: r.Constructor.name } : undefined,
  }));
}

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get("year");
  const round = req.nextUrl.searchParams.get("round");

  if (!year || !round) {
    return Response.json({ error: "year and round are required" }, { status: 400 });
  }

  try {
    const races = await fetchResults(year, round, 3600);
    if (races.length === 0) {
      return Response.json({
        year,
        round,
        resultsAvailable: false,
        startTs: null,
        locked: false,
        fullResults: [],
      });
    }

    const race = races[0];
    const startTs = raceStartTs(race.date);
    const now = Date.now();
    const rawResults = race.Results ?? [];

    const fullResults = enrichResults(rawResults).sort((a, b) => {
      const pA = a.position != null ? Number(a.position) : 999;
      const pB = b.position != null ? Number(b.position) : 999;
      return pA - pB;
    });

    return Response.json({
      year,
      round,
      raceName: race.raceName,
      resultsAvailable: rawResults.length > 0,
      startTs,
      locked: startTs == null ? true : now > startTs,
      fullResults,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}