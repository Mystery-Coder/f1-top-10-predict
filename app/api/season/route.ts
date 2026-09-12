import { NextRequest } from "next/server";
import { fetchDrivers, fetchSchedule } from "@/lib/jolpica";
import { toScheduleEntry } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get("year");
  const year = requested || String(new Date().getFullYear());

  try {
    const [races, drivers] = await Promise.all([
      fetchSchedule(year),
      fetchDrivers(year),
    ]);

    const now = Date.now();
    return Response.json({
      year,
      asOf: now,
      schedule: races.map((r) => toScheduleEntry(r, now)),
      drivers: drivers.map((d) => ({
        driverId: d.driverId,
        code: d.code,
        givenName: d.givenName,
        familyName: d.familyName,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
}