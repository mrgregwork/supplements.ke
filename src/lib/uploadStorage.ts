/**
 * Where admin-uploaded files (blog featured images, page images, category
 * images) actually live on disk, and how they get served back.
 *
 * This exists because the previous approach — write to public/images/products/
 * at request time — never worked in production. The Node standalone adapter
 * serves static files from dist/client/, which is populated from public/ only
 * at BUILD time. A runtime write to public/ lands somewhere nothing serves,
 * so every admin upload 404'd immediately, silently.
 *
 * If a Railway Volume is attached, RAILWAY_VOLUME_MOUNT_PATH is a path Railway
 * guarantees survives across deploys, so uploads go there and persist. Without
 * one, uploads fall back to a local directory that IS served (dev, and even in
 * prod via the /uploads/[...path] route below) but will be wiped on the next
 * deploy, same as any other write to an ephemeral container filesystem.
 */
import { join } from "path";

export function getUploadDir(): string {
  const volumeRoot = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  return volumeRoot
    ? join(volumeRoot, "uploads")
    : join(process.cwd(), "data", "uploads");
}

export const UPLOAD_URL_PREFIX = "/uploads";

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export function mimeTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

export const ALLOWED_UPLOAD_MIME_TYPES = Object.values(MIME_TYPES);
