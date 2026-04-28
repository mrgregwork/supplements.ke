import { db } from "../../server/db";
import { adminUsers, adminSessions, orders, orderItems, products, customers, categories, subcategories, attributeDefinitions } from "@shared/schema";
import { eq, desc, sql, count, and, gt, asc } from "drizzle-orm";
import crypto from "crypto";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const testHash = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(hashBuffer, testHash);
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function getAdminByEmail(email: string) {
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
  return admin || null;
}

export async function createAdmin(email: string, password: string, name: string) {
  const passwordHash = await hashPassword(password);
  const [admin] = await db
    .insert(adminUsers)
    .values({ email, passwordHash, name })
    .returning();
  return admin;
}

export async function createAdminSession(adminId: string): Promise<string> {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await db.insert(adminSessions).values({
    adminId,
    token,
    expiresAt,
  });
  
  return token;
}

export function getAdminSessionToken(request: Request): string | null {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.match(/adminSession=([^;]+)/);
  return match ? match[1] : null;
}

export async function verifyAdminSession(sessionToken: string | null): Promise<{ admin: typeof adminUsers.$inferSelect; session: typeof adminSessions.$inferSelect } | null> {
  if (!sessionToken) return null;
  
  const [session] = await db
    .select()
    .from(adminSessions)
    .where(and(
      eq(adminSessions.token, sessionToken),
      gt(adminSessions.expiresAt, new Date())
    ));
  
  if (!session) return null;
  
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, session.adminId));
  
  if (!admin) return null;
  
  return { admin, session };
}

export async function deleteAdminSession(token: string) {
  await db.delete(adminSessions).where(eq(adminSessions.token, token));
}

export async function getDashboardStats() {
  const [orderStats] = await db
    .select({
      totalOrders: count(),
      totalRevenue: sql<number>`COALESCE(SUM(total), 0)`,
    })
    .from(orders);

  const [productStats] = await db
    .select({
      totalProducts: count(),
    })
    .from(products);

  const [customerStats] = await db
    .select({
      totalCustomers: count(),
    })
    .from(customers);

  const recentOrders = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(5);

  return {
    totalOrders: orderStats?.totalOrders || 0,
    totalRevenue: orderStats?.totalRevenue || 0,
    totalProducts: productStats?.totalProducts || 0,
    totalCustomers: customerStats?.totalCustomers || 0,
    recentOrders,
  };
}

export async function getAllOrders(limit = 50) {
  return db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function getOrderWithItems(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  
  if (!order) return null;
  
  const items = await db
    .select({
      id: orderItems.id,
      productName: orderItems.productName,
      productImage: orderItems.productImage,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  
  return { ...order, items };
}

export async function updateOrderStatus(orderId: string, status: string) {
  const [order] = await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();
  return order;
}

export async function getAllProducts() {
  return db.select().from(products).orderBy(desc(products.createdAt));
}

export async function getProductById(id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  return product || null;
}

export async function createProduct(data: any) {
  const [product] = await db.insert(products).values(data).returning();
  return product;
}

export async function updateProduct(id: string, data: any) {
  const [product] = await db
    .update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  return product;
}

export async function deleteProduct(id: string) {
  await db.delete(products).where(eq(products.id, id));
}

export async function getAllCategories() {
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryById(id: string) {
  const [category] = await db.select().from(categories).where(eq(categories.id, id));
  return category || null;
}

export async function getAllSubcategories() {
  return db.select().from(subcategories).orderBy(asc(subcategories.sortOrder), asc(subcategories.name));
}

export async function getSubcategoriesByCategoryId(categoryId: string) {
  return db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId)).orderBy(asc(subcategories.sortOrder));
}

export async function getSubcategoryById(id: string) {
  const [subcategory] = await db.select().from(subcategories).where(eq(subcategories.id, id));
  return subcategory || null;
}

export async function getAllAttributeDefinitions() {
  return db.select().from(attributeDefinitions).orderBy(asc(attributeDefinitions.sortOrder), asc(attributeDefinitions.name));
}

export async function getAttributeDefinitionById(id: string) {
  const [attr] = await db.select().from(attributeDefinitions).where(eq(attributeDefinitions.id, id));
  return attr || null;
}
