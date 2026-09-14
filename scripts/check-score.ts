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
  { driverId: "sainz", position: 2, positionText: "2", status: "Finished" },
  { driverId: "norris", position: 3, positionText: "3", status: "Finished" },
  { driverId: "russell", position: 7, positionText: "7", status: "Finished" },
  { driverId: "piastri", position: 9, positionText: "9", status: "Finished" },
  { driverId: "hamilton", position: 10, positionText: "10", status: "Finished" },
  { driverId: "albon", position: 11, positionText: "11", status: "Finished" },
  { driverId: "ocon", position: 16, positionText: "16", status: "Lapped" },
  { driverId: "leclerc", position: 22, positionText: "R", status: "Retired" },
];

const prediction: ScoreInputSlot[] = [
  { slot: 1, driverId: "verstappen", multiplier: 3 },
  { slot: 2, driverId: "norris", multiplier: 1 },
  { slot: 3, driverId: "sainz", multiplier: 2 },
  { slot: 4, driverId: "noone", multiplier: 1 },
  { slot: 5, driverId: "leclerc", multiplier: 1 },
  { slot: 6, driverId: "piastri", multiplier: 2 },
  { slot: 7, driverId: "ocon", multiplier: 1 },
  { slot: 8, driverId: "russell", multiplier: 3 },
  { slot: 9, driverId: "hamilton", multiplier: 1 },
  { slot: 10, driverId: "albon", multiplier: 1 },
];

const s = scoreRound(prediction, results);
const bySlot = new Map(s.slots.map((x) => [x.slot, x]));

assert.equal(bySlot.get(1)!.basePoints, 10, "VER actual P1 vs slot 1 -> exact");
assert.equal(bySlot.get(1)!.points, 30, "exact x3 -> 10 x 3 = 30");
assert.equal(bySlot.get(2)!.basePoints, 5, "NOR actual P3 vs slot 2 -> off by one");
assert.equal(bySlot.get(2)!.points, 5, "off-by-one x1 -> 5");
assert.equal(bySlot.get(3)!.basePoints, 5, "SAI actual P2 vs slot 3 -> off by one");
assert.equal(bySlot.get(3)!.points, 10, "off-by-one x2 -> 5 x 2 = 10");
assert.equal(bySlot.get(8)!.basePoints, 5, "RUS actual P7 vs slot 8 -> off by one");
assert.equal(bySlot.get(8)!.points, 15, "off-by-one x3 -> 5 x 3 = 15, not 5");
assert.equal(bySlot.get(4)!.points, 0, "driver not in results -> 0");
assert.equal(bySlot.get(5)!.actualPosition, null);
assert.equal(bySlot.get(5)!.points, 0, "LEC retired (text R) -> 0, no off-by-one");
assert.equal(bySlot.get(6)!.actualPosition, 9);
assert.equal(bySlot.get(6)!.points, 0, "PIA actual P9 vs slot 6 -> 0");
assert.equal(bySlot.get(7)!.finished, true, "lapped classified driver counts as finished");
assert.equal(bySlot.get(7)!.points, 0, "OCO actual P16 vs slot 7 -> 0");
assert.equal(bySlot.get(9)!.basePoints, 5, "HAM actual P10 vs slot 9 -> off by one");
assert.equal(bySlot.get(9)!.points, 5);
assert.equal(s.total, 70);
assert.equal(s.maxTotal, 160);

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