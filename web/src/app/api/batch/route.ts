import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import OpenAI from "openai";
import AdmZip from "adm-zip";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

function analyzePage(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(process.cwd(), "../browser-service/analyze_page.py");
    const venvPython = path.join(process.cwd(), "../browser-service/venv/bin/python");

    const proc = spawn(venvPython, [pythonScript, url]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error));
        }
      } catch (e: any) {
        reject(new Error(`Failed to parse Python output: ${e.message}`));
      }
    });

    setTimeout(() => {
      proc.kill();
      reject(new Error("Browser analysis timeout (2 minutes)"));
    }, 120000);
  });
}

export async function POST(req: NextRequest) {
  try {
    const { urls } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "URLs array is required" }, { status: 400 });
    }

    const zip = new AdmZip();
    const results = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i].trim();
      if (!url) continue;

      // Normalize URL
      const normalizedUrl = url.match(/^https?:\/\//i) ? url : `https://${url}`;

      try {
        // Step 1: Analyze page with Playwright
        const pythonResult = await analyzePage(normalizedUrl);
        const pageAnalysis = pythonResult.data || "";
        const rawData = pythonResult.raw || {};

        // Step 2: Generate checklist with OpenAI
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Based on analysis of page ${normalizedUrl}, create a detailed checklist.\n\nHere's what I found on the page:\n\n${pageAnalysis}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        });

        const csv = response.choices[0].message.content || "";

        // Add files to ZIP
        const folderName = `page_${i + 1}_${normalizedUrl.replace(/https?:\/\//g, "").replace(/[^a-z0-9]/gi, "_").slice(0, 30)}`;
        
        zip.addFile(`${folderName}/checklist.csv`, Buffer.from(csv, "utf8"));
        zip.addFile(`${folderName}/analysis.json`, Buffer.from(JSON.stringify(rawData, null, 2), "utf8"));
        
        if (rawData.html) {
          zip.addFile(`${folderName}/page.html`, Buffer.from(rawData.html, "utf8"));
        }

        results.push({ url: normalizedUrl, success: true });
      } catch (error: any) {
        results.push({ url: normalizedUrl, success: false, error: error.message });
        
        // Add error log to ZIP
        const folderName = `page_${i + 1}_ERROR`;
        zip.addFile(`${folderName}/error.txt`, Buffer.from(`Failed to analyze ${normalizedUrl}\n\nError: ${error.message}`, "utf8"));
      }
    }

    // Add summary
    const summary = `Batch Analysis Summary
======================

Total URLs: ${urls.length}
Successful: ${results.filter((r) => r.success).length}
Failed: ${results.filter((r) => !r.success).length}

Results:
${results.map((r, i) => `${i + 1}. ${r.url} - ${r.success ? "✓ Success" : "✗ Failed" + (r.error ? `: ${r.error}` : "")}`).join("\n")}
`;
    
    zip.addFile("_SUMMARY.txt", Buffer.from(summary, "utf8"));

    const zipBuffer = zip.toBuffer();

    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=batch_analysis_${Date.now()}.zip`,
      },
    });
  } catch (error: any) {
    console.error("Batch analysis error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

