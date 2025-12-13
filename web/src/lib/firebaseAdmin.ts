import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadServiceAccountFromEnv(): Record<string, unknown> | undefined {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson && rawJson.trim()) {
    return JSON.parse(rawJson);
  }

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (b64 && b64.trim()) {
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  }

  return undefined;
}

export function getAdminDb() {
  if (!getApps().length) {
    const sa = loadServiceAccountFromEnv();
    if (sa) {
      initializeApp({ credential: cert(sa as any) });
    } else {
      // Cloud Run: use Application Default Credentials (service account attached to the service).
      // Local: user can set GOOGLE_APPLICATION_CREDENTIALS, or provide FIREBASE_SERVICE_ACCOUNT_* env vars.
      initializeApp();
    }
  }

  return getFirestore();
}



