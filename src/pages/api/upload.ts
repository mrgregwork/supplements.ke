import type { APIRoute } from "astro";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

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
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
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
    const fileName = `${randomUUID()}-0.${ext}`;

    // Save to public/images/products/ so it's served by Astro/Node static file handler
    // On Railway this is the persistent app directory during a deployment session
    const uploadDir = join(process.cwd(), "public", "images", "products");
    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const publicUrl = `/images/products/${fileName}`;

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
