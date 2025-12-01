import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";
import OpenAI from "openai";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

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

function extractUrlFromText(text: string): string | null {
  const urlRegex =
    /(https?:\/\/[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(\/[^\s]*)?/i;
  const match = text.match(urlRegex);
  if (!match) return null;
  return match[0];
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      function sendLog(message: string) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "log", message })}\n\n`,
          ),
        );
      }

      try {
        const body = await req.json();
        const messages = (body?.messages ?? []) as ChatMessage[];
        const explicitUrl = (body?.url as string | undefined)?.trim();

        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const userText = lastUser?.content ?? "";

        let url = explicitUrl || extractUrlFromText(userText) || "";
        url = url.trim();

        if (!url) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", message: "Please provide a URL in your message" })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        if (!/^https?:\/\//i.test(url)) {
          url = `https://${url}`;
        }

        sendLog(`📨 Received request for ${url}`);
        sendLog(`🚀 Preparing to launch browser...`);

        // In Cloud Run container, cwd is /app/web, so we go up to /app
        // In local dev, cwd might be different, so we use relative path
        const isProduction = process.env.NODE_ENV === 'production';
        const projectRoot = isProduction ? '/app' : path.join(process.cwd(), "..");
        const pythonScript = path.join(projectRoot, "browser-service/analyze_page.py");
        const venvPython = path.join(projectRoot, "browser-service/venv/bin/python");

        sendLog(`📂 Project root: ${projectRoot}`);
        sendLog(`🐍 Python path: ${venvPython}`);
        sendLog(`📜 Script path: ${pythonScript}`);

        // Check if files exist
        try {
          const fs = await import('fs');
          const pythonExists = fs.existsSync(venvPython);
          const scriptExists = fs.existsSync(pythonScript);
          sendLog(`✓ Python binary exists: ${pythonExists}`);
          sendLog(`✓ Script exists: ${scriptExists}`);
        } catch (e) {
          sendLog(`⚠️ Could not check file existence: ${e}`);
        }

        sendLog(`🔧 Spawning Python process...`);

        const pythonProcess = spawn(venvPython, [pythonScript, url], {
          cwd: projectRoot,
          env: { ...process.env },
        });

        sendLog(`✓ Python process spawned (PID: ${pythonProcess.pid})`);

        let stdout = "";
        let stderr = "";
        let stderrLineCount = 0;

        pythonProcess.stdout.on("data", (data) => {
          stdout += data.toString();
          sendLog(`📤 [stdout] ${data.toString().substring(0, 200)}`);
        });

        pythonProcess.stderr.on("data", (data) => {
          const chunk = data.toString();
          stderr += chunk;
          stderrLineCount++;
          
          // Forward each line from Python stderr
          const lines = chunk.split('\n').filter((l: string) => l.trim());
          for (const line of lines) {
            sendLog(line);
          }
        });

        pythonProcess.on("error", (err) => {
          sendLog(`❌ Python process error: ${err.message}`);
        });

        const pythonResult = await new Promise<{ analysis: string; raw: unknown }>((resolve, reject) => {
          let timeoutHandle: NodeJS.Timeout;
          
          pythonProcess.on("close", (code, signal) => {
            clearTimeout(timeoutHandle);
            sendLog(`🏁 Python process closed (code: ${code}, signal: ${signal})`);
            sendLog(`📊 Total stderr lines: ${stderrLineCount}`);
            sendLog(`📊 Total stdout length: ${stdout.length} chars`);

            if (code !== 0) {
              reject(new Error(`Python exited with code ${code}. stderr: ${stderr.substring(0, 500)}`));
              return;
            }

            try {
              const parsed = JSON.parse(stdout);
              if (!parsed.success) {
                reject(new Error(parsed.error ?? "Page analysis failed"));
                return;
              }
              resolve({ analysis: parsed.data, raw: parsed.raw });
            } catch (e) {
              const message =
                e instanceof Error ? e.message : "Unknown JSON parse error";
              reject(new Error(`Failed to parse Python output: ${message}. First 500 chars: ${stdout.substring(0, 500)}`));
            }
          });

          timeoutHandle = setTimeout(() => {
            sendLog(`⏱️ Timeout reached, killing Python process...`);
            pythonProcess.kill('SIGTERM');
            setTimeout(() => {
              if (!pythonProcess.killed) {
                sendLog(`⏱️ Force killing Python process...`);
                pythonProcess.kill('SIGKILL');
              }
            }, 5000);
            reject(new Error(`Browser analysis timeout (3 minutes). Got ${stderrLineCount} stderr lines.`));
          }, 180000); // 3 minutes
        });

        sendLog("✅ Page analysis complete");
        sendLog("🤖 Generating CSV checklist with GPT-4o...");

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error("OPENAI_API_KEY is not set on the server");
        }

        const openai = new OpenAI({ apiKey });

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Based on analysis of page ${url}, create a detailed checklist.\n\nHere is the page analysis:\n\n${pythonResult.analysis}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        });

        const csv = completion.choices[0]?.message?.content ?? "";

        sendLog("✅ Checklist generated successfully");

        // Send final result
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ 
              type: "result", 
              url, 
              csv, 
              raw: pythonResult.raw 
            })}\n\n`,
          ),
        );

        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
