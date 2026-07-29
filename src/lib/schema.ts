import siteSettings from '@config/siteSettings.json';

interface ProductData {
  name: string;
  description: string;
  images: string[];
  sku?: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  inStock?: boolean;
  slug: string;
  categorySlug: string;
  subcategorySlug: string;
  attributes?: { name: string; value: string; slug: string }[];
  gtin?: string;
  mpn?: string;
  longDescription?: string;
  tags?: string[];
}

interface CategoryData {
  name: string;
  slug: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  image?: string;
}

interface BreadcrumbItem {
  name: string;
  href: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

const getSiteUrl = (): string => siteSettings.siteUrl || 'https://supplementskenya.com';

const getRegionalName = (name: string): string => {
  if (siteSettings.enableRegionalSeo && siteSettings.targetRegion) {
    return `${name} in ${siteSettings.targetRegion}`;
  }
  return name;
};

// ── Helper: detect supplement keywords to enrich type ─────────────────────────
function isSupplementProduct(name: string, tags?: string[]): boolean {
  const lower = (name + ' ' + (tags ?? []).join(' ')).toLowerCase();
  const keywords = [
    'vitamin', 'mineral', 'protein', 'collagen', 'omega', 'probiotic', 'prebiotic',
    'supplement', 'capsule', 'tablet', 'gummy', 'powder', 'whey', 'creatine',
    'magnesium', 'zinc', 'calcium', 'iron', 'biotin', 'turmeric', 'ashwagandha',
    'spirulina', 'fish oil', 'multivitamin', 'amino', 'bcaa', 'glutamine',
  ];
  return keywords.some(k => lower.includes(k));
}

// ── Extract serving/dosage hints from attributes ──────────────────────────────
function extractNutritionFromAttributes(
  attributes: { name: string; value: string; slug: string }[]
): Record<string, unknown> | null {
  if (!attributes.length) return null;

  const find = (keys: string[]) =>
    attributes.find(a => keys.some(k => a.name.toLowerCase().includes(k)))?.value ?? null;

  const serving = find(['serving size', 'serving']);
  const servings = find(['servings per container', 'servings', 'number of servings']);
  const calories = find(['calorie', 'energy']);
  const protein = find(['protein']);
  const carbs = find(['carbohydrate', 'carbs']);
  const fat = find(['fat']);

  if (!serving && !protein && !calories) return null;

  const nutrition: Record<string, unknown> = {
    "@type": "NutritionInformation",
  };
  if (serving)   nutrition["servingSize"]        = serving;
  if (servings)  nutrition["numberOfServings"]    = servings;
  if (calories)  nutrition["calories"]            = calories;
  if (protein)   nutrition["proteinContent"]      = protein;
  if (carbs)     nutrition["carbohydrateContent"] = carbs;
  if (fat)       nutrition["fatContent"]          = fat;

  return nutrition;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Core schema generators
// ═══════════════════════════════════════════════════════════════════════════════

export function generateOrganizationSchema() {
  const org = siteSettings.organization;
  const baseUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    "name": org.name,
    "legalName": org.legalName,
    "description": org.description,
    "url": baseUrl,
    "logo": {
      "@type": "ImageObject",
      "url": `${baseUrl}${org.logo}`,
      "width": 512,
      "height": 512,
    },
    "image": `${baseUrl}${org.logo}`,
    "email": org.email,
    "telephone": org.telephone,
    "foundingDate": org.foundingDate,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": org.address.streetAddress,
      "addressLocality": org.address.addressLocality,
      "addressRegion": org.address.addressRegion,
      "postalCode": org.address.postalCode,
      "addressCountry": org.address.addressCountry,
    },
    "sameAs": org.sameAs,
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": org.telephone,
      "contactType": "customer service",
      "email": org.email,
      "availableLanguage": ["English", "Swahili"],
      "areaServed": org.areaServed,
    },
  };
}

export function generateLocalBusinessSchema() {
  const org = siteSettings.organization;
  const baseUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": ["Store", "HealthAndBeautyBusiness"],
    "@id": `${baseUrl}/#store`,
    "name": org.name,
    "description": getRegionalName(org.description),
    "url": baseUrl,
    "logo": `${baseUrl}${org.logo}`,
    "image": `${baseUrl}${org.logo}`,
    "telephone": org.telephone,
    "email": org.email,
    "priceRange": org.priceRange,
    "paymentAccepted": org.paymentAccepted.join(", "),
    "currenciesAccepted": org.currenciesAccepted,
    "openingHours": org.openingHours,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": org.address.streetAddress,
      "addressLocality": org.address.addressLocality,
      "addressRegion": org.address.addressRegion,
      "postalCode": org.address.postalCode,
      "addressCountry": org.address.addressCountry,
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -1.2921,
      "longitude": 36.8219,
    },
    "areaServed": {
      "@type": org.areaServed.type,
      "name": org.areaServed.name,
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": siteSettings.reviews.aggregateRating.ratingValue,
      "reviewCount": siteSettings.reviews.aggregateRating.reviewCount,
      "bestRating": siteSettings.reviews.aggregateRating.bestRating,
      "worstRating": siteSettings.reviews.aggregateRating.worstRating,
    },
    "sameAs": org.sameAs,
  };
}

export function generateWebSiteSchema() {
  const baseUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    "name": siteSettings.siteName,
    "description": siteSettings.siteDescription,
    "url": baseUrl,
    "publisher": {
      "@id": `${baseUrl}/#organization`,
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${baseUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    "inLanguage": "en-KE",
  };
}

export function generateWebPageSchema(
  title: string,
  description: string,
  pageUrl: string,
  type: "WebPage" | "ItemPage" | "CollectionPage" | "AboutPage" | "ContactPage" = "WebPage"
) {
  const baseUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${pageUrl}#webpage`,
    "name": title,
    "description": description,
    "url": pageUrl,
    "isPartOf": { "@id": `${baseUrl}/#website` },
    "publisher": { "@id": `${baseUrl}/#organization` },
    "inLanguage": "en-KE",
  };
}

export function generateProductSchema(product: ProductData, pageUrl: string) {
  const baseUrl = getSiteUrl();
  const org = siteSettings.organization;

  const priceValidUntil = new Date();
  priceValidUntil.setMonth(priceValidUntil.getMonth() + 3);

  // Use DietarySupplement type for supplement products, fall back to Product
  const productType = isSupplementProduct(product.name, product.tags ?? [])
    ? ["Product", "DietarySupplement"]
    : "Product";

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": productType,
    "@id": `${pageUrl}#product`,
    "name": getRegionalName(product.name),
    "description": product.description,
    "image": product.images.map(img => img.startsWith('http') ? img : `${baseUrl}${img}`),
    "sku": product.sku || product.slug,
    "mpn": product.mpn || product.sku || product.slug,
    "brand": {
      "@type": "Brand",
      "name": product.brand || org.name,
    },
    "manufacturer": {
      "@type": "Organization",
      "name": product.brand || org.name,
    },
    "category": "Health & Wellness Supplements",
    "url": pageUrl,
    "offers": {
      "@type": "Offer",
      "@id": `${pageUrl}#offer`,
      "url": pageUrl,
      "priceCurrency": product.currency || siteSettings.defaultCurrency,
      "price": product.price,
      "priceValidUntil": priceValidUntil.toISOString().split('T')[0],
      "availability": product.inStock !== false
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        "name": org.name,
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": 0,
          "currency": product.currency || siteSettings.defaultCurrency,
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": org.address.addressCountry,
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 2,
            "unitCode": "DAY",
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 3,
            "maxValue": 7,
            "unitCode": "DAY",
          },
        },
      },
      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": org.address.addressCountry,
        "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
        "merchantReturnDays": org.returnPolicy.daysToReturn,
        "returnMethod": `https://schema.org/${org.returnPolicy.returnMethod}`,
        "returnFees": `https://schema.org/${org.returnPolicy.returnFees}`,
      },
    },
  };

  if (product.gtin) schema["gtin13"] = product.gtin;

  // No aggregateRating/review here — only added once a real review system exists.
  // Fabricated ratings/reviews are a Google Merchant Center policy violation.

  // NutritionInformation extracted from product attributes
  if (product.attributes && product.attributes.length > 0) {
    const nutrition = extractNutritionFromAttributes(product.attributes);
    if (nutrition) schema["nutrition"] = nutrition;

    schema["additionalProperty"] = product.attributes.map(attr => ({
      "@type": "PropertyValue",
      "name": attr.name,
      "value": attr.value,
    }));
  }

  // DietarySupplement-specific fields
  if (Array.isArray(productType) && productType.includes("DietarySupplement")) {
    const attrs = product.attributes ?? [];
    const getAttr = (keys: string[]) =>
      attrs.find(a => keys.some(k => a.name.toLowerCase().includes(k)))?.value;

    const dosage = getAttr(['dosage', 'serving size', 'serving', 'recommended dose', 'directions']);
    const activeIngredient = getAttr(['active ingredient', 'key ingredient', 'main ingredient', 'ingredient']);

    if (dosage)          schema["recommendedIntake"]  = { "@type": "RecommendedDoseSchedule", "doseValue": dosage };
    if (activeIngredient) schema["activeIngredient"]   = activeIngredient;

    schema["isSafeForChildren"]   = false;
    schema["legalStatus"]         = "OTC";
    schema["targetPopulation"]    = "Adults seeking health and wellness support";
    schema["isProprietary"]       = false;
  }

  return schema;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[], baseUrl?: string) {
  const siteUrl = baseUrl || getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": siteUrl,
      },
      ...items.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 2,
        "name": siteSettings.enableRegionalSeo ? getRegionalName(item.name) : item.name,
        "item": `${siteUrl}${item.href}`,
      })),
    ],
  };
}

export function generateCollectionPageSchema(
  category: CategoryData,
  pageUrl: string,
  products?: ProductData[]
) {
  const baseUrl = getSiteUrl();

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${pageUrl}#collection`,
    "name": getRegionalName(category.seoTitle || category.name),
    "description": category.seoDescription || category.description,
    "url": pageUrl,
    "isPartOf": { "@id": `${baseUrl}/#website` },
    "about": {
      "@type": "Thing",
      "name": getRegionalName(category.name),
    },
    "inLanguage": "en-KE",
  };

  if (category.image) {
    schema["primaryImageOfPage"] = {
      "@type": "ImageObject",
      "url": category.image.startsWith('http') ? category.image : `${baseUrl}${category.image}`,
    };
  }

  return schema;
}

export function generateItemListSchema(
  products: ProductData[],
  listName: string,
  pageUrl: string
) {
  const baseUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": getRegionalName(listName),
    "url": pageUrl,
    "numberOfItems": products.length,
    "itemListElement": products.map((product, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": `${baseUrl}/${product.categorySlug}/${product.subcategorySlug}/${product.slug}/`,
      "name": getRegionalName(product.name),
      "image": product.images[0]?.startsWith('http')
        ? product.images[0]
        : `${baseUrl}${product.images[0] || '/images/placeholder-product.jpg'}`,
    })),
  };
}

export function generateFAQSchema(faqs: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };
}

export function generateOfferCatalogSchema(
  catalogName: string,
  products: ProductData[],
  pageUrl: string
) {
  const baseUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "name": getRegionalName(catalogName),
    "url": pageUrl,
    "numberOfItems": products.length,
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "itemListElement": products.map((product, index) => ({
      "@type": "Offer",
      "position": index + 1,
      "url": `${baseUrl}/${product.categorySlug}/${product.subcategorySlug}/${product.slug}/`,
      "name": getRegionalName(product.name),
      "price": product.price,
      "priceCurrency": product.currency || siteSettings.defaultCurrency,
      "availability": product.inStock !== false
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": siteSettings.organization.name,
      },
    })),
  };
}

export function generateHomePageSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      generateOrganizationSchema(),
      generateWebSiteSchema(),
      generateLocalBusinessSchema(),
    ],
  };
}

export function generateProductPageSchema(
  product: ProductData,
  breadcrumbs: BreadcrumbItem[],
  pageUrl: string,
  faqs?: FAQItem[]
) {
  const productSchema = generateProductSchema(product, pageUrl);
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);
  const webPageSchema = generateWebPageSchema(
    getRegionalName(product.name),
    product.description,
    pageUrl,
    "ItemPage"
  );

  const graph: unknown[] = [productSchema, breadcrumbSchema, webPageSchema];

  if (faqs && faqs.length > 0) {
    graph.push(generateFAQSchema(faqs));
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

export function generateCategoryPageSchema(
  category: CategoryData,
  products: ProductData[],
  breadcrumbs: BreadcrumbItem[],
  pageUrl: string
) {
  const collectionSchema = generateCollectionPageSchema(category, pageUrl, products);
  const itemListSchema = generateItemListSchema(products, category.name, pageUrl);
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs);
  const webPageSchema = generateWebPageSchema(
    getRegionalName(category.seoTitle || category.name),
    category.seoDescription || category.description || '',
    pageUrl,
    "CollectionPage"
  );

  return {
    "@context": "https://schema.org",
    "@graph": [
      collectionSchema,
      itemListSchema,
      breadcrumbSchema,
      webPageSchema,
    ],
  };
}

// ── Image alt text helpers ─────────────────────────────────────────────────────

export function getSchemaAltText(
  productName: string,
  context?: string,
  includeAction?: string
): string {
  let altText = productName;
  if (context)       altText = `${altText} - ${context}`;
  if (includeAction) altText = `${altText} - ${includeAction}`;
  if (siteSettings.enableRegionalSeo && siteSettings.targetRegion) {
    altText = `${altText} in ${siteSettings.targetRegion}`;
  }
  return altText;
}

export function getProductImageAlt(
  productName: string,
  imageIndex: number,
  totalImages: number,
  brand?: string
): string {
  const brandPrefix = brand ? `${brand} ` : '';
  const base = `${brandPrefix}${productName}`;

  if (totalImages <= 1) {
    return base;
  }

  const viewDescriptions = ['Front View', 'Label View', 'Back View', 'Ingredients View', 'Angle View'];
  const viewDesc = viewDescriptions[imageIndex] ?? `View ${imageIndex + 1}`;

  return `${base} - ${viewDesc}`;
}

export function getCategoryImageAlt(categoryName: string): string {
  return categoryName;
}
