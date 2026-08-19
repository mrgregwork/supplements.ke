/**
 * sitemap.ts
 *
 * Single source of truth for both /sitemap.xml and the human-readable /sitemap page.
 * Everything indexable is collected here so the two can never drift apart.
 */

import { storage } from '@lib/storage';
import siteSettings from '@config/siteSettings.json';
import {
  generateCategoryUrl,
  generateSubcategoryUrl,
  generateProductUrl,
  generateBrandUrl,
} from '@lib/seo';

export interface SitemapEntry {
  /** Root-relative path, always with a trailing slash */
  path: string;
  label: string;
  lastmod?: string;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
}

export interface SitemapSection {
  title: string;
  entries: SitemapEntry[];
  /**
   * False for sections whose pages are noindex. They still appear on the
   * human-readable /sitemap page for shoppers, but are kept out of
   * sitemap.xml — submitting noindex URLs there trips Search Console errors.
   */
  includeInXml: boolean;
}

export const SITE_URL = (siteSettings.siteUrl || 'https://supplements.ke').replace(/\/$/, '');

/**
 * Mirror of the brand-slug normalisation used by storage.getProductsByBrandSlug,
 * so generated brand URLs always resolve: lowercase, hyphens to spaces,
 * drop anything that is not a-z/0-9/space, collapse spaces, then hyphenate.
 */
export function brandToSlug(brand: string): string {
  return brand
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const toIso = (d: Date | string | null | undefined): string | undefined => {
  if (!d) return undefined;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString().split('T')[0];
};

/** Static, indexable pages. Cart/checkout/login/account/admin/api/search are deliberately excluded. */
const STATIC_PAGES: SitemapEntry[] = [
  { path: '/',                 label: 'Home',            changefreq: 'daily',   priority: 1.0 },
  { path: '/all-supplements/', label: 'All Supplements', changefreq: 'daily',   priority: 0.9 },
  { path: '/blog/',            label: 'Blog',            changefreq: 'weekly',  priority: 0.6 },
  { path: '/about/',           label: 'About Us',        changefreq: 'yearly',  priority: 0.4 },
  { path: '/contact/',         label: 'Contact',         changefreq: 'yearly',  priority: 0.4 },
  { path: '/privacy/',         label: 'Privacy Policy',  changefreq: 'yearly',  priority: 0.2 },
  { path: '/terms/',           label: 'Terms & Conditions', changefreq: 'yearly', priority: 0.2 },
  { path: '/sitemap/',         label: 'Sitemap',         changefreq: 'weekly',  priority: 0.2 },
];

/**
 * Build every section of the sitemap. Each data source is fetched independently so a
 * single failing table degrades that one section instead of emptying the whole sitemap.
 */
export async function getSitemapSections(): Promise<SitemapSection[]> {
  const safe = async <T>(fn: () => Promise<T[]>): Promise<T[]> => {
    try { return await fn(); } catch { return []; }
  };

  const [products, categories, subcategories, blogPosts, blogCategories, contentPages] = await Promise.all([
    safe(() => storage.getProducts()),
    safe(() => storage.getCategories()),
    safe(() => storage.getSubcategories()),
    safe(() => storage.getBlogPosts()),
    safe(() => storage.getBlogCategories()),
    safe(() => storage.getContentPages()),
  ]);

  const activeProducts = products.filter(p => p.status === 'active');

  const categoryById = new Map(categories.map(c => [c.id, c]));
  const subcategoryById = new Map(subcategories.map(s => [s.id, s]));

  // ── Categories ──────────────────────────────────────────────────────────────
  const categoryEntries: SitemapEntry[] = categories
    .map(c => ({
      path: generateCategoryUrl(c.slug),
      label: c.name,
      changefreq: 'weekly' as const,
      priority: 0.8,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // ── Subcategories (skip any whose parent category is missing) ───────────────
  const subcategoryEntries: SitemapEntry[] = subcategories
    .flatMap(s => {
      const parent = categoryById.get(s.categoryId ?? '');
      if (!parent) return [];
      return [{
        path: generateSubcategoryUrl(parent.slug, s.slug),
        label: `${parent.name} → ${s.name}`,
        changefreq: 'weekly' as const,
        priority: 0.7,
      }];
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  // ── Products (use the product's own category/subcategory, matching the
  //    canonical URL the product page itself redirects to).
  //    Only products flagged indexable are eligible for sitemap.xml. ──────────
  const buildProductEntries = (list: typeof activeProducts): SitemapEntry[] => list
    .flatMap(p => {
      const category = categoryById.get(p.categoryId ?? '');
      const subcategory = subcategoryById.get(p.subcategoryId ?? '');
      const categorySlug = category?.slug ?? p.categorySlug;
      const subcategorySlug = subcategory?.slug ?? p.subcategorySlug;
      if (!categorySlug || !subcategorySlug) return [];
      return [{
        path: generateProductUrl(categorySlug, subcategorySlug, p.slug),
        label: p.name,
        lastmod: toIso(p.updatedAt),
        changefreq: 'weekly' as const,
        priority: 0.7,
      }];
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const indexableProductEntries = buildProductEntries(activeProducts.filter(p => p.indexable === true));
  const noindexProductEntries   = buildProductEntries(activeProducts.filter(p => p.indexable !== true));

  // ── Brands (deduped, derived from active products) ──────────────────────────
  const brandMap = new Map<string, string>();
  for (const p of activeProducts) {
    const brand = p.brand?.trim();
    if (!brand) continue;
    const slug = brandToSlug(brand);
    if (slug && !brandMap.has(slug)) brandMap.set(slug, brand);
  }
  const brandEntries: SitemapEntry[] = [...brandMap.entries()]
    .map(([slug, name]) => ({
      path: generateBrandUrl(slug),
      label: name,
      changefreq: 'weekly' as const,
      priority: 0.6,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // ── Blog posts & content pages (published only) ─────────────────────────────
  const blogEntries: SitemapEntry[] = blogPosts
    .filter(p => p.status === 'published')
    .map(p => ({
      path: `/blog/${p.slug}/`,
      label: p.title,
      lastmod: toIso(p.publishedAt ?? p.updatedAt),
      changefreq: 'monthly' as const,
      priority: 0.5,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Only list a blog category page if it actually has a published post —
  // an empty archive page is thin content and not worth indexing.
  const blogCategoryEntries: SitemapEntry[] = blogCategories
    .filter(cat => blogPosts.some(p => p.status === 'published' && p.categoryId === cat.id))
    .map(cat => ({
      path: `/blog/category/${cat.slug}/`,
      label: `Blog: ${cat.name}`,
      lastmod: toIso(cat.updatedAt),
      changefreq: 'weekly' as const,
      priority: 0.5,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const contentPageEntries: SitemapEntry[] = contentPages
    .filter(p => p.status === 'published')
    .map(p => ({
      path: `/pages/${p.slug}/`,
      label: p.title,
      lastmod: toIso(p.updatedAt),
      changefreq: 'monthly' as const,
      priority: 0.4,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [
    { title: 'Main Pages',    entries: STATIC_PAGES,              includeInXml: true },
    { title: 'Categories',    entries: categoryEntries,           includeInXml: true },
    { title: 'Subcategories', entries: subcategoryEntries,        includeInXml: true },
    { title: 'Brands',        entries: brandEntries,              includeInXml: true },
    { title: 'Products',      entries: indexableProductEntries,   includeInXml: true },
    { title: 'Products (not yet indexed)', entries: noindexProductEntries, includeInXml: false },
    { title: 'Articles',      entries: blogEntries,               includeInXml: true },
    { title: 'Blog Categories', entries: blogCategoryEntries,     includeInXml: true },
    { title: 'Other Pages',   entries: contentPageEntries,        includeInXml: true },
  ].filter(section => section.entries.length > 0);
}
