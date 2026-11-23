import type { MiddlewareHandler } from 'astro';
import { getAdminSessionToken, verifyAdminSession } from '@lib/admin';

// A 'staff' admin_users row (see /admin/staff) is Products-only -- this is
// the one place that's actually enforced, rather than duplicated into every
// individual admin page/route. Anything under /admin or /api/admin that
// isn't in one of these lists is blocked for a staff session: redirected to
// /admin/products for a page, or a 403 JSON response for an API call.
const STAFF_ALLOWED_PAGE_PREFIXES = ['/admin/products', '/admin/login', '/admin/logout'];
const STAFF_ALLOWED_API_EXACT = ['/api/admin/request-otp', '/api/admin/verify-otp', '/api/admin/upload-image'];
const STAFF_ALLOWED_API_PREFIXES = ['/api/admin/products'];
// Read-only lookups the product form needs for its Category/Subcategory/
// Attribute dropdowns -- GET only (checked separately below), since staff
// has no business creating or editing any of these themselves.
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
