import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

async function requireAdmin(request: Request): Promise<boolean> {
  const sessionToken = getAdminSessionToken(request);
  const sessionData = await verifyAdminSession(sessionToken);
  return Boolean(process.env.NODE_ENV === 'development' || sessionData);
}

// Lists every brand+subcategory page the catalogue implies, with its live state.
export const GET: APIRoute = async ({ request, url }) => {
  try {
    if (!await requireAdmin(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    const minProducts = Math.max(1, Number(url.searchParams.get('minProducts')) || 2);
    const candidates = await storage.getBrandSubcategoryCandidates(minProducts);

    return new Response(JSON.stringify({ success: true, candidates }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Get brand subcategories error:", error);
    return new Response(JSON.stringify({ error: "Failed to load brand subcategories" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

// Enables or disables a single brand subcategory page.
export const POST: APIRoute = async ({ request }) => {
  try {
    if (!await requireAdmin(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { brandSlug, brandName, subcategorySlug, subcategoryName, isActive } = body;

    if (!brandSlug || !subcategorySlug || typeof isActive !== 'boolean') {
      return new Response(JSON.stringify({ error: "brandSlug, subcategorySlug and isActive are required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const row = await storage.setBrandSubcategoryActive({
      brandSlug,
      brandName: brandName || brandSlug,
      subcategorySlug,
      subcategoryName: subcategoryName || subcategorySlug,
      isActive,
    } as any);

    return new Response(JSON.stringify({ success: true, brandSubcategory: row }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Toggle brand subcategory error:", error);
    return new Response(JSON.stringify({ error: "Failed to update brand subcategory" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

// Permanently removes a brand subcategory row -- unlike POST with isActive:
// false, which only unpublishes it, this is for clearing out a mistake or test
// entry so it stops showing up in the admin list at all.
export const DELETE: APIRoute = async ({ request }) => {
  try {
    if (!await requireAdmin(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { brandSlug, subcategorySlug } = body;

    if (!brandSlug || !subcategorySlug) {
      return new Response(JSON.stringify({ error: "brandSlug and subcategorySlug are required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    await storage.deleteBrandSubcategory(brandSlug, subcategorySlug);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Delete brand subcategory error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete brand subcategory" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
