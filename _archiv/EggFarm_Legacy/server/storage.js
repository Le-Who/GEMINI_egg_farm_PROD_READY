/**
 * Storage Module — GCS + Local Filesystem Helpers
 *
 * Extracted from server.js for modularity.
 * Provides a unified interface for read/write/list operations
 * that works with Google Cloud Storage (primary) and local filesystem (fallback).
 */
import { Storage } from "@google-cloud/storage";

let bucket = null;

/**
 * Initialize storage with optional GCS bucket.
 * @param {string} bucketName - GCS bucket name (empty string = local only)
 */
export function initStorage(bucketName) {
  if (bucketName) {
    const storage = new Storage(); // auto-authenticates on GCP
    bucket = storage.bucket(bucketName);
    console.log(`GCS bucket: ${bucketName}`);
  } else {
    console.warn(
      "⚠️  GCS_BUCKET not set — using LOCAL file storage (data lost on redeploy!)",
    );
  }
}

/**
 * Get the current bucket instance (or null if local-only).
 */
export function getBucket() {
  return bucket;
}

/**
 * Read a file from GCS.
 * @param {string} gcsPath - Path within the bucket
 * @returns {Promise<string|null>} File contents or null
 */
export async function gcsRead(gcsPath) {
  if (!bucket) return null;
  try {
    const [data] = await bucket.file(gcsPath).download();
    return data.toString("utf-8");
  } catch (e) {
    if (e.code === 404) return null;
    console.error(`GCS read error (${gcsPath}):`, e.message);
    return null;
  }
}

/**
 * Write content to GCS.
 * @param {string} gcsPath - Path within the bucket
 * @param {string|Buffer} content - Content to write
 * @param {string} contentType - MIME type (default: application/json)
 */
export async function gcsWrite(
  gcsPath,
  content,
  contentType = "application/json",
) {
  if (!bucket) return;
  try {
    await bucket.file(gcsPath).save(content, { resumable: false, contentType });
  } catch (e) {
    console.error(`GCS write error (${gcsPath}):`, e.message);
  }
}

/**
 * List files in GCS with a given prefix.
 * @param {string} prefix - Path prefix to list
 * @returns {Promise<string[]>} Array of file names
 */
export async function gcsList(prefix) {
  if (!bucket) return [];
  try {
    const [files] = await bucket.getFiles({ prefix });
    return files.map((f) => f.name);
  } catch (e) {
    console.error(`GCS list error (${prefix}):`, e.message);
    return [];
  }
}
