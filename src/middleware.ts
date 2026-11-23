import type { MiddlewareHandler } from 'astro';
import { getAdminSessionToken, verifyAdminSession } from '@lib/admin';

// A 'staff' admin_users row (see /admin/staff) is Products + Orders (full
// access, including abandoned checkouts and refunds) + Categories/
// Subcategories (view only) -- this is the one place that's actually
// enforced, rather than duplicated into every individual admin page/route.
// Anything under /admin or /api/admin that isn't in one of these lists is
// blocked for a staff session: redirected to /admin/products for a page, or
// a 403 JSON response for an API call.
const STAFF_ALLOWED_PAGE_PREFIXES = ['/admin/products', '/admin/orders', '/admin/login', '/admin/logout'];
// Exact matches only (not prefix) -- the list pages themselves, never
// /admin/categories/edit or /admin/categories/import, since staff can look
// but not create/edit/delete (enforced at the API layer below too).
const STAFF_ALLOWED_PAGE_EXACT = ['/admin/categories', '/admin/subcategories'];
const STAFF_ALLOWED_API_EXACT = ['/api/admin/request-otp', '/api/admin/verify-otp', '/api/admin/upload-image'];
const STAFF_ALLOWED_API_PREFIXES = ['/api/admin/products', '/api/admin/orders', '/api/admin/abandoned-checkouts', '/api/admin/refund-requests'];
// Read-only lookups the product form needs for its Category/Subcategory/
// Attribute dropdowns, and that back the Categories/Subcategories list pages
// above -- GET only (checked separately below), since staff has no business
// creating or editing any of these themselves.
const STAFF_READONLY_GET_API_PREFIXES = ['/api/admin/categories', '/api/admin/subcategories', '/api/admin/attributes'];

export const onRequest: MiddlewareHandler = async (context, next) => {
  const path = context.url.pathname;
  const isAdminArea = path.startsWith('/admin') || path.startsWith('/api/admin');

  if (isAdminArea) {
    const sessionToken = getAdminSessionToken(context.request);
    const sessionData = await verifyAdminSession(sessionToken);

    if (sessionData?.admin.role === 'staff') {
      const allowed =
        STAFF_ALLOWED_PAGE_PREFIXES.some((p) => path.startsWith(p)) ||
        STAFF_ALLOWED_PAGE_EXACT.includes(path) ||
        STAFF_ALLOWED_API_EXACT.includes(path) ||
        STAFF_ALLOWED_API_PREFIXES.some((p) => path.startsWith(p)) ||
        (context.request.method === 'GET' && STAFF_READONLY_GET_API_PREFIXES.some((p) => path.startsWith(p)));

      if (!allowed) {
        if (path.startsWith('/admin')) {
          return context.redirect('/admin/products');
        }
        return new Response(JSON.stringify({ error: 'Not permitted for this account.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  }

  return next();
};
