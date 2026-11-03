(function (root) {
  "use strict";
  const DAY = 86400000;
  const day = (value) => Date.parse(`${value}T00:00:00Z`) / DAY;
  const iso = (value) => new Date(value * DAY).toISOString().slice(0, 10);
  const monthKey = (value) => iso(value).slice(0, 7);
  const weekday = (value) => ![0, 6].includes(new Date(value * DAY).getUTCDay());

  function months(today) {
    const date = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    return Array.from({ length: 12 }, (_, index) => {
      const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + index, 1) / DAY;
      const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + index + 1, 1) / DAY;
      let workdays = 0;
      for (let d = start; d < end; d++) if (weekday(d)) workdays++;
      return { key: monthKey(start), start, end, workdays };
    });
  }

  function validDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(day(value)) && iso(day(value)) === value;
  }

  function prepare(state, today) {
    const calendar = months(today);
    const errors = [];
    const tasks = [];
    const resources = {};
    if (state.initiatives.length < 2) errors.push("Dodaj co najmniej dwie inicjatywy.");
    if (!state.skills.length) errors.push("Dodaj co najmniej jedną kompetencję.");
    state.teams.forEach((team) => {
      if (!team.name.trim()) errors.push("Każdy zespół musi mieć nazwę.");
      team.skills.forEach((skill) => {
        const key = `${team.id}/${skill}`;
        resources[key] = {};
        calendar.forEach((month) => {
          const stored = team.capacity[month.key]?.[skill];
          const capacity = stored === undefined ? 0 : stored;
          if (!Number.isFinite(capacity) || capacity < 0 || capacity > 10000) {
            errors.push(`Zespół ${team.name}: capacity musi być liczbą od 0 do 10000.`);
          }
          resources[key][month.key] = capacity / month.workdays;
        });
      });
    });
    state.initiatives.forEach((initiative) => {
      const prefix = initiative.name || "Inicjatywa bez nazwy";
      if (!initiative.name.trim()) errors.push("Każda inicjatywa musi mieć nazwę.");
      if (!validDate(initiative.start)) errors.push(`${prefix}: podaj poprawną datę startu.`);
      if (initiative.deadline && !validDate(initiative.deadline)) errors.push(`${prefix}: niepoprawny fixed date.`);
      if (!initiative.skills.length) errors.push(`${prefix}: wybierz potrzebne kompetencje.`);
      if (!initiative.items.length) errors.push(`${prefix}: dodaj co najmniej jeden element.`);
      initiative.skills.forEach((skillId) => {
        if (!initiative.items.some((item) => item.skillId === skillId)) {
          const skill = state.skills.find((entry) => entry.id === skillId);
          errors.push(`${prefix}: brakuje elementu dla kompetencji ${skill?.name || "usuniętej"}.`);
        }
      });
      let predecessor = -1;
      initiative.items.forEach((item) => {
        const label = `${prefix} / ${item.name || "Element bez nazwy"}`;
        const team = state.teams.find((entry) => entry.id === item.teamId);
        if (!item.name.trim()) errors.push(`${prefix}: każdy element musi mieć nazwę.`);
        if (!team || !team.skills.includes(item.skillId) || !initiative.skills.includes(item.skillId)) {
          errors.push(`${label}: wybierz zespół i kompetencję pasującą do inicjatywy i zespołu.`);
        }
        if (!Number.isFinite(item.min) || !Number.isFinite(item.max) || item.min <= 0 || item.max < item.min || item.max > 10000) {
          errors.push(`${label}: wymagane 0 < min ≤ max ≤ 10000 dni pracy.`);
        }
        if (item.start && !validDate(item.start)) errors.push(`${label}: niepoprawna data startu.`);
        if (item.deadline && !validDate(item.deadline)) errors.push(`${label}: niepoprawny fixed date.`);
        const start = Math.max(day(today), day(initiative.start), item.start ? day(item.start) : -Infinity);
        if (item.deadline && day(item.deadline) < start) errors.push(`${label}: fixed date jest przed datą startu.`);
        if (initiative.deadline && day(initiative.deadline) < start) errors.push(`${prefix}: fixed date inicjatywy jest przed datą startu elementu.`);
        tasks.push({ id: item.id, initiativeId: initiative.id, resource: `${item.teamId}/${item.skillId}`, min: item.min, max: item.max, start, predecessor });
        predecessor = tasks.length - 1;
      });
    });
    if (errors.length) throw new Error([...new Set(errors)].join("\n"));
    return { tasks, resources, calendar, today: day(today), end: calendar[11].end };
  }

  function run(model, random = Math.random) {
    const remaining = model.tasks.map((task) => task.min + random() * (task.max - task.min));
    const starts = model.tasks.map(() => Infinity);
    const ends = model.tasks.map(() => Infinity);
    for (let d = model.today; d < model.end; d++) {
      if (!weekday(d)) continue;
      const month = monthKey(d);
      const available = {};
      model.tasks.forEach((task, index) => {
        if (remaining[index] <= 0 || task.start > d ||
            (task.predecessor !== -1 && ends[task.predecessor] >= d)) return;
        if (!(task.resource in available)) available[task.resource] = model.resources[task.resource][month] || 0;
        const used = Math.min(remaining[index], available[task.resource]);
        if (used <= 0) return;
        starts[index] = Math.min(starts[index], d);
        remaining[index] -= used;
        available[task.resource] -= used;
        if (remaining[index] < 1e-9) {
          remaining[index] = 0;
          ends[index] = d;
        }
      });
      if (remaining.every((value) => value === 0)) break;
    }
    return { starts, ends };
  }

  function percentile(values, probability = .85) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.ceil(sorted.length * probability) - 1];
  }

  function summarize(model, samples, state) {
    const stats = (starts, ends, deadline) => ({
      start: percentile(starts),
      end: percentile(ends),
      completion: ends.filter(Number.isFinite).length / samples.length,
      chance: deadline && day(deadline) < model.end
        ? ends.filter((end) => end <= day(deadline)).length / samples.length : null
    });
    const items = {};
    model.tasks.forEach((task, index) => {
      const initiative = state.initiatives.find((entry) => entry.id === task.initiativeId);
      const item = initiative.items.find((entry) => entry.id === task.id);
      items[task.id] = stats(samples.map((sample) => sample.starts[index]), samples.map((sample) => sample.ends[index]), item.deadline);
    });
    const initiatives = {};
    state.initiatives.forEach((initiative) => {
      const indexes = model.tasks.map((task, index) => task.initiativeId === initiative.id ? index : -1).filter((index) => index >= 0);
      initiatives[initiative.id] = stats(
        samples.map((sample) => Math.min(...indexes.map((index) => sample.starts[index]))),
        samples.map((sample) => Math.max(...indexes.map((index) => sample.ends[index]))),
        initiative.deadline
      );
    });
    return { items, initiatives, calendar: model.calendar, runs: samples.length };
  }

  const api = { DAY, day, iso, months, validDate, prepare, run, percentile, summarize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RoadmapForecast = api;
})(typeof window !== "undefined" ? window : globalThis);
