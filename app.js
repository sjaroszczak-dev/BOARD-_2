(() => {
  "use strict";
  const F = window.RoadmapForecast;
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const id = () => crypto.randomUUID();
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const dateLabel = (value) => Number.isFinite(value) ? new Intl.DateTimeFormat("pl-PL", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value * F.DAY)) : "Poza horyzontem";
  const percent = (value) => new Intl.NumberFormat("pl-PL", { style: "percent", maximumFractionDigits: 1 }).format(value);
  let calendar = F.months(today());
  const monthLabel = (month) => new Intl.DateTimeFormat("pl-PL", { timeZone: "UTC", month: "short", year: "2-digit" }).format(new Date(month.start * F.DAY));
  const storageKey = "board-roadmap-v1";
  let forecast = null;
  let generation = 0;

  function demo() {
    const skills = [".net", "mobile", "frontend", "altamirka"].map((name) => ({ id: id(), name }));
    const teams = [
      { id: id(), name: "Atlas", skills: [skills[0].id, skills[2].id], capacity: {} },
      { id: id(), name: "Nova", skills: [skills[1].id, skills[3].id], capacity: {} }
    ];
    teams.forEach((team) => calendar.forEach((month) => {
      team.capacity[month.key] = Object.fromEntries(team.skills.map((skill) => [skill, 18]));
    }));
    const item = (name, team, skill, min, max) => ({ id: id(), name, teamId: teams[team].id, skillId: skills[skill].id, min, max, start: "", deadline: "" });
    return { skills, teams, initiatives: [
      { id: id(), name: "Portal klienta", skills: [skills[0].id, skills[2].id], start: today(), deadline: "", items: [item("API i integracje", 0, 0, 15, 30), item("Panel klienta", 0, 2, 10, 22)] },
      { id: id(), name: "Doświadczenie mobilne", skills: [skills[1].id, skills[3].id], start: today(), deadline: "", items: [item("Aplikacja mobilna", 1, 1, 20, 40), item("Integracja altamirka", 1, 3, 8, 18)] }
    ] };
  }

  function validSaved(data) {
    const text = (value, max = 160) => typeof value === "string" && value.length <= max;
    const identifier = (value) => text(value, 80) && /^[a-zA-Z0-9-]+$/.test(value);
    const list = (value, max) => Array.isArray(value) && value.length <= max;
    const refs = (value) => list(value, 50) && value.every(identifier);
    const date = (value) => value === "" || F.validDate(value);
    const number = (value) => value === null || (typeof value === "number" && Number.isFinite(value));
    if (!data || !list(data.skills, 50) || !list(data.teams, 50) || !list(data.initiatives, 50) || data.initiatives.length < 2) return false;
    const entities = [...data.skills, ...data.teams, ...data.initiatives];
    if (!entities.every((entry) => entry && identifier(entry.id) && text(entry.name))) return false;
    if (!data.skills.length || !data.skills.every((skill) => text(skill.name, 80))) return false;
    if (!data.teams.every((team) => refs(team.skills) && team.capacity && typeof team.capacity === "object" &&
      !Array.isArray(team.capacity) && Object.entries(team.capacity).every(([month, capacities]) =>
        /^\d{4}-\d{2}$/.test(month) && capacities && typeof capacities === "object" &&
        !Array.isArray(capacities) && Object.entries(capacities).every(([skill, value]) => identifier(skill) && number(value))))) return false;
    if (!data.initiatives.every((initiative) => refs(initiative.skills) && date(initiative.start) && date(initiative.deadline) &&
      list(initiative.items, 100) && initiative.items.every((item) => item && identifier(item.id) && text(item.name) &&
        text(item.teamId, 80) && text(item.skillId, 80) && number(item.min) && number(item.max) && date(item.start) && date(item.deadline)))) return false;
    const ids = [...entities.map((entry) => entry.id), ...data.initiatives.flatMap((entry) => entry.items.map((item) => item.id))];
    return new Set(ids).size === ids.length;
  }

  let state;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    state = validSaved(saved) ? saved : demo();
  } catch { state = demo(); }

  function message(text, error = false) {
    const box = document.getElementById("message");
    box.textContent = text;
    box.classList.toggle("error", error);
    box.hidden = !text;
  }

  function changed() {
    generation++;
    forecast = null;
    document.getElementById("forecast-button").disabled = false;
    document.getElementById("forecast-button").textContent = "Przelicz prognozę ↗";
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      document.getElementById("save-status").textContent = "✓ Zapisano w tej przeglądarce";
    } catch { document.getElementById("save-status").textContent = "Brak zapisu — pamięć przeglądarki niedostępna lub pełna"; }
    message("Dane zmienione. Przelicz prognozę, aby zaktualizować roadmapę.");
    renderRoadmap();
  }

  function refreshCalendar() {
    const next = F.months(today());
    if (next[0].key === calendar[0].key) return;
    calendar = next;
    changed();
    render();
    message("Nowy miesiąc: kalendarz odświeżony. Uzupełnij capacity ostatniego miesiąca i przelicz prognozę.");
  }

  const input = (label, value, field, entity, type = "text") => `<label class="field">${escape(label)}<input type="${type}" value="${escape(value)}" data-field="${field}" data-id="${entity}" ${type === "text" ? 'maxlength="160"' : ""}></label>`;
  const checks = (selected, type, entity) => `<div class="checks">${state.skills.map((skill) => `<label><input type="checkbox" data-check="${type}" data-id="${entity}" value="${skill.id}" ${selected.includes(skill.id) ? "checked" : ""}>${escape(skill.name)}</label>`).join("")}</div>`;
  const options = (entries, selected, placeholder) => `<option value="">${placeholder}</option>${entries.map((entry) => `<option value="${entry.id}" ${entry.id === selected ? "selected" : ""}>${escape(entry.name)}</option>`).join("")}`;
  const moveButtons = (type, entity, index, length) => `<button data-action="move-${type}" data-id="${entity}" data-direction="-1" aria-label="Przesuń wyżej" ${index === 0 ? "disabled" : ""}>↑</button><button data-action="move-${type}" data-id="${entity}" data-direction="1" aria-label="Przesuń niżej" ${index === length - 1 ? "disabled" : ""}>↓</button>`;

  function renderInitiatives() {
    document.getElementById("initiatives").innerHTML = state.initiatives.map((initiative, index) => `
      <article class="card" data-initiative="${initiative.id}">
        <div class="section-heading"><h3><span class="gold">${String(index + 1).padStart(2, "0")}</span> · ${escape(initiative.name || "Nowa inicjatywa")}</h3><div class="actions">
          ${moveButtons("initiative", initiative.id, index, state.initiatives.length)}
          <button class="danger" data-action="remove-initiative" data-id="${initiative.id}" ${state.initiatives.length <= 2 ? "disabled" : ""}>Usuń inicjatywę</button>
        </div></div>
        <div class="form-grid">${input("Nazwa inicjatywy", initiative.name, "initiative-name", initiative.id)}
          ${input("Data startu", initiative.start, "initiative-start", initiative.id, "date")}
          ${input("Fixed date (opcjonalnie)", initiative.deadline, "initiative-deadline", initiative.id, "date")}</div>
        <fieldset><legend>Potrzebne kompetencje</legend>${checks(initiative.skills, "initiative", initiative.id)}</fieldset>
        <div class="table-scroll"><table class="items-table"><caption class="sr-only">Elementy inicjatywy ${escape(initiative.name)}</caption>
          <thead><tr><th>Element</th><th>Zespół</th><th>Kompetencja</th><th>Min dni</th><th>Max dni</th><th>Start (opcjonalnie)</th><th>Fixed date</th><th>Kolejność / usuń</th></tr></thead>
          <tbody>${initiative.items.map((item, itemIndex) => {
            const team = state.teams.find((entry) => entry.id === item.teamId);
            const skills = state.skills.filter((skill) => initiative.skills.includes(skill.id) && team?.skills.includes(skill.id));
            return `<tr data-item="${item.id}">
              <td class="item-name"><input aria-label="Nazwa elementu" maxlength="160" value="${escape(item.name)}" data-field="item-name" data-id="${item.id}"></td>
              <td class="item-team"><select aria-label="Zespół elementu" data-field="item-teamId" data-id="${item.id}">${options(state.teams, item.teamId, "Wybierz zespół")}</select></td>
              <td class="item-skill"><select aria-label="Kompetencja elementu" data-field="item-skillId" data-id="${item.id}">${options(skills, item.skillId, "Wybierz kompetencję")}</select></td>
              <td><input type="number" min="0.1" max="10000" step="any" aria-label="Minimalny nakład w dniach" value="${escape(item.min ?? "")}" data-field="item-min" data-id="${item.id}"></td>
              <td><input type="number" min="0.1" max="10000" step="any" aria-label="Maksymalny nakład w dniach" value="${escape(item.max ?? "")}" data-field="item-max" data-id="${item.id}"></td>
              <td><input type="date" aria-label="Data startu elementu" value="${escape(item.start)}" data-field="item-start" data-id="${item.id}"></td>
              <td><input type="date" aria-label="Fixed date elementu" value="${escape(item.deadline)}" data-field="item-deadline" data-id="${item.id}"></td>
              <td><div class="actions">${moveButtons("item", item.id, itemIndex, initiative.items.length)}<button class="danger" data-action="remove-item" data-id="${item.id}" aria-label="Usuń element">×</button></div></td>
            </tr>`;
          }).join("")}</tbody></table></div>
        <button data-action="add-item" data-id="${initiative.id}">+ Dodaj element</button>
      </article>`).join("");
  }

  function renderTeams() {
    document.getElementById("skills").innerHTML = state.skills.map((skill) => `<span class="skill-chip">${escape(skill.name)}<button data-action="remove-skill" data-id="${skill.id}" aria-label="Usuń kompetencję ${escape(skill.name)}" ${state.skills.length <= 1 ? "disabled" : ""}>×</button></span>`).join("");
    document.getElementById("teams").innerHTML = state.teams.length ? state.teams.map((team) => `
      <article class="card"><div class="section-heading"><h3>${escape(team.name || "Nowy zespół")}</h3><button class="danger" data-action="remove-team" data-id="${team.id}">Usuń zespół</button></div>
        <div class="form-grid">${input("Nazwa zespołu", team.name, "team-name", team.id)}</div>
        <fieldset><legend>Kompetencje zespołu</legend>${checks(team.skills, "team", team.id)}</fieldset>
        ${team.skills.length ? `<div class="table-scroll"><table class="capacity-table"><caption class="sr-only">Capacity zespołu ${escape(team.name)} w dniach pracy</caption>
          <thead><tr><th>Kompetencja / dni</th>${calendar.map((month, index) => `<th scope="col">${escape(monthLabel(month))}<button data-action="clone-capacity" data-id="${team.id}" data-month="${month.key}" ${index === 11 ? "disabled" : ""}>Klonuj →</button></th>`).join("")}</tr></thead>
          <tbody>${state.skills.filter((skill) => team.skills.includes(skill.id)).map((skill) => `<tr><th scope="row">${escape(skill.name)}</th>${calendar.map((month) => {
            const value = team.capacity[month.key]?.[skill.id];
            return `<td><input type="number" min="0" max="10000" step="any" value="${escape(value === undefined ? 0 : value ?? "")}" aria-label="${escape(`${team.name}, ${skill.name}, ${monthLabel(month)} — dni pracy`)}" data-field="capacity" data-id="${team.id}" data-skill="${skill.id}" data-month="${month.key}"></td>`;
          }).join("")}</tr>`).join("")}</tbody>
        </table></div>` : '<p class="muted">Zaznacz kompetencje zespołu, aby wprowadzić capacity.</p>'}
      </article>`).join("") : '<div class="empty">Dodaj pierwszy zespół, aby zaplanować dostępność.</div>';
  }

  function renderRoadmap() {
    const riskCount = forecast ? [...Object.values(forecast.items), ...Object.values(forecast.initiatives)].filter((result) => result.chance !== null && result.chance < .85).length : "—";
    document.getElementById("metrics").innerHTML = [
      [state.initiatives.length, "Inicjatywy w portfelu"],
      [state.teams.length, "Zespoły realizujące"],
      [state.initiatives.reduce((total, initiative) => total + initiative.items.length, 0), "Elementy do dostarczenia"],
      [riskCount, "Terminy z szansą poniżej 85%"]
    ].map(([value, label]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join("");
    if (!forecast) {
      document.getElementById("gantt").innerHTML = '<div class="empty">Twoja roadmapa zaczyna się od danych.<br>Uzupełnij inicjatywy i capacity, następnie wybierz „Przelicz prognozę”.</div>';
      document.getElementById("forecast-results").innerHTML = "";
      return;
    }
    const chartCalendar = forecast.calendar;
    const first = chartCalendar[0].start;
    const last = chartCalendar[11].end;
    const position = (day) => (day - first) / (last - first) * 100;
    const grid = chartCalendar.map((month) => `<span class="month-cell" style="left:${position(month.start)}%;width:${position(month.end) - position(month.start)}%"></span>`).join("");
    const row = (name, subtitle, result, deadline, group = false) => {
      const risk = result.chance !== null && result.chance < .85;
      let bar = '<span class="overflow-label">P85 poza horyzontem — zwiększ capacity lub zmniejsz zakres</span>';
      if (Number.isFinite(result.end)) bar = `<span class="gantt-bar ${risk ? "risk" : ""}" style="left:${position(result.start)}%;width:${position(result.end + 1) - position(result.start)}%" title="${escape(`${name}: ${dateLabel(result.start)} – ${dateLabel(result.end)} (P85)`)}"></span>`;
      const marker = deadline && F.day(deadline) >= first && F.day(deadline) < last ? `<span class="deadline" style="left:${position(F.day(deadline))}%" title="Fixed date: ${escape(deadline)}"></span>` : "";
      return `<div class="gantt-row ${group ? "gantt-group" : ""}"><div class="gantt-label">${escape(name)}<small>${escape(subtitle)}</small></div><div class="gantt-track">${grid}${bar}${marker}</div></div>`;
    };
    let chart = `<div class="gantt"><div class="gantt-row"><div class="gantt-label muted">INICJATYWA / ELEMENT</div><div class="gantt-track">${chartCalendar.map((month) => `<span class="month-cell month-title" style="left:${position(month.start)}%;width:${position(month.end) - position(month.start)}%">${escape(monthLabel(month))}</span>`).join("")}</div></div>`;
    const tableRows = [];
    const resultRow = (name, result, deadline) => {
      const chance = result.chance === null ? (deadline ? "Termin poza horyzontem" : "—") : percent(result.chance);
      return `<tr><td>${escape(name)}</td><td>${dateLabel(result.start)}</td><td>${dateLabel(result.end)}</td><td>${deadline ? dateLabel(F.day(deadline)) : "—"}</td><td class="${result.chance === null ? "" : result.chance < .85 ? "risk" : "safe"}">${chance}</td><td>${percent(result.completion)}</td></tr>`;
    };
    state.initiatives.forEach((initiative) => {
      chart += row(initiative.name, "Inicjatywa · P85", forecast.initiatives[initiative.id], initiative.deadline, true);
      tableRows.push(resultRow(initiative.name, forecast.initiatives[initiative.id], initiative.deadline));
      initiative.items.forEach((item) => {
        const team = state.teams.find((entry) => entry.id === item.teamId);
        const skill = state.skills.find((entry) => entry.id === item.skillId);
        chart += row(item.name, `${team.name} · ${skill.name}`, forecast.items[item.id], item.deadline);
        tableRows.push(resultRow(`${initiative.name} / ${item.name}`, forecast.items[item.id], item.deadline));
      });
    });
    document.getElementById("gantt").innerHTML = `${chart}</div>`;
    document.getElementById("forecast-results").innerHTML = `<div class="table-scroll"><table class="results-table"><caption class="sr-only">Wyniki ${forecast.runs} symulacji Monte Carlo</caption><thead><tr><th>Inicjatywa / element</th><th>Start P85</th><th>Koniec P85</th><th>Fixed date</th><th>Szansa terminu</th><th>Ukończenie w horyzoncie</th></tr></thead><tbody>${tableRows.join("")}</tbody></table></div>`;
  }

  function render() { renderInitiatives(); renderTeams(); renderRoadmap(); }
  function findItem(itemId) { return state.initiatives.flatMap((initiative) => initiative.items).find((item) => item.id === itemId); }

  document.addEventListener("change", (event) => {
    const target = event.target;
    const entityId = target.dataset.id;
    if (target.dataset.check) {
      const type = target.dataset.check;
      const entity = (type === "team" ? state.teams : state.initiatives).find((entry) => entry.id === entityId);
      entity.skills = target.checked ? [...entity.skills, target.value] : entity.skills.filter((skill) => skill !== target.value);
      if (!target.checked) {
        state.initiatives.forEach((initiative) => initiative.items.forEach((item) => {
          if (item.skillId === target.value && (type === "team" ? item.teamId === entityId : initiative.id === entityId)) item.skillId = "";
        }));
      }
    } else if (target.dataset.field) {
      const field = target.dataset.field;
      if (field === "capacity") {
        const team = state.teams.find((entry) => entry.id === entityId);
        team.capacity[target.dataset.month] ??= {};
        team.capacity[target.dataset.month][target.dataset.skill] = Number.isFinite(target.valueAsNumber) ? target.valueAsNumber : null;
      } else {
        const [type, key] = field.split("-");
        const entity = type === "item" ? findItem(entityId) : (type === "team" ? state.teams : state.initiatives).find((entry) => entry.id === entityId);
        entity[key] = ["min", "max"].includes(key) ? (Number.isFinite(target.valueAsNumber) ? target.valueAsNumber : null) : target.value;
        if (key === "teamId") {
          const team = state.teams.find((entry) => entry.id === entity.teamId);
          if (!team?.skills.includes(entity.skillId)) entity.skillId = "";
        }
      }
    } else return;
    changed();
    // Keep the active input mounted so tabbing through the calendar is uninterrupted.
    if (target.dataset.check || target.tagName === "SELECT") {
      renderInitiatives();
      if (target.dataset.check === "team") renderTeams();
    }
  });

  function switchTab(tab) {
    document.querySelectorAll("[data-tab]").forEach((button) => {
      const selected = button.dataset.tab === tab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      document.getElementById(`panel-${button.dataset.tab}`).hidden = !selected;
    });
  }
  document.querySelector('[role="tablist"]').addEventListener("keydown", (event) => {
    const buttons = [...document.querySelectorAll("[data-tab]")];
    const index = buttons.indexOf(event.target);
    if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    switchTab(buttons[next].dataset.tab);
    buttons[next].focus();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.dataset.tab) { switchTab(button.dataset.tab); return; }
    const action = button.dataset.action;
    const entityId = button.dataset.id;
    if (!action) return;
    if (action === "add-initiative") {
      if (state.initiatives.length >= 50) { message("Maksymalnie 50 inicjatyw.", true); return; }
      state.initiatives.push({ id: id(), name: "Nowa inicjatywa", skills: [], start: today(), deadline: "", items: [] });
    }
    if (action === "remove-initiative" && state.initiatives.length > 2) {
      if (!confirm("Usunąć inicjatywę wraz z jej elementami?")) return;
      state.initiatives = state.initiatives.filter((entry) => entry.id !== entityId);
    }
    if (action === "add-team") {
      if (state.teams.length >= 50) { message("Maksymalnie 50 zespołów.", true); return; }
      state.teams.push({ id: id(), name: "Nowy zespół", skills: [], capacity: {} });
    }
    if (action === "remove-team") {
      if (!confirm("Usunąć zespół? Elementy przypisane do niego będą wymagały ponownego przypisania.")) return;
      state.teams = state.teams.filter((entry) => entry.id !== entityId);
      state.initiatives.forEach((initiative) => initiative.items.forEach((item) => {
        if (item.teamId === entityId) { item.teamId = ""; item.skillId = ""; }
      }));
    }
    if (action === "remove-skill" && state.skills.length > 1) {
      if (!confirm("Usunąć kompetencję z inicjatyw, zespołów i capacity? Powiązane elementy będą wymagały ponownego przypisania.")) return;
      state.skills = state.skills.filter((entry) => entry.id !== entityId);
      state.teams.forEach((team) => {
        team.skills = team.skills.filter((skill) => skill !== entityId);
        Object.values(team.capacity).forEach((capacities) => delete capacities[entityId]);
      });
      state.initiatives.forEach((initiative) => {
        initiative.skills = initiative.skills.filter((skill) => skill !== entityId);
        initiative.items.forEach((item) => { if (item.skillId === entityId) item.skillId = ""; });
      });
    }
    if (action === "add-item") {
      const initiative = state.initiatives.find((entry) => entry.id === entityId);
      if (initiative.items.length >= 100) { message("Maksymalnie 100 elementów na inicjatywę.", true); return; }
      initiative.items.push({ id: id(), name: "Nowy element", teamId: "", skillId: "", min: 5, max: 10, start: "", deadline: "" });
    }
    if (action === "remove-item") {
      state.initiatives.forEach((initiative) => { initiative.items = initiative.items.filter((item) => item.id !== entityId); });
    }
    if (action.startsWith("move-")) {
      const list = action === "move-initiative" ? state.initiatives : state.initiatives.find((initiative) => initiative.items.some((item) => item.id === entityId)).items;
      const index = list.findIndex((entry) => entry.id === entityId);
      const next = index + Number(button.dataset.direction);
      if (next >= 0 && next < list.length) [list[index], list[next]] = [list[next], list[index]];
    }
    if (action === "clone-capacity") {
      const team = state.teams.find((entry) => entry.id === entityId);
      const source = team.capacity[button.dataset.month] || {};
      if (team.skills.some((skill) => {
        const value = source[skill] === undefined ? 0 : source[skill];
        return !Number.isFinite(value) || value < 0 || value > 10000;
      })) {
        message("Przed klonowaniem wpisz poprawne capacity (0–10000).", true); return;
      }
      const index = calendar.findIndex((month) => month.key === button.dataset.month);
      calendar.slice(index + 1).forEach((month) => {
        team.capacity[month.key] = Object.fromEntries(team.skills.map((skill) => [skill, source[skill] ?? 0]));
      });
    }
    changed();
    render();
  });

  document.getElementById("skill-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const field = document.getElementById("skill-name");
    const name = field.value.trim();
    if (!name) return;
    if (state.skills.length >= 50) { message("Maksymalnie 50 kompetencji.", true); return; }
    if (state.skills.some((skill) => skill.name.toLocaleLowerCase("pl") === name.toLocaleLowerCase("pl"))) {
      message("Taka kompetencja już istnieje.", true); return;
    }
    state.skills.push({ id: id(), name });
    field.value = "";
    changed();
    render();
  });
  document.getElementById("reset-button").addEventListener("click", () => {
    if (!confirm("Zastąpić wszystkie dane w tej przeglądarce przykładami?")) return;
    state = demo();
    changed();
    render();
  });

  document.getElementById("forecast-button").addEventListener("click", async () => {
    refreshCalendar();
    let model;
    try { model = F.prepare(state, today()); }
    catch (error) { message(error.message, true); return; }
    const token = ++generation;
    const button = document.getElementById("forecast-button");
    button.disabled = true;
    message("Obliczanie 1200 scenariuszy Monte Carlo…");
    const samples = [];
    try {
      for (let index = 0; index < 1200; index++) {
        if (token !== generation) return;
        samples.push(F.run(model));
        const batch = Math.max(1, Math.floor(200 / Math.max(model.tasks.length, 10)));
        if ((index + 1) % batch === 0) {
          button.textContent = `Obliczanie… ${percent((index + 1) / 1200)}`;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      if (token !== generation) return;
      forecast = F.summarize(model, samples, state);
      renderRoadmap();
      switchTab("roadmap");
      message(`✓ Przeliczono ${forecast.runs} scenariuszy. Kalendarz: ${monthLabel(forecast.calendar[0])} – ${monthLabel(forecast.calendar[11])}.`);
    } catch (error) { message(`Nie udało się obliczyć prognozy: ${error.message}`, true); }
    finally {
      if (token === generation) {
        button.disabled = false;
        button.textContent = "Przelicz prognozę ↗";
      }
    }
  });
  window.addEventListener("focus", refreshCalendar);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshCalendar(); });
  setInterval(refreshCalendar, 60000);
  render();
})();
