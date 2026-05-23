import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  orders, users, organizers, events, ticketTypes, ticketPurchases, eventConfig,
  subscriptionReferences,
  type Order, type InsertOrder, type EventConfig,
  type User, type UserRole, type UserTier,
  type Organizer, type CreateOrganizerData,
  type Event, type CreateEventData, type UpdateEventData, type EventStatus, type PaymentMethod,
  type TicketType, type CreateTicketTypeData, type UpdateTicketTypeData,
  type TicketPurchase, type CreateTicketPurchaseData, type PurchaseStatus,
} from "@shared/schema";
import { randomUUID } from "crypto";

const DEFAULT_CONFIG: EventConfig = {
  eventName: "My Event",
  eventTheme: "",
  eventDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] + "T18:00:00",
  eventTime: "6:00 PM",
  eventVenue: "Venue Name",
  eventDescription: "An amazing event you don't want to miss.",
  logoDataUrl: null,
  primaryColor: "#F59E0B",
  highlightColor: "#FDE68A",
  accentColor: "#D97706",
  bgColor: "#0d0d0d",
  contactEmail: "",
  contactPhone: "",
  currency: "NGN",
  paymentMethod: "paystack",
  paystackPublicKey: "",
  paystackSecretKey: "",
  stripePublicKey: "",
  stripeSecretKey: "",
  paypalClientId: "",
  paypalSecretKey: "",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankRoutingCode: "",
  bankTransferInstructions: "",
  ticketTiers: [
    {
      id: "regular",
      name: "Regular",
      price: 5000,
      description: "General admission ticket.",
      perks: ["Full event access", "Welcome pack"],
      isVip: false,
      allowQuantity: true,
      ticketsIncluded: 1,
    },
  ],
  totalTickets: 200,
  isPublished: false,
};

export interface IStorage {
  // Orders
  createOrder(order: InsertOrder, status?: string): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByEventId(eventId: string): Promise<Order[]>;
  getTotalTicketsSold(): Promise<number>;
  updateOrderStatus(id: string, status: string): Promise<Order>;
  // Event config
  getEventConfig(): Promise<EventConfig>;
  saveEventConfig(config: EventConfig): Promise<EventConfig>;
  // Users
  createUser(email: string, passwordHash: string, role: UserRole, tier: UserTier): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  updateUserTier(userId: string, tier: UserTier, proExpiresAt: Date | null): Promise<User>;
  getUsersWithExpiredPro(): Promise<User[]>;
  // Organizers
  createOrganizer(data: CreateOrganizerData): Promise<Organizer>;
  getOrganizerByUserId(userId: string): Promise<Organizer | undefined>;
  getOrganizerById(id: string): Promise<Organizer | undefined>;
  updateOrganizerTier(organizerId: string, tier: UserTier): Promise<Organizer>;
  updateOrganizerBranding(organizerId: string, data: { customBrandName: string | null; customLogoUrl: string | null; brandTheme?: import("@shared/schema").BrandTheme | null }): Promise<Organizer>;
  updateOrganizerGateways(organizerId: string, data: { flutterwavePublicKey: string | null; flutterwaveSecretKey: string | null }): Promise<Organizer>;
  // Events
  createEvent(data: CreateEventData): Promise<Event>;
  getEventsByOrganizerId(organizerId: string): Promise<Event[]>;
  getEventById(id: string): Promise<Event | undefined>;
  updateEvent(id: string, updates: UpdateEventData): Promise<Event>;
  // Ticket Types
  createTicketType(data: CreateTicketTypeData): Promise<TicketType>;
  getTicketTypesByEventId(eventId: string): Promise<TicketType[]>;
  getTicketTypeById(id: string): Promise<TicketType | undefined>;
  updateTicketType(id: string, updates: UpdateTicketTypeData): Promise<TicketType>;
  incrementTicketTypeSold(id: string, quantity: number): Promise<TicketType>;
  // Ticket Purchases
  createTicketPurchase(data: CreateTicketPurchaseData): Promise<TicketPurchase>;
  getTicketPurchaseByReference(reference: string): Promise<TicketPurchase | undefined>;
  getTicketPurchasesByEventId(eventId: string): Promise<TicketPurchase[]>;
  updateTicketPurchaseStatus(id: string, status: PurchaseStatus): Promise<TicketPurchase>;
  // Subscription References (upgrade replay-attack prevention)
  hasSubscriptionReference(reference: string): Promise<boolean>;
  recordSubscriptionReference(reference: string, userId: string, plan: string): Promise<void>;
}

export class DbStorage implements IStorage {

  // ── Orders ───────────────────────────────────────────────────────────────

  async createOrder(insertOrder: InsertOrder, status = "confirmed"): Promise<Order> {
    const id = randomUUID();
    const [row] = await db.insert(orders).values({ ...insertOrder, id, status }).returning();
    return row;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [row] = await db.select().from(orders).where(eq(orders.id, id));
    return row;
  }

  async getAllOrders(): Promise<Order[]> {
    return db.select().from(orders);
  }

  async getOrdersByEventId(eventId: string): Promise<Order[]> {
    const rows = await db.select().from(orders)
      .where(eq(orders.eventId, eventId))
      .orderBy(sql`${orders.createdAt} DESC`);
    return rows;
  }

  async getTotalTicketsSold(): Promise<number> {
    const [result] = await db.select({ total: sql<number>`coalesce(sum(${orders.quantity}), 0)` }).from(orders);
    return Number(result.total);
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const [row] = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    if (!row) throw new Error("Order not found");
    return row;
  }

  // ── Event Config ─────────────────────────────────────────────────────────

  async getEventConfig(): Promise<EventConfig> {
    const [row] = await db.select().from(eventConfig).where(eq(eventConfig.id, 1));
    if (!row) return { ...DEFAULT_CONFIG };
    return row.config as EventConfig;
  }

  async saveEventConfig(config: EventConfig): Promise<EventConfig> {
    await db.insert(eventConfig)
      .values({ id: 1, config })
      .onConflictDoUpdate({ target: eventConfig.id, set: { config } });
    return config;
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async createUser(email: string, passwordHash: string, role: UserRole, tier: UserTier): Promise<User> {
    const id = randomUUID();
    const [row] = await db.insert(users).values({ id, email: email.toLowerCase(), passwordHash, role, tier }).returning();
    return this._mapUser(row);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return row ? this._mapUser(row) : undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row ? this._mapUser(row) : undefined;
  }

  async updateUserTier(userId: string, tier: UserTier, proExpiresAt: Date | null): Promise<User> {
    const [row] = await db.update(users)
      .set({ tier, proExpiresAt })
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw new Error("User not found");
    return this._mapUser(row);
  }

  async getUsersWithExpiredPro(): Promise<User[]> {
    const now = new Date();
    const rows = await db.select().from(users)
      .where(sql`${users.tier} = 'pro' AND ${users.proExpiresAt} IS NOT NULL AND ${users.proExpiresAt} <= ${now}`);
    return rows.map(this._mapUser);
  }

  private _mapUser(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role as UserRole,
      tier: row.tier as UserTier,
      proExpiresAt: row.proExpiresAt ?? null,
      createdAt: row.createdAt,
    };
  }

  // ── Organizers ────────────────────────────────────────────────────────────

  async createOrganizer(data: CreateOrganizerData): Promise<Organizer> {
    const id = randomUUID();
    const [row] = await db.insert(organizers).values({ ...data, id }).returning();
    return this._mapOrganizer(row);
  }

  async getOrganizerByUserId(userId: string): Promise<Organizer | undefined> {
    const [row] = await db.select().from(organizers).where(eq(organizers.userId, userId));
    return row ? this._mapOrganizer(row) : undefined;
  }

  async getOrganizerById(id: string): Promise<Organizer | undefined> {
    const [row] = await db.select().from(organizers).where(eq(organizers.id, id));
    return row ? this._mapOrganizer(row) : undefined;
  }

  async updateOrganizerTier(organizerId: string, tier: UserTier): Promise<Organizer> {
    const [row] = await db.update(organizers)
      .set({ tier })
      .where(eq(organizers.id, organizerId))
      .returning();
    if (!row) throw new Error("Organizer not found");
    return this._mapOrganizer(row);
  }

  private _mapOrganizer(row: typeof organizers.$inferSelect): Organizer {
    return {
      id: row.id,
      userId: row.userId,
      businessName: row.businessName,
      bankName: row.bankName,
      bankCode: row.bankCode,
      accountNumber: row.accountNumber,
      subaccountCode: row.subaccountCode,
      bvn: row.bvn ?? null,
      tier: row.tier as UserTier,
      customBrandName: row.customBrandName ?? null,
      customLogoUrl: row.customLogoUrl ?? null,
      flutterwavePublicKey: row.flutterwavePublicKey ?? null,
      flutterwaveSecretKey: row.flutterwaveSecretKey ?? null,
      brandTheme: (row.brandTheme as import("@shared/schema").BrandTheme | null) ?? null,
      createdAt: row.createdAt,
    };
  }

  async updateOrganizerBranding(organizerId: string, data: { customBrandName: string | null; customLogoUrl: string | null; brandTheme?: import("@shared/schema").BrandTheme | null }): Promise<Organizer> {
    const [row] = await db.update(organizers)
      .set(data)
      .where(eq(organizers.id, organizerId))
      .returning();
    if (!row) throw new Error("Organizer not found");
    return this._mapOrganizer(row);
  }

  async updateOrganizerGateways(organizerId: string, data: { flutterwavePublicKey: string | null; flutterwaveSecretKey: string | null }): Promise<Organizer> {
    const [row] = await db.update(organizers)
      .set(data)
      .where(eq(organizers.id, organizerId))
      .returning();
    if (!row) throw new Error("Organizer not found");
    return this._mapOrganizer(row);
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async createEvent(data: CreateEventData): Promise<Event> {
    const id = randomUUID();
    const [row] = await db.insert(events).values({ ...data, id }).returning();
    return this._mapEvent(row);
  }

  async getEventsByOrganizerId(organizerId: string): Promise<Event[]> {
    const rows = await db.select().from(events)
      .where(eq(events.organizerId, organizerId))
      .orderBy(sql`${events.createdAt} DESC`);
    return rows.map(this._mapEvent);
  }

  async getEventById(id: string): Promise<Event | undefined> {
    const [row] = await db.select().from(events).where(eq(events.id, id));
    return row ? this._mapEvent(row) : undefined;
  }

  async updateEvent(id: string, updates: UpdateEventData): Promise<Event> {
    const [row] = await db.update(events)
      .set(updates)
      .where(eq(events.id, id))
      .returning();
    if (!row) throw new Error("Event not found");
    return this._mapEvent(row);
  }

  private _mapEvent(row: typeof events.$inferSelect): Event {
    return {
      id: row.id,
      organizerId: row.organizerId,
      title: row.title,
      date: row.date,
      location: row.location,
      status: row.status as EventStatus,
      maxTickets: row.maxTickets,
      paymentMethod: row.paymentMethod as PaymentMethod,
      isActive: row.isActive,
      description: row.description ?? null,
      coverImageUrl: row.coverImageUrl ?? null,
      createdAt: row.createdAt,
    };
  }

  // ── Ticket Types ──────────────────────────────────────────────────────────

  async createTicketType(data: CreateTicketTypeData): Promise<TicketType> {
    const id = randomUUID();
    const [row] = await db.insert(ticketTypes).values({ ...data, id, quantitySold: 0 }).returning();
    return this._mapTicketType(row);
  }

  async getTicketTypesByEventId(eventId: string): Promise<TicketType[]> {
    const rows = await db.select().from(ticketTypes).where(eq(ticketTypes.eventId, eventId));
    return rows.map(this._mapTicketType);
  }

  async getTicketTypeById(id: string): Promise<TicketType | undefined> {
    const [row] = await db.select().from(ticketTypes).where(eq(ticketTypes.id, id));
    return row ? this._mapTicketType(row) : undefined;
  }

  async updateTicketType(id: string, updates: UpdateTicketTypeData): Promise<TicketType> {
    const [row] = await db.update(ticketTypes)
      .set(updates)
      .where(eq(ticketTypes.id, id))
      .returning();
    if (!row) throw new Error("Ticket type not found");
    return this._mapTicketType(row);
  }

  async incrementTicketTypeSold(id: string, quantity: number): Promise<TicketType> {
    const [row] = await db.update(ticketTypes)
      .set({ quantitySold: sql`${ticketTypes.quantitySold} + ${quantity}` })
      .where(eq(ticketTypes.id, id))
      .returning();
    if (!row) throw new Error("Ticket type not found");
    return this._mapTicketType(row);
  }

  private _mapTicketType(row: typeof ticketTypes.$inferSelect): TicketType {
    return {
      id: row.id,
      eventId: row.eventId,
      name: row.name,
      price: row.price,
      quantityAvailable: row.quantityAvailable,
      quantitySold: row.quantitySold,
      createdAt: row.createdAt,
    };
  }

  // ── Ticket Purchases ──────────────────────────────────────────────────────

  async createTicketPurchase(data: CreateTicketPurchaseData): Promise<TicketPurchase> {
    const id = randomUUID();
    const [row] = await db.insert(ticketPurchases).values({ ...data, id }).returning();
    return this._mapPurchase(row);
  }

  async getTicketPurchaseByReference(reference: string): Promise<TicketPurchase | undefined> {
    const [row] = await db.select().from(ticketPurchases).where(eq(ticketPurchases.reference, reference));
    return row ? this._mapPurchase(row) : undefined;
  }

  async getTicketPurchasesByEventId(eventId: string): Promise<TicketPurchase[]> {
    const rows = await db.select().from(ticketPurchases)
      .where(eq(ticketPurchases.eventId, eventId))
      .orderBy(sql`${ticketPurchases.createdAt} DESC`);
    return rows.map(this._mapPurchase);
  }

  async updateTicketPurchaseStatus(id: string, status: PurchaseStatus): Promise<TicketPurchase> {
    const [row] = await db.update(ticketPurchases)
      .set({ status })
      .where(eq(ticketPurchases.id, id))
      .returning();
    if (!row) throw new Error("Purchase not found");
    return this._mapPurchase(row);
  }

  private _mapPurchase(row: typeof ticketPurchases.$inferSelect): TicketPurchase {
    return {
      id: row.id,
      eventId: row.eventId,
      ticketTypeId: row.ticketTypeId,
      buyerEmail: row.buyerEmail,
      buyerName: row.buyerName,
      buyerPhone: row.buyerPhone,
      quantity: row.quantity,
      amount: row.amount,
      reference: row.reference,
      status: row.status as PurchaseStatus,
      createdAt: row.createdAt,
    };
  }

  // ── Subscription References ────────────────────────────────────────────────

  async hasSubscriptionReference(reference: string): Promise<boolean> {
    const [row] = await db.select({ reference: subscriptionReferences.reference })
      .from(subscriptionReferences)
      .where(eq(subscriptionReferences.reference, reference));
    return !!row;
  }

  async recordSubscriptionReference(reference: string, userId: string, plan: string): Promise<void> {
    await db.insert(subscriptionReferences)
      .values({ reference, userId, plan })
      .onConflictDoNothing();
  }
}

export const storage = new DbStorage();
