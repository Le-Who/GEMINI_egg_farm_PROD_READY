/**
 * Content Manager — CMS Content CRUD
 *
 * Extracted from server.js for modularity.
 * Handles loading, saving, caching, and versioning of game content
 * (items, crops, pets, eggs, levels, tutorial, skus, quests).
 */
import fs from "fs";
import path from "path";
import { gcsRead, gcsWrite } from "./storage.js";

export const CONTENT_TYPES = [
  "items",
  "crops",
  "pets",
  "eggs",
  "levels",
  "tutorial",
  "skus",
  "quests",
];

let contentCache = {};
let contentVersion = 0;
let localContentDir = "";

/**
 * Initialize the content manager with a local content directory.
 * @param {string} dir - Path to local content directory
 */
export function initContentManager(dir) {
  localContentDir = dir;
}

/**
 * Get the local content directory path.
 * @returns {string}
 */
export function getLocalContentDir() {
  return localContentDir;
}

/**
 * Get the current content cache (mutable reference).
 * @returns {object}
 */
export function getContentCache() {
  return contentCache;
}

/**
 * Get the current content version number.
 * @returns {number}
 */
export function getContentVersion() {
  return contentVersion;
}

/**
 * Load all content from GCS (primary) or local filesystem (fallback).
 * Populates the content cache and bumps the version.
 */
export async function loadContent() {
  for (const type of CONTENT_TYPES) {
    try {
      // Try GCS first
      const gcsData = await gcsRead(`content/${type}.json`);
      if (gcsData) {
        contentCache[type] = JSON.parse(gcsData);
        // Sync to local
        try {
          fs.mkdirSync(localContentDir, { recursive: true });
          fs.writeFileSync(path.join(localContentDir, `${type}.json`), gcsData);
        } catch (e) {}
        continue;
      }
    } catch (e) {}

    // Fallback: local file
    try {
      const localPath = path.join(localContentDir, `${type}.json`);
      if (fs.existsSync(localPath)) {
        contentCache[type] = JSON.parse(fs.readFileSync(localPath, "utf-8"));
      } else {
        contentCache[type] = type === "levels" || type === "tutorial" ? [] : {};
      }
    } catch (e) {
      contentCache[type] = type === "levels" || type === "tutorial" ? [] : {};
    }
  }
  contentVersion++;
  console.log(
    `Content loaded (v${contentVersion}):`,
    Object.keys(contentCache)
      .map((k) => {
        const v = contentCache[k];
        return `${k}(${Array.isArray(v) ? v.length : Object.keys(v).length})`;
      })
      .join(", "),
  );
}

/**
 * Save a specific content type to both local filesystem and GCS.
 * Bumps the content version.
 * @param {string} type - Content type key
 */
export async function saveContent(type) {
  const json = JSON.stringify(contentCache[type], null, 2);

  // Save locally
  try {
    fs.mkdirSync(localContentDir, { recursive: true });
    fs.writeFileSync(path.join(localContentDir, `${type}.json`), json);
  } catch (e) {
    console.error(`Local save error (${type}):`, e.message);
  }

  // Save to GCS
  await gcsWrite(`content/${type}.json`, json);

  contentVersion++;
}
