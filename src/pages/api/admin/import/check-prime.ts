import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

// Verifies Amazon Prime eligibility for a single ASIN.
//
// Rainforest's "search" endpoint per-item is_prime field is unreliable (Amazon's
// search results page shows generic "Join Prime" upsell markup rather than a real
// per-item Prime badge), but the "product" detail endpoint's
// buybox_winner.is_prime is accurate once a registered customer_zipcode is sent.
//
// This is deliberately one ASIN per request: the client fans these out while
// rendering, so search stays fast and no single request depends on dozens of
// sequential upstream calls completing.
// Prime status per ASIN barely changes minute to minute, and the same product
// gets re-checked whenever it's re-selected, so cache the answer briefly.
const PRIME_CACHE = new Map<string, { isPrime: boolean; images: string[]; expires: number }>();
const PRIME_CACHE_TTL_MS = 10 * 60 * 1000;
const PRIME_CACHE_MAX = 500;

export const POST: APIRoute = async ({ request }) => {
  try {
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);

    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && !sessionData) {
      return new Response(JSON.stringify({ success: false, message: 'Admin authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { asin } = body;

    if (!asin || typeof asin !== 'string') {
      return new Response(JSON.stringify({ success: false, message: 'asin is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cached = PRIME_CACHE.get(asin);
    if (cached && cached.expires > Date.now()) {
      return new Response(JSON.stringify({ success: true, asin, isPrime: cached.isPrime, images: cached.images || [], cached: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const allSettings = await storage.getSiteSettings();
    const settingsMap: Record<string, string> = {};
    for (const s of allSettings) settingsMap[s.key] = s.value || '';

    const apiKey = settingsMap.rainforestApiKey || process.env.RAINFOREST_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, message: 'Rainforest API key is not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL('https://api.rainforestapi.com/request');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('type', 'product');
    url.searchParams.set('amazon_domain', 'amazon.com');
    url.searchParams.set('asin', asin);
    if (settingsMap.rainforestZipCode) {
      url.searchParams.set('customer_zipcode', settingsMap.rainforestZipCode);
    }

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(25000) });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      let upstreamMessage = '';
      try { upstreamMessage = JSON.parse(detail)?.request_info?.message || ''; } catch { /* not JSON */ }
      console.error('Prime check upstream error:', asin, response.status, detail.slice(0, 300));
      return new Response(JSON.stringify({
        success: false,
        isPrime: false,
        message: upstreamMessage || `Upstream status ${response.status}`,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const isPrime = Boolean(data.product?.buybox_winner?.is_prime);

    // The search endpoint only returns one thumbnail per product, but this
    // detail response carries the full gallery — and we're already paying for
    // this call to check Prime, so take the images too rather than making a
    // second request. Highest-resolution variant of each, de-duplicated.
    const images: string[] = [];
    const seen = new Set<string>();
    for (const img of (data.product?.images || [])) {
      const src = img?.link || img?.variant_link || (typeof img === 'string' ? img : '');
      if (!src || seen.has(src)) continue;
      seen.add(src);
      images.push(src);
    }
    // Fall back to the single main image if the gallery is absent.
    const mainImage = data.product?.main_image?.link;
    if (images.length === 0 && mainImage) images.push(mainImage);

    if (PRIME_CACHE.size >= PRIME_CACHE_MAX) {
      const oldest = PRIME_CACHE.keys().next().value;
      if (oldest) PRIME_CACHE.delete(oldest);
    }
    PRIME_CACHE.set(asin, { isPrime, images, expires: Date.now() + PRIME_CACHE_TTL_MS });

    return new Response(JSON.stringify({ success: true, asin, isPrime, images }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error('Prime check error:', error);
    // Report the failure without asserting Prime status either way — the client
    // treats an unverified product as not-Prime so nothing unverified is listed.
    return new Response(JSON.stringify({
      success: false,
      isPrime: false,
      message: timedOut ? 'Prime check timed out' : 'Prime check failed',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};
