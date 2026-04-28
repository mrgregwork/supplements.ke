# E-Commerce SEO Platform Template

## Overview
This project is a production-ready, SEO-optimized e-commerce template built with Astro, designed for distribution and deployment across numerous websites in various niches. It emphasizes performance, mobile-first design, and advanced SEO capabilities to maximize search engine visibility and user experience. The template is niche-agnostic, easily adaptable for different product categories, and includes features like regional SEO, Schema.org markup, OTP authentication, and a 3-click navigation structure.

The template aims to serve affiliate marketers deploying multiple niche sites, agencies building e-commerce solutions for clients, and developers creating white-label storefronts. Its core vision is to provide a highly performant and SEO-friendly foundation for e-commerce ventures, enabling rapid deployment and effective online presence.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: Astro v5 with Server-Side Rendering (SSR) via `@astrojs/node` adapter.
- **Styling**: Tailwind CSS for utility-first styling, incorporating custom design tokens.
- **Mobile-First Design**: Implemented with responsive breakpoints (sm: 640px, md: 768px, lg: 1024px) and specific patterns for touch targets (minimum 48px height for interactive elements), admin sidebar, product cards, form inputs, and layout stacking.
- **Components**: Reusable Astro components stored in `src/components/`.
- **Layouts**: Base layout (`src/layouts/BaseLayout.astro`) includes SEO meta tags, structured data, and dark mode support.
- **Site Structure**: Enforces a maximum of 3-click navigation depth for optimal SEO, with natural language URLs for categories, subcategories, products, and spec filter pages.

### Backend and Data Management
- **Database**: PostgreSQL for storing categories, subcategories, attributes, and product data.
- **ORM**: Drizzle ORM used with Zod validation for schema definition (`shared/schema.ts`).
- **Admin Panel**: Shopify-style CRUD operations accessible at `/admin/` for managing categories, subcategories, attributes, products, and site settings. Products support Active/Draft status, SEO fields, and the product list includes search, status filtering, and stock filtering. Categories support hero images, Active/Draft status, sort order, and collapsible SEO sections.
- **Content Management**: Static content stored as JSON files in `src/content/`.
- **Authentication**: Email-based One-Time Password (OTP) for passwordless login, with cookie-based sessions.
- **Admin API**: Astro API routes for all admin functionalities, including product import, license verification, and AI-powered filter generation, all secured with Zod validation and admin session authentication on all write endpoints (categories, subcategories, products, navigation, homepage).

### SEO Features
- **Regional SEO Module**: `src/lib/seo.ts` dynamically appends region names to text, anchor text, and alt text based on configured `targetRegion`.
- **Schema Markup Library**: `src/lib/schema.ts` generates comprehensive Schema.org JSON-LD structured data for various page types (Organization, LocalBusiness, WebSite, Product, BreadcrumbList, CollectionPage, ItemList, OfferCatalog, FAQPage).
- **Dual Currency Display**: Automatically shows prices in USD and local currency when regional SEO is enabled, using real-time exchange rates (cached for 1 hour).
- **URL Strategy**: Natural language slugs (e.g., `/specs/32gb-laptops`) and semantic product URLs including category and subcategory paths. Canonical URLs are set via BaseLayout.
- **Reverse Silo Interlinking**: Automated strategy ensuring category/subcategory descriptions appear after product listings, contextual linking between subcategories and parent categories, and rich breadcrumbs with Schema.org markup.
- **Configuration**: SEO settings (e.g., `enableRegionalSeo`, `targetRegion`, `includeBrandInH1`) are database-driven via the `site_settings` table.

### Content Management
- **Homepage Editor**: Admin page at `/admin/homepage` for editing hero section (title, description, button text/link), statistics, and SEO content with database persistence and fallbacks.
- **Navigation Editor**: Admin page at `/admin/navigation` for managing menu items with quick-add from categories, drag-drop reordering (via sort order), and mega menu structure support via parentId.
- **Dynamic Content Loading**: Header.astro and index.astro fetch content from database with sensible hardcoded fallbacks for empty states.

### E-Commerce Functionality
- **Product Import (Amazon)**: Features AI-powered smart filters using OpenAI to generate context-aware filter suggestions for product imports. Subcategory is optional during import.
- **Bulk Category Tree Import**: Admin page at `/admin/categories/import` for uploading CSV files to create entire category hierarchies at once. Supports file upload, drag-and-drop, and paste. Includes preview, progress tracking, downloadable template, and duplicate/conflict detection. API at `POST /api/admin/categories/import` with max 500 rows, input trimming, empty slug rejection, and slug collision detection.
- **Product CSV Import**: Admin page at `/admin/products/import` for bulk importing products from CSV files. Maps products to existing categories/subcategories by name, auto-generates unique slugs, and supports all product fields. API at `POST /api/admin/products/import` with max 500 rows and comprehensive validation.
- **Category Editor**: Full-page WordPress/Shopify-style editing experience at `/admin/categories/edit` with:
  - Visual/HTML code toggle for rich text editing
  - Formatting toolbar (bold, italic, underline, headings, lists, links, images)
  - Image upload via Object Storage integration
  - Hero image URL field for collection featured images
  - Active/Draft status toggle (draft hides from storefront)
  - Sort order control for listing position
  - Collapsible SEO section with page title, meta description, and live search preview
  - Unsaved changes protection with confirmation dialogs
  - Keyboard shortcuts (Ctrl+S to save)
  - Client-side and server-side HTML sanitization for security
- **Licensing System**: A license-based product import system for multi-tenant deployments, validating license keys against an external server (with a demo mode for local testing).

## External Dependencies

- **Astro v5**: Core framework.
- **@astrojs/node**: Astro adapter for Node.js SSR.
- **@astrojs/tailwind**: Astro integration for Tailwind CSS.
- **Drizzle ORM**: For PostgreSQL database interaction.
- **Tailwind CSS v3**: For styling, including `@tailwindcss/typography` plugin.
- **TypeScript**: For type safety.
- **Vite**: Development server (integrated with Astro).
- **OpenAI**: Used via Replit AI Integrations for AI-powered smart filter generation (gpt-4o-mini).
- **ExchangeRate-API**: For real-time currency conversion rates.