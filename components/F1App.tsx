"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DriverInfo, Multiplier, RaceScheduleEntry, SlotPrediction } from "@/lib/types";
import { validateSlots } from "@/lib/predict";
import { formatLocal } from "@/lib/schedule";
import {
  loadPredictions,
  loadScores,
  savePrediction,
  type SavedPredMap,
  type SavedScoreMap,
} from "@/lib/local";

interface SeasonData {
  year: string;
  asOf: number;
  schedule: RaceScheduleEntry[];
  drivers: DriverInfo[];
}

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

function emptySlots(): SlotPrediction[] {
  return Array.from({ length: 10 }, (_, i) => ({ slot: i + 1, driverId: "", multiplier: 1 }));
}

function timeUntil(ts: number, now: number): string {
  const diff = ts - now;
  if (diff <= 0) return "started";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h <= 0) return `${m}m`;
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export default function F1App() {
  const [year, setYear] = useState(2026);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [round, setRound] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotPrediction[]>(emptySlots);
  const [predictions, setPredictions] = useState<SavedPredMap>({});
  const [scores, setScores] = useState<SavedScoreMap>({});
  const [activeTab, setActiveTab] = useState<"races" | "leaderboard">("races");
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "error" | "neutral" } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [scoring, setScoring] = useState(false);
  const predictionsRef = useRef<SavedPredMap>({});

  const race = useMemo(
    () => season?.schedule.find((r) => r.round === round) ?? null,
    [season, round],
  );

  const isLocked = useCallback(
    (r: RaceScheduleEntry | null) => {
      if (!r) return true;
      if (r.startTs == null) return true;
      return Date.now() > r.startTs;
    },
    [],
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function loadSeason(y: number) {
    setSeason(null);
    setSeasonError(null);
    predictionsRef.current = {};
    try {
      const res = await fetch(`/api/season?year=${y}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }
      const data = (await res.json()) as SeasonData;
      setSeason(data);
      const loaded = loadPredictions(y);
      setPredictions(loaded);
      predictionsRef.current = loaded;
      setScores(loadScores(y));
      const upcoming = data.schedule.find((r) => !isLocked(r));
      setRound(upcoming?.round ?? data.schedule[data.schedule.length - 1]?.round ?? null);
    } catch (err) {
      setSeasonError(err instanceof Error ? err.message : "Failed to load season");
    }
  }

  useEffect(() => {
    loadSeason(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const refreshScores = useCallback(async () => {
    if (!season) return;
    const preds = predictionsRef.current;
    const payload: Record<string, { slots: SlotPrediction[] }> = {};
    for (const r of season.schedule) {
      if (isLocked(r) && preds[r.round]?.length) payload[r.round] = { slots: preds[r.round] };
    }
    if (Object.keys(payload).length === 0) return;
    setScoring(true);
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: Number(season.year), predictions: payload }),
      });
      if (!res.ok) throw new Error("Scoring failed");
      const data = (await res.json()) as {
        scores: Record<
          string,
          { resultsAvailable: boolean; raceName?: string; score: SavedScoreMap[string]["score"] }
        >;
      };
      const base = loadScores(Number(season.year));
      for (const [r, v] of Object.entries(data.scores)) {
        base[r] = { resultsAvailable: v.resultsAvailable, raceName: v.raceName, score: v.score };
      }
      setScores(base);
      try {
        localStorage.setItem(`f1p.scores.${season.year}`, JSON.stringify(base));
      } catch {}
    } finally {
      setScoring(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, isLocked]);

  useEffect(() => {
    predictionsRef.current = predictions;
    if (!season) return;
    const dirty = season.schedule.some((r) => isLocked(r) && predictions[r.round]?.length);
    if (dirty) void refreshScores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictions, season]);

  useEffect(() => {
    if (!season) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(`f1p.preds.${season.year}`, JSON.stringify(predictions));
      } catch {}
    }, 400);
    return () => clearTimeout(t);
  }, [predictions, season]);

  function selectRound(r: string) {
    setRound(r);
    const saved = predictionsRef.current[r];
    setSlots(saved?.length ? [...saved] : emptySlots());
    setMsg(null);
  }

  function changeDriver(index: number, driverId: string) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, driverId } : s)));
    setMsg(null);
  }

  function changeMultiplier(index: number, multiplier: Multiplier) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, multiplier } : s)));
    setMsg(null);
  }

  function savePredictionLocal() {
    if (!race || !round) return;
    if (isLocked(race)) {
      setMsg({ text: "This race has already started — predictions are locked.", type: "error" });
      return;
    }
    const v = validateSlots(slots.map((s, i) => ({ slot: i + 1, driverId: s.driverId, multiplier: s.multiplier })));
    if (!v.ok) {
      setMsg({ text: v.error, type: "error" });
      return;
    }
    const next = { ...predictionsRef.current, [round]: v.slots };
    predictionsRef.current = next;
    setPredictions(next);
    savePrediction(year, round, v.slots);
    setMsg({ text: "Prediction saved — editable until the green light.", type: "ok" });
  }

  const usedDrivers = useMemo(() => new Set(slots.filter((s) => s.driverId).map((s) => s.driverId)), [slots]);
  const usedMultipliers = useMemo(() => {
    const m = new Set<string>();
    for (const s of slots) if (s.multiplier !== 1) m.add(`x${s.multiplier}`);
    return m;
  }, [slots]);

  const sortedDrivers = useMemo(
    () =>
      season
        ? [...season.drivers].sort((a, b) => a.familyName.localeCompare(b.familyName))
        : [],
    [season],
  );

  const seasonTotal = useMemo(
    () =>
      (season?.schedule ?? []).reduce(
        (sum, r) => sum + (scores[r.round]?.score ? scores[r.round].score!.total : 0),
        0,
      ),
    [season, scores],
  );

  const scoredRaces = useMemo(
    () => (season?.schedule ?? []).filter((r) => scores[r.round]?.resultsAvailable),
    [season, scores],
  );

  return (
    <div className="app">
      <header className="header">
        <div className="brand">F1&nbsp;PREDICTOR</div>
        <select className="year-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <div className="season-total-chip" title="Season total">
          <span className="chip-label">SEASON</span>
          <span className="chip-value">{seasonTotal}</span>
        </div>
        <div className="tabs">
          <button className={`tab ${activeTab === "races" ? "active" : ""}`} onClick={() => setActiveTab("races")}>
            Races
          </button>
          <button
            className={`tab ${activeTab === "leaderboard" ? "active" : ""}`}
            onClick={() => setActiveTab("leaderboard")}
          >
            Leaderboard
          </button>
        </div>
      </header>

      {seasonError && <div className="empty-state">{seasonError}</div>}

      {!season && !seasonError && <div className="loading-msg">Loading season…</div>}

      {season && activeTab === "races" && (
        <div className="layout">
          <aside className="race-list">
            {season.schedule.map((r) => {
              const sc = scores[r.round];
              const locked = isLocked(r);
              const selected = r.round === round;
              return (
                <button key={r.round} className={`race-item ${selected ? "selected" : ""}`} onClick={() => selectRound(r.round)}>
                  <span className="race-num">R{r.round}</span>
                  <span className="race-info">
                    <span className="race-name">{r.raceName}</span>
                    <span className="race-date">{formatLocal(r.startTs)}</span>
                  </span>
                  {sc?.resultsAvailable && sc.score ? (
                    <span className="race-points">{sc.score.total}</span>
                  ) : (
                    <span className={`race-status ${locked ? "locked" : "open"}`}>{locked ? "CLOSED" : "OPEN"}</span>
                  )}
                </button>
              );
            })}
          </aside>

          <main className="main-panel">
            {!race && <div className="empty-state">Select a race&hellip;</div>}

            {race && (
              <>
                <div className="race-header">
                  <h2>
                    {race.raceName} <span className="round-sub">R{race.round}</span>
                  </h2>
                  <div className="race-meta">
                    <span className="deadline">
                      {isLocked(race) ? "Race started" : `Closes in ${timeUntil(race.startTs!, now)}`} ·{" "}
                      {formatLocal(race.startTs)}
                    </span>
                    <span className={`badge ${isLocked(race) ? "locked" : "open"}`}>
                      {isLocked(race) ? "Locked" : "Open"}
                    </span>
                  </div>
                </div>

                {!isLocked(race) && (
                  <>
                    <div className="prediction-form">
                      {slots.map((s, i) => (
                        <div key={i} className={`slot-row multiplier-${s.multiplier} ${s.multiplier !== 1 ? "boosted" : ""}`}>
                          <span className="slot-label">P{i + 1}</span>
                          <select
                            className="driver-select"
                            value={s.driverId}
                            onChange={(e) => changeDriver(i, e.target.value)}
                          >
                            <option value="" disabled>
                              — select driver —
                            </option>
                            {sortedDrivers.map((d) => (
                              <option key={d.driverId} value={d.driverId} disabled={usedDrivers.has(d.driverId)}>
                                {d.code} {d.givenName} {d.familyName}
                              </option>
                            ))}
                          </select>
                          <select
                            className="mult-select"
                            value={s.multiplier}
                            onChange={(e) => changeMultiplier(i, Number(e.target.value) as Multiplier)}
                          >
                            <option value={1}>1x</option>
                            <option value={2} disabled={usedMultipliers.has("x2")}>
                              2x
                            </option>
                            <option value={3} disabled={usedMultipliers.has("x3")}>
                              3x
                            </option>
                          </select>
                        </div>
                      ))}
                    </div>

                    <div className="status-bar">
                      <button className="save-btn" onClick={savePredictionLocal}>
                        Save forecast
                      </button>
                      <span className={`msg ${msg ? msg.type : "neutral"}`}>{msg?.text ?? "One 2x and one 3x required."}</span>
                    </div>
                    <p className="hint">Predictions are locked at the scheduled race start. Make changes any time before then.</p>
                  </>
                )}

                {isLocked(race) && (
                  <>
                    {predictions[race.round] && !scores[race.round]?.score && (
                      <PredictionView
                        slots={predictions[race.round]!}
                        drivers={sortedDrivers}
                      />
                    )}
                    {scores[race.round]?.resultsAvailable && scores[race.round]?.score ? (
                      <ScoreBreakdown
                        score={scores[race.round].score!}
                        drivers={sortedDrivers}
                        slots={predictions[race.round] ?? []}
                      />
                    ) : (
                      <div className="empty-state small">
                        {scoring ? "Crunching results…" : "Results not published yet."}
                        {!scoring && (
                          <button className="save-btn" onClick={() => void refreshScores()}>
                            Refresh
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        </div>
      )}

      {season && activeTab === "leaderboard" && (
        <div className="leaderboard main-panel">
          <h2>Season Leaderboard — {season.year}</h2>
          <div className="season-total-box">
            <div className="label">Season total</div>
            <div className="value">
              {seasonTotal}
              <span>/ {scoredRaces.reduce((sum, r) => sum + (scores[r.round]?.score?.maxTotal ?? 0), 0)} possible</span>
            </div>
          </div>

          {scoring ? (
            <div className="loading-msg">Scoring…</div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Race</th>
                  <th>Your P1 pick</th>
                  <th>Points</th>
                  <th>Max</th>
                </tr>
              </thead>
              <tbody>
                {season.schedule.map((r) => {
                  const pred = predictions[r.round];
                  const sc = scores[r.round];
                  const scorable = sc?.resultsAvailable && sc.score;
                  const p1 = pred?.[0];
                  const p1Driver = p1 ? season.drivers.find((d) => d.driverId === p1.driverId) : null;
                  return (
                    <tr key={r.round} className={scorable ? "has-prediction" : "no-prediction"} onClick={() => switchToRace(r.round)}>
                      <td>
                        R{r.round} {r.raceName}
                      </td>
                      <td>
                        {scorable ? (p1Driver ? `${p1Driver.code} ${p1Driver.familyName}` : "—") : p1Driver ? `${p1Driver.code} ${p1Driver.familyName}` : "no prediction"}
                      </td>
                      <td>{scorable ? sc.score!.total : "—"}</td>
                      <td className="total-col">{scorable ? sc.score!.maxTotal : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );

  function switchToRace(r: string) {
    selectRound(r);
    setActiveTab("races");
  }
}

function ScoreBreakdown({
  score,
  drivers,
  slots,
}: {
  score: NonNullable<SavedScoreMap[string]["score"]>;
  drivers: DriverInfo[];
  slots: SlotPrediction[];
}) {
  const name = (id: string) => {
    const d = drivers.find((x) => x.driverId === id);
    return d ? `${d.code} ${d.familyName}` : id;
  };

  return (
    <div className="score-section">
      <h3>Results & scoring</h3>
      <div className="score-total">{score.total}</div>
      <div className="score-max">
        out of {score.maxTotal} maximum · green = exact, orange = off-by-one
      </div>
      <div className="score-grid">
        <div className="score-row header">
          <span>Pos</span>
          <span>Your pick</span>
          <span>Actual</span>
          <span>Mult</span>
          <span>Pts</span>
        </div>
        {score.slots.map((s) => {
          const actual = s.actualPosition;
          return (
            <div key={s.slot} className="score-row">
              <span className="slot-label">P{s.slot}</span>
              <span className="predicted-driver">{name(s.driverId)}</span>
              <span className="actual">
                {actual != null ? `P${actual}` : <span className="status-dnf">{s.status}</span>}
              </span>
              <span>×{s.multiplier}</span>
              <span className={`pts ${s.points > 0 ? "positive" : "zero"}`}>{s.points === 0 && actual != null ? "0" : s.points}</span>
            </div>
          );
        })}
      </div>
      {slots.length === 0 && <p className="prediction-empty">This race was scored from a prediction stored on this device.</p>}
    </div>
  );
}

function PredictionView({
  slots,
  drivers,
}: {
  slots: SlotPrediction[];
  drivers: DriverInfo[];
}) {
  const name = (id: string) => {
    const d = drivers.find((x) => x.driverId === id);
    return d ? `${d.code} ${d.familyName}` : id;
  };

  return (
    <div className="score-section">
      <h3>Your prediction</h3>
      <div className="score-max">Locked — no longer editable.</div>
      <div className="score-grid">
        <div className="score-row header">
          <span>Pos</span>
          <span>Your pick</span>
          <span>Status</span>
          <span>Mult</span>
          <span></span>
        </div>
        {slots.map((s) => (
          <div key={s.slot} className="score-row">
            <span className="slot-label">P{s.slot}</span>
            <span className="predicted-driver">{name(s.driverId)}</span>
            <span className="predicted-status">locked</span>
            <span>×{s.multiplier}</span>
            <span className="pts zero">—</span>
          </div>
        ))}
      </div>
    </div>
  );
}