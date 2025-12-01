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

This script is called automatically by the Telegram bot via Node.js child_process.

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

1. Opens the URL in Chromium browser (visible window)
2. Waits for page to load
3. Extracts:
   - Page title
   - All headings (h1-h6)
   - All buttons
   - All links
   - All images with alt text
   - All form inputs
   - Page text content
4. Returns structured data as JSON

