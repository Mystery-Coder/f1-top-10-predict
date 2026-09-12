const BASE_URL = "https://api.jolpi.ca/ergast/f1";
const USER_AGENT = "F1Predictor/1.0";

interface MRData<T> {
  MRData: T;
}

interface RaceTable<T> {
  RaceTable: { Races: T };
}

interface DriverTable<T> {
  DriverTable: { Drivers: T };
}

async function jolpica<T>(path: string, revalidate: number): Promise<T> {
  const url = `${BASE_URL}${path}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`Jolpica request failed (${res.status}) for ${url}`);
  }
  return (await res.json()) as T;
}

export async function fetchSchedule(year: number | string) {
  const data = await jolpica<MRData<RaceTable<import("./schedule").RawRace[]>>>(
    `/${year}`,
    21600,
  );
  return data.MRData.RaceTable.Races;
}

export async function fetchDrivers(year: number | string) {
  const data = await jolpica<
    MRData<DriverTable<import("./types").DriverInfo[]>>
  >(`/${year}/drivers`, 43200);
  return data.MRData.DriverTable.Drivers;
}

export interface RawResult {
  position?: string | null;
  positionText?: string | null;
  status?: string;
  laps?: string;
  Driver: {
    driverId: string;
    code: string;
    givenName: string;
    familyName: string;
  };
  Constructor?: { name: string };
}

export async function fetchResults(year: number | string, round: number | string, revalidate: number) {
  const data = await jolpica<
    MRData<RaceTable<Array<{ date: string; time?: string; raceName: string; Results?: RawResult[] }>>>
  >(`/${year}/${round}/results`, revalidate);
  return data.MRData.RaceTable.Races;
}

/**
 * Results are fresh for ~2 weeks after a race, then effectively final.
 */
export function resultsRevalidate(startTs: number | null, now: number = Date.now()): number {
  if (startTs == null) return 21600;
  const ageDays = (now - startTs) / 86_400_000;
  return ageDays < 14 ? 3600 : 2_592_000;
}