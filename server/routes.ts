import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import { z } from "zod";
import type { Customer } from "@shared/schema";
import { insertCategorySchema, insertSubcategorySchema, insertAttributeDefinitionSchema, insertProductSchema } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

declare global {
  namespace Express {
    interface Request {
      customer?: Customer;
      sessionToken?: string;
    }
  }
}

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function isValidEmail(identifier: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
}

function isValidPhone(identifier: string): boolean {
  return /^\+?[\d\s-]{10,}$/.test(identifier.replace(/\s/g, ""));
}

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.session;
  
  if (token) {
    const session = await storage.getSessionByToken(token);
    if (session) {
      const customer = await storage.getCustomer(session.customerId);
      if (customer) {
        req.customer = customer;
        req.sessionToken = token;
      }
    }
  }
  next();
}

const requestOtpSchema = z.object({
  identifier: z.string().min(1, "Email or phone number is required"),
});

const verifyOtpSchema = z.object({
  identifier: z.string().min(1),
  code: z.string().length(6, "OTP must be 6 digits"),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.use(authMiddleware);
  
  registerObjectStorageRoutes(app);

  // ============================================
  // AUTH ROUTES
  // ============================================
  
  app.post("/api/auth/request-otp", async (req, res) => {
    try {
      const { identifier } = requestOtpSchema.parse(req.body);
      
      const isEmail = isValidEmail(identifier);
      const isPhone = isValidPhone(identifier);
      
      if (!isEmail && !isPhone) {
        return res.status(400).json({ error: "Please enter a valid email address or phone number" });
      }
      
      const type = isEmail ? "email" : "sms";
      const code = generateOtpCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      await storage.createOtpCode({
        identifier,
        code,
        type,
        expiresAt,
        used: false,
      });
      
      // TODO: Send OTP via email/SMS
      // For now, log to console for development
      console.log(`[OTP] ${type.toUpperCase()} code for ${identifier}: ${code}`);
      
      // In production, integrate with email service (SendGrid, AWS SES) 
      // and SMS service (Twilio) to send the code
      
      res.json({ 
        success: true, 
        message: `Verification code sent to your ${type === "email" ? "email" : "phone"}`,
        type,
        // Only return code in development for testing
        ...(process.env.NODE_ENV !== "production" && { devCode: code }),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Request OTP error:", error);
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { identifier, code } = verifyOtpSchema.parse(req.body);
      
      const otpRecord = await storage.getValidOtpCode(identifier, code);
      
      if (!otpRecord) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }
      
      await storage.markOtpCodeUsed(otpRecord.id);
      
      // Find or create customer
      let customer = await storage.getCustomerByIdentifier(identifier);
      
      if (!customer) {
        const isEmail = isValidEmail(identifier);
        customer = await storage.createCustomer({
          email: isEmail ? identifier : null,
          phone: !isEmail ? identifier : null,
          firstName: null,
          lastName: null,
        });
      }
      
      // Create session
      const token = generateSessionToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      await storage.createSession({
        customerId: customer.id,
        token,
        expiresAt,
      });
      
      // Set cookie for web clients
      res.cookie("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      
      res.json({ 
        success: true,
        customer: {
          id: customer.id,
          email: customer.email,
          phone: customer.phone,
          firstName: customer.firstName,
          lastName: customer.lastName,
        },
        token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Failed to verify code" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.customer) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    res.json({
      customer: {
        id: req.customer.id,
        email: req.customer.email,
        phone: req.customer.phone,
        firstName: req.customer.firstName,
        lastName: req.customer.lastName,
      },
    });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.session;
    
    if (token) {
      const session = await storage.getSessionByToken(token);
      if (session) {
        await storage.deleteSession(session.id);
      }
    }
    
    res.clearCookie("session");
    res.json({ success: true });
  });

  // ============================================
  // CART ROUTES
  // ============================================
  
  app.get("/api/cart", async (req, res) => {
    const sessionId = req.cookies?.cartSession || req.headers["x-cart-session"] as string;
    
    if (!sessionId) {
      return res.json({ items: [], total: 0 });
    }
    
    const items = await storage.getCartItems(sessionId);
    const total = items.reduce((sum, item) => sum + item.quantity, 0);
    
    res.json({ items, total });
  });

  app.post("/api/cart", async (req, res) => {
    try {
      const { productId, quantity = 1 } = req.body;
      
      if (!productId) {
        return res.status(400).json({ error: "Product ID is required" });
      }
      
      // Get or create cart session
      let sessionId = req.cookies?.cartSession || req.headers["x-cart-session"] as string;
      
      if (!sessionId) {
        sessionId = randomBytes(16).toString("hex");
        res.cookie("cartSession", sessionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
      }
      
      const item = await storage.addToCart({
        sessionId,
        customerId: req.customer?.id || null,
        productId,
        quantity,
      });
      
      res.json({ success: true, item });
    } catch (error) {
      console.error("Add to cart error:", error);
      res.status(500).json({ error: "Failed to add item to cart" });
    }
  });

  app.patch("/api/cart/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      
      if (quantity < 1) {
        await storage.removeFromCart(id);
        return res.json({ success: true, removed: true });
      }
      
      const item = await storage.updateCartItem(id, quantity);
      res.json({ success: true, item });
    } catch (error) {
      console.error("Update cart error:", error);
      res.status(500).json({ error: "Failed to update cart" });
    }
  });

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      await storage.removeFromCart(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Remove from cart error:", error);
      res.status(500).json({ error: "Failed to remove item" });
    }
  });

  // ============================================
  // PRODUCTS ROUTES
  // ============================================
  
  app.get("/api/products", async (req, res) => {
    const products = await storage.getProducts();
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const product = await storage.getProduct(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  });

  // ============================================
  // ORDERS ROUTES
  // ============================================
  
  app.get("/api/orders", async (req, res) => {
    if (!req.customer) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const orders = await storage.getCustomerOrders(req.customer.id);
    res.json(orders);
  });

  app.get("/api/orders/:id", async (req, res) => {
    const order = await storage.getOrder(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    // Check authorization
    if (order.customerId && req.customer?.id !== order.customerId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    
    const items = await storage.getOrderItems(order.id);
    res.json({ ...order, items });
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const sessionId = req.cookies?.cartSession || req.headers["x-cart-session"] as string;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Cart is empty" });
      }
      
      const cartItems = await storage.getCartItems(sessionId);
      
      if (cartItems.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
      }
      
      const { email, phone, shippingAddress } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      // Calculate totals (simplified - in production, fetch product prices)
      const subtotal = 0; // Would sum product prices * quantities
      const tax = 0;
      const shipping = 0;
      const total = subtotal + tax + shipping;
      
      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      
      const order = await storage.createOrder({
        orderNumber,
        customerId: req.customer?.id || null,
        email,
        phone: phone || null,
        status: "pending",
        subtotal,
        tax,
        shipping,
        total,
        currency: "USD",
        shippingAddress: shippingAddress || null,
        notes: null,
      });
      
      // Clear cart after order
      await storage.clearCart(sessionId);
      
      res.json({ success: true, order });
    } catch (error) {
      console.error("Create order error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // ============================================
  // CUSTOMER ACCOUNT ROUTES
  // ============================================
  
  app.patch("/api/account", async (req, res) => {
    if (!req.customer) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { firstName, lastName, email, phone } = req.body;
      
      const updated = await storage.updateCustomer(req.customer.id, {
        firstName: firstName ?? req.customer.firstName,
        lastName: lastName ?? req.customer.lastName,
        email: email ?? req.customer.email,
        phone: phone ?? req.customer.phone,
      });
      
      res.json({ success: true, customer: updated });
    } catch (error) {
      console.error("Update account error:", error);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  // ============================================
  // ADMIN CATEGORY ROUTES
  // ============================================
  
  app.get("/api/admin/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  app.get("/api/admin/categories/:id", async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Get category error:", error);
      res.status(500).json({ error: "Failed to get category" });
    }
  });

  app.post("/api/admin/categories", async (req, res) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(data);
      res.status(201).json(category);
    } catch (error) {
      console.error("Create category error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/admin/categories/:id", async (req, res) => {
    try {
      const data = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(req.params.id, data);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Update category error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/admin/categories/:id", async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // ============================================
  // ADMIN SUBCATEGORY ROUTES
  // ============================================
  
  app.get("/api/admin/subcategories", async (req, res) => {
    try {
      const categoryId = req.query.categoryId as string | undefined;
      const subcategories = categoryId 
        ? await storage.getSubcategoriesByCategoryId(categoryId)
        : await storage.getSubcategories();
      res.json(subcategories);
    } catch (error) {
      console.error("Get subcategories error:", error);
      res.status(500).json({ error: "Failed to get subcategories" });
    }
  });

  app.get("/api/admin/subcategories/:id", async (req, res) => {
    try {
      const subcategory = await storage.getSubcategory(req.params.id);
      if (!subcategory) {
        return res.status(404).json({ error: "Subcategory not found" });
      }
      res.json(subcategory);
    } catch (error) {
      console.error("Get subcategory error:", error);
      res.status(500).json({ error: "Failed to get subcategory" });
    }
  });

  app.post("/api/admin/subcategories", async (req, res) => {
    try {
      const data = insertSubcategorySchema.parse(req.body);
      const subcategory = await storage.createSubcategory(data);
      res.status(201).json(subcategory);
    } catch (error) {
      console.error("Create subcategory error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create subcategory" });
    }
  });

  app.put("/api/admin/subcategories/:id", async (req, res) => {
    try {
      const data = insertSubcategorySchema.partial().parse(req.body);
      const subcategory = await storage.updateSubcategory(req.params.id, data);
      if (!subcategory) {
        return res.status(404).json({ error: "Subcategory not found" });
      }
      res.json(subcategory);
    } catch (error) {
      console.error("Update subcategory error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update subcategory" });
    }
  });

  app.delete("/api/admin/subcategories/:id", async (req, res) => {
    try {
      await storage.deleteSubcategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete subcategory error:", error);
      res.status(500).json({ error: "Failed to delete subcategory" });
    }
  });

  // ============================================
  // ADMIN ATTRIBUTE DEFINITION ROUTES
  // ============================================
  
  app.get("/api/admin/attributes", async (req, res) => {
    try {
      const attributes = await storage.getAttributeDefinitions();
      res.json(attributes);
    } catch (error) {
      console.error("Get attributes error:", error);
      res.status(500).json({ error: "Failed to get attributes" });
    }
  });

  app.get("/api/admin/attributes/:id", async (req, res) => {
    try {
      const attribute = await storage.getAttributeDefinition(req.params.id);
      if (!attribute) {
        return res.status(404).json({ error: "Attribute not found" });
      }
      res.json(attribute);
    } catch (error) {
      console.error("Get attribute error:", error);
      res.status(500).json({ error: "Failed to get attribute" });
    }
  });

  app.post("/api/admin/attributes", async (req, res) => {
    try {
      const data = insertAttributeDefinitionSchema.parse(req.body);
      const attribute = await storage.createAttributeDefinition(data);
      res.status(201).json(attribute);
    } catch (error) {
      console.error("Create attribute error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create attribute" });
    }
  });

  app.put("/api/admin/attributes/:id", async (req, res) => {
    try {
      const data = insertAttributeDefinitionSchema.partial().parse(req.body);
      const attribute = await storage.updateAttributeDefinition(req.params.id, data);
      if (!attribute) {
        return res.status(404).json({ error: "Attribute not found" });
      }
      res.json(attribute);
    } catch (error) {
      console.error("Update attribute error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update attribute" });
    }
  });

  app.delete("/api/admin/attributes/:id", async (req, res) => {
    try {
      await storage.deleteAttributeDefinition(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete attribute error:", error);
      res.status(500).json({ error: "Failed to delete attribute" });
    }
  });

  // ============================================
  // ADMIN PRODUCT ROUTES (with full CRUD)
  // ============================================
  
  app.get("/api/admin/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  app.get("/api/admin/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Get product error:", error);
      res.status(500).json({ error: "Failed to get product" });
    }
  });

  app.post("/api/admin/products", async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      res.status(201).json(product);
    } catch (error) {
      console.error("Create product error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/admin/products/:id", async (req, res) => {
    try {
      const data = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, data);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Update product error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/admin/products/:id", async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete product error:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  return httpServer;
}
