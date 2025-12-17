# QA Mentor — Offline Evaluation (Google Sheet)

This doc describes the simplest way to iterate prompt quality using your existing dataset:
URL → AI checklist → QA feedback (what was missed).

## 1) Sheet schema

Create 2 tabs:

### Tab: `Cases`

Recommended columns:
- `case_id`
- `url`
- `site_type` (saas / ecommerce / agency / marketplace / blog / web_app / landing / other)
- `page_type` (home / pricing / category / pdp / checkout / login / contact / article / docs / onboarding / other)
- `features` (comma-separated: dropdown_nav, search, auth, form, ecommerce_cart, filters, i18n, cookie_banner, video, pricing_table)
- `ai_output_v1` (Markdown table output)
- `qa_feedback_raw` (free text from human QA)
- `qa_missing_bullets` (normalized bullets: one per line; “what AI missed”)
- `missing_severity` (optional: P0/P1/P2)
- `notes`

### Tab: `Rules`

Recommended columns:
- `rule_id` (e.g. `nav_dropdown`, `forms_validation`, `ecom_cart`, `a11y_basics`, `seo_share`, `perf_basics`)
- `trigger` (human + machine-ish, e.g. `features contains dropdown_nav`)
- `checks_to_add` (Markdown bullets or table rows)
- `priority_default` (P0/P1/P2)
- `examples` (optional)

## 2) Scoring rubric (per case)

For each case, score **coverage** against `qa_missing_bullets`:

- `missed_total`: count of missing bullets
- `covered_by_ai`: how many of those bullets appear in the new output
- `coverage_pct = covered_by_ai / missed_total`
- `missed_p0`: count of missing bullets marked P0 that are still missing
- `missed_p1`: same for P1

Promote a new prompt version only if:
- average `coverage_pct` increases, and
- `missed_p0` decreases or stays at 0.

## 3) Iteration loop (recommended)

1) Pick 10 cases as a stable “benchmark” subset.
2) Run prompt v1 → collect `ai_output_v1`.
3) Extract rules from QA diffs and add them to the `Rules` tab.
4) Update prompt to apply triggers (v2) and re-run the same benchmark.
5) Compare scores.


