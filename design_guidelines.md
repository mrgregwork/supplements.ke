# E-Commerce SEO Platform - Design Guidelines

## Design Approach
**Modern E-Commerce Marketplace Style**: Inspired by Kentex Cargo shop design - clean, product-focused layout with prominent categories, promotional banners, and feature-rich product cards.

## Color Palette

### Light Mode
- **Background**: White (#FFFFFF)
- **Card Background**: White with subtle gray borders
- **Primary Accent**: Deep Blue (#1e40af) - CTAs, links
- **Secondary Accent**: Orange/Red (#ea580c) - Sale badges, discounts
- **Success**: Green (#16a34a) - In stock, ratings
- **Text Primary**: Dark Gray (#1f2937)
- **Text Secondary**: Medium Gray (#6b7280)
- **Borders**: Light Gray (#e5e7eb)

### Dark Mode
- **Background**: Dark (#0f172a)
- **Card Background**: Slate (#1e293b)
- **Accents**: Same as light mode with adjusted brightness

## Typography System
**Primary Font**: Inter (via Google Fonts CDN)
- Headings: 600-700 weight, sizes from text-2xl to text-4xl
- Product titles: 500-600 weight, text-sm to text-base
- Prices: 700 weight, prominent sizing
- Body: 400 weight, text-sm for descriptions
- Badges: 600 weight, text-xs uppercase

## Layout & Spacing
**Tailwind Units**: Consistently use 2, 4, 6, 8, 12, 16 for spacing
- Section padding: py-8 to py-12 (compact e-commerce style)
- Component gaps: gap-4 for cards, gap-2 for list items
- Container: max-w-7xl for main content
- Product grid: 4-5 columns on desktop, 2 on mobile

## Component Library

### Category Bar (Horizontal Scroll)
- Horizontal scrolling row of category icons
- Circular icon containers (80-100px)
- Category image inside circle with subtle shadow
- Category name below in small caps
- Smooth scroll with navigation arrows on desktop
- Touch-friendly swipe on mobile

### Hero Banners / Promotional Carousel
- Multiple sliding banners with promotional content
- Each banner: gradient background, promotional text, CTA button
- Left side: promotional copy (deal type, headline, price starting from)
- Right side: product image
- Navigation dots below
- Auto-advance with pause on hover

### Product Cards (Feature-Rich)
- **Card structure**:
  - Product image (square aspect ratio)
  - Hover overlay with quick action buttons (Wishlist, Quick View, Compare)
  - Discount badge (top-left, red/orange with percentage)
  - "Hot" or "New" badge when applicable
  - Category label (small, muted text)
  - Product title (2 lines max, truncate)
  - Star rating with review count
  - Price: Current price bold, original price strikethrough
  - Short description (1-2 lines)
  - Add to Cart button (full width, primary color)

### Product Card Quick Actions
- Floating action buttons on image hover
- Icons: Heart (wishlist), Eye (quick view), Arrows (compare)
- Circular buttons with white background, subtle shadow
- Smooth fade-in transition on hover

### Rating Display
- 5 star icons (filled gold for rating, gray for empty)
- Rating value in parentheses
- Review count next to rating

### Discount Badge
- Positioned top-left of product image
- Red/orange background
- White text: "-XX%"
- Small, rounded corners

### Promotional Banner Grid
- 2-3 column grid of promotional cards
- Each card: Background image/gradient, headline, subtext, CTA
- Use codes highlighted prominently
- Mix of vertical and horizontal orientations

### Brands Section
- Horizontal scrolling logo carousel
- Brand logos in consistent sizing (180x60 approx)
- Grayscale with color on hover
- Infinite scroll animation
- Link to brand page

### Navigation Header
- Top bar: Contact info, social links, account links
- Main header: Logo (left), Search bar (center), Cart/Account (right)
- Category mega menu below

### Footer
- Multi-column layout
- Quick links, categories, contact info
- Newsletter signup
- Payment method icons
- Social media links

## Page Structures

### Homepage Layout
1. **Category Bar**: Horizontal scroll of category circles
2. **Hero Carousel**: 3-4 promotional banners
3. **Featured Products**: "Hot Deals" section with 4-6 products
4. **Promotional Grid**: 2-3 promotional banners (deals/sales)
5. **New Arrivals**: Another product row
6. **Brands Section**: Logo carousel
7. **Newsletter/CTA**: Email signup section

### Category Page
- Breadcrumbs
- Category title with product count
- Filter sidebar (collapsible on mobile)
- Product grid (4 columns)
- Pagination or load more

### Product Page
- Image gallery with thumbnails
- Product info: title, rating, price, description
- Add to cart with quantity selector
- Specifications table
- Reviews section
- Related products

## Interactions
- Product card image zoom on hover (subtle scale)
- Quick action buttons fade in on card hover
- Smooth carousel transitions
- Add to cart button state changes (loading, success)
- Toast notifications for cart actions
- Wishlist heart icon toggle (filled when active)

## Professional Polish
- Consistent 8px border radius for cards
- Subtle shadows: shadow-sm for cards, shadow-md for dropdowns
- Icon usage: Lucide icons throughout
- Status colors: Green (in stock), Orange (low stock), Red (out of stock)
- Loading states: Skeleton screens for product grids
- Responsive breakpoints: Mobile-first with tablet and desktop variants
