/**
 * googleRating.ts
 *
 * Site-level Google Places rating for Supplements Kenya.
 *
 * Currently returns a static placeholder.
 * To wire up live data:
 *  1. Set GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID in your Railway env vars
 *  2. Uncomment the fetch block below
 *  3. Add a build-time or ISR cache so you're not hitting the API on every request
 *
 * Google Places API docs:
 *   https://developers.google.com/maps/documentation/places/web-service/details
 */

export interface SiteRating {
  rating: number;       // e.g. 4.8
  reviewCount: number;  // e.g. 127
  source: 'google' | 'placeholder';
}

// ── Placeholder values ──────────────────────────────────────────────────────
// Replace these with real numbers once the Google Places API is connected.
const PLACEHOLDER: SiteRating = {
  rating: 4.8,
  reviewCount: 127,
  source: 'placeholder',
};

// ── Live fetch (disabled until API credentials are provided) ─────────────────
// async function fetchGoogleRating(): Promise<SiteRating> {
//   const apiKey  = import.meta.env.GOOGLE_PLACES_API_KEY;
//   const placeId = import.meta.env.GOOGLE_PLACE_ID;
//   if (!apiKey || !placeId) return PLACEHOLDER;
//
//   const url = `https://maps.googleapis.com/maps/api/place/details/json`
//             + `?place_id=${placeId}&fields=rating,user_ratings_total&key=${apiKey}`;
//   const res  = await fetch(url);
//   const data = await res.json();
//   const result = data?.result;
//   if (!result?.rating) return PLACEHOLDER;
//   return {
//     rating:      result.rating,
//     reviewCount: result.user_ratings_total ?? 0,
//     source:      'google',
//   };
// }

/**
 * Returns the site-wide Google rating.
 * Swap `getSiteRating` implementation for the live fetch when ready.
 */
export async function getSiteRating(): Promise<SiteRating> {
  // return fetchGoogleRating(); // ← uncomment when API key is ready
  return PLACEHOLDER;
}
