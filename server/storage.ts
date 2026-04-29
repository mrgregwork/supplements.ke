import { 
  users, customers, otpCodes, sessions, adminUsers, 
  products, cartItems, orders, orderItems,
  categories, subcategories, attributeDefinitions, siteSettings,
  navigationItems, homepageContent,
  type User, type InsertUser,
  type Customer, type InsertCustomer,
  type OtpCode, type InsertOtpCode,
  type Session, type InsertSession,
  type AdminUser, type InsertAdminUser,
  type Product, type InsertProduct,
  type CartItem, type InsertCartItem,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type Category, type InsertCategory,
  type Subcategory, type InsertSubcategory,
  type AttributeDefinition, type InsertAttributeDefinition,
  type SiteSetting, type InsertSiteSetting,
  type NavigationItem, type InsertNavigationItem,
  type HomepageContent, type InsertHomepageContent,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gt, or, desc, asc, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // Users (legacy)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Customers
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByEmail(email: string): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string): Promise<Customer | undefined>;
  getCustomerByIdentifier(identifier: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  
  // OTP Codes
  createOtpCode(otp: InsertOtpCode): Promise<OtpCode>;
  getValidOtpCode(identifier: string, code: string): Promise<OtpCode | undefined>;
  markOtpCodeUsed(id: string): Promise<void>;
  
  // Sessions
  createSession(session: InsertSession): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  
  // Admin Users
  getAdminUserByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(admin: InsertAdminUser): Promise<AdminUser>;
  
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  getProductsByCategory(categoryId: string): Promise<Product[]>;
  getProductsBySubcategory(subcategoryId: string): Promise<Product[]>;
  getProductsByBrand(brand: string): Promise<Product[]>;
  getProductsByBrandSlug(slug: string): Promise<Product[]>;
  getRelatedProducts(product: Product, limit?: number): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;
  
  // Cart
  getCartItems(sessionId: string): Promise<CartItem[]>;
  addToCart(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  removeFromCart(id: string): Promise<void>;
  clearCart(sessionId: string): Promise<void>;
  
  // Orders
  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getCustomerOrders(customerId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  
  // Order Items
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;
  
  // Subcategories
  getSubcategories(): Promise<Subcategory[]>;
  getSubcategoriesByCategoryId(categoryId: string): Promise<Subcategory[]>;
  getSubcategory(id: string): Promise<Subcategory | undefined>;
  getSubcategoryBySlug(categoryId: string, slug: string): Promise<Subcategory | undefined>;
  createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory>;
  updateSubcategory(id: string, data: Partial<InsertSubcategory>): Promise<Subcategory | undefined>;
  deleteSubcategory(id: string): Promise<void>;
  
  // Attribute Definitions
  getAttributeDefinitions(): Promise<AttributeDefinition[]>;
  getAttributeDefinition(id: string): Promise<AttributeDefinition | undefined>;
  getAttributeDefinitionBySlug(slug: string): Promise<AttributeDefinition | undefined>;
  getAttributeDefinitionsByCategory(categoryId: string, subcategoryId?: string): Promise<AttributeDefinition[]>;
  createAttributeDefinition(attr: InsertAttributeDefinition): Promise<AttributeDefinition>;
  updateAttributeDefinition(id: string, data: Partial<InsertAttributeDefinition>): Promise<AttributeDefinition | undefined>;
  deleteAttributeDefinition(id: string): Promise<void>;
  
  // Site Settings
  getSiteSettings(): Promise<SiteSetting[]>;
  getSiteSetting(key: string): Promise<SiteSetting | undefined>;
  setSiteSetting(key: string, value: string, description?: string): Promise<SiteSetting>;
  deleteSiteSetting(key: string): Promise<void>;
  
  // Navigation Items
  getNavigationItems(): Promise<NavigationItem[]>;
  getNavigationItem(id: string): Promise<NavigationItem | undefined>;
  createNavigationItem(item: InsertNavigationItem): Promise<NavigationItem>;
  updateNavigationItem(id: string, data: Partial<InsertNavigationItem>): Promise<NavigationItem | undefined>;
  deleteNavigationItem(id: string): Promise<void>;
  
  // Homepage Content
  getHomepageContent(): Promise<HomepageContent[]>;
  getHomepageSection(section: string): Promise<HomepageContent | undefined>;
  setHomepageSection(section: string, content: Record<string, any>, isActive?: boolean): Promise<HomepageContent>;
}

export class DatabaseStorage implements IStorage {
  // Users (legacy)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async getCustomerByEmail(email: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.email, email));
    return customer || undefined;
  }

  async getCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.phone, phone));
    return customer || undefined;
  }

  async getCustomerByIdentifier(identifier: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(
      or(eq(customers.email, identifier), eq(customers.phone, identifier))
    );
    return customer || undefined;
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [customer] = await db.update(customers).set({ ...data, updatedAt: new Date() }).where(eq(customers.id, id)).returning();
    return customer || undefined;
  }

  // OTP Codes
  async createOtpCode(otp: InsertOtpCode): Promise<OtpCode> {
    const [code] = await db.insert(otpCodes).values(otp).returning();
    return code;
  }

  async getValidOtpCode(identifier: string, code: string): Promise<OtpCode | undefined> {
    const [otp] = await db.select().from(otpCodes).where(
      and(
        eq(otpCodes.identifier, identifier),
        eq(otpCodes.code, code),
        eq(otpCodes.used, false),
        gt(otpCodes.expiresAt, new Date())
      )
    );
    return otp || undefined;
  }

  async markOtpCodeUsed(id: string): Promise<void> {
    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, id));
  }

  // Sessions
  async createSession(session: InsertSession): Promise<Session> {
    const [sess] = await db.insert(sessions).values(session).returning();
    return sess;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(
      and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))
    );
    return session || undefined;
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  // Admin Users
  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return admin || undefined;
  }

  async createAdminUser(admin: InsertAdminUser): Promise<AdminUser> {
    const [user] = await db.insert(adminUsers).values(admin).returning();
    return user;
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.slug, slug));
    return product || undefined;
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    // Include products whose primary category matches OR which list this id in additional_category_ids
    return db.select().from(products).where(
      or(
        eq(products.categoryId, categoryId),
        sql`${products.additionalCategoryIds} @> ${JSON.stringify([categoryId])}::jsonb`
      )
    ).orderBy(desc(products.createdAt));
  }

  async getProductsBySubcategory(subcategoryId: string): Promise<Product[]> {
    return db.select().from(products).where(
      or(
        eq(products.subcategoryId, subcategoryId),
        sql`${products.additionalSubcategoryIds} @> ${JSON.stringify([subcategoryId])}::jsonb`
      )
    ).orderBy(desc(products.createdAt));
  }

  async getProductsByBrand(brand: string): Promise<Product[]> {
    return db.select().from(products).where(ilike(products.brand, brand)).orderBy(asc(products.name));
  }

  async getProductsByBrandSlug(slug: string): Promise<Product[]> {
    // Normalize both the slug and the stored brand name by stripping non-alphanumeric chars,
    // so "doctors-best" matches "Doctor's Best", "natures-way" matches "Nature's Way", etc.
    const normalized = slug.replace(/-/g, ' ');
    const result = await db.select().from(products).where(
      sql`regexp_replace(regexp_replace(lower(${products.brand}), '-', ' ', 'g'), '[^a-z0-9 ]', '', 'g') ilike ${normalized}`
    ).orderBy(asc(products.name));
    return result;
  }

  async getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
    // Primary: same subcategory, excluding this product
    const bySub = product.subcategoryId
      ? await db.select().from(products).where(
          and(
            or(
              eq(products.subcategoryId, product.subcategoryId),
              sql`${products.additionalSubcategoryIds} @> ${JSON.stringify([product.subcategoryId])}::jsonb`
            ),
            sql`${products.id} != ${product.id}`
          )
        ).orderBy(desc(products.featured), asc(products.name)).limit(limit)
      : [];

    if (bySub.length >= limit) return bySub;

    // Fallback: fill remaining slots from same brand
    if (product.brand) {
      const existingIds = new Set(bySub.map(p => p.id));
      const byBrand = await db.select().from(products).where(
        and(
          ilike(products.brand, product.brand),
          sql`${products.id} != ${product.id}`
        )
      ).orderBy(desc(products.featured), asc(products.name)).limit(limit);
      for (const p of byBrand) {
        if (!existingIds.has(p.id)) bySub.push(p);
        if (bySub.length >= limit) break;
      }
    }

    return bySub;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [p] = await db.insert(products).values(product as any).returning();
    return p;
  }

  async updateProduct(id: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    const [product] = await db.update(products).set(updateData as any).where(eq(products.id, id)).returning();
    return product || undefined;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  // Cart
  async getCartItems(sessionId: string): Promise<CartItem[]> {
    return db.select().from(cartItems).where(eq(cartItems.sessionId, sessionId));
  }

  async addToCart(item: InsertCartItem): Promise<CartItem> {
    const [cartItem] = await db.insert(cartItems).values(item).returning();
    return cartItem;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const [item] = await db.update(cartItems).set({ quantity, updatedAt: new Date() }).where(eq(cartItems.id, id)).returning();
    return item || undefined;
  }

  async removeFromCart(id: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, id));
  }

  async clearCart(sessionId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.sessionId, sessionId));
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return order || undefined;
  }

  async getCustomerOrders(customerId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [o] = await db.insert(orders).values(order as any).returning();
    return o;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [order] = await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
    return order || undefined;
  }

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const [orderItem] = await db.insert(orderItems).values(item).returning();
    return orderItem;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(categories.sortOrder);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [cat] = await db.insert(categories).values(category).returning();
    return cat;
  }

  async updateCategory(id: string, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [cat] = await db.update(categories).set({ ...data, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
    return cat || undefined;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Subcategories
  async getSubcategories(): Promise<Subcategory[]> {
    return db.select().from(subcategories).orderBy(subcategories.sortOrder);
  }

  async getSubcategoriesByCategoryId(categoryId: string): Promise<Subcategory[]> {
    return db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId)).orderBy(subcategories.sortOrder);
  }

  async getSubcategory(id: string): Promise<Subcategory | undefined> {
    const [sub] = await db.select().from(subcategories).where(eq(subcategories.id, id));
    return sub || undefined;
  }

  async getSubcategoryBySlug(categoryId: string, slug: string): Promise<Subcategory | undefined> {
    const [sub] = await db.select().from(subcategories).where(
      and(eq(subcategories.categoryId, categoryId), eq(subcategories.slug, slug))
    );
    return sub || undefined;
  }

  async createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory> {
    const [sub] = await db.insert(subcategories).values(subcategory).returning();
    return sub;
  }

  async updateSubcategory(id: string, data: Partial<InsertSubcategory>): Promise<Subcategory | undefined> {
    const [sub] = await db.update(subcategories).set({ ...data, updatedAt: new Date() }).where(eq(subcategories.id, id)).returning();
    return sub || undefined;
  }

  async deleteSubcategory(id: string): Promise<void> {
    await db.delete(subcategories).where(eq(subcategories.id, id));
  }

  // Attribute Definitions
  async getAttributeDefinitions(): Promise<AttributeDefinition[]> {
    return db.select().from(attributeDefinitions).orderBy(attributeDefinitions.sortOrder);
  }

  async getAttributeDefinition(id: string): Promise<AttributeDefinition | undefined> {
    const [attr] = await db.select().from(attributeDefinitions).where(eq(attributeDefinitions.id, id));
    return attr || undefined;
  }

  async getAttributeDefinitionBySlug(slug: string): Promise<AttributeDefinition | undefined> {
    const [attr] = await db.select().from(attributeDefinitions).where(eq(attributeDefinitions.slug, slug));
    return attr || undefined;
  }

  async getAttributeDefinitionsByCategory(categoryId: string, subcategoryId?: string): Promise<AttributeDefinition[]> {
    // Get attributes that are either global (no category) or match the category/subcategory
    const conditions = [
      and(
        eq(attributeDefinitions.categoryId, categoryId),
        subcategoryId ? eq(attributeDefinitions.subcategoryId, subcategoryId) : undefined
      ),
      and(
        eq(attributeDefinitions.categoryId, categoryId),
        eq(attributeDefinitions.subcategoryId, '')
      ),
      and(
        eq(attributeDefinitions.categoryId, ''),
        eq(attributeDefinitions.subcategoryId, '')
      )
    ].filter(Boolean);
    
    // For simpler query, just get all and filter in memory
    const allAttrs = await db.select().from(attributeDefinitions).orderBy(attributeDefinitions.sortOrder);
    
    return allAttrs.filter(attr => {
      // Global attributes (no category restriction)
      if (!attr.categoryId || attr.categoryId === '') return true;
      // Category match
      if (attr.categoryId === categoryId) {
        // If subcategory specified, check it matches or attr has no subcategory restriction
        if (subcategoryId && attr.subcategoryId && attr.subcategoryId !== '') {
          return attr.subcategoryId === subcategoryId;
        }
        return true;
      }
      return false;
    });
  }

  async createAttributeDefinition(attr: InsertAttributeDefinition): Promise<AttributeDefinition> {
    const [attrDef] = await db.insert(attributeDefinitions).values(attr).returning();
    return attrDef;
  }

  async updateAttributeDefinition(id: string, data: Partial<InsertAttributeDefinition>): Promise<AttributeDefinition | undefined> {
    const [attr] = await db.update(attributeDefinitions).set({ ...data, updatedAt: new Date() }).where(eq(attributeDefinitions.id, id)).returning();
    return attr || undefined;
  }

  async deleteAttributeDefinition(id: string): Promise<void> {
    await db.delete(attributeDefinitions).where(eq(attributeDefinitions.id, id));
  }

  // Site Settings
  async getSiteSettings(): Promise<SiteSetting[]> {
    return db.select().from(siteSettings);
  }

  async getSiteSetting(key: string): Promise<SiteSetting | undefined> {
    const [setting] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    return setting || undefined;
  }

  async setSiteSetting(key: string, value: string, description?: string): Promise<SiteSetting> {
    const existing = await this.getSiteSetting(key);
    if (existing) {
      const [updated] = await db.update(siteSettings)
        .set({ value, description, updatedAt: new Date() })
        .where(eq(siteSettings.key, key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(siteSettings)
        .values({ key, value, description })
        .returning();
      return created;
    }
  }

  async deleteSiteSetting(key: string): Promise<void> {
    await db.delete(siteSettings).where(eq(siteSettings.key, key));
  }

  // Navigation Items
  async getNavigationItems(): Promise<NavigationItem[]> {
    return db.select().from(navigationItems).orderBy(asc(navigationItems.sortOrder));
  }

  async getNavigationItem(id: string): Promise<NavigationItem | undefined> {
    const [item] = await db.select().from(navigationItems).where(eq(navigationItems.id, id));
    return item || undefined;
  }

  async createNavigationItem(item: InsertNavigationItem): Promise<NavigationItem> {
    const [navItem] = await db.insert(navigationItems).values(item).returning();
    return navItem;
  }

  async updateNavigationItem(id: string, data: Partial<InsertNavigationItem>): Promise<NavigationItem | undefined> {
    const [item] = await db.update(navigationItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(navigationItems.id, id))
      .returning();
    return item || undefined;
  }

  async deleteNavigationItem(id: string): Promise<void> {
    await db.delete(navigationItems).where(eq(navigationItems.id, id));
  }

  // Homepage Content
  async getHomepageContent(): Promise<HomepageContent[]> {
    return db.select().from(homepageContent);
  }

  async getHomepageSection(section: string): Promise<HomepageContent | undefined> {
    const [content] = await db.select().from(homepageContent).where(eq(homepageContent.section, section));
    return content || undefined;
  }

  async setHomepageSection(section: string, content: Record<string, any>, isActive: boolean = true): Promise<HomepageContent> {
    const existing = await this.getHomepageSection(section);
    if (existing) {
      const [updated] = await db.update(homepageContent)
        .set({ content, isActive, updatedAt: new Date() })
        .where(eq(homepageContent.section, section))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(homepageContent)
        .values({ section, content, isActive })
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
