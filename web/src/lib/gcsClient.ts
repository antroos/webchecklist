import { Storage } from "@google-cloud/storage";

let _storage: Storage | null = null;

export function getGcsBucketName(): string {
  const bucket =
    process.env.GCS_BUCKET ||
    process.env.SNAPSHOTS_GCS_BUCKET ||
    process.env.GOOGLE_CLOUD_STORAGE_BUCKET ||
    "";
  if (!bucket) {
    throw new Error(
      "Missing GCS bucket env var. Set GCS_BUCKET (or SNAPSHOTS_GCS_BUCKET).",
    );
  }
  return bucket;
}

export function getGcsStorage(): Storage {
  if (_storage) return _storage;
  _storage = new Storage(); // uses ADC on Cloud Run / local env
  return _storage;
}

export async function uploadBufferToGcs(params: {
  bucket: string;
  objectPath: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
}) {
  const storage = getGcsStorage();
  const file = storage.bucket(params.bucket).file(params.objectPath);
  await file.save(params.buffer, {
    resumable: false,
    contentType: params.contentType,
    metadata: params.cacheControl ? { cacheControl: params.cacheControl } : undefined,
  });
}

export async function downloadGcsObjectToBuffer(params: {
  bucket: string;
  objectPath: string;
}): Promise<Buffer> {
  const storage = getGcsStorage();
  const file = storage.bucket(params.bucket).file(params.objectPath);
  const [buf] = await file.download();
  return buf;
}


