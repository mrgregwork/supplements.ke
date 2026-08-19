import siteSettings from '@config/siteSettings.json';

export interface SeoProps {
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
}

export function getRegionalText(text: string): string {
  if (siteSettings.enableRegionalSeo && siteSettings.targetRegion) {
    return `${text} in ${siteSettings.targetRegion}`;
  }
  return text;
}

export function getRegionalAnchorText(text: string): string {
  return getRegionalText(text);
}

export function getRegionalAltText(productName: string, context?: string): string {
  const baseText = context ? `${productName} - ${context}` : productName;
  return getRegionalText(baseText);
}

export function generateBreadcrumbs(
  segments: { name: string; href: string }[]
): { name: string; href: string }[] {
  return [
    { name: 'Home', href: '/' },
    ...segments,
  ];
}

export function generateNaturalSlug(value: string, category: string): string {
  const normalizedValue = value.toLowerCase().replace(/\s+/g, '-');
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '-');
  return `${normalizedValue}-${normalizedCategory}`;
}

export function generateProductUrl(
  categorySlug: string,
  subcategorySlug: string,
  productSlug: string
): string {
  return `/${categorySlug}/${subcategorySlug}/${productSlug}/`;
}

export function generateSubcategoryUrl(
  categorySlug: string,
  subcategorySlug: string
): string {
  return `/${categorySlug}/${subcategorySlug}/`;
}

export function generateCategoryUrl(categorySlug: string): string {
  return `/${categorySlug}/`;
}

export function generateSpecUrl(naturalSlug: string): string {
  return `/specs/${naturalSlug}/`;
}

export function generateBrandUrl(brandSlug: string): string {
  return `/brand/${brandSlug}/`;
}

/** Reserved URL segment for posts with no category assigned. Not a real category row. */
export const UNCATEGORIZED_BLOG_SLUG = "uncategorized";

export function generateBlogCategoryUrl(categorySlug: string): string {
  return `/blog/${categorySlug}/`;
}

export function generateBlogPostUrl(categorySlug: string | null | undefined, postSlug: string): string {
  return `/blog/${categorySlug || UNCATEGORIZED_BLOG_SLUG}/${postSlug}/`;
}

export function formatPrice(price: number, currency: string = 'KES'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price);
}

export function getCanonicalUrl(path: string): string {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'https://ecommerce-seo.replit.app';
  return `${baseUrl}${path}`;
}
