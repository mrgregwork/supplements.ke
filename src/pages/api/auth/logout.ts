import type { APIRoute } from "astro";
import { getSessionByToken, deleteSession } from "@lib/auth";

async function clearSession(cookies: Parameters<APIRoute>[0]["cookies"]) {
  const token = cookies.get("session")?.value;
  if (token) {
    try {
      const session = await getSessionByToken(token);
      if (session) await deleteSession(session.id);
    } catch {}
  }
  cookies.delete("session", { path: "/" });
}

export const POST: APIRoute = async ({ cookies }) => {
  await clearSession(cookies);
  return new Response(null, { status: 302, headers: { Location: "/" } });
};

// Handle direct browser navigation to this URL
export const GET: APIRoute = async ({ cookies }) => {
  await clearSession(cookies);
  return new Response(null, { status: 302, headers: { Location: "/" } });
};
