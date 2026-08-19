import type { APIRoute } from "astro";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";
import { getUploadDir, UPLOAD_URL_PREFIX, ALLOWED_UPLOAD_MIME_TYPES } from "@lib/uploadStorage";

export const POST: APIRoute = async ({ request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);

    const isDev = process.env.NODE_ENV === "development";
    if (!isDev && !sessionData) {
      return new Response(
        JSON.stringify({ success: false, message: "Admin authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, message: "No file provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid file type. Only JPEG, PNG, WebP, GIF and SVG are allowed." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, message: "File too large. Maximum size is 5MB." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${randomUUID()}.${ext}`;

    // Served back through src/pages/uploads/[...path].ts, not Astro's static
    // handler — that only serves dist/client/, which is rebuilt from public/
    // at BUILD time and never sees a runtime write. See uploadStorage.ts for
    // why the directory itself may or may not survive the next deploy.
    const uploadDir = getUploadDir();
    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const publicUrl = `${UPLOAD_URL_PREFIX}/${fileName}`;

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        fileName: file.name,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Upload error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Failed to upload file" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
