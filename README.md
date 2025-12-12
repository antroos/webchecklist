# Web Checklist Generator

AI-powered system for generating website testing checklists (web-only).

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

## Roadmap

- [ ] Public landing → connect to web analyzer endpoint
- [ ] Export checklists to Google Sheets
- [ ] Support multiple pages at once
- [ ] Analysis history
- [ ] Customizable checklist templates

