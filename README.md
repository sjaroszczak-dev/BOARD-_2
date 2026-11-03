# BOARD-_2
RM

## Roadmap & Capacity Forecast Dashboard

A single-page, dark-mode/gold-themed dashboard for building a multi-team, multi-initiative
roadmap with Monte Carlo (P85) delivery forecasts. Open `index.html` (new "Roadmap i Prognoza"
tab) directly in a browser, or publish via GitHub Pages — no build step required.

Features:

- Manage **competencies** (add/remove), teams (name + competency checkboxes) and
  **initiatives** (2 or more, name + required competency checkboxes).
- 12-month-ahead **capacity calendar** per team/competency, with one-click cloning of a
  month's value to the rest of the year.
- Per-item delivery **min/max estimates**, start date and optional **fixed date**.
- **Monte Carlo simulation** (2000 runs, triangular distribution) consuming each team's
  monthly capacity day-by-day to forecast the **P50/P85** completion date, flagging items
  at risk of missing their fixed date.
- An SVG **Gantt chart** visualizing all initiatives/items with P50 markers, P85 bars,
  fixed-date diamonds and risk highlighting.
- All data persists in the browser's `localStorage`; use **Eksportuj/Importuj** to
  share/back up a dataset as JSON.

### Publishing to GitHub Pages

A workflow at `.github/workflows/pages.yml` deploys the repository root to GitHub Pages on
every push to `main`. Enable it once under **Settings → Pages → Source: GitHub Actions**.

