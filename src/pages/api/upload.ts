import type { APIRoute } from "astro";
import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  const segments = path.replace(/^\/+/, "").split("/");
  const bucketName = segments[0];
  const objectName = segments.slice(1).join("/");
  return { bucketName, objectName };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify admin session
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);
    
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && !sessionData) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Admin authentication required' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string || 'uploads';
    
    if (!file) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No file provided' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const publicSearchPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = publicSearchPaths.split(",").map(p => p.trim()).filter(p => p.length > 0);
    
    if (paths.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Object storage not configured' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const basePath = paths[0];
    const { bucketName } = parseObjectPath(basePath);
    
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${folder}/${randomUUID()}.${ext}`;
    const objectPath = `public/${fileName}`;
    
    const bucket = storage.bucket(bucketName);
    const gcsFile = bucket.file(objectPath);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    
    await gcsFile.save(buffer, {
      contentType: file.type,
      metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });
    
    const publicUrl = `/objects/${bucketName}/${objectPath}`;
    
    return new Response(JSON.stringify({ 
      success: true,
      url: publicUrl,
      objectPath: `/${bucketName}/${objectPath}`,
      fileName: file.name,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Failed to upload file' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
