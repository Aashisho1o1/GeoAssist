# GeoAssist

GeoAssist is a React + TypeScript web app that lets people ask plain-English questions against three public ArcGIS Feature Services and see the results on an interactive map.

**[Try the live demo →](https://aashisho1o1.github.io/GeoAssist/)**

[![GeoAssist: choose a dataset, then ask the map a question](assets/demo.png)](https://aashisho1o1.github.io/GeoAssist/)

No API key needed for the example questions: they run pre-translated queries against the live ArcGIS services. Add a Claude API key to ask your own questions.

## Why This Project

Public GIS datasets are powerful but hard to query without ArcGIS REST syntax. GeoAssist translates natural language into ArcGIS query parameters so non-GIS users can explore hospitals, schools, and cities with no query-language training.

## Core Features

- Natural language to ArcGIS REST query translation using Claude (structured JSON output)
- Generated SQL is checked against the live layer before it runs: field names, SQL shape, and the values of coded fields
- Hospitals the layer marks as closed are left out unless the question asks about them
- Every answer says how many rows are shown and how many match in total ("Showing 50 of 748 matching results" for open hospitals in Texas)
- The data source, the account that hosts it, and the date the layer's data was last edited are shown under the results
- Interactive ArcGIS map with result graphics and popup details
- Dataset selector for US hospitals, public schools, and major cities
- Chat-style query history and AI summary responses
- Query inspector to show generated `where`, `outFields`, and `orderByFields`
- Result list with click-to-highlight behavior on map
- Calcite-based UI with dark mode and keyboard-accessible controls

## Architecture Flow

1. User selects a dataset and submits a question.
2. The app reads the layer's schema (fields, types, real values) from the service. `lib/translate.ts` sends the question and that schema to Claude, which returns query params as schema-checked JSON. Example questions never call Claude, with or without a key: they use their pre-translated query.
3. `lib/prepareQuery.ts` runs the query through the shared gate, which rejects unknown fields, unsafe SQL, and values that are not in the layer.
4. `lib/arcgis.ts` calls `{featureServiceUrl}/query` twice in parallel: once for the rows to show, once with `returnCountOnly=true` for the total.
5. `MapPanel` + `lib/mapGraphics.ts` render results and handle highlighting.
6. Sidebar shows chat summary, query inspector, and result list.

## Tech Stack

- React 19 + TypeScript (strict mode)
- Vite
- `@arcgis/map-components`
- `@esri/calcite-components`
- Public ArcGIS Feature Services (see Data sources)
- Anthropic Messages API (frontend direct for demo)

## Local Development

### Prerequisites

- Node.js 20.19 or later, or 22.12 or later (what Vite 7 requires)
- npm
- Claude API key (optional; only needed for your own questions)

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Test

```bash
npm test
```

The tests cover how the app uses the shared gate, the text the model is shown, the row and count requests (with ArcGIS mocked, so they run offline), and the result summary. The gate itself is tested in geoassist-mcp. There are no UI tests yet.

## Data sources

| Dataset | Origin | Hosted on ArcGIS Online by | Data last edited (what the app shows) | What the records describe |
| --- | --- | --- | --- | --- |
| Hospitals | HIFLD Hospitals | FEMA Region 6 GIS ([item](https://www.arcgis.com/home/item.html?id=38eebc0197034d59b331eaa7f753cdb0)) | August 30, 2021 | Newest source date inside the data: May 2018 |
| Public schools | HIFLD Public Schools, from NCES Common Core of Data | FEMA, account `FEMA_HQ_Preparedness_NIC` ([item](https://www.arcgis.com/home/item.html?id=963a2d204098495a8a80134ed9dc95ae)) | August 27, 2025 | The 2022-2023 school year |
| Major cities | Esri, US Census Bureau | Esri, ArcGIS Living Atlas ([item](https://www.arcgis.com/home/item.html?id=9df5e769bfe8412b8de36a2e618c7672)) | December 8, 2022 | 2020 Census population counts |

Dates are as checked on November 11, 2026. The app reads each layer's data-edit date from the service and shows it under the results. That date says when rows last changed on the service, not how current the records are. Only the cities layer is a Living Atlas item. The hospital and school layers are copies of HIFLD data that FEMA accounts host publicly. They are not marked authoritative on ArcGIS Online, and their owners can change or remove them. These are the same layers [geoassist-mcp](https://github.com/Aashisho1o1/geoassist-mcp) uses.

## How a generated query is checked

GeoAssist does not have its own validator. It imports the query core of [geoassist-mcp](https://github.com/Aashisho1o1/geoassist-mcp) (`geoassist-hazard-proximity/core`, installed from GitHub at a pinned commit), so both projects run the same checks and those checks are tested in one place. `lib/prepareQuery.ts` calls it before any request is sent:

- Field names in `where`, `outFields` and `orderByFields` must exist in the schema read from the live layer. A typo comes back with the nearest real field.
- Only values, comparison operators, and a short list of SQL words are allowed (`AND`, `OR`, `NOT`, `IN`, `LIKE`, `IS`, `NULL`, `BETWEEN`, `UPPER`, `LOWER`). `;`, `--`, `/*`, and subqueries are refused. Words inside quoted values are treated as values, so a hospital named "Select Specialty" can be searched.
- For coded fields (for example `STATUS`, `HELIPAD`, `TRAUMA`, `LEVEL_`), a quoted value in `FIELD = '...'` must exist in the layer. In an `IN (...)` list, values that don't exist are allowed as long as one does, and the answer names the ones that matched nothing.
- A query is only refused over a value when it can be shown to match nothing, which means every condition is joined by `AND`. With `OR` or `NOT` in the filter the rest may still match, so the query runs and the answer names the unknown value.
- For hospitals, `STATUS = 'OPEN'` is added unless the filter itself asks for another status (`STATUS = 'CLOSED'`), and the answer says only hospitals marked open in the snapshot are included. Naming the field some other way (`STATUS IS NOT NULL`) does not switch this off. If the filter uses `STATUS` in a form the check can't read (`STATUS LIKE 'C%'`), the rule is left off and the answer says so, because adding `STATUS = 'OPEN'` could turn that filter into an empty one.
- ORDER BY may only add `ASC` or `DESC`.

The model is given the same live schema: every field with its type, real example values, the complete value list for coded fields, and named value groups (for example every spelling of a Level I trauma center).

## Limits

- Results are capped at 50 rows per question. The total shown comes from a separate count query. If that query fails or takes more than 5 seconds, the app says the total is unknown, unless the rows that came back are fewer than the cap, in which case they are the total. The rows request gives up after 10 seconds with an error.
- Counting questions ("how many hospitals are in Texas?") get a list plus the total, not a computed answer. Sums, averages, and group-by questions are not supported yet.
- Values are checked only for coded fields, and only in `=` and `IN` comparisons. A misspelled city in `CITY = '...'`, a `LIKE` pattern, or a range that matches nothing returns no results without an explanation.
- The gate checks words and characters, not grammar. A query with broken SQL grammar passes the gate and comes back as an ArcGIS error.
- The pre-translated example questions are checked by the same gate, but their wording and summaries are written by hand.
- Each question is sent to Claude on its own. Follow-up questions that depend on the previous answer do not work.
- The hospital layer is an old snapshot. See Data sources. "Open" means open in that snapshot.
- The school layer includes 1,971 schools that are closed (`STATUS = '2'`), temporarily closed (`'6'`) or not yet open (`'7'`), and nothing filters them out. Codes `1`, `3`, `4`, `5` and `8` are operational schools (new, newly added, moved to another agency, reopened), following the NCES Common Core of Data.
- The shared core is a GitHub dependency pinned to a commit of geoassist-mcp. It is not published to npm.
- The Claude key is used from the browser. That is a demo shortcut: a production app would keep the key on a server.
- I tested the example questions in the browser and the gate with unit tests. The path that calls Claude with a live API key has not been re-tested since the prompt was rewritten.

## API Key Setup

- Open the app and click the **API Key** action in the header.
- Paste your Claude key (`sk-ant-...`) and save. The key takes effect on Save, not while typing.
- By default the key is kept in memory and is gone when the tab is closed or reloaded.
- Tick **Remember on this device** to save it in browser `localStorage` under `geoassist_api_key`. GitHub Pages serves every project of an account from one origin, so other pages on that origin could read a saved key.
- **Remove key** clears it from memory and from storage.

## Deployment (GitHub Pages)

1. In the repository, open **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. Push to `main`. The `Deploy to GitHub Pages` workflow builds the app and publishes `dist/` to **`https://aashisho1o1.github.io/GeoAssist/`**.

Notes:

- `vite.config.ts` uses `base: "/GeoAssist/"` for GitHub Pages project-site deployment.
- Static assets for Calcite and ArcGIS are copied into `public/assets` by:
  - `npm run copy:calcite`
  - `npm run copy:arcgis`

## Security Note

This portfolio version calls Anthropic directly from the browser (`anthropic-dangerous-direct-browser-access: true`) for speed of iteration.

For production, move LLM calls behind a backend proxy (FastAPI/Express) so API keys are never exposed client-side.
