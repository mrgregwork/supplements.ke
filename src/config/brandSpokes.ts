export interface SpokeConfig {
  slug: string;
  h1: string;
  title: string;
  metaDescription: string;
  filter: (p: { name: string; subcategorySlug?: string | null; categorySlug?: string | null }) => boolean;
  seoContent: string;
  related: string[]; // exactly 3 spoke slugs
}

// Map of brand slug -> spoke configs. Empty by default -- this template ships
// with no niche-specific brand content. Add hand-written spokes here the same
// way the original cosmetics.ke build did for its "Olay" brand pages
// (/brand/<brand>/<spoke-slug>), e.g. { "some-brand": { "some-brand-widgets": { ... } } }.
export const BRAND_SPOKES: Record<string, Record<string, SpokeConfig>> = {};
