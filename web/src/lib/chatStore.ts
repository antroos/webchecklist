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
  raw?: unknown;
  html?: string;
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

  if (typeof input.html === "string") {
    const sz = Buffer.byteLength(input.html, "utf8");
    if (sz <= maxHtmlBytes) out.html = input.html;
    else {
      omitted = true;
      reasons.push("html_too_large");
    }
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
  welcomeMessage: string;
}) {
  const ref = userChatsRef(params.userId).doc();
  const now = FieldValue.serverTimestamp();
  const title = (params.title || "").trim() || "New chat";

  await ref.set({
    title,
    siteUrl: params.siteUrl ?? null,
    lastMessagePreview: safePreview(params.welcomeMessage),
    createdAt: now,
    updatedAt: now,
  } satisfies ChatDoc);

  await ref.collection("messages").add({
    role: "assistant",
    kind: "plain",
    content: params.welcomeMessage,
    createdAt: now,
  } satisfies MessageDoc);

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


