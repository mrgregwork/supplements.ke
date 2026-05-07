import { db } from "../../server/db";
import { customers, otpCodes, sessions, orders } from "../../shared/schema";
import { eq, and, gt, or, desc } from "drizzle-orm";
import { randomBytes } from "crypto";

export function generateOtpCode(): string {
  const bytes = randomBytes(3);
  const num = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 900000;
  return String(100000 + num).padStart(6, '0');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function isValidEmail(identifier: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
}

export function isValidPhone(identifier: string): boolean {
  return /^\+?[\d\s-]{10,}$/.test(identifier.replace(/\s/g, ""));
}

export async function createOtpCode(identifier: string, code: string, type: "email" | "sms") {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const [otp] = await db.insert(otpCodes).values({
    identifier,
    code,
    type,
    expiresAt,
    used: false,
  }).returning();
  return otp;
}

export async function verifyOtpCode(identifier: string, code: string) {
  const [otp] = await db.select().from(otpCodes).where(
    and(
      eq(otpCodes.identifier, identifier),
      eq(otpCodes.code, code),
      eq(otpCodes.used, false),
      gt(otpCodes.expiresAt, new Date())
    )
  );
  return otp || null;
}

export async function markOtpUsed(id: string) {
  await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, id));
}

export async function getCustomerByIdentifier(identifier: string) {
  const [customer] = await db.select().from(customers).where(
    or(eq(customers.email, identifier), eq(customers.phone, identifier))
  );
  return customer || null;
}

export async function createCustomer(data: { email?: string | null; phone?: string | null }) {
  const [customer] = await db.insert(customers).values({
    email: data.email || null,
    phone: data.phone || null,
    firstName: null,
    lastName: null,
  }).returning();
  return customer;
}

export async function getCustomer(id: string) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  return customer || null;
}

export async function updateCustomer(id: string, data: Partial<{
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}>) {
  const [customer] = await db.update(customers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning();
  return customer || null;
}

export async function createSession(customerId: string) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  const [session] = await db.insert(sessions).values({
    customerId,
    token,
    expiresAt,
  }).returning();
  
  return session;
}

export async function getSessionByToken(token: string) {
  const [session] = await db.select().from(sessions).where(
    and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()))
  );
  return session || null;
}

export async function deleteSession(id: string) {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function getCustomerFromRequest(request: Request) {
  const cookies = request.headers.get("cookie") || "";
  const sessionMatch = cookies.match(/session=([^;]+)/);
  const token = sessionMatch?.[1];
  
  if (!token) return null;
  
  const session = await getSessionByToken(token);
  if (!session) return null;
  
  return getCustomer(session.customerId);
}

export async function getCustomerOrders(customerId: string) {
  return db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
}
