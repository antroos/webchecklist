# Web Checklist Generator

AI-powered system for generating website testing checklists (web-only).

## Prompt system (mentors) + QA iteration

The product now supports **mentor roles** (e.g. General, QA Lead, UI/UX Expert) and a **prompt layering** approach:

- **Base prompt**: product-wide behavior (concise mentor tone, language mirroring, “don’t invent”, structured output).
- **Mentor overlay**: role-specific instructions (QA Lead, UI/UX Expert, etc.).
- (Optional later) **Per-chat project context**: business-specific context for one project/chat.

### Prompt versions (v1)

- **Prompt library**: `web/src/lib/promptLibrary.ts`
  - `basePromptV1(...)`
  - `generalMentorV1(...)` (triage/therapist)
  - `qaLeadV1(...)` (page understanding + Markdown table checklist)
  - Language is detected from the user’s last message (UA/RU/EN) and responses mirror it.

- **Mentor definitions**: `web/src/lib/mentors.ts`
  - Mentors store a `systemPrompt` marker like `PROMPT_LIBRARY:qa_lead_v1` so we can swap versions cleanly.

- **Runtime application**: `web/src/app/api/chat/route.ts`
  - Builds final `system` as: **Base prompt + Mentor overlay**.
  - **Auto-switch (MVP)**: if the active mentor is `general` and the user message clearly indicates QA intent (URL, “QA”, “checklist”, “testing”, etc.), the chat is automatically switched to `qa_lead` for that chat.

### QA Lead behavior (v1)

QA Lead outputs:
1) **Page understanding** (site type, page type, goal, key flows, detected features)
2) **Markdown checklist table** with fixed columns:
   `| ID | Priority | Area | Check | Steps | Expected | Notes |`

It supports one-page and multi-page flows: if only a homepage is provided, it asks for 1–3 additional high-value pages (pricing/contact/checkout, depending on site type).

### Offline quality evaluation (Google Sheet)

We iterate quality using your dataset (AI output + human QA feedback) via a simple offline workflow:
- Template doc: `web/PROMPT_EVAL_QA.md`
- Recommended tabs: `Cases` (URL → AI output → QA missing bullets) and `Rules` (trigger-based checks).
- Scoring: coverage of QA-missing bullets + count of missed P0/P1.

## Architecture

The project consists of two parts:

1. **Web app** (Next.js) - UI + API routes (SSE + REST)
2. **Browser Service** (Python) - page analysis using Playwright (HTML/DOM snapshot for the LLM)

## Installation

### 1. Web app

```bash
cd web
npm install
```

Create `web/.env.local`:
```
OPENAI_API_KEY=your_openai_key
```

### 2. Browser Service

```bash
cd browser-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

## Usage

### Run the web app:

```bash
cd web
npm run dev
```

The web app will call the Python analyzer to open the page and generate a CSV checklist.

## How it works

1. Paste a page URL in the web UI
2. The backend opens the page in a real browser (Playwright)
3. Extracts page structure (texts, images, buttons, links, forms, etc.)
4. Generates a detailed CSV checklist using GPT-4o
5. You can download CSV + JSON snapshot (and HTML copy if needed)

## CSV Format

```csv
Check,Opera GX,Chrome,Android Chrome,Android Browser,iOS Chrome,iOS Safari,MacOS Chrome,MacOS Safari,Comment
"Text in Header displays correctly without line breaks and errors",,,,,,,,,
"Button Get in Touch redirects to the correct page",,,,,,,,,
"Image Logo displays without artifacts",,,,,,,,,
```

## Deployment

Ready to deploy on:
- Web app: Cloud Run / Vercel (Node runtime required; Python analyzer must be available in the build image)

### Ops docs
- `DEPLOYMENT.md` — deployment setup + CI/CD notes
- `RUNBOOK.md` — step-by-step deploy + smoke-tests + troubleshooting (CTO-safe)

## Roadmap

- [ ] Public landing → connect to web analyzer endpoint
- [ ] Export checklists to Google Sheets
- [ ] Support multiple pages at once
- [ ] Analysis history
- [ ] Customizable checklist templates

