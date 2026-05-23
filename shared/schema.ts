import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const orders = pgTable("orders", {
  id: varchar("id", { length: 36 }).primaryKey(),
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
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ─── Users ────────────────────────────────────────────────────────────────────

export type UserRole = "organizer";
export type UserTier = "free" | "pro";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  tier: UserTier;
  createdAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  tier: UserTier;
}

// ─── Organizers ───────────────────────────────────────────────────────────────

export interface Organizer {
  id: string;
  userId: string;
  businessName: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  subaccountCode: string;
  bvn: string | null;
  tier: UserTier;
  createdAt: Date;
}

export interface CreateOrganizerData {
  userId: string;
  businessName: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  subaccountCode: string;
  bvn: string | null;
  tier: UserTier;
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
export type PaymentMethod = "paystack" | "stripe" | "paypal" | "bank_transfer";

export interface Event {
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
}

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
  paymentMethod: z.enum(["paystack", "stripe", "paypal", "bank_transfer"]),
  isActive: z.boolean().default(true),
});

export const updateEventSchema = createEventSchema.partial();

// ─── Ticket Types ─────────────────────────────────────────────────────────────

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  price: number;
  quantityAvailable: number;
  quantitySold: number;
  createdAt: Date;
}

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

// ─── Event Config (legacy single-event setup page) ────────────────────────────

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
