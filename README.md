# Web Checklist Generator

AI-powered system for generating website testing checklists.

## Architecture

The project consists of two services:

1. **Telegram Bot** (Node.js) - user interface for interaction
2. **Browser Service** (Python) - page analysis using Playwright and checklist generation

## Installation

### 1. Telegram Bot

```bash
npm install
```

Create `.env`:
```
TELEGRAM_BOT_TOKEN=your_telegram_token
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

Create `browser-service/.env`:
```
OPENAI_API_KEY=your_openai_key
PORT=5001
```

## Usage

### Run the bot:

```bash
npm run dev
```

The bot will automatically call the Python script to analyze pages when you send a URL.

## How it works

1. Open the bot in Telegram: @webchecklist_bot
2. Send `/start`
3. Send a page URL for analysis
4. The bot opens the page in a browser (Playwright)
5. Collects all page elements (texts, images, buttons, links, etc.)
6. Generates a detailed CSV checklist using GPT-4o
7. Sends you the CSV file

## CSV Format

```csv
Check,Opera GX,Chrome,Android Chrome,Android Browser,iOS Chrome,iOS Safari,MacOS Chrome,MacOS Safari,Comment
"Text in Header displays correctly without line breaks and errors",,,,,,,,,
"Button Get in Touch redirects to the correct page",,,,,,,,,
"Image Logo displays without artifacts",,,,,,,,,
```

## Deployment

Ready to deploy on:
- Telegram bot: Local or VPS (requires browser automation)
- Future: Web interface for Vercel/Netlify

## Roadmap

- [ ] Web interface (instead of Telegram)
- [ ] Export checklists to Google Sheets
- [ ] Support multiple pages at once
- [ ] Analysis history
- [ ] Customizable checklist templates

