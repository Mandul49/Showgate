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
  gender: text("gender"),
  ageRange: text("age_range"),
  heardFrom: text("heard_from"),
  ticketType: text("ticket_type").notNull(),
  quantity: integer("quantity").notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: text("status").notNull().default("confirmed"),
  attendeeDetails: jsonb("attendee_details"),
  discountCode: text("discount_code"),
  discountAmount: integer("discount_amount").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  status: true,
  createdAt: true,
}).extend({
  eventId: z.string().optional().nullable(),
  ticketTypeId: z.string().optional().nullable(),
  attendeeDetails: z.array(z.object({ name: z.string(), email: z.string().optional() })).optional().nullable(),
  discountCode: z.string().optional().nullable(),
  discountAmount: z.number().optional().default(0),
  gender: z.string().optional().nullable(),
  ageRange: z.string().optional().nullable(),
  heardFrom: z.string().optional().nullable(),
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ─── Users ────────────────────────────────────────────────────────────────────

export type AdminRole = "super_admin" | "admin" | "support" | "finance";
export type UserRole = "organizer" | "admin";
export type UserTier = "free" | "pro";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("organizer"),
  tier: text("tier").notNull().default("free"),
  proExpiresAt: timestamp("pro_expires_at"),
  billingCycle: text("billing_cycle"),
  cancelledAt: timestamp("cancelled_at"),
  resetToken: text("reset_token"),
  resetTokenExpires: timestamp("reset_token_expires"),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  suspended: boolean("suspended").notNull().default(false),
  adminRole: text("admin_role"),
  adminAddedBy: text("admin_added_by"),
  adminAddedAt: timestamp("admin_added_at"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  tier: UserTier;
  proExpiresAt: Date | null;
  billingCycle: string | null;
  cancelledAt: Date | null;
  resetToken: string | null;
  resetTokenExpires: Date | null;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  suspended: boolean;
  adminRole: AdminRole[] | null;
  adminAddedBy: string | null;
  adminAddedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export interface AdminTeamMember {
  id: string;
  email: string;
  adminRole: AdminRole[];
  createdAt: Date;
  adminAddedAt: Date | null;
  adminAddedBy: string | null;
  lastLoginAt: Date | null;
}

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  tier: UserTier;
}

// ─── Brand Theme ─────────────────────────────────────────────────────────────

export interface BrandTheme {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary?: string;
  textMuted?: string;
  onPrimary?: string;
  border?: string;
  themeMode?: "custom" | "auto";
  countdownStyle?: "box" | "minimal" | "rings";
  buttonStyle?: "solid" | "outline";
}

// ─── Organizers ───────────────────────────────────────────────────────────────

export const organizers = pgTable("organizers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().unique(),
  businessName: text("business_name").notNull(),
  bankName: text("bank_name").notNull(),
  bankCode: text("bank_code").notNull(),
  accountNumber: text("account_number").notNull(),
  subaccountCode: text("subaccount_code"),
  testSubaccountCode: text("test_subaccount_code"),
  bvn: text("bvn"),
  tier: text("tier").notNull().default("free"),
  customBrandName: text("custom_brand_name"),
  customLogoUrl: text("custom_logo_url"),
  flutterwavePublicKey: text("flutterwave_public_key"),
  flutterwaveSecretKey: text("flutterwave_secret_key"),
  brandTheme: jsonb("brand_theme"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Organizer = {
  id: string;
  userId: string;
  businessName: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  subaccountCode: string | null;
  testSubaccountCode: string | null;
  bvn: string | null;
  tier: UserTier;
  customBrandName: string | null;
  customLogoUrl: string | null;
  flutterwavePublicKey: string | null;
  flutterwaveSecretKey: string | null;
  brandTheme: BrandTheme | null;
  createdAt: Date;
};

export interface CreateOrganizerData {
  userId: string;
  businessName: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  subaccountCode: string | null;
  testSubaccountCode?: string | null;
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
  subaccountCode: string | null;
  tier: UserTier;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type EventStatus = "active" | "inactive" | "draft";
export type PaymentMethod = "paystack" | "bank_transfer" | "flutterwave";

export const events = pgTable("events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  organizerId: varchar("organizer_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time"),
  location: text("location").notNull(),
  status: text("status").notNull().default("draft"),
  maxTickets: integer("max_tickets").notNull(),
  paymentMethod: text("payment_method").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  suspendedByAdmin: boolean("suspended_by_admin").notNull().default(false),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  coverImagePositionY: integer("cover_image_position_y").default(50),
  slug: text("slug"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Event = {
  id: string;
  organizerId: string;
  title: string;
  date: string;
  startTime: string | null;
  location: string;
  status: EventStatus;
  maxTickets: number;
  paymentMethod: PaymentMethod;
  isActive: boolean;
  suspendedByAdmin: boolean;
  description: string | null;
  coverImageUrl: string | null;
  coverImagePositionY: number | null;
  slug: string | null;
  createdAt: Date;
};

export interface CreateEventData {
  organizerId: string;
  title: string;
  date: string;
  startTime?: string | null;
  location: string;
  status: EventStatus;
  maxTickets: number;
  paymentMethod: PaymentMethod;
  isActive: boolean;
  description?: string | null;
  coverImageUrl?: string | null;
  coverImagePositionY?: number | null;
  slug?: string | null;
}

export interface UpdateEventData {
  title?: string;
  date?: string;
  startTime?: string | null;
  location?: string;
  status?: EventStatus;
  maxTickets?: number;
  paymentMethod?: PaymentMethod;
  isActive?: boolean;
  description?: string | null;
  coverImageUrl?: string | null;
  coverImagePositionY?: number | null;
  slug?: string | null;
}

export const createEventSchema = z.object({
  title: z.string().min(1, "Event title is required"),
  date: z.string().min(1, "Event date is required"),
  startTime: z.string().optional().nullable(),
  location: z.string().min(1, "Location is required"),
  maxTickets: z.number().min(1, "Must have at least 1 ticket"),
  paymentMethod: z.enum(["paystack", "bank_transfer", "flutterwave"]),
  isActive: z.boolean().default(true),
  description: z.string().optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  coverImagePositionY: z.number().min(0).max(100).optional().nullable(),
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
  groupSize: integer("group_size").notNull().default(1),
  groupLabel: text("group_label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TicketType = {
  id: string;
  eventId: string;
  name: string;
  price: number;
  quantityAvailable: number;
  quantitySold: number;
  groupSize: number;
  groupLabel: string | null;
  createdAt: Date;
};

export interface CreateTicketTypeData {
  eventId: string;
  name: string;
  price: number;
  quantityAvailable: number;
  groupSize?: number;
  groupLabel?: string | null;
}

export interface UpdateTicketTypeData {
  name?: string;
  price?: number;
  quantityAvailable?: number;
  groupSize?: number;
  groupLabel?: string | null;
}

export const createTicketTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().min(0, "Price must be non-negative"),
  quantityAvailable: z.number().min(1, "Must have at least 1 ticket"),
  groupSize: z.number().int().min(1).optional().default(1),
  groupLabel: z.string().optional().nullable(),
});

export const updateTicketTypeSchema = createTicketTypeSchema.partial();

// ─── Discount Codes ───────────────────────────────────────────────────────────

export const discountCodes = pgTable("discount_codes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventId: varchar("event_id", { length: 36 }).notNull(),
  code: text("code").notNull(),
  type: text("type").notNull(), // "percent" | "fixed"
  value: integer("value").notNull(),
  appliesTo: text("applies_to").notNull().default("all"), // "all" | "specific"
  appliesToTicketTypeId: varchar("applies_to_ticket_type_id", { length: 36 }),
  usageLimit: integer("usage_limit"),
  timesUsed: integer("times_used").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DiscountCode = {
  id: string;
  eventId: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  appliesTo: "all" | "specific";
  appliesToTicketTypeId: string | null;
  usageLimit: number | null;
  timesUsed: number;
  expiresAt: Date | null;
  createdAt: Date;
};

export interface CreateDiscountCodeData {
  eventId: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  appliesTo: "all" | "specific";
  appliesToTicketTypeId?: string | null;
  usageLimit?: number | null;
  expiresAt?: Date | null;
}

export const createDiscountCodeSchema = z.object({
  code: z.string().min(1, "Code is required").max(50).transform((v) => v.trim().toUpperCase()),
  type: z.enum(["percent", "fixed"]),
  value: z.number().min(1, "Value must be at least 1"),
  appliesTo: z.enum(["all", "specific"]).default("all"),
  appliesToTicketTypeId: z.string().optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  expiresAt: z.string().optional().nullable(),
});

// ─── Ticket Purchases ─────────────────────────────────────────────────────────

export type PurchaseStatus = "confirmed" | "pending" | "failed";

export const ticketPurchases = pgTable("ticket_purchases", {
  id: varchar("id", { length: 36 }).primaryKey(),
  eventId: varchar("event_id", { length: 36 }).notNull(),
  ticketTypeId: varchar("ticket_type_id", { length: 36 }).notNull(),
  organizerId: varchar("organizer_id", { length: 36 }),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  instagramHandle: text("instagram_handle"),
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
  organizerId: string | null;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  instagramHandle: string | null;
  quantity: number;
  amount: number;
  reference: string;
  status: PurchaseStatus;
  createdAt: Date;
};

export interface CreateTicketPurchaseData {
  eventId: string;
  ticketTypeId: string;
  organizerId?: string | null;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  instagramHandle?: string | null;
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

// ─── Platform Stats ────────────────────────────────────────────────────────────
// Single-row accumulator. When an organizer deletes their account their event
// and ticket counts are added here so the homepage counters never go down.

export const platformStats = pgTable("platform_stats", {
  id: integer("id").primaryKey().default(1),
  deletedEvents: integer("deleted_events").notNull().default(0),
  deletedTicketsSold: integer("deleted_tickets_sold").notNull().default(0),
});

// ─── Subscription References ──────────────────────────────────────────────────
// Tracks Paystack references that have already been used to fulfill a Pro upgrade.
// Prevents replay attacks where a downgraded user re-uses an old valid reference.

export const subscriptionReferences = pgTable("subscription_references", {
  reference: text("reference").primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  plan: text("plan").notNull(),
  amountKobo: integer("amount_kobo"),
  fulfilledAt: timestamp("fulfilled_at").defaultNow().notNull(),
});

export type SubscriptionReference = typeof subscriptionReferences.$inferSelect;

// ─── Pro Grants ────────────────────────────────────────────────────────────────
// Admin-issued complimentary Pro access with a note tracking the reason.

export const proGrants = pgTable("pro_grants", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  grantedBy: varchar("granted_by", { length: 36 }).notNull(),
  note: text("note").notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
});

export type ProGrant = typeof proGrants.$inferSelect;

// ─── Platform Settings ─────────────────────────────────────────────────────────
// Key-value store for admin-configurable platform settings.

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Admin Audit Log ──────────────────────────────────────────────────────────
// Immutable log of every admin mutation: who did what, to which entity, when.

export const adminAuditLog = pgTable("admin_audit_log", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminEmail: text("admin_email").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminAuditEntry = typeof adminAuditLog.$inferSelect;

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
  paymentMethod: z.enum(["paystack", "bank_transfer", "flutterwave"]),
  paystackPublicKey: z.string(),
  paystackSecretKey: z.string(),
  bankName: z.string(),
  bankAccountName: z.string(),
  bankAccountNumber: z.string(),
  bankRoutingCode: z.string(),
  bankTransferInstructions: z.string(),
  ticketTiers: z.array(ticketTierSchema),
  totalTickets: z.number().min(1),
  isPublished: z.boolean(),
});
