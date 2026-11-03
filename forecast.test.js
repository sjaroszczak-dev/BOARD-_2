"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("./forecast.js");
const TODAY = "2026-01-01";

function fixture() {
  const capacity = Object.fromEntries(F.months(TODAY).map((month) => [month.key, { net: month.workdays }]));
  return {
    skills: [{ id: "net", name: ".net" }],
    teams: [{ id: "atlas", name: "Atlas", skills: ["net"], capacity }],
    initiatives: ["a", "b"].map((id) => ({
      id, name: id, skills: ["net"], start: TODAY, deadline: "",
      items: [{ id: `${id}-1`, name: "API", teamId: "atlas", skillId: "net", min: 1, max: 1, start: "", deadline: "" }]
    }))
  };
}

test("calendar contains 12 consecutive months, including year rollover and leap days", () => {
  const calendar = F.months("2027-11-15");
  assert.equal(calendar.length, 12);
  assert.equal(calendar[0].key, "2027-11");
  assert.equal(calendar[11].key, "2028-10");
  assert.equal(calendar[3].end - calendar[3].start, 29);
  assert.equal(F.months(TODAY)[0].workdays, 22);
});

test("initiatives share a finite team/competency resource in priority order", () => {
  const result = F.run(F.prepare(fixture(), TODAY));
  assert.deepEqual(result.ends.map(F.iso), ["2026-01-01", "2026-01-02"]);
});

test("distinct teams deliver in parallel", () => {
  const state = fixture();
  state.teams.push({ ...structuredClone(state.teams[0]), id: "nova", name: "Nova" });
  state.initiatives[1].items[0].teamId = "nova";
  assert.deepEqual(F.run(F.prepare(state, TODAY)).ends.map(F.iso), [TODAY, TODAY]);
});

test("distinct competencies within a team use separate capacity pools", () => {
  const state = fixture();
  state.skills.push({ id: "mobile", name: "mobile" });
  state.teams[0].skills.push("mobile");
  Object.values(state.teams[0].capacity).forEach((capacity) => { capacity.mobile = capacity.net; });
  state.initiatives[1].skills = ["mobile"];
  state.initiatives[1].items[0].skillId = "mobile";
  assert.deepEqual(F.run(F.prepare(state, TODAY)).ends.map(F.iso), [TODAY, TODAY]);
});

test("successors wait for the next working day and do not start on weekends", () => {
  const state = fixture();
  state.initiatives[0].start = "2026-01-02";
  state.initiatives[1].start = "2026-02-01";
  state.initiatives[0].items.push({ ...state.initiatives[0].items[0], id: "a-2" });
  const result = F.run(F.prepare(state, TODAY));
  assert.equal(F.iso(result.ends[0]), "2026-01-02");
  assert.equal(F.iso(result.starts[1]), "2026-01-05");
  assert.equal(F.iso(result.starts[2]), "2026-02-02");
});

test("capacity is carried across month boundaries without borrowing from unavailable months", () => {
  const state = fixture();
  state.teams[0].capacity["2026-01"].net = 0;
  const result = F.run(F.prepare(state, TODAY));
  assert.deepEqual(result.ends.map(F.iso), ["2026-02-02", "2026-02-03"]);
});

test("past start dates are clamped to today; mid-month forecasts only use remaining working days", () => {
  const state = fixture();
  const result = F.run(F.prepare(state, "2026-01-30"));
  assert.deepEqual(result.ends.map(F.iso), ["2026-01-30", "2026-02-02"]);
});

test("uniform min/max effort changes completion dates", () => {
  const state = fixture();
  state.initiatives[0].items[0].max = 4;
  const model = F.prepare(state, TODAY);
  assert.equal(F.iso(F.run(model, () => 0).ends[0]), "2026-01-01");
  assert.equal(F.iso(F.run(model, () => 1).ends[0]), "2026-01-06");
});

test("zero capacity yields unfinished results, not an invented P85 date", () => {
  const state = fixture();
  Object.values(state.teams[0].capacity).forEach((capacity) => { capacity.net = 0; });
  state.initiatives[0].deadline = "2026-06-01";
  const model = F.prepare(state, TODAY);
  const result = F.summarize(model, [F.run(model), F.run(model)], state);
  assert.equal(result.items["a-1"].end, Infinity);
  assert.equal(result.initiatives.a.completion, 0);
  assert.equal(result.initiatives.a.chance, 0);
});

test("nearest-rank P85 includes unfinished scenarios in the denominator", () => {
  assert.equal(F.percentile([...Array(84).fill(F.day(TODAY)), ...Array(16).fill(Infinity)]), Infinity);
  assert.equal(F.percentile([...Array(85).fill(F.day(TODAY)), ...Array(15).fill(Infinity)]), F.day(TODAY));
});

test("deadline probabilities include completion on the deadline and all unfinished runs", () => {
  const state = fixture();
  state.initiatives[0].deadline = TODAY;
  state.initiatives[0].items[0].deadline = TODAY;
  const model = F.prepare(state, TODAY);
  const samples = [
    { starts: [F.day(TODAY), F.day(TODAY)], ends: [F.day(TODAY), F.day("2026-01-02")] },
    { starts: [F.day(TODAY), Infinity], ends: [Infinity, Infinity] }
  ];
  const result = F.summarize(model, samples, state);
  assert.equal(result.items["a-1"].chance, .5);
  assert.equal(result.initiatives.a.chance, .5);
  assert.equal(result.initiatives.a.end, Infinity);
});

test("deadlines and requested starts beyond the horizon are not falsely forecast", () => {
  const state = fixture();
  state.initiatives[0].start = "2027-01-01";
  state.initiatives[0].deadline = "2027-02-01";
  const model = F.prepare(state, TODAY);
  const result = F.summarize(model, [F.run(model)], state);
  assert.equal(result.initiatives.a.end, Infinity);
  assert.equal(result.initiatives.a.chance, null);
});

test("missed deadlines do not block forecasts when requested starts were valid", () => {
  const state = fixture();
  state.initiatives[0].start = "2025-12-01";
  state.initiatives[0].deadline = "2025-12-31";
  state.initiatives[0].items[0].deadline = "2025-12-31";
  const model = F.prepare(state, TODAY);
  const result = F.summarize(model, [F.run(model)], state);
  assert.equal(result.initiatives.a.chance, 0);
  assert.equal(result.items["a-1"].chance, 0);
  assert.equal(F.iso(result.items["a-1"].start), TODAY);
});

test("portfolio finish uses the last element, not the earliest finish", () => {
  const state = fixture();
  state.initiatives[0].items.push({ ...state.initiatives[0].items[0], id: "a-2", deadline: "" });
  const model = F.prepare(state, TODAY);
  const sample = F.run(model);
  const result = F.summarize(model, [sample], state);
  assert.equal(result.initiatives.a.end, sample.ends[1]);
});

test("invalid estimates, blank capacity, date and incompatible competencies are rejected", () => {
  for (const mutate of [
    (state) => { state.initiatives[0].items[0].min = 0; },
    (state) => { state.initiatives[0].items[0].max = .5; },
    (state) => { state.initiatives[0].items[0].min = null; },
    (state) => { state.teams[0].capacity["2026-01"].net = null; },
    (state) => { state.teams[0].capacity["2026-01"].net = -1; },
    (state) => { state.initiatives[0].start = "2026-02-30"; },
    (state) => { state.initiatives[0].items[0].skillId = "missing"; },
    (state) => { state.initiatives[0].items[0].teamId = "missing"; },
    (state) => { state.initiatives[0].items = []; },
    (state) => { state.initiatives[0].deadline = "2025-12-31"; }
  ]) {
    const state = fixture();
    mutate(state);
    assert.throws(() => F.prepare(state, TODAY));
  }
  assert.equal(F.validDate("2026-02-30"), false);
});
