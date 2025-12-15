import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { promises as fs } from "fs";
import crypto from "crypto";

import { auth } from "@/auth";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  normalizeUrl,
  type PageSnapshotDoc,
} from "@/lib/pageSnapshotStore";
import { getGcsBucketName, uploadBufferToGcs } from "@/lib/gcsClient";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

type PythonResult = {
  success: boolean;
  data?: string;
  raw?: Record<string, unknown>;
  error?: string;
};

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function runPythonSnapshot(params: {
  projectRoot: string;
  url: string;
}): Promise<{ raw: Record<string, unknown> }> {
  const pythonScript = path.join(params.projectRoot, "browser-service/analyze_page.py");
  const venvPython = path.join(params.projectRoot, "browser-service/venv/bin/python");

  const proc = spawn(venvPython, [pythonScript, params.url], {
    cwd: params.projectRoot,
    env: { ...process.env },
  });

  let stdout = "";
  let stderr = "";

  proc.stdout.on("data", (d) => (stdout += d.toString()));
  proc.stderr.on("data", (d) => (stderr += d.toString()));

  const result = await new Promise<PythonResult>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const timeout = setTimeout(() => {
      settle(() => {
        proc.kill("SIGTERM");
        reject(new Error("Browser snapshot timeout (3 minutes)"));
      });
    }, 180_000);

    proc.once("close", (code) => {
      settle(() => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Python exited with code ${code}: ${stderr.substring(0, 800)}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout) as PythonResult);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown JSON parse error";
          reject(
            new Error(
              `Failed to parse Python output: ${msg}. First 800 chars: ${stdout.substring(0, 800)}`,
            ),
          );
        }
      });
    });
  });

  if (!result.success) {
    throw new Error(result.error || "Snapshot failed");
  }
  const raw = (result.raw || {}) as Record<string, unknown>;
  return { raw };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const urlInput = (body?.url as string | undefined) ?? "";
  const normalized = normalizeUrl(urlInput);
  if (!normalized) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const db = getAdminDb();
  const snapshotRef = db.collection("pageSnapshots").doc();
  const snapshotId = snapshotRef.id;

  const bucket = getGcsBucketName();
  const basePath = `snapshots/${encodeURIComponent(userId)}/${encodeURIComponent(snapshotId)}`;
  const htmlPath = `${basePath}/page.html`;
  const jsonPath = `${basePath}/snapshot.json`;
  const screenshotPath = `${basePath}/screenshot.png`;

  const initialDoc: PageSnapshotDoc = {
    userId,
    url: urlInput,
    normalizedUrl: normalized,
    title: null,
    status: "processing",
    error: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    gcs: { bucket, htmlPath, jsonPath, screenshotPath },
  };

  await snapshotRef.set(initialDoc);

  try {
    const isProduction = process.env.NODE_ENV === "production";
    const projectRoot = isProduction ? "/app" : path.join(process.cwd(), "..");

    const { raw } = await runPythonSnapshot({ projectRoot, url: normalized });

    const title = typeof raw.title === "string" ? raw.title : null;
    const html = typeof raw.html === "string" ? raw.html : "";

    // screenshot handling:
    // - preferred: screenshot_base64 (future)
    // - current: screenshot filename written to cwd by Python
    let screenshotBuf: Buffer | null = null;
    const screenshotB64 = raw.screenshot_base64;
    if (typeof screenshotB64 === "string" && screenshotB64.trim()) {
      screenshotBuf = Buffer.from(screenshotB64, "base64");
    } else {
      const screenshotFile = typeof raw.screenshot === "string" ? raw.screenshot : "";
      if (screenshotFile) {
        const abs = path.isAbsolute(screenshotFile)
          ? screenshotFile
          : path.join(projectRoot, screenshotFile);
        try {
          screenshotBuf = await fs.readFile(abs);
          // best-effort cleanup
          void fs.unlink(abs).catch(() => {});
        } catch {
          screenshotBuf = null;
        }
      }
    }

    // Upload HTML
    const htmlBuf = Buffer.from(html, "utf8");
    await uploadBufferToGcs({
      bucket,
      objectPath: htmlPath,
      buffer: htmlBuf,
      contentType: "text/html; charset=utf-8",
      cacheControl: "private, max-age=0, no-store",
    });

    // Upload snapshot JSON (exclude full HTML + base64 screenshot to keep it small)
    const rawForJson: Record<string, unknown> = { ...raw };
    delete rawForJson.html;
    delete rawForJson.screenshot_base64;
    const jsonBuf = Buffer.from(JSON.stringify(rawForJson, null, 2), "utf8");
    await uploadBufferToGcs({
      bucket,
      objectPath: jsonPath,
      buffer: jsonBuf,
      contentType: "application/json; charset=utf-8",
      cacheControl: "private, max-age=0, no-store",
    });

    // Upload screenshot (if present)
    if (screenshotBuf && screenshotBuf.length) {
      await uploadBufferToGcs({
        bucket,
        objectPath: screenshotPath,
        buffer: screenshotBuf,
        contentType: "image/png",
        cacheControl: "private, max-age=0, no-store",
      });
    } else {
      // Keep empty placeholder? For now just leave missing object.
    }

    await snapshotRef.set(
      {
        status: "completed",
        title,
        updatedAt: FieldValue.serverTimestamp(),
        hashes: {
          htmlSha256: sha256(htmlBuf),
          jsonSha256: sha256(jsonBuf),
        },
      },
      { merge: true },
    );

    return NextResponse.json({
      ok: true,
      snapshotId,
      url: normalized,
      title,
      gcs: { bucket, htmlPath, jsonPath, screenshotPath },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Snapshot error";
    await snapshotRef.set(
      {
        status: "error",
        error: message,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return NextResponse.json({ error: message, snapshotId }, { status: 500 });
  }
}


