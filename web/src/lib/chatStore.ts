import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "./firebaseAdmin";

export type ChatDoc = {
  title: string;
  siteUrl?: string | null;
  lastMessagePreview?: string | null;
  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
};

export type MessageKind = "status" | "result" | "plain";
export type MessageRole = "user" | "assistant";

export type MessageArtifacts = {
  csv?: string;
  markdown?: string;
  raw?: unknown;
  html?: string;
  snapshotId?: string;
  analysisId?: string;
  mode?: string;
  omitted?: boolean;
  omittedReason?: string;
};

export type MessageDoc = {
  role: MessageRole;
  kind: MessageKind;
  content: string;
  createdAt: FirebaseFirestore.FieldValue;
  artifacts?: MessageArtifacts;
};

function safePreview(s: string, max = 140) {
  const t = (s || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function approxSizeBytes(v: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(v ?? null), "utf8");
  } catch {
    return 0;
  }
}

function sanitizeArtifacts(input: MessageArtifacts | undefined): MessageArtifacts | undefined {
  if (!input) return undefined;

  // Firestore doc size limit is 1MB. Keep MVP safe by limiting artifacts aggressively.
  const maxCsvBytes = 220_000;
  const maxMarkdownBytes = 220_000;
  const maxHtmlBytes = 220_000;
  const maxRawBytes = 220_000;

  const out: MessageArtifacts = {};
  let omitted = false;
  const reasons: string[] = [];

  if (typeof input.csv === "string") {
    const sz = Buffer.byteLength(input.csv, "utf8");
    if (sz <= maxCsvBytes) out.csv = input.csv;
    else {
      omitted = true;
      reasons.push("csv_too_large");
    }
  }

  if (typeof input.markdown === "string") {
    const sz = Buffer.byteLength(input.markdown, "utf8");
    if (sz <= maxMarkdownBytes) out.markdown = input.markdown;
    else {
      omitted = true;
      reasons.push("markdown_too_large");
    }
  }

  if (typeof input.html === "string") {
    const sz = Buffer.byteLength(input.html, "utf8");
    if (sz <= maxHtmlBytes) out.html = input.html;
    else {
      omitted = true;
      reasons.push("html_too_large");
    }
  }

  if (typeof input.snapshotId === "string" && input.snapshotId.trim()) {
    out.snapshotId = input.snapshotId.trim();
  }
  if (typeof input.analysisId === "string" && input.analysisId.trim()) {
    out.analysisId = input.analysisId.trim();
  }
  if (typeof input.mode === "string" && input.mode.trim()) {
    out.mode = input.mode.trim();
  }

  if (typeof input.raw !== "undefined") {
    const sz = approxSizeBytes(input.raw);
    if (sz <= maxRawBytes) out.raw = input.raw;
    else {
      omitted = true;
      reasons.push("raw_too_large");
    }
  }

  if (omitted) {
    out.omitted = true;
    out.omittedReason = reasons.join(",");
  }

  // If nothing survived and nothing omitted, return undefined.
  if (
    typeof out.csv === "undefined" &&
    typeof out.html === "undefined" &&
    typeof out.raw === "undefined" &&
    !out.omitted
  ) {
    return undefined;
  }

  return out;
}

function userChatsRef(userId: string) {
  const db = getAdminDb();
  return db.collection("users").doc(userId).collection("chats");
}

function chatMessagesRef(userId: string, chatId: string) {
  return userChatsRef(userId).doc(chatId).collection("messages");
}

function extractFirstUrl(text: string): string | null {
  const s = (text || "").trim();
  if (!s) return null;
  // Basic URL matcher: accept http(s) or bare domain.
  const m =
    s.match(/\bhttps?:\/\/[^\s)]+/i) ||
    s.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?/i);
  return m ? m[0] : null;
}

function makeTitleFromContent(text: string): { title: string; siteUrl?: string | null } | null {
  const url = extractFirstUrl(text);
  if (url) {
    try {
      const normalized = url.startsWith("http") ? url : `https://${url}`;
      const u = new URL(normalized);
      const host = u.hostname.replace(/^www\./, "");
      return { title: host || "New chat", siteUrl: normalized };
    } catch {
      // fall through
    }
    const clean = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
    return { title: clean.slice(0, 48), siteUrl: url.startsWith("http") ? url : `https://${url}` };
  }
  const preview = safePreview(text, 48);
  return preview ? { title: preview } : null;
}

export async function listChats(userId: string) {
  const snap = await userChatsRef(userId).orderBy("updatedAt", "desc").limit(50).get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ChatDoc, "createdAt" | "updatedAt">),
    createdAt: d.get("createdAt") ?? null,
    updatedAt: d.get("updatedAt") ?? null,
  }));
}

export async function createChat(params: {
  userId: string;
  title?: string;
  siteUrl?: string | null;
  welcomeMessage?: string;
}) {
  const ref = userChatsRef(params.userId).doc();
  const now = FieldValue.serverTimestamp();
  const title = (params.title || "").trim() || "New chat";
  const welcome = (params.welcomeMessage || "").trim();

  await ref.set({
    title,
    siteUrl: params.siteUrl ?? null,
    lastMessagePreview: welcome ? safePreview(welcome) : null,
    createdAt: now,
    updatedAt: now,
  } satisfies ChatDoc);

  if (welcome) {
    await ref.collection("messages").add({
      role: "assistant",
      kind: "plain",
      content: welcome,
      createdAt: now,
    } satisfies MessageDoc);
  }

  return { chatId: ref.id };
}

export async function listMessages(params: { userId: string; chatId: string; limit?: number }) {
  const lim = typeof params.limit === "number" && params.limit > 0 ? params.limit : 200;
  const snap = await chatMessagesRef(params.userId, params.chatId)
    .orderBy("createdAt", "asc")
    .limit(lim)
    .get();

  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      role: (data.role as MessageRole) ?? "assistant",
      kind: (data.kind as MessageKind) ?? "plain",
      content: (data.content as string) ?? "",
      artifacts: (data.artifacts as MessageArtifacts | undefined) ?? undefined,
      createdAt: d.get("createdAt") ?? null,
    };
  });
}

export async function appendMessage(params: {
  userId: string;
  chatId: string;
  role: MessageRole;
  kind: MessageKind;
  content: string;
  artifacts?: MessageArtifacts;
}) {
  const msgRef = chatMessagesRef(params.userId, params.chatId).doc();
  const now = FieldValue.serverTimestamp();

  const artifacts = sanitizeArtifacts(params.artifacts);

  await msgRef.set({
    role: params.role,
    kind: params.kind,
    content: params.content,
    createdAt: now,
    ...(artifacts ? { artifacts } : {}),
  } satisfies MessageDoc);

  await userChatsRef(params.userId)
    .doc(params.chatId)
    .set(
      {
        lastMessagePreview: safePreview(params.content),
        updatedAt: now,
      } satisfies Partial<ChatDoc>,
      { merge: true },
    );

  return { messageId: msgRef.id };
}

export async function updateChatMeta(params: {
  userId: string;
  chatId: string;
  title?: string;
  siteUrl?: string | null;
}) {
  const now = FieldValue.serverTimestamp();
  await userChatsRef(params.userId)
    .doc(params.chatId)
    .set(
      {
        ...(typeof params.title === "string" ? { title: params.title } : {}),
        ...(typeof params.siteUrl !== "undefined" ? { siteUrl: params.siteUrl } : {}),
        updatedAt: now,
      } satisfies Partial<ChatDoc>,
      { merge: true },
    );
}

export async function maybeSetChatTitleFromFirstUserMessage(params: {
  userId: string;
  chatId: string;
  userMessage: string;
}) {
  const ref = userChatsRef(params.userId).doc(params.chatId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const currentTitle = (snap.get("title") as string | undefined) ?? "New chat";
  if (currentTitle && currentTitle !== "New chat") return;
  const meta = makeTitleFromContent(params.userMessage);
  if (!meta?.title) return;
  await updateChatMeta({
    userId: params.userId,
    chatId: params.chatId,
    title: meta.title,
    siteUrl: typeof meta.siteUrl === "string" ? meta.siteUrl : undefined,
  });
}

export async function deleteChat(params: { userId: string; chatId: string }) {
  const db = getAdminDb();
  const ref = userChatsRef(params.userId).doc(params.chatId);

  // Prefer recursive delete if available (admin SDK).
  const anyDb = db as any;
  if (typeof anyDb.recursiveDelete === "function") {
    await anyDb.recursiveDelete(ref);
    return;
  }

  // Fallback: best-effort delete up to a reasonable number of messages.
  const msgs = await ref.collection("messages").limit(1000).get();
  const batch = db.batch();
  msgs.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();
}


