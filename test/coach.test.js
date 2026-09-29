import test from "node:test";
import assert from "node:assert/strict";
import { CoachEngine } from "../src/coach.js";

function stroke(x, y, dx = 0.015, dy = 0.01) {
  return {
    id: Math.random().toString(36),
    tool: "pen",
    size: 3,
    startedAt: Date.now(),
    endedAt: Date.now() + 20,
    points: [
      { x, y, t: 0, pressure: 0.5 },
      { x: x + dx, y: y + dy, t: 10, pressure: 0.5 }
    ]
  };
}

test("manual check always yields a low-risk global cue once drawing exists", () => {
  const engine = new CoachEngine();
  const strokes = [
    stroke(0.1, 0.1), stroke(0.2, 0.2), stroke(0.3, 0.3),
    stroke(0.4, 0.4), stroke(0.5, 0.5)
  ];
  const cue = engine.analyze(strokes, { manual: true });
  assert.equal(cue.code, "global_check");
  assert.equal(cue.risk, "low");
  assert.equal(cue.level, 0);
});

test("repeated short strokes in one region produce a conservative cue", () => {
  const engine = new CoachEngine();
  const strokes = [
    stroke(0.05, 0.05, 0.2, 0.15),
    stroke(0.7, 0.7, 0.18, 0.1),
    stroke(0.2, 0.75, 0.15, -0.1),
    stroke(0.45, 0.15, 0.12, 0.2),
    stroke(0.5, 0.5),
    stroke(0.505, 0.505),
    stroke(0.51, 0.502),
    stroke(0.507, 0.51),
    stroke(0.512, 0.506),
    stroke(0.509, 0.501)
  ];
  const cue = engine.analyze(strokes);
  assert.ok(cue);
  assert.ok(["searching_line", "repeated_region"].includes(cue.code));
  assert.equal(cue.risk, "low");
});

test("escalation reveals only one additional hint level at a time", () => {
  const engine = new CoachEngine();
  engine.lastCue = engine.makeCue("global_check", 0, { risk: "low" });
  const cue = engine.escalate();
  assert.equal(cue.level, 1);
  assert.notEqual(cue.text, "全体。");
});
