import { pgTable, text, varchar, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Orders ───────────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventId: text("event_id"),
  ticketTypeId: text("ticket_type_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  instagramHandle: text("instagram_handle"),
  ticketType: text("ticket_type").notNull(),
  quantity: integer("quantity").notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  status: true,
  createdAt: true,
}).extend({
  eventId: z.string().optional().nullable(),
  ticketTypeId: z.string().optional().nullable(),
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ─── Users ────────────────────────────────────────────────────────────────────

export type UserRole = "organizer";
export type UserTier = "free" | "pro";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("organizer"),
  tier: text("tier").notNull().default("free"),
  proExpiresAt: timestamp("pro_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  tier: UserTier;
  proExpiresAt: Date | null;
  createdAt: Date;
};

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  tier: UserTier;
}

// ─── Organizers ───────────────────────────────────────────────────────────────

export const organizers = pgTable("organizers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().unique(),
  businessName: text("business_name").notNull(),
  bankName: text("bank_name").notNull(),
  bankCode: text("bank_code").notNull(),
  accountNumber: text("account_number").notNull(),
  subaccountCode: text("subaccount_code").notNull(),
  bvn: text("bvn"),
  tier: text("tier").notNull().default("free"),
  customBrandName: text("custom_brand_name"),
  customLogoUrl: text("custom_logo_url"),
  flutterwavePublicKey: text("flutterwave_public_key"),
  flutterwaveSecretKey: text("flutterwave_secret_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Organizer = {
  id: string;
  userId: string;
  businessName: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  subaccountCode: string;
  bvn: string | null;
  tier: UserTier;
  customBrandName: string | null;
  customLogoUrl: string | null;
  flutterwavePublicKey: string | null;
  flutterwaveSecretKey: string | null;
  createdAt: Date;
};

export interface CreateOrganizerData {
  userId: string;
  businessName: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  subaccountCode: string;
  bvn: string | null;
  tier: UserTier;
  customBrandName?: string | null;
  customLogoUrl?: string | null;
}

export interface PublicOrganizer {
  id: string;
  businessName: string;
  bankName: string;
  accountNumber: string;
  subaccountCode: string;
  tier: UserTier;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type EventStatus = "active" | "inactive" | "draft";
export type PaymentMethod = "paystack" | "stripe" | "paypal" | "bank_transfer" | "flutterwave";

export const events = pgTable("events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizerId: varchar("organizer_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  location: text("location").notNull(),
  status: text("status").notNull().default("draft"),
  maxTickets: integer("max_tickets").notNull(),
  paymentMethod: text("payment_method").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Event = {
  id: string;
  organizerId: string;
  title: string;
  date: string;
  location: string;
  status: EventStatus;
  maxTickets: number;
  paymentMethod: PaymentMethod;
  isActive: boolean;
  createdAt: Date;
};

export interface CreateEventData {
  organizerId: string;
  title: string;
  date: string;
  location: string;
  status: EventStatus;
  maxTickets: number;
  paymentMethod: PaymentMethod;
  isActive: boolean;
}

export interface UpdateEventData {
  title?: string;
  date?: string;
  location?: string;
  status?: EventStatus;
  maxTickets?: number;
  paymentMethod?: PaymentMethod;
  isActive?: boolean;
}

export const createEventSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  date: z.string().min(1, "Event date is required"),
  location: z.string().min(1, "Location is required"),
  maxTickets: z.number().min(1, "Must have at least 1 ticket"),
  paymentMethod: z.enum(["paystack", "stripe", "paypal", "bank_transfer", "flutterwave"]),
  isActive: z.boolean().default(true),
});

export const updateEventSchema = createEventSchema.partial();

// ─── Ticket Types ─────────────────────────────────────────────────────────────

export const ticketTypes = pgTable("ticket_types", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventId: varchar("event_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  quantityAvailable: integer("quantity_available").notNull(),
  quantitySold: integer("quantity_sold").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TicketType = {
  id: string;
  eventId: string;
  name: string;
  price: number;
  quantityAvailable: number;
  quantitySold: number;
  createdAt: Date;
};

export interface CreateTicketTypeData {
  eventId: string;
  name: string;
  price: number;
  quantityAvailable: number;
}

export interface UpdateTicketTypeData {
  name?: string;
  price?: number;
  quantityAvailable?: number;
}

export const createTicketTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().min(0, "Price must be non-negative"),
  quantityAvailable: z.number().min(1, "Must have at least 1 ticket"),
});

export const updateTicketTypeSchema = createTicketTypeSchema.partial();

// ─── Ticket Purchases ─────────────────────────────────────────────────────────

export type PurchaseStatus = "confirmed" | "pending" | "failed";

export const ticketPurchases = pgTable("ticket_purchases", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventId: varchar("event_id", { length: 36 }).notNull(),
  ticketTypeId: varchar("ticket_type_id", { length: 36 }).notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name").notNull(),
  buyerPhone: text("buyer_phone").notNull(),
  quantity: integer("quantity").notNull(),
  amount: integer("amount").notNull(),
  reference: text("reference").notNull().unique(),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TicketPurchase = {
  id: string;
  eventId: string;
  ticketTypeId: string;
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string;
  quantity: number;
  amount: number;
  reference: string;
  status: PurchaseStatus;
  createdAt: Date;
};

export interface CreateTicketPurchaseData {
  eventId: string;
  ticketTypeId: string;
  buyerEmail: string;
  buyerName: string;
  buyerPhone: string;
  quantity: number;
  amount: number;
  reference: string;
  status: PurchaseStatus;
}

export const checkoutSchema = z.object({
  eventId: z.string().min(1, "Event ID required"),
  ticketTypeId: z.string().min(1, "Ticket type required"),
  buyerName: z.string().min(2, "Full name required"),
  buyerEmail: z.string().email("Valid email required"),
  buyerPhone: z.string().min(7, "Phone number required"),
  quantity: z.number().int().min(1).max(10),
});

// ─── Event Config (legacy single-event setup page) ────────────────────────────

export const eventConfig = pgTable("event_config", {
  id: integer("id").primaryKey().default(1),
  config: jsonb("config").notNull(),
});

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  description: string;
  perks: string[];
  isVip: boolean;
  allowQuantity: boolean;
  ticketsIncluded: number;
}

export interface EventConfig {
  eventName: string;
  eventTheme: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  eventDescription: string;
  logoDataUrl: string | null;
  primaryColor: string;
  highlightColor: string;
  accentColor: string;
  bgColor: string;
  contactEmail: string;
  contactPhone: string;
  currency: string;
  paymentMethod: PaymentMethod;
  paystackPublicKey: string;
  paystackSecretKey: string;
  stripePublicKey: string;
  stripeSecretKey: string;
  paypalClientId: string;
  paypalSecretKey: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankRoutingCode: string;
  bankTransferInstructions: string;
  ticketTiers: TicketTier[];
  totalTickets: number;
  isPublished: boolean;
}

export const ticketTierSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  price: z.number().min(0),
  description: z.string(),
  perks: z.array(z.string()),
  isVip: z.boolean(),
  allowQuantity: z.boolean(),
  ticketsIncluded: z.number().min(1),
});

export const eventConfigSchema = z.object({
  eventName: z.string().min(1, "Event name is required"),
  eventTheme: z.string(),
  eventDate: z.string().min(1, "Event date is required"),
  eventTime: z.string().min(1, "Event time is required"),
  eventVenue: z.string().min(1, "Venue is required"),
  eventDescription: z.string(),
  logoDataUrl: z.string().nullable(),
  primaryColor: z.string(),
  highlightColor: z.string(),
  accentColor: z.string(),
  bgColor: z.string(),
  contactEmail: z.string().email().or(z.literal("")),
  contactPhone: z.string(),
  currency: z.string(),
  paymentMethod: z.enum(["paystack", "stripe", "paypal", "bank_transfer"]),
  paystackPublicKey: z.string(),
  paystackSecretKey: z.string(),
  stripePublicKey: z.string(),
  stripeSecretKey: z.string(),
  paypalClientId: z.string(),
  paypalSecretKey: z.string(),
  bankName: z.string(),
  bankAccountName: z.string(),
  bankAccountNumber: z.string(),
  bankRoutingCode: z.string(),
  bankTransferInstructions: z.string(),
  ticketTiers: z.array(ticketTierSchema),
  totalTickets: z.number().min(1),
  isPublished: z.boolean(),
});
