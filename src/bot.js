require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

const token = process.env.TELEGRAM_BOT_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set in the environment.');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('OPENAI_API_KEY is not set in the environment.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: openaiApiKey });
const bot = new TelegramBot(token, { polling: true });

const SYSTEM_PROMPT = `Create a detailed checklist for website page testing in CSV format.

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

1. **Texts** - check each text block, heading
2. **Images** - each image separately
3. **Blocks and sections** - each page section
4. **Links and navigation** - each link from menu and content
5. **Buttons and CTAs** - each button by name
6. **Styles and layout** - margins, alignment, fonts
7. **Mobile responsiveness** - how elements behave on mobile
8. **Header** - all header elements
9. **Footer** - all footer elements
10. **Forms** - if there are forms and input fields

DO NOT include backend functionality.

Return ONLY CSV data, starting with the header. Generate 40-80 check items depending on page complexity.`;

function analyzePage(url) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../browser-service/analyze_page.py');
    const venvPython = path.join(__dirname, '../browser-service/venv/bin/python');
    
    const process = spawn(venvPython, [pythonScript, url]);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }

      // Return raw JSON string; we'll parse it in the caller
      resolve(stdout);
    });
    
    setTimeout(() => {
      process.kill();
      reject(new Error('Browser analysis timeout (2 minutes)'));
    }, 120000);
  });
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    'Hello! I will help you generate a testing checklist for a website page.\n\n' +
      'Send me the page URL and I will open it in a browser for detailed analysis.'
  );
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.text && msg.text.startsWith('/start')) {
    return;
  }

  let url = msg.text || '';
  
  if (!url.trim()) {
    bot.sendMessage(chatId, 'Please send the page URL.');
    return;
  }

  // Add https:// if protocol is missing
  if (!url.match(/^https?:\/\//i)) {
    url = 'https://' + url;
  }

  bot.sendMessage(chatId, '🌐 Opening page in browser...');

  try {
    // Step 1: Open page with Playwright
    const pageAnalysisRaw = await analyzePage(url);
    
    // Parse the JSON response from Python
    let pageAnalysis = pageAnalysisRaw;
    let rawData = {};
    try {
      const parsed = JSON.parse(pageAnalysisRaw);
      pageAnalysis = parsed.data || pageAnalysisRaw;
      rawData = parsed.raw || {};
    } catch (e) {
      console.log('Using raw page analysis');
    }
    
    bot.sendMessage(chatId, '🤖 Generating checklist based on analysis...');
    
    // Step 2: Send analysis to GPT with system prompt
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `Based on analysis of page ${url}, create a detailed checklist.\n\nHere's what I found on the page:\n\n${pageAnalysis}` 
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    const checklist = response.choices[0].message.content;
    const timestamp = Date.now();
    
    // 1. Save CSV checklist
    const csvFilename = `checklist_${timestamp}.csv`;
    const csvPath = path.join(__dirname, '../', csvFilename);
    fs.writeFileSync(csvPath, checklist, 'utf8');
    
    // 2. Save full HTML copy
    const htmlFilename = `page_copy_${timestamp}.html`;
    const htmlPath = path.join(__dirname, '../', htmlFilename);
    if (rawData.html) {
      fs.writeFileSync(htmlPath, rawData.html, 'utf8');
    }
    
    // 3. Save comprehensive JSON analysis
    const analysisFilename = `analysis_${timestamp}.json`;
    const analysisPath = path.join(__dirname, '../', analysisFilename);
    const fullAnalysis = {
      url: url,
      timestamp: new Date().toISOString(),
      title: rawData.title,
      meta: rawData.meta,
      stylesheets: rawData.stylesheets,
      scripts: rawData.scripts,
      headings: rawData.headings,
      links: rawData.links,
      buttons: rawData.buttons,
      images: rawData.images,
      forms: rawData.forms,
      inputs: rawData.inputs,
      interactive_elements: rawData.interactive_elements,
      text_content: rawData.text_content,
      screenshot: rawData.screenshot
    };
    fs.writeFileSync(analysisPath, JSON.stringify(fullAnalysis, null, 2), 'utf8');
    
    // Send all files to user
    await bot.sendMessage(chatId, '📦 Sending files...');
    
    await bot.sendDocument(chatId, csvPath, {
      caption: `✅ CSV Checklist for ${url}`
    });
    
    if (rawData.html) {
      await bot.sendDocument(chatId, htmlPath, {
        caption: `📄 HTML copy of the page`
      });
    }
    
    await bot.sendDocument(chatId, analysisPath, {
      caption: `📊 Full analysis (JSON): HTML, CSS, JS, Meta, Forms, etc.`
    });
    
    // Send screenshot if exists (as document to avoid Telegram photo dimension limits)
    if (rawData.screenshot && fs.existsSync(rawData.screenshot)) {
      await bot.sendDocument(chatId, rawData.screenshot, {
        caption: `📸 Full page screenshot`
      });
      fs.unlinkSync(rawData.screenshot);
    }
    
    // Delete temporary files
    fs.unlinkSync(csvPath);
    if (rawData.html) fs.unlinkSync(htmlPath);
    fs.unlinkSync(analysisPath);
  } catch (error) {
    console.error('Error:', error);
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

console.log('Telegram bot is running with long polling...');


