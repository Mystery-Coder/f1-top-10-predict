export type Multiplier = 1 | 2 | 3;

export interface DriverInfo {
  driverId: string;
  code: string;
  givenName: string;
  familyName: string;
  constructorName?: string;
}

export interface RaceScheduleEntry {
  round: string;
  raceName: string;
  circuitName: string;
  date: string;
  time: string;
  startTs: number | null;
  locked: boolean;
}

export interface SlotPrediction {
  slot: number;
  driverId: string;
  multiplier: Multiplier;
}

export interface RoundPrediction {
  slots: Record<string, SlotPrediction>;
  updatedAt: string;
}

export interface SlotScore {
  slot: number;
  driverId: string;
  multiplier: number;
  actualPosition: number | null;
  finished: boolean;
  status: string;
  basePoints: number;
  points: number;
}

export interface RoundScore {
  total: number;
  maxTotal: number;
  slots: SlotScore[];
}

export interface RaceResultEntry {
  position: string | null;
  positionText: string;
  status: string;
  Driver: {
    driverId: string;
    code: string;
    givenName: string;
    familyName: string;
  };
  Constructor?: {
    name: string;
  };
  laps: string;
}

export interface RoundDetailData {
  round: string;
  raceName: string;
  startTs: number;
  locked: boolean;
  prediction: RoundPrediction | null;
  resultsAvailable: boolean;
  resultsPublishedAt?: string;
  score: RoundScore | null;
  actualTop10?: Array<{
    position: number;
    driverId: string;
    code: string;
    name: string;
    constructorName: string;
  }>;
}