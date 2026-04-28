import { db } from "../../server/db";
import { cartItems, products } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

export function generateCartSessionId(): string {
  return randomBytes(16).toString("hex");
}

export function getCartSessionId(request: Request): string | null {
  const cookies = request.headers.get("cookie") || "";
  const sessionMatch = cookies.match(/cartSession=([^;]+)/);
  return sessionMatch?.[1] || null;
}

export async function getCartItems(sessionId: string) {
  const items = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      product: {
        id: products.id,
        slug: products.slug,
        name: products.name,
        price: products.price,
        currency: products.currency,
        images: products.images,
        categorySlug: products.categorySlug,
        subcategorySlug: products.subcategorySlug,
      },
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.sessionId, sessionId));
  
  return items;
}

export async function getProductBySlugOrId(slugOrId: string) {
  // First try by slug
  const [bySlug] = await db.select().from(products).where(eq(products.slug, slugOrId));
  if (bySlug) return bySlug;
  
  // Then try by ID
  const [byId] = await db.select().from(products).where(eq(products.id, slugOrId));
  return byId || null;
}

export async function addToCart(sessionId: string, productIdOrSlug: string, quantity: number = 1, customerId?: string | null) {
  // Resolve product by slug or ID
  const product = await getProductBySlugOrId(productIdOrSlug);
  
  if (!product) {
    throw new Error(`Product not found: ${productIdOrSlug}`);
  }
  
  const productId = product.id;
  
  // Check if item already exists in cart
  const [existing] = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.sessionId, sessionId), eq(cartItems.productId, productId)));
  
  if (existing) {
    // Update quantity
    const [updated] = await db
      .update(cartItems)
      .set({ quantity: existing.quantity + quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, existing.id))
      .returning();
    return updated;
  }
  
  // Add new item
  const [item] = await db
    .insert(cartItems)
    .values({
      sessionId,
      productId,
      quantity,
      customerId: customerId || null,
    })
    .returning();
  
  return item;
}

export async function updateCartItemQuantity(itemId: string, quantity: number) {
  if (quantity < 1) {
    await db.delete(cartItems).where(eq(cartItems.id, itemId));
    return null;
  }
  
  const [updated] = await db
    .update(cartItems)
    .set({ quantity, updatedAt: new Date() })
    .where(eq(cartItems.id, itemId))
    .returning();
  
  return updated;
}

export async function removeFromCart(itemId: string) {
  await db.delete(cartItems).where(eq(cartItems.id, itemId));
}

export async function clearCart(sessionId: string) {
  await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
}

export async function getCartCount(sessionId: string): Promise<number> {
  const items = await db.select({ quantity: cartItems.quantity }).from(cartItems).where(eq(cartItems.sessionId, sessionId));
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export async function getCartItemById(itemId: string) {
  const [item] = await db.select().from(cartItems).where(eq(cartItems.id, itemId));
  return item || null;
}
