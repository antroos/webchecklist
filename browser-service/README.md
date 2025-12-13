# Browser Analysis Service

Python script for analyzing web pages using Playwright.

## Installation

```bash
cd browser-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

## Configuration

Create `.env` file:

```
OPENAI_API_KEY=your_key_here
PORT=5001
```

## Usage

This script is called automatically by the web app (Next.js API routes) via Node.js `child_process.spawn`.

**Command line usage:**
```bash
python analyze_page.py https://example.com
```

**Output:**
```json
{
  "success": true,
  "data": "Analyzed page data..."
}
```

## What it does

1. Opens the URL in Chromium browser (headless)
2. Waits for page to load
3. Extracts:
   - Page title
   - HTML snapshot
   - Stylesheets (best-effort; some rules may be blocked by CORS)
   - Scripts list
   - Meta tags
   - Headings (h1-h6)
   - Buttons
   - Links
   - Images
   - Forms + input fields
   - Page text content
4. Returns structured data as JSON

