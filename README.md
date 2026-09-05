# SeaTauBench landing page

A clean research landing page with sitaw green and SEACrowd red, an interactive leaderboard, and responsive plots. Built with semantic HTML, CSS, and native JavaScript modules; no production dependencies, API keys, database, or server functions.

## Develop and verify

Requires Node.js 22 or newer. There are no packages to install.

```sh
npm run dev
npm run check
```

The development server listens on port 4173. `PORT` can override the port. `npm run build` writes the deployable static site to `dist/`.

## Deploy on Vercel

Import `saksornr/SeaTauBench-Landing-Page` in Vercel. Use the repository root as the Root Directory. `vercel.json` supplies the build configuration:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js | 22 or newer |
| Environment variables | None |

Connect the production branch `main` for automatic deployments on subsequent pushes. Alternatively, run `vercel --prod` from an authenticated local Vercel CLI.

## Results and aggregation

`data/results.json` contains all 168 model × domain × target-language × scenario records from Appendix G, Tables 17–21 of the supplied manuscript. All four metrics are transcribed at the original precision; no synthetic or estimated cells are included. The JSON includes the source manuscript’s SHA-256 fingerprint and per-record table/page references. The full supplied manuscript is not redistributed. Paper links point to the [public repository version](https://github.com/SEACrowd/SEATauBench/blob/main/SEATauBench_v1.pdf), whose revision or pagination may differ from this score snapshot.

- **Task domain:** Airline, Retail, Telecom. The paper reports aggregate domain results, so this is not a filter over individual task IDs.
- **Language:** target localization language. In S3, dialogue stays English even though the tool schemas use the selected target language.
- **Scenario:** S1 baseline, S2 interaction, S3 monolingual tools, S4 full domain, and the separate S3 mixed-language configuration.
- **Models:** any subset of Kimi K2.5, GPT-5 mini, and Qwen3-235B-A22B-Instruct-2507.
- **Metrics:** pass@1, pass², pass³, robustness ρ³. Values are shown as percentages.

Both plots, the sortable leaderboard, source-result table, and CSV export use the same filter state. The chart metric and leaderboard sort are independently controllable. Selecting a chart metric initially sorts the leaderboard by that metric. Filter state is encoded in the URL, including an empty model selection.

Model and language summaries are unweighted arithmetic means of matching source cells. Each domain × language × scenario cell receives equal weight. Aggregate ρ³ is the mean of reported cell-level ρ³ values, **not** the ratio of aggregate pass³ to aggregate pass@1. This differs from pooling raw task outcomes or weighting by task counts.

English S1 is counted once and never replicated into L2 cells. “All core scenarios” excludes auxiliary mixed-language tools. Unsupported combinations show an explicit empty state. Kimi mixed-language results are absent in Table 20 and appear as not reported, never zero.

### Manuscript inconsistencies

The explorer follows the appendix tables, not the prose summaries. In particular, Table 19 includes Kimi in monolingual S3, while the main text describes S3 as containing two models; Table 20 reports two models for mixed-language S3. Recomputed means may differ from narrative means in the manuscript. Do not replace the table-derived values with prose summaries without reconciling them against the authors’ raw evaluation output.

## Update the benchmark

Edit `data/results.json` and retain the existing schema. Add model metadata to `data/benchmark.mjs` and matching model picker options in `index.html` for new models. Revise provenance, record counts, and tests when replacing the experiment snapshot. Run `npm run check` before publishing. The website does not automatically fetch changing upstream benchmark results.

## Design and accessibility

The design follows the user-provided [SEACrowd design guide](https://github.com/saksornr/hstack/blob/main/design_skills/seacrowd-DESIGN.md), with green promoted to the primary role as requested:

- Sitaw green `#487B2C`, deep green `#315E1D`, SEACrowd red `#ED2939`.
- Geist and Geist Mono, with system fallbacks. Google Fonts is optional; core content does not depend on it.
- White surfaces, subtle borders, restrained 12px cards, and compact navigation.
- Native keyboard-accessible selects, model checkboxes, table sort state, focusable plot marks with exact values, source tables, skip navigation, responsive layout, and reduced-motion support.
- The original user-supplied sitaw image is included unchanged. The image remains its respective owner’s material; the existing repository license is preserved.

## Verification

`tests/benchmark.test.mjs` checks source coverage, unique cells, metric ordering, rounded robustness consistency, known source values, filter intersections, macro averaging, missing data, ranking, URL state, and CSV export. The build copies only production assets, excluding development scripts, tests, and source documentation.

## Project structure

```text
index.html                 Research page and semantic UI
styles.css                 Responsive design system
app.js                     Filters, charts, table, interactions
data/benchmark.mjs         Pure filtering, ranking, and export functions
data/results.json          Sourced benchmark snapshot
assets/                    Supplied sitaw image and favicon
scripts/                   Dependency-free build and preview server
tests/                     Data and interaction-state logic tests
vercel.json                Static deployment configuration
```
