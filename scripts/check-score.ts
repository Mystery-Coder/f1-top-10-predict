import assert from "node:assert";
import {
  type ScoreInputSlot,
  type ScorableResult,
  classifiedPosition,
  isFinishedStatus,
  scoreRound,
} from "../lib/score.ts";

const results: ScorableResult[] = [
  { driverId: "verstappen", position: 1, positionText: "1", status: "Finished" },
  { driverId: "norris", position: 3, positionText: "3", status: "Finished" },
  { driverId: "piastri", position: 9, positionText: "9", status: "Finished" },
  { driverId: "leclerc", position: 22, positionText: "R", status: "Retired" },
  { driverId: "ocon", position: 16, positionText: "16", status: "Lapped" },
  { driverId: "albon", position: 11, positionText: "11", status: "Finished" },
];

const prediction: ScoreInputSlot[] = [
  { slot: 1, driverId: "verstappen", multiplier: 3 },
  { slot: 2, driverId: "noone", multiplier: 1 },
  { slot: 3, driverId: "albon", multiplier: 1 },
  { slot: 4, driverId: "norris", multiplier: 1 },
  { slot: 7, driverId: "piastri", multiplier: 2 },
  { slot: 8, driverId: "leclerc", multiplier: 1 },
  { slot: 9, driverId: "ocon", multiplier: 1 },
];

const s = scoreRound(prediction, results);
const bySlot = new Map(s.slots.map((x) => [x.slot, x]));

assert.equal(bySlot.get(1)!.points, 30, "VER P1 x3 -> 30");
assert.equal(bySlot.get(4)!.points, 5, "NOR predicted P4, finished P3 -> 5");
assert.equal(bySlot.get(4)!.basePoints, 5);
assert.equal(bySlot.get(7)!.points, 0, "PIA predicted P7, finished P9 -> 0");
assert.equal(bySlot.get(7)!.actualPosition, 9);
assert.equal(bySlot.get(8)!.points, 0, "LEC retired (text R) -> 0, no off-by-one");
assert.equal(bySlot.get(8)!.actualPosition, null);
assert.equal(bySlot.get(2)!.points, 0, "driver not in results -> 0");
assert.equal(bySlot.get(3)!.points, 0, "ALB predicted P3, finished P11 -> 0");
assert.equal(bySlot.get(9)!.points, 0, "OCO predicted P9, classified P16 -> 0");
assert.equal(bySlot.get(9)!.finished, true, "lapped classified driver counts as finished");
assert.equal(s.total, 35);
assert.equal(s.maxTotal, 100);

assert.ok(isFinishedStatus("Finished"));
assert.ok(isFinishedStatus("Lapped"));
assert.ok(isFinishedStatus("+1 Lap"));
assert.ok(!isFinishedStatus("Retired"));
assert.ok(!isFinishedStatus("Disqualified"));
assert.ok(!isFinishedStatus("Withdrew"));

assert.equal(classifiedPosition(16, "16", "Lapped"), 16);
assert.equal(classifiedPosition(22, "R", "Retired"), null);
assert.equal(classifiedPosition(11, "11", "Finished"), 11);

console.log("Worked example passed:");
for (const row of s.slots) {
  console.log(
    `  P${row.slot} ${row.driverId.padEnd(12)} mult=${row.multiplier} actual=${row.actualPosition ?? "DNF"} base=${row.basePoints} -> ${row.points} pts`,
  );
}
console.log(`  total = ${s.total}, max = ${s.maxTotal}`);