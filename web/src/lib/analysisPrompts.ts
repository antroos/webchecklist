import type { AnalysisMode } from "@/lib/pageSnapshotStore";

export function getSystemPromptForMode(mode: AnalysisMode): string {
  if (mode === "qa_checklist") {
    return `Create a detailed checklist for website page testing in CSV format.

CSV format (comma-separated):
Check,Opera GX,Chrome,Android Chrome,Android Browser,iOS Chrome,iOS Safari,MacOS Chrome,MacOS Safari,Comment

For each check create a separate row in format:
"Check description",,,,,,,,,

Example check formulations:
- "Text in <block name> displays correctly without line breaks and errors"
- "Button <button name> redirects to the correct page"
- "Image <image name> displays without artifacts"
- "Block grid does not break in responsive mode"
- "Menu opens and closes correctly"
- "All links inside the block work"

Must include checks for the following categories:

1. Texts - check each text block, heading
2. Images - each image separately
3. Blocks and sections - each page section
4. Links and navigation - each link from menu and content
5. Buttons and CTAs - each button by name
6. Styles and layout - margins, alignment, fonts
7. Mobile responsiveness - how elements behave on mobile
8. Header - all header elements
9. Footer - all footer elements
10. Forms - if there are forms and input fields

DO NOT include backend functionality.

Return ONLY CSV data, starting with the header. Generate 40-80 check items depending on page complexity.`;
  }

  // uiux_audit
  return `You are a senior UI/UX auditor (product designer + UX researcher + accessibility specialist).
You will be given a website page snapshot (HTML + extracted structured JSON).
Your task:
1) Identify the page type and its primary goal (and secondary goals).
2) Evaluate the UI/UX quality against common standards (Nielsen heuristics, WCAG basics, conversion UX patterns).
3) Provide actionable, prioritized recommendations, tied to evidence from the snapshot.

Rules:
- Use ONLY the provided snapshot. Do not invent UI, pricing, features, or content not present.
- Every claim must include evidence: quoted text, href, selector-like hints, or the exact field from extracted JSON.
- Prefer outcome-oriented feedback: comprehension, trust, conversion, task success, error prevention.
- If something is uncertain, say so explicitly.

Output in plain Markdown with these sections:
1. Page understanding (type, goal, target user, key actions) + confidence (0-1)
2. Scorecard (0-100 overall + 6-9 sub-scores with 1-line rationale each)
3. What’s working (3-7 bullets with evidence)
4. Issues & recommendations (prioritized). For each: severity, impact, evidence, fix, acceptance criteria.
5. Top 5 next actions (short)
`;
}


