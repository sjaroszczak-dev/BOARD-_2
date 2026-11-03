/* BOARD — Roadmap & Capacity Forecast
 * Vanilla JS, no build step. Data persisted in localStorage.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "board1_roadmap_forecast_v1";
  const MONTHS_AHEAD = 12;
  const MC_RUNS = 2000;

  /* ---------------------------------------------------------------------
   * State
   * ------------------------------------------------------------------- */
  let state = loadState();

  function defaultState() {
    return {
      competencies: [".NET", "Mobile", "Frontend", "Altamirka"],
      teams: [],
      initiatives: [],
      items: [],
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      console.warn("Nie udało się wczytać danych, używam domyślnych.", e);
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  }

  /* ---------------------------------------------------------------------
   * Month calendar helpers (12 months ahead from current month)
   * ------------------------------------------------------------------- */
  function getMonthKeys(count) {
    const out = [];
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth(); // 0-indexed
    for (let i = 0; i < count; i++) {
      out.push({ year: y, month: m, key: y + "-" + String(m + 1).padStart(2, "0") });
      m++;
      if (m > 11) { m = 0; y++; }
    }
    return out;
  }

  const MONTH_NAMES = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function capacityKey(teamId, competency) {
    return teamId + "::" + competency;
  }

  function getTeamCapacity(team, competency) {
    if (!team.capacity) team.capacity = {};
    const key = competency;
    if (!team.capacity[key]) {
      team.capacity[key] = getMonthKeys(MONTHS_AHEAD).map(() => 0);
    }
    return team.capacity[key];
  }

  /* ---------------------------------------------------------------------
   * Monte Carlo simulation
   * ------------------------------------------------------------------- */
  function triangularRandom(min, max) {
    if (max <= min) return min;
    const mode = (min + max) / 2;
    const u = Math.random();
    const fc = (mode - min) / (max - min);
    if (u < fc) {
      return min + Math.sqrt(u * (max - min) * (mode - min));
    }
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }

  // Looks up the monthly capacity for a given team/competency/year/month.
  // If the requested month is beyond the 12-month defined calendar, the last
  // defined month's value is reused (extrapolated) so simulations can still progress.
  function lookupMonthlyCapacity(team, competency, year, month) {
    const arr = getTeamCapacity(team, competency);
    const keys = getMonthKeys(MONTHS_AHEAD);
    const idx = keys.findIndex((k) => k.year === year && k.month === month);
    if (idx >= 0) return arr[idx] || 0;
    // extrapolate using last known month
    return arr[arr.length - 1] || 0;
  }

  // Simulates completion date for a single sampled effort, stepping day by day
  // consuming the team's daily capacity (monthlyCapacity / daysInThatMonth).
  function simulateOnce(team, competency, startDate, effort) {
    let remaining = effort;
    let cur = new Date(startDate.getTime());
    const MAX_DAYS = 365 * 4; // safety cap ~4 years
    for (let d = 0; d < MAX_DAYS; d++) {
      const y = cur.getFullYear();
      const m = cur.getMonth();
      const dim = daysInMonth(y, m);
      const monthly = lookupMonthlyCapacity(team, competency, y, m);
      const daily = monthly / dim;
      if (daily > 0) {
        if (remaining <= daily) {
          return new Date(cur.getTime());
        }
        remaining -= daily;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return null; // never completes within horizon -> no capacity
  }

  function runMonteCarlo(item, team) {
    const startDate = new Date(item.startDate + "T00:00:00");
    const completions = [];
    let neverCount = 0;
    for (let i = 0; i < MC_RUNS; i++) {
      const effort = triangularRandom(Number(item.min), Number(item.max));
      const d = simulateOnce(team, item.competency, startDate, effort);
      if (d === null) { neverCount++; continue; }
      completions.push(d.getTime());
    }
    completions.sort((a, b) => a - b);
    const pick = (p) => {
      if (completions.length === 0) return null;
      const idx = Math.min(completions.length - 1, Math.floor(p * completions.length));
      return new Date(completions[idx]);
    };
    return {
      p50: pick(0.5),
      p85: pick(0.85),
      neverRatio: neverCount / MC_RUNS,
    };
  }

  /* ---------------------------------------------------------------------
   * DOM refs
   * ------------------------------------------------------------------- */
  const el = {
    competencyChips: document.getElementById("competency-chips"),
    formAddCompetency: document.getElementById("form-add-competency"),
    inputCompetency: document.getElementById("input-competency"),

    formAddTeam: document.getElementById("form-add-team"),
    inputTeamName: document.getElementById("input-team-name"),
    teamCompetencyChecks: document.getElementById("team-competency-checks"),
    teamsList: document.getElementById("teams-list"),

    formAddInitiative: document.getElementById("form-add-initiative"),
    inputInitiativeName: document.getElementById("input-initiative-name"),
    initiativeCompetencyChecks: document.getElementById("initiative-competency-checks"),
    initiativesList: document.getElementById("initiatives-list"),
    initiativeCountHint: document.getElementById("initiative-count-hint"),

    capacityTeamSelect: document.getElementById("capacity-team-select"),
    capacityCompetencySelect: document.getElementById("capacity-competency-select"),
    capacityTable: document.getElementById("capacity-table"),

    formAddItem: document.getElementById("form-add-item"),
    itemInitiative: document.getElementById("item-initiative"),
    itemName: document.getElementById("item-name"),
    itemCompetency: document.getElementById("item-competency"),
    itemTeam: document.getElementById("item-team"),
    itemMin: document.getElementById("item-min"),
    itemMax: document.getElementById("item-max"),
    itemStart: document.getElementById("item-start"),
    itemFixedEnabled: document.getElementById("item-fixed-enabled"),
    itemFixedDate: document.getElementById("item-fixed-date"),
    itemsTable: document.getElementById("items-table"),

    ganttSvg: document.getElementById("gantt-svg"),

    btnExport: document.getElementById("btn-export"),
    btnImport: document.getElementById("btn-import"),
    btnReset: document.getElementById("btn-reset"),
  };

  /* ---------------------------------------------------------------------
   * Render: competencies
   * ------------------------------------------------------------------- */
  function renderCompetencies() {
    el.competencyChips.innerHTML = "";
    state.competencies.forEach((comp) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `<span>${escapeHtml(comp)}</span>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = "Usuń kompetencję";
      btn.textContent = "×";
      btn.addEventListener("click", () => removeCompetency(comp));
      chip.appendChild(btn);
      el.competencyChips.appendChild(chip);
    });

    renderChecklist(el.teamCompetencyChecks, state.competencies, "team-comp");
    renderChecklist(el.initiativeCompetencyChecks, state.competencies, "init-comp");
    renderSelectOptions(el.capacityCompetencySelect, state.competencies);
  }

  function renderChecklist(container, options, name) {
    container.innerHTML = "";
    options.forEach((opt) => {
      const id = name + "-" + opt.replace(/\W+/g, "_");
      const label = document.createElement("label");
      label.innerHTML = `<input type="checkbox" value="${escapeHtml(opt)}" id="${id}"> ${escapeHtml(opt)}`;
      container.appendChild(label);
    });
  }

  function renderSelectOptions(select, options, placeholder) {
    const current = select.value;
    select.innerHTML = "";
    if (placeholder) {
      const o = document.createElement("option");
      o.value = ""; o.textContent = placeholder;
      select.appendChild(o);
    }
    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });
    if ([...select.options].some((o) => o.value === current)) select.value = current;
  }

  function removeCompetency(comp) {
    if (!confirm(`Usunąć kompetencję "${comp}"? Zostanie usunięta z zespołów i inicjatyw.`)) return;
    state.competencies = state.competencies.filter((c) => c !== comp);
    state.teams.forEach((t) => { t.competencies = t.competencies.filter((c) => c !== comp); });
    state.initiatives.forEach((i) => { i.competencies = i.competencies.filter((c) => c !== comp); });
    state.items = state.items.filter((it) => it.competency !== comp);
    saveState();
    renderAll();
  }

  /* ---------------------------------------------------------------------
   * Render: teams
   * ------------------------------------------------------------------- */
  function renderTeams() {
    el.teamsList.innerHTML = "";
    state.teams.forEach((team) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <div>
          <div class="name">${escapeHtml(team.name)}</div>
          <div class="meta">${team.competencies.map(escapeHtml).join(", ") || "brak kompetencji"}</div>
        </div>`;
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "✕";
      removeBtn.title = "Usuń zespół";
      removeBtn.addEventListener("click", () => removeTeam(team.id));
      row.appendChild(removeBtn);
      el.teamsList.appendChild(row);
    });

    renderSelectOptions(el.capacityTeamSelect, state.teams.map((t) => t.name));
    renderSelectOptions(el.itemTeam, [], "Wybierz zespół");
  }

  function removeTeam(id) {
    if (!confirm("Usunąć ten zespół? Powiązane elementy stracą przypisany zespół.")) return;
    state.teams = state.teams.filter((t) => t.id !== id);
    state.items = state.items.filter((it) => it.teamId !== id);
    saveState();
    renderAll();
  }

  /* ---------------------------------------------------------------------
   * Render: initiatives
   * ------------------------------------------------------------------- */
  function renderInitiatives() {
    el.initiativesList.innerHTML = "";
    state.initiatives.forEach((init) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <div>
          <div class="name">${escapeHtml(init.name)}</div>
          <div class="meta">${init.competencies.map(escapeHtml).join(", ") || "brak kompetencji"}</div>
        </div>`;
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "✕";
      removeBtn.title = "Usuń inicjatywę";
      removeBtn.addEventListener("click", () => removeInitiative(init.id));
      row.appendChild(removeBtn);
      el.initiativesList.appendChild(row);
    });

    const count = state.initiatives.length;
    el.initiativeCountHint.textContent = count < 2
      ? `Dodano ${count} inicjatyw(ę). Dodaj co najmniej 2, aby zbudować pełną roadmapę.`
      : `Liczba inicjatyw: ${count}.`;
    el.initiativeCountHint.classList.toggle("warn", count < 2);

    const options = state.initiatives.map((i) => ({ value: i.id, label: i.name }));
    el.itemInitiative.innerHTML = '<option value="">Wybierz inicjatywę</option>';
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value; opt.textContent = o.label;
      el.itemInitiative.appendChild(opt);
    });
  }

  function removeInitiative(id) {
    if (!confirm("Usunąć tę inicjatywę wraz z jej elementami?")) return;
    state.initiatives = state.initiatives.filter((i) => i.id !== id);
    state.items = state.items.filter((it) => it.initiativeId !== id);
    saveState();
    renderAll();
  }

  /* ---------------------------------------------------------------------
   * Capacity calendar
   * ------------------------------------------------------------------- */
  function renderCapacityTable() {
    const teamName = el.capacityTeamSelect.value;
    const team = state.teams.find((t) => t.name === teamName);
    const competency = el.capacityCompetencySelect.value;
    el.capacityTable.innerHTML = "";

    if (!team || !competency) {
      el.capacityTable.innerHTML = "<tr><td>Wybierz zespół i kompetencję, aby edytować capacity.</td></tr>";
      return;
    }
    if (!team.competencies.includes(competency)) {
      el.capacityTable.innerHTML = `<tr><td>Zespół "${escapeHtml(team.name)}" nie posiada kompetencji "${escapeHtml(competency)}".</td></tr>`;
      return;
    }

    const months = getMonthKeys(MONTHS_AHEAD);
    const capacityArr = getTeamCapacity(team, competency);

    const headRow = document.createElement("tr");
    headRow.innerHTML = "<th>Miesiąc</th>" + months.map((m) => `<th>${MONTH_NAMES[m.month]} ${m.year}</th>`).join("");
    el.capacityTable.appendChild(headRow);

    const valueRow = document.createElement("tr");
    let cells = `<td class="row-head">Capacity</td>`;
    months.forEach((m, idx) => {
      cells += `<td><input type="number" min="0" step="0.5" value="${escapeHtml(capacityArr[idx] ?? 0)}" data-idx="${idx}" class="capacity-input"></td>`;
    });
    valueRow.innerHTML = cells;
    el.capacityTable.appendChild(valueRow);

    const cloneRow = document.createElement("tr");
    let cloneCells = `<td class="row-head">Klonuj →</td>`;
    months.forEach((m, idx) => {
      cloneCells += `<td><button type="button" class="clone-btn" data-idx="${idx}" title="Skopiuj wartość tego miesiąca na wszystkie kolejne miesiące roku">⇒ reszta roku</button></td>`;
    });
    cloneRow.innerHTML = cloneCells;
    el.capacityTable.appendChild(cloneRow);

    el.capacityTable.querySelectorAll(".capacity-input").forEach((input) => {
      input.addEventListener("change", () => {
        const idx = Number(input.dataset.idx);
        capacityArr[idx] = Number(input.value) || 0;
        saveState();
        renderItemsTable();
        renderGantt();
      });
    });

    el.capacityTable.querySelectorAll(".clone-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const value = capacityArr[idx] || 0;
        for (let i = idx + 1; i < capacityArr.length; i++) capacityArr[i] = value;
        saveState();
        renderCapacityTable();
        renderItemsTable();
        renderGantt();
      });
    });
  }

  /* ---------------------------------------------------------------------
   * Items (deliverables) form + table
   * ------------------------------------------------------------------- */
  function updateItemFormContext() {
    const initId = el.itemInitiative.value;
    const init = state.initiatives.find((i) => i.id === initId);
    const comps = init ? init.competencies : [];
    renderSelectOptions(el.itemCompetency, comps, "Wybierz kompetencję");
    updateItemTeamOptions();
  }

  function updateItemTeamOptions() {
    const competency = el.itemCompetency.value;
    const eligible = state.teams.filter((t) => !competency || t.competencies.includes(competency));
    const current = el.itemTeam.value;
    el.itemTeam.innerHTML = '<option value="">Wybierz zespół</option>';
    eligible.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id; opt.textContent = t.name;
      el.itemTeam.appendChild(opt);
    });
    if (eligible.some((t) => t.id === current)) el.itemTeam.value = current;
  }

  function renderItemsTable() {
    el.itemsTable.innerHTML = "";
    if (state.items.length === 0) {
      el.itemsTable.innerHTML = "<tr><td>Brak elementów. Dodaj pierwszy powyżej.</td></tr>";
      return;
    }
    const headRow = document.createElement("tr");
    headRow.innerHTML = [
      "Inicjatywa", "Element", "Kompetencja", "Zespół", "Min", "Max",
      "Start", "Fixed date", "P50 (MC)", "P85 (MC)", "Status", "",
    ].map((h) => `<th>${h}</th>`).join("");
    el.itemsTable.appendChild(headRow);

    state.items.forEach((item) => {
      const init = state.initiatives.find((i) => i.id === item.initiativeId);
      const team = state.teams.find((t) => t.id === item.teamId);
      let forecast = { p50: null, p85: null, neverRatio: 1 };
      if (team) forecast = runMonteCarlo(item, team);
      item._forecast = forecast;

      const fixedDate = item.fixedEnabled && item.fixedDate ? new Date(item.fixedDate + "T00:00:00") : null;
      const atRisk = fixedDate && forecast.p85 && forecast.p85.getTime() > fixedDate.getTime();
      let status = "—";
      if (!team) status = "Brak zespołu";
      else if (forecast.neverRatio > 0.5) status = "Brak capacity";
      else if (fixedDate) status = atRisk ? "Ryzyko opóźnienia" : "W terminie";
      else status = "Prognoza OK";

      const row = document.createElement("tr");
      if (atRisk) row.classList.add("risk-row");
      row.innerHTML = `
        <td>${escapeHtml(init ? init.name : "—")}</td>
        <td class="row-head">${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.competency)}</td>
        <td>${escapeHtml(team ? team.name : "—")}</td>
        <td>${escapeHtml(item.min)}</td>
        <td>${escapeHtml(item.max)}</td>
        <td>${escapeHtml(item.startDate)}</td>
        <td>${fixedDate ? escapeHtml(item.fixedDate) : "—"}</td>
        <td>${forecast.p50 ? fmtDate(forecast.p50) : "—"}</td>
        <td>${forecast.p85 ? fmtDate(forecast.p85) : "—"}</td>
        <td>${escapeHtml(status)}</td>
      `;
      const tdRemove = document.createElement("td");
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "✕";
      removeBtn.title = "Usuń element";
      removeBtn.addEventListener("click", () => removeItem(item.id));
      tdRemove.appendChild(removeBtn);
      row.appendChild(tdRemove);
      el.itemsTable.appendChild(row);
    });
  }

  function removeItem(id) {
    state.items = state.items.filter((it) => it.id !== id);
    saveState();
    renderItemsTable();
    renderGantt();
  }

  function fmtDate(d) {
    return d.toLocaleDateString("pl-PL", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  /* ---------------------------------------------------------------------
   * Gantt chart (SVG)
   * ------------------------------------------------------------------- */
  function renderGantt() {
    const svg = el.ganttSvg;
    svg.innerHTML = "";

    const rows = state.items.map((item) => {
      const init = state.initiatives.find((i) => i.id === item.initiativeId);
      const team = state.teams.find((t) => t.id === item.teamId);
      const forecast = item._forecast || (team ? runMonteCarlo(item, team) : { p50: null, p85: null, neverRatio: 1 });
      return { item, init, team, forecast };
    }).filter((r) => r.forecast.p85);

    if (rows.length === 0) {
      svg.setAttribute("height", 80);
      const text = svgEl("text", { x: 20, y: 40, fill: "#a6a9b3" }, "Brak danych do wyświetlenia. Dodaj elementy z zespołem i prognozą.");
      svg.appendChild(text);
      return;
    }

    const startDate = new Date(Math.min(...rows.map((r) => new Date(r.item.startDate + "T00:00:00").getTime())));
    const endCandidates = rows.map((r) => r.forecast.p85.getTime());
    rows.forEach((r) => { if (r.item.fixedEnabled && r.item.fixedDate) endCandidates.push(new Date(r.item.fixedDate + "T00:00:00").getTime()); });
    const endDate = new Date(Math.max(...endCandidates));

    const paddingLeft = 220;
    const paddingTop = 40;
    const rowHeight = 30;
    const chartWidth = Math.max(700, rows.length > 0 ? 900 : 700);
    const totalDays = Math.max(1, Math.round((endDate - startDate) / 86400000)) + 14;
    const pxPerDay = chartWidth / totalDays;
    const chartHeight = paddingTop + rows.length * rowHeight + 30;

    svg.setAttribute("height", chartHeight);
    svg.setAttribute("viewBox", `0 0 ${paddingLeft + chartWidth + 30} ${chartHeight}`);

    // Month gridlines
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor < endDate) {
      const x = paddingLeft + ((cursor - startDate) / 86400000) * pxPerDay;
      svg.appendChild(svgEl("line", {
        x1: x, y1: paddingTop - 20, x2: x, y2: chartHeight - 10,
        stroke: "#2b2e37", "stroke-width": 1,
      }));
      svg.appendChild(svgEl("text", {
        x: x + 4, y: paddingTop - 24, fill: "#a6a9b3", "font-size": 11,
      }, `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    rows.forEach((r, idx) => {
      const y = paddingTop + idx * rowHeight;
      const rowStart = new Date(r.item.startDate + "T00:00:00");
      const x0 = paddingLeft + ((rowStart - startDate) / 86400000) * pxPerDay;
      const xP50 = r.forecast.p50 ? paddingLeft + ((r.forecast.p50 - startDate) / 86400000) * pxPerDay : null;
      const xP85 = paddingLeft + ((r.forecast.p85 - startDate) / 86400000) * pxPerDay;

      const fixedDate = r.item.fixedEnabled && r.item.fixedDate ? new Date(r.item.fixedDate + "T00:00:00") : null;
      const atRisk = fixedDate && r.forecast.p85.getTime() > fixedDate.getTime();

      // label
      const label = (r.init ? r.init.name + " / " : "") + r.item.name;
      svg.appendChild(svgEl("text", {
        x: 6, y: y + rowHeight / 2 + 4, fill: "#e9e6df", "font-size": 12,
      }, truncate(label, 32)));

      // base bar (start -> p85)
      svg.appendChild(svgEl("rect", {
        x: x0, y: y + 6, width: Math.max(2, xP85 - x0), height: 14,
        rx: 3, fill: atRisk ? "#e2584d" : "#d4af37", opacity: 0.85,
      }));

      // p50 marker
      if (xP50 !== null) {
        svg.appendChild(svgEl("line", {
          x1: xP50, y1: y + 2, x2: xP50, y2: y + 24,
          stroke: "#7a6a2a", "stroke-width": 2,
        }));
      }

      // fixed date marker (diamond)
      if (fixedDate) {
        const xf = paddingLeft + ((fixedDate - startDate) / 86400000) * pxPerDay;
        svg.appendChild(svgEl("polygon", {
          points: `${xf},${y} ${xf + 6},${y + 10} ${xf},${y + 20} ${xf - 6},${y + 10}`,
          fill: "#ffffff", stroke: "#d4af37", "stroke-width": 1,
        }));
      }

      const titleEl = svgEl("title", {}, `${label}\nStart: ${r.item.startDate}\nP50: ${r.forecast.p50 ? fmtDate(r.forecast.p50) : "—"}\nP85: ${fmtDate(r.forecast.p85)}${fixedDate ? "\nFixed: " + r.item.fixedDate : ""}`);
      svg.lastChild.insertBefore(titleEl, svg.lastChild.firstChild);
    });
  }

  function svgEl(tag, attrs, text) {
    const ns = "http://www.w3.org/2000/svg";
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function truncate(str, n) {
    return str.length > n ? str.slice(0, n - 1) + "…" : str;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* ---------------------------------------------------------------------
   * Event handlers
   * ------------------------------------------------------------------- */
  el.formAddCompetency.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = el.inputCompetency.value.trim();
    if (!name) return;
    if (state.competencies.some((c) => c.toLowerCase() === name.toLowerCase())) {
      alert("Taka kompetencja już istnieje.");
      return;
    }
    state.competencies.push(name);
    el.inputCompetency.value = "";
    saveState();
    renderAll();
  });

  el.formAddTeam.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = el.inputTeamName.value.trim();
    if (!name) return;
    const checked = [...el.teamCompetencyChecks.querySelectorAll("input:checked")].map((i) => i.value);
    state.teams.push({ id: uid("team"), name, competencies: checked, capacity: {} });
    el.inputTeamName.value = "";
    el.teamCompetencyChecks.querySelectorAll("input").forEach((i) => (i.checked = false));
    saveState();
    renderAll();
  });

  el.formAddInitiative.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = el.inputInitiativeName.value.trim();
    if (!name) return;
    const checked = [...el.initiativeCompetencyChecks.querySelectorAll("input:checked")].map((i) => i.value);
    state.initiatives.push({ id: uid("init"), name, competencies: checked });
    el.inputInitiativeName.value = "";
    el.initiativeCompetencyChecks.querySelectorAll("input").forEach((i) => (i.checked = false));
    saveState();
    renderAll();
  });

  el.capacityTeamSelect.addEventListener("change", renderCapacityTable);
  el.capacityCompetencySelect.addEventListener("change", renderCapacityTable);

  el.itemInitiative.addEventListener("change", updateItemFormContext);
  el.itemCompetency.addEventListener("change", updateItemTeamOptions);
  el.itemFixedEnabled.addEventListener("change", () => {
    el.itemFixedDate.disabled = !el.itemFixedEnabled.checked;
    if (!el.itemFixedEnabled.checked) el.itemFixedDate.value = "";
  });

  el.formAddItem.addEventListener("submit", (e) => {
    e.preventDefault();
    const initiativeId = el.itemInitiative.value;
    const competency = el.itemCompetency.value;
    const teamId = el.itemTeam.value;
    const name = el.itemName.value.trim();
    const min = Number(el.itemMin.value);
    const max = Number(el.itemMax.value);
    const startDate = el.itemStart.value;
    const fixedEnabled = el.itemFixedEnabled.checked;
    const fixedDate = fixedEnabled ? el.itemFixedDate.value : "";

    if (!initiativeId || !competency || !teamId || !name || !startDate) {
      alert("Uzupełnij wszystkie wymagane pola elementu.");
      return;
    }
    if (max < min) {
      alert("Wartość Max nie może być mniejsza niż Min.");
      return;
    }
    if (fixedEnabled && !fixedDate) {
      alert("Podaj fixed date lub odznacz tę opcję.");
      return;
    }

    state.items.push({
      id: uid("item"), initiativeId, name, competency, teamId,
      min, max, startDate, fixedEnabled, fixedDate,
    });

    el.formAddItem.reset();
    el.itemFixedDate.disabled = true;
    updateItemFormContext();
    saveState();
    renderItemsTable();
    renderGantt();
  });

  el.btnExport.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "board1-roadmap-export.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  el.btnImport.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        state = Object.assign(defaultState(), parsed);
        saveState();
        renderAll();
      } catch (err) {
        alert("Nieprawidłowy plik JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  el.btnReset.addEventListener("click", () => {
    if (!confirm("Czy na pewno chcesz usunąć wszystkie dane?")) return;
    state = defaultState();
    saveState();
    renderAll();
  });

  // Tabs (extensible: currently a single tab, structure supports more)
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  /* ---------------------------------------------------------------------
   * Full render + init
   * ------------------------------------------------------------------- */
  function renderAll() {
    renderCompetencies();
    renderTeams();
    renderInitiatives();
    updateItemFormContext();
    renderCapacityTable();
    renderItemsTable();
    renderGantt();
  }

  function seedDefaultDataIfEmpty() {
    if (state.teams.length === 0 && state.initiatives.length === 0 && state.items.length === 0) {
      const today = new Date();
      const iso = (d) => d.toISOString().slice(0, 10);

      state.teams.push(
        { id: uid("team"), name: "Zespół Alfa", competencies: [".NET", "Frontend"], capacity: {} },
        { id: uid("team"), name: "Zespół Beta", competencies: ["Mobile", "Altamirka"], capacity: {} }
      );
      state.teams.forEach((t) => {
        t.competencies.forEach((c) => {
          const arr = getTeamCapacity(t, c);
          for (let i = 0; i < arr.length; i++) arr[i] = 20;
        });
      });

      state.initiatives.push(
        { id: uid("init"), name: "Inicjatywa Płatności", competencies: [".NET", "Frontend"] },
        { id: uid("init"), name: "Inicjatywa Mobile Onboarding", competencies: ["Mobile", "Altamirka"] }
      );

      const init1 = state.initiatives[0];
      const init2 = state.initiatives[1];
      const teamAlfa = state.teams[0];
      const teamBeta = state.teams[1];
      const start1 = new Date(today.getFullYear(), today.getMonth(), 1);
      const fixed1 = new Date(today.getFullYear(), today.getMonth() + 3, 15);

      state.items.push(
        { id: uid("item"), initiativeId: init1.id, name: "API płatności", competency: ".NET", teamId: teamAlfa.id, min: 15, max: 30, startDate: iso(start1), fixedEnabled: true, fixedDate: iso(fixed1) },
        { id: uid("item"), initiativeId: init1.id, name: "UI koszyka", competency: "Frontend", teamId: teamAlfa.id, min: 10, max: 20, startDate: iso(start1), fixedEnabled: false, fixedDate: "" },
        { id: uid("item"), initiativeId: init2.id, name: "Ekran powitalny", competency: "Mobile", teamId: teamBeta.id, min: 8, max: 16, startDate: iso(start1), fixedEnabled: false, fixedDate: "" }
      );
      saveState();
    }
  }

  seedDefaultDataIfEmpty();
  renderAll();
})();
