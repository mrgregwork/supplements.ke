import type { APIRoute } from "astro";
import { z } from "zod";
import { getAdminSessionToken, verifyAdminSession, getAllAdminUsers, getAdminByEmail, createStaffAdmin } from "@lib/admin";

// Defense in depth: src/middleware.ts already keeps a 'staff' session from
// ever reaching this route at all, but this endpoint creates/lists login
// accounts, so it re-checks role itself rather than relying solely on that.
async function requireFullAdmin(request: Request) {
  const sessionToken = getAdminSessionToken(request);
  const sessionData = await verifyAdminSession(sessionToken);
  const isDev = import.meta.env.DEV;
  if (!isDev && !sessionData) return { ok: false as const, status: 401, error: "Unauthorized" };
  if (sessionData?.admin.role === "staff") return { ok: false as const, status: 403, error: "Not permitted for this account." };
  return { ok: true as const };
}

export const GET: APIRoute = async ({ request }) => {
  const guard = await requireFullAdmin(request);
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), { status: guard.status, headers: { "Content-Type": "application/json" } });
  }

  const admins = (await getAllAdminUsers()).map(({ passwordHash, ...rest }) => rest);
  return new Response(JSON.stringify({ admins }), { status: 200, headers: { "Content-Type": "application/json" } });
};

const createSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  name: z.string().min(1, "Name is required"),
});

export const POST: APIRoute = async ({ request }) => {
  const guard = await requireFullAdmin(request);
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.error }), { status: guard.status, headers: { "Content-Type": "application/json" } });
  }

  try {
    const body = await request.json();
    const parseResult = createSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: parseResult.error.errors[0]?.message || "Invalid input" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const { email, name } = parseResult.data;
    const existing = await getAdminByEmail(email);
    if (existing) {
      return new Response(JSON.stringify({ error: "An account with that email already exists." }), { status: 409, headers: { "Content-Type": "application/json" } });
    }

    const { passwordHash, ...admin } = await createStaffAdmin(email, name);
    return new Response(JSON.stringify({ success: true, admin }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Create staff account error:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to create staff account" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
