import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/firebaseAdmin";

export type PageSnapshotStatus = "completed" | "error" | "processing";

export type PageSnapshotDoc = {
  userId: string;
  url: string;
  normalizedUrl: string;
  title?: string | null;

  status: PageSnapshotStatus;
  error?: string | null;

  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;

  // References to GCS objects (gs://bucket/path or just object path; we store both)
  gcs: {
    bucket: string;
    htmlPath: string;
    jsonPath: string;
    screenshotPath: string;
  };

  // Optional hashes for dedup/debug.
  hashes?: {
    htmlSha256?: string;
    jsonSha256?: string;
  };
};

export type AnalysisMode = "qa_checklist" | "uiux_audit";
export type AnalysisStatus = "processing" | "completed" | "error";

export type AnalysisDoc = {
  userId: string;
  snapshotId: string;
  mode: AnalysisMode;
  status: AnalysisStatus;
  error?: string | null;

  model?: string | null;
  promptVersion?: string | null;

  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
  completedAt?: FirebaseFirestore.FieldValue;

  // Billing classification (reused semantics from current /api/agent).
  billingMode?: "free" | "included" | "overage";
  stripeUsageRecordId?: string | null;

  // For small results we can store inline; for large, prefer GCS and store gcsResultPath.
  resultInline?: unknown;
  gcsResult?: { bucket: string; path: string } | null;
};

export function normalizeUrl(input: string): string {
  const s = (input ?? "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) return `https://${s}`;
  return s;
}

export function pageSnapshotsCol() {
  return getAdminDb().collection("pageSnapshots");
}

export function analysesCol() {
  return getAdminDb().collection("analyses");
}

export async function createPageSnapshot(params: {
  userId: string;
  url: string;
  normalizedUrl: string;
  title?: string | null;
  gcs: PageSnapshotDoc["gcs"];
  status?: PageSnapshotStatus;
}) {
  const db = getAdminDb();
  const ref = db.collection("pageSnapshots").doc();
  const doc: PageSnapshotDoc = {
    userId: params.userId,
    url: params.url,
    normalizedUrl: params.normalizedUrl,
    title: params.title ?? null,
    status: params.status ?? "completed",
    error: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    gcs: params.gcs,
  };
  await ref.set(doc);
  return { snapshotId: ref.id, ref };
}

export async function setPageSnapshotStatus(params: {
  snapshotId: string;
  status: PageSnapshotStatus;
  error?: string | null;
  title?: string | null;
}) {
  const db = getAdminDb();
  await db
    .collection("pageSnapshots")
    .doc(params.snapshotId)
    .set(
      {
        status: params.status,
        error: params.error ?? null,
        title: typeof params.title !== "undefined" ? params.title : undefined,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function getPageSnapshotForUser(params: {
  snapshotId: string;
  userId: string;
}): Promise<(PageSnapshotDoc & { id: string }) | null> {
  const db = getAdminDb();
  const snap = await db.collection("pageSnapshots").doc(params.snapshotId).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<PageSnapshotDoc> | undefined;
  if (!data || data.userId !== params.userId) return null;
  return { ...(data as PageSnapshotDoc), id: snap.id };
}

export async function createAnalysis(params: {
  userId: string;
  snapshotId: string;
  mode: AnalysisMode;
  model?: string | null;
  promptVersion?: string | null;
}) {
  const db = getAdminDb();
  const ref = db.collection("analyses").doc();
  const doc: AnalysisDoc = {
    userId: params.userId,
    snapshotId: params.snapshotId,
    mode: params.mode,
    status: "processing",
    error: null,
    model: params.model ?? null,
    promptVersion: params.promptVersion ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    gcsResult: null,
  };
  await ref.set(doc);
  return { analysisId: ref.id, ref };
}

export async function setAnalysisCompleted(params: {
  analysisId: string;
  resultInline?: unknown;
  gcsResult?: { bucket: string; path: string } | null;
  stripeUsageRecordId?: string | null;
  billingMode?: AnalysisDoc["billingMode"];
}) {
  const db = getAdminDb();
  await db
    .collection("analyses")
    .doc(params.analysisId)
    .set(
      {
        status: "completed",
        updatedAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
        resultInline:
          typeof params.resultInline !== "undefined"
            ? params.resultInline
            : undefined,
        gcsResult:
          typeof params.gcsResult !== "undefined" ? params.gcsResult : undefined,
        stripeUsageRecordId:
          typeof params.stripeUsageRecordId !== "undefined"
            ? params.stripeUsageRecordId
            : undefined,
        billingMode:
          typeof params.billingMode !== "undefined" ? params.billingMode : undefined,
      },
      { merge: true },
    );
}

export async function setAnalysisError(params: {
  analysisId: string;
  message: string;
  billingMode?: AnalysisDoc["billingMode"];
}) {
  const db = getAdminDb();
  await db
    .collection("analyses")
    .doc(params.analysisId)
    .set(
      {
        status: "error",
        error: params.message,
        updatedAt: FieldValue.serverTimestamp(),
        billingMode:
          typeof params.billingMode !== "undefined" ? params.billingMode : undefined,
      },
      { merge: true },
    );
}


