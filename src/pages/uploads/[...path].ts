import type { APIRoute } from "astro";
import { readFile } from "fs/promises";
import { join, normalize } from "path";
import { getUploadDir, mimeTypeFor } from "@lib/uploadStorage";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const requested = params.path ?? "";

  // normalize() collapses ../ segments; reject anything that still tries to
  // escape the upload directory rather than trusting the URL segment as-is.
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  if (safePath.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = join(getUploadDir(), safePath);

  try {
    const data = await readFile(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": mimeTypeFor(filePath),
        // Uploaded filenames are random UUIDs, so a changed image is a new
        // URL, not a mutated one — safe to cache aggressively.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};
