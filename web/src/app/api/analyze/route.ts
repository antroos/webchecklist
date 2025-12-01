import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { spawn } from "child_process";
import OpenAI from "openai";

export const runtime = "nodejs";

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

async function runPython(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const projectRoot = path.join(process.cwd(), ".."); // go out of /web
    const pythonScript = path.join(projectRoot, "browser-service/analyze_page.py");
    const venvPython = path.join(
      projectRoot,
      "browser-service/venv/bin/python",
    );

    const child = spawn(venvPython, [pythonScript, url]);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python exited with code ${code}: ${stderr}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let url = (body?.url as string | undefined)?.trim();

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 },
      );
    }

    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    // Step 1: analyze page with Python + Playwright
    const pythonOutput = await runPython(url);
    const parsed = JSON.parse(pythonOutput);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error ?? "Page analysis failed" },
        { status: 500 },
      );
    }

    const pageAnalysis: string = parsed.data;
    const rawData = parsed.raw;

    // Step 2: generate CSV checklist with OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set on the server" },
        { status: 500 },
      );
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Based on analysis of page ${url}, create a detailed checklist.\n\nHere is the page analysis:\n\n${pageAnalysis}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const csv = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({
      ok: true,
      url,
      csv,
      raw: rawData,
    });
  } catch (error: any) {
    console.error("API /api/analyze error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Unexpected error" },
      { status: 500 },
    );
  }
}


