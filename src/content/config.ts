import { defineCollection, z } from 'astro:content';

const categoriesCollection = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    heroImage: z.string().optional(),
    seoContent: z.string().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

const subcategoriesCollection = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    categorySlug: z.string(),
    description: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    heroImage: z.string().optional(),
    seoContent: z.string().optional(),
    siblingLinks: z.array(z.object({
      name: z.string(),
      slug: z.string(),
    })).optional(),
    order: z.number().default(0),
  }),
});

const productsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    categorySlug: z.string(),
    subcategorySlug: z.string(),
    description: z.string(),
    longDescription: z.string().optional(),
    price: z.number(),
    originalPrice: z.number().optional(),
    currency: z.string().default('KES'),
    images: z.array(z.string()),
    brand: z.string(),
    sku: z.string(),
    inStock: z.boolean().default(true),
    attributes: z.array(z.object({
      name: z.string(),
      value: z.string(),
      slug: z.string(),
    })),
    seoTitle: z.string(),
    seoDescription: z.string(),
    primaryKeyword: z.string(),
    secondaryKeywords: z.array(z.string()).optional(),
    featured: z.boolean().default(false),
  }),
});

const specsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    attributeValue: z.string(),
    categorySlug: z.string(),
    naturalSlug: z.string(),
    seoTitle: z.string(),
    seoDescription: z.string(),
    seoContent: z.string().optional(),
  }),
});

export const collections = {
  categories: categoriesCollection,
  subcategories: subcategoriesCollection,
  products: productsCollection,
  specs: specsCollection,
};
