import { eq, sql, and, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  orders, users, organizers, events, ticketTypes, ticketPurchases, eventConfig,
  subscriptionReferences, discountCodes, platformStats, proGrants,
  type Order, type InsertOrder, type EventConfig,
  type User, type UserRole, type UserTier,
  type Organizer, type CreateOrganizerData,
  type Event, type CreateEventData, type UpdateEventData, type EventStatus, type PaymentMethod,
  type TicketType, type CreateTicketTypeData, type UpdateTicketTypeData,
  type TicketPurchase, type CreateTicketPurchaseData, type PurchaseStatus,
  type SubscriptionReference,
  type DiscountCode, type CreateDiscountCodeData,
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

// ─── Admin types ─────────────────────────────────────────────────────────────
export interface AdminUserRow {
  id: string;
  email: string;
  role: string;
  tier: string;
  proExpiresAt: Date | null;
  suspended: boolean;
  createdAt: Date;
  businessName: string | null;
  eventCount: number;
}

export interface AdminOrganizerRow {
  id: string;
  userId: string;
  email: string;
  businessName: string;
  tier: string;
  proExpiresAt: Date | null;
  subaccountCode: string | null;
  eventCount: number;
  activeEventCount: number;
  ticketsSold: number;
  revenue: number;
  suspended: boolean;
  createdAt: Date;
}

export interface AdminOrganizerEventRow {
  id: string;
  title: string;
  date: string;
  location: string;
  status: string;
  isActive: boolean;
  paymentMethod: string;
  maxTickets: number;
  ticketsSold: number;
  revenue: number;
  createdAt: Date;
}

export interface AdminOrganizerDetail {
  id: string;
  userId: string;
  email: string;
  businessName: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  subaccountCode: string | null;
  testSubaccountCode: string | null;
  tier: string;
  proExpiresAt: Date | null;
  suspended: boolean;
  createdAt: Date;
  eventCount: number;
  ticketsSold: number;
  revenue: number;
  events: AdminOrganizerEventRow[];
  recentPurchases: {
    id: string;
    customerName: string;
    customerEmail: string;
    eventTitle: string;
    quantity: number;
    amount: number;
    status: string;
    createdAt: Date;
  }[];
  subscriptionHistory: {
    reference: string;
    plan: string;
    amountKobo: number | null;
    fulfilledAt: Date;
  }[];
}

export interface AdminSubscriptionRow {
  userId: string;
  email: string;
  businessName: string | null;
  plan: string;
  startedAt: Date | null;
  expiresAt: Date | null;
  status: "active" | "cancelled" | "expired" | "lifetime";
  totalPaid: number;
  cancelledAt: Date | null;
  grantNote: string | null;
}

export interface AdminSubscriptionStats {
  activeSubscribers: number;
  churnedThisMonth: number;
  revenueThisMonth: number;
}

export interface AdminEventRow {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  location: string;
  status: string;
  isActive: boolean;
  suspendedByAdmin: boolean;
  paymentMethod: string;
  maxTickets: number;
  createdAt: Date;
  organizerId: string;
  businessName: string;
  organizerEmail: string;
  ticketsSold: number;
  revenue: number;
}

export interface AdminStats {
  totalUsers: number;
  totalOrganizers: number;
  totalEvents: number;
  activeEvents: number;
  inactiveEvents: number;
  totalTicketsSold: number;
  totalRevenue: number;
  proUsers: number;
  monthlySubscriptionRevenue: number;
  newSignupsThisWeek: number;
  newSignupsThisMonth: number;
}

export interface AdminChartData {
  signupsLast30Days: { date: string; count: number }[];
  ticketSalesLast30Days: { date: string; count: number }[];
}

export interface AdminAnalyticsData {
  revenueByMonth: { month: string; subscriptionRevenue: number; ticketFeeRevenue: number }[];
  ticketsByMonth: { month: string; count: number; revenue: number }[];
  topEventsByTickets: { id: string; title: string; ticketsSold: number; revenue: number }[];
  topOrganizersByRevenue: { id: string; businessName: string; email: string; revenue: number; ticketsSold: number }[];
  subscriptionGrowth: { month: string; newSubscriptions: number; cumulative: number }[];
  tierRatio: { free: number; pro: number };
  avgTicketsPerEvent: number;
  totalTicketRevenue: number;
  totalSubscriptionRevenue: number;
}

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
  setPasswordResetToken(userId: string, token: string, expires: Date): Promise<void>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  updatePasswordAndClearResetToken(userId: string, passwordHash: string): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  updateUserEmail(userId: string, email: string): Promise<void>;
  deleteUserAccount(userId: string): Promise<void>;
  setEmailVerificationToken(userId: string, token: string): Promise<void>;
  getUserByEmailVerificationToken(token: string): Promise<User | undefined>;
  markEmailVerified(userId: string): Promise<void>;
  // Organizers
  createOrganizer(data: CreateOrganizerData): Promise<Organizer>;
  getOrganizerByUserId(userId: string): Promise<Organizer | undefined>;
  getOrganizerById(id: string): Promise<Organizer | undefined>;
  updateOrganizerTier(organizerId: string, tier: UserTier): Promise<Organizer>;
  updateOrganizerBranding(organizerId: string, data: { customBrandName: string | null; customLogoUrl: string | null; brandTheme?: import("@shared/schema").BrandTheme | null }): Promise<Organizer>;
  updateOrganizerGateways(organizerId: string, data: { flutterwavePublicKey: string | null; flutterwaveSecretKey: string | null }): Promise<Organizer>;
  updateOrganizerTestSubaccount(organizerId: string, testSubaccountCode: string): Promise<Organizer>;
  updateOrganizerBankAccount(organizerId: string, data: { bankName: string; bankCode: string; accountNumber: string }): Promise<Organizer>;
  setOrganizerLiveSubaccount(organizerId: string, subaccountCode: string): Promise<Organizer>;
  // Events
  createEvent(data: CreateEventData): Promise<Event>;
  getEventsByOrganizerId(organizerId: string): Promise<Event[]>;
  getEventById(id: string): Promise<Event | undefined>;
  updateEvent(id: string, updates: UpdateEventData): Promise<Event>;
  deleteEvent(id: string): Promise<void>;
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
  // Monthly ticket count for free-tier limit
  getMonthlyTicketCountByOrganizerId(organizerId: string): Promise<number>;
  // Subscription References (upgrade replay-attack prevention)
  hasSubscriptionReference(reference: string): Promise<boolean>;
  recordSubscriptionReference(reference: string, userId: string, plan: string, amountKobo?: number): Promise<void>;
  getSubscriptionHistory(userId: string): Promise<SubscriptionReference[]>;
  // Subscription management
  updateUserBillingCycle(userId: string, billingCycle: string): Promise<User>;
  cancelSubscription(userId: string): Promise<User>;
  reinstateSubscription(userId: string): Promise<User>;
  // Discount Codes
  createDiscountCode(data: CreateDiscountCodeData): Promise<DiscountCode>;
  getDiscountCodesByEventId(eventId: string): Promise<DiscountCode[]>;
  getDiscountCodeByCode(eventId: string, code: string): Promise<DiscountCode | undefined>;
  getDiscountCodeById(id: string): Promise<DiscountCode | undefined>;
  incrementDiscountCodeUsed(id: string): Promise<DiscountCode>;
  deleteDiscountCode(id: string): Promise<void>;
  getPublicStats(): Promise<{ totalEvents: number; totalTicketsSold: number }>;
  // Admin
  getAllUsers(): Promise<AdminUserRow[]>;
  getAllEventsAdmin(): Promise<AdminEventRow[]>;
  getAdminAnalytics(): Promise<AdminAnalyticsData>;
  adminSuspendEvent(eventId: string, suspended: boolean): Promise<Event>;
  adminDeleteEvent(eventId: string): Promise<void>;
  setUserRole(userId: string, role: string): Promise<User>;
  getAdminStats(): Promise<AdminStats>;
  getAdminChartData(): Promise<AdminChartData>;
  getAdminOrganizers(): Promise<AdminOrganizerRow[]>;
  getAdminOrganizerDetail(userId: string): Promise<AdminOrganizerDetail | null>;
  suspendUser(userId: string, suspended: boolean): Promise<User>;
  getAdminSubscriptions(): Promise<{ stats: AdminSubscriptionStats; subscriptions: AdminSubscriptionRow[] }>;
  extendSubscription(userId: string, months: number): Promise<User>;
  upgradeToYearly(userId: string): Promise<User>;
  grantFreePro(userId: string, grantedBy: string, note: string): Promise<User>;
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
    const [row] = await db.insert(users).values({ id, email: email.toLowerCase(), passwordHash, role, tier, emailVerified: false }).returning();
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

  async setPasswordResetToken(userId: string, token: string, expires: Date): Promise<void> {
    await db.update(users)
      .set({ resetToken: token, resetTokenExpires: expires })
      .where(eq(users.id, userId));
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.resetToken, token));
    return row ? this._mapUser(row) : undefined;
  }

  async updatePasswordAndClearResetToken(userId: string, passwordHash: string): Promise<void> {
    await db.update(users)
      .set({ passwordHash, resetToken: null, resetTokenExpires: null })
      .where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  }

  async updateUserEmail(userId: string, email: string): Promise<void> {
    await db.update(users).set({ email: email.toLowerCase() }).where(eq(users.id, userId));
  }

  async deleteUserAccount(userId: string): Promise<void> {
    const organizer = await this.getOrganizerByUserId(userId);
    if (organizer) {
      const orgEvents = await this.getEventsByOrganizerId(organizer.id);

      // Snapshot counts before deletion so homepage stats never go down
      const eventCount = orgEvents.length;
      let ticketsSoldCount = 0;
      for (const event of orgEvents) {
        const [row] = await db
          .select({ total: sql<number>`cast(coalesce(sum(quantity_sold),0) as int)` })
          .from(ticketTypes)
          .where(eq(ticketTypes.eventId, event.id));
        ticketsSoldCount += row?.total ?? 0;
      }
      if (eventCount > 0 || ticketsSoldCount > 0) {
        await db
          .insert(platformStats)
          .values({ id: 1, deletedEvents: eventCount, deletedTicketsSold: ticketsSoldCount })
          .onConflictDoUpdate({
            target: platformStats.id,
            set: {
              deletedEvents: sql`platform_stats.deleted_events + ${eventCount}`,
              deletedTicketsSold: sql`platform_stats.deleted_tickets_sold + ${ticketsSoldCount}`,
            },
          });
      }

      for (const event of orgEvents) {
        await db.delete(ticketPurchases).where(eq(ticketPurchases.eventId, event.id));
        await db.delete(discountCodes).where(eq(discountCodes.eventId, event.id));
        await db.delete(ticketTypes).where(eq(ticketTypes.eventId, event.id));
      }
      await db.delete(events).where(eq(events.organizerId, organizer.id));
      await db.delete(organizers).where(eq(organizers.id, organizer.id));
    }
    await db.delete(users).where(eq(users.id, userId));
  }

  async setEmailVerificationToken(userId: string, token: string): Promise<void> {
    await db.update(users).set({ emailVerificationToken: token }).where(eq(users.id, userId));
  }

  async getUserByEmailVerificationToken(token: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return row ? this._mapUser(row) : undefined;
  }

  async markEmailVerified(userId: string): Promise<void> {
    await db.update(users).set({ emailVerified: true, emailVerificationToken: null }).where(eq(users.id, userId));
  }

  private _mapUser(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role as UserRole,
      tier: row.tier as UserTier,
      proExpiresAt: row.proExpiresAt ?? null,
      billingCycle: row.billingCycle ?? null,
      cancelledAt: row.cancelledAt ?? null,
      resetToken: row.resetToken ?? null,
      resetTokenExpires: row.resetTokenExpires ?? null,
      emailVerified: row.emailVerified,
      emailVerificationToken: row.emailVerificationToken ?? null,
      suspended: row.suspended,
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
      testSubaccountCode: row.testSubaccountCode ?? null,
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

  async updateOrganizerTestSubaccount(organizerId: string, testSubaccountCode: string): Promise<Organizer> {
    const [row] = await db.update(organizers)
      .set({ testSubaccountCode })
      .where(eq(organizers.id, organizerId))
      .returning();
    if (!row) throw new Error("Organizer not found");
    return this._mapOrganizer(row);
  }

  async updateOrganizerBankAccount(organizerId: string, data: { bankName: string; bankCode: string; accountNumber: string }): Promise<Organizer> {
    const [row] = await db.update(organizers)
      .set(data)
      .where(eq(organizers.id, organizerId))
      .returning();
    if (!row) throw new Error("Organizer not found");
    return this._mapOrganizer(row);
  }

  async setOrganizerLiveSubaccount(organizerId: string, subaccountCode: string): Promise<Organizer> {
    const [row] = await db.update(organizers)
      .set({ subaccountCode })
      .where(eq(organizers.id, organizerId))
      .returning();
    if (!row) throw new Error("Organizer not found");
    return this._mapOrganizer(row);
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

  async deleteEvent(id: string): Promise<void> {
    await db.delete(ticketTypes).where(eq(ticketTypes.eventId, id));
    await db.delete(events).where(eq(events.id, id));
  }

  private _mapEvent(row: typeof events.$inferSelect): Event {
    return {
      id: row.id,
      organizerId: row.organizerId,
      title: row.title,
      date: row.date,
      startTime: row.startTime ?? null,
      location: row.location,
      status: row.status as EventStatus,
      maxTickets: row.maxTickets,
      paymentMethod: row.paymentMethod as PaymentMethod,
      isActive: row.isActive,
      suspendedByAdmin: row.suspendedByAdmin,
      description: row.description ?? null,
      coverImageUrl: row.coverImageUrl ?? null,
      createdAt: row.createdAt,
    };
  }

  // ── Ticket Types ──────────────────────────────────────────────────────────

  async createTicketType(data: CreateTicketTypeData): Promise<TicketType> {
    const id = randomUUID();
    const [row] = await db.insert(ticketTypes).values({
      ...data,
      id,
      quantitySold: 0,
      groupSize: data.groupSize ?? 1,
      groupLabel: data.groupLabel ?? null,
    }).returning();
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
      groupSize: row.groupSize ?? 1,
      groupLabel: row.groupLabel ?? null,
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
      organizerId: row.organizerId ?? null,
      customerEmail: row.customerEmail,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      instagramHandle: row.instagramHandle ?? null,
      quantity: row.quantity,
      amount: row.amount,
      reference: row.reference,
      status: row.status as PurchaseStatus,
      createdAt: row.createdAt,
    };
  }

  // ── Monthly ticket count ──────────────────────────────────────────────────

  async getMonthlyTicketCountByOrganizerId(organizerId: string): Promise<number> {
    const [result] = await db
      .select({ total: sql<number>`coalesce(sum(${orders.quantity}), 0)` })
      .from(orders)
      .innerJoin(events, eq(orders.eventId, events.id))
      .where(
        and(
          eq(events.organizerId, organizerId),
          sql`date_trunc('month', ${orders.createdAt}) = date_trunc('month', now())`,
          eq(orders.status, "confirmed")
        )
      );
    return Number(result.total);
  }

  // ── Subscription References ────────────────────────────────────────────────

  async hasSubscriptionReference(reference: string): Promise<boolean> {
    const [row] = await db.select({ reference: subscriptionReferences.reference })
      .from(subscriptionReferences)
      .where(eq(subscriptionReferences.reference, reference));
    return !!row;
  }

  async recordSubscriptionReference(reference: string, userId: string, plan: string, amountKobo?: number): Promise<void> {
    await db.insert(subscriptionReferences)
      .values({ reference, userId, plan, amountKobo: amountKobo ?? null })
      .onConflictDoNothing();
  }

  async getSubscriptionHistory(userId: string): Promise<SubscriptionReference[]> {
    return db.select()
      .from(subscriptionReferences)
      .where(eq(subscriptionReferences.userId, userId))
      .orderBy(sql`${subscriptionReferences.fulfilledAt} DESC`);
  }

  async updateUserBillingCycle(userId: string, billingCycle: string): Promise<User> {
    const [row] = await db.update(users)
      .set({ billingCycle, cancelledAt: null })
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw new Error("User not found");
    return this._mapUser(row);
  }

  async cancelSubscription(userId: string): Promise<User> {
    const [row] = await db.update(users)
      .set({ cancelledAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw new Error("User not found");
    return this._mapUser(row);
  }

  async reinstateSubscription(userId: string): Promise<User> {
    const [row] = await db.update(users)
      .set({ cancelledAt: null })
      .where(eq(users.id, userId))
      .returning();
    if (!row) throw new Error("User not found");
    return this._mapUser(row);
  }

  // ── Discount Codes ────────────────────────────────────────────────────────

  async createDiscountCode(data: CreateDiscountCodeData): Promise<DiscountCode> {
    const id = randomUUID();
    const [row] = await db.insert(discountCodes).values({
      id,
      eventId: data.eventId,
      code: data.code,
      type: data.type,
      value: data.value,
      appliesTo: data.appliesTo,
      appliesToTicketTypeId: data.appliesToTicketTypeId ?? null,
      usageLimit: data.usageLimit ?? null,
      timesUsed: 0,
      expiresAt: data.expiresAt ?? null,
    }).returning();
    return this._mapDiscountCode(row);
  }

  async getDiscountCodesByEventId(eventId: string): Promise<DiscountCode[]> {
    const rows = await db.select().from(discountCodes)
      .where(eq(discountCodes.eventId, eventId))
      .orderBy(sql`${discountCodes.createdAt} DESC`);
    return rows.map(this._mapDiscountCode);
  }

  async getDiscountCodeByCode(eventId: string, code: string): Promise<DiscountCode | undefined> {
    const [row] = await db.select().from(discountCodes)
      .where(and(eq(discountCodes.eventId, eventId), eq(discountCodes.code, code.toUpperCase())));
    return row ? this._mapDiscountCode(row) : undefined;
  }

  async getDiscountCodeById(id: string): Promise<DiscountCode | undefined> {
    const [row] = await db.select().from(discountCodes).where(eq(discountCodes.id, id));
    return row ? this._mapDiscountCode(row) : undefined;
  }

  async incrementDiscountCodeUsed(id: string): Promise<DiscountCode> {
    const [row] = await db.update(discountCodes)
      .set({ timesUsed: sql`${discountCodes.timesUsed} + 1` })
      .where(eq(discountCodes.id, id))
      .returning();
    if (!row) throw new Error("Discount code not found");
    return this._mapDiscountCode(row);
  }

  async deleteDiscountCode(id: string): Promise<void> {
    await db.delete(discountCodes).where(eq(discountCodes.id, id));
  }

  async getPublicStats(): Promise<{ totalEvents: number; totalTicketsSold: number }> {
    const [eventsResult] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(events);
    const [ticketsResult] = await db.select({ count: sql<number>`cast(coalesce(sum(quantity_sold),0) as int)` }).from(ticketTypes);
    const [offset] = await db.select().from(platformStats).where(eq(platformStats.id, 1));
    return {
      totalEvents: (eventsResult?.count ?? 0) + (offset?.deletedEvents ?? 0),
      totalTicketsSold: (ticketsResult?.count ?? 0) + (offset?.deletedTicketsSold ?? 0),
    };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async getAllUsers(): Promise<AdminUserRow[]> {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        tier: users.tier,
        proExpiresAt: users.proExpiresAt,
        suspended: users.suspended,
        createdAt: users.createdAt,
        businessName: organizers.businessName,
        organizerId: organizers.id,
      })
      .from(users)
      .leftJoin(organizers, eq(users.id, organizers.userId))
      .orderBy(sql`${users.createdAt} DESC`);

    const eventCounts = await db
      .select({ organizerId: events.organizerId, count: sql<number>`cast(count(*) as int)` })
      .from(events)
      .groupBy(events.organizerId);
    const countMap = new Map(eventCounts.map(r => [r.organizerId, r.count]));

    return rows.map(r => ({
      id: r.id,
      email: r.email,
      role: r.role,
      tier: r.tier,
      proExpiresAt: r.proExpiresAt,
      suspended: r.suspended,
      createdAt: r.createdAt,
      businessName: r.businessName ?? null,
      eventCount: r.organizerId ? (countMap.get(r.organizerId) ?? 0) : 0,
    }));
  }

  async getAdminOrganizers(): Promise<AdminOrganizerRow[]> {
    const rows = await db
      .select({
        id: organizers.id,
        userId: organizers.userId,
        email: users.email,
        businessName: organizers.businessName,
        subaccountCode: organizers.subaccountCode,
        tier: users.tier,
        proExpiresAt: users.proExpiresAt,
        suspended: users.suspended,
        createdAt: users.createdAt,
      })
      .from(organizers)
      .innerJoin(users, eq(users.id, organizers.userId))
      .orderBy(sql`${users.createdAt} DESC`);

    const eventRows = await db
      .select({
        organizerId: events.organizerId,
        total: sql<number>`cast(count(*) as int)`,
        active: sql<number>`cast(count(case when ${events.isActive} then 1 end) as int)`,
      })
      .from(events)
      .groupBy(events.organizerId);
    const eventMap = new Map(eventRows.map(r => [r.organizerId, { total: r.total, active: r.active }]));

    const statsRows = await db
      .select({
        organizerId: ticketPurchases.organizerId,
        tickets: sql<number>`cast(coalesce(sum(${ticketPurchases.quantity}), 0) as int)`,
        revenue: sql<number>`cast(coalesce(sum(case when ${ticketPurchases.status} = 'confirmed' then ${ticketPurchases.amount} else 0 end), 0) as bigint)`,
      })
      .from(ticketPurchases)
      .where(sql`${ticketPurchases.organizerId} is not null`)
      .groupBy(ticketPurchases.organizerId);
    const statsMap = new Map(statsRows.map(r => [r.organizerId!, { tickets: r.tickets, revenue: Number(r.revenue) }]));

    return rows.map(r => {
      const evCounts = eventMap.get(r.id) ?? { total: 0, active: 0 };
      const stats = statsMap.get(r.id) ?? { tickets: 0, revenue: 0 };
      return {
        id: r.id,
        userId: r.userId,
        email: r.email,
        businessName: r.businessName,
        subaccountCode: r.subaccountCode,
        tier: r.tier,
        proExpiresAt: r.proExpiresAt,
        suspended: r.suspended,
        createdAt: r.createdAt,
        eventCount: evCounts.total,
        activeEventCount: evCounts.active,
        ticketsSold: stats.tickets,
        revenue: stats.revenue,
      };
    });
  }

  async getAdminOrganizerDetail(userId: string): Promise<AdminOrganizerDetail | null> {
    const [row] = await db
      .select({
        id: organizers.id,
        userId: organizers.userId,
        email: users.email,
        businessName: organizers.businessName,
        bankName: organizers.bankName,
        bankCode: organizers.bankCode,
        accountNumber: organizers.accountNumber,
        subaccountCode: organizers.subaccountCode,
        testSubaccountCode: organizers.testSubaccountCode,
        tier: users.tier,
        proExpiresAt: users.proExpiresAt,
        suspended: users.suspended,
        createdAt: users.createdAt,
      })
      .from(organizers)
      .innerJoin(users, eq(users.id, organizers.userId))
      .where(eq(organizers.userId, userId));

    if (!row) return null;

    const eventRows = await db
      .select({
        id: events.id,
        title: events.title,
        date: events.date,
        location: events.location,
        status: events.status,
        isActive: events.isActive,
        paymentMethod: events.paymentMethod,
        maxTickets: events.maxTickets,
        createdAt: events.createdAt,
        ticketsSold: sql<number>`cast(coalesce(sum(${ticketTypes.quantitySold}), 0) as int)`,
      })
      .from(events)
      .leftJoin(ticketTypes, eq(ticketTypes.eventId, events.id))
      .where(eq(events.organizerId, row.id))
      .groupBy(events.id)
      .orderBy(sql`${events.createdAt} DESC`);

    const revenueRows = await db
      .select({
        eventId: ticketPurchases.eventId,
        revenue: sql<number>`cast(coalesce(sum(${ticketPurchases.amount}), 0) as bigint)`,
      })
      .from(ticketPurchases)
      .innerJoin(events, eq(events.id, ticketPurchases.eventId))
      .where(and(eq(events.organizerId, row.id), eq(ticketPurchases.status, "confirmed")))
      .groupBy(ticketPurchases.eventId);
    const revenueMap = new Map(revenueRows.map(r => [r.eventId, Number(r.revenue)]));

    const eventsResult: AdminOrganizerEventRow[] = eventRows.map(e => ({
      id: e.id,
      title: e.title,
      date: e.date,
      location: e.location,
      status: e.status,
      isActive: e.isActive,
      paymentMethod: e.paymentMethod,
      maxTickets: e.maxTickets,
      ticketsSold: e.ticketsSold,
      revenue: revenueMap.get(e.id) ?? 0,
      createdAt: e.createdAt,
    }));

    const purchaseRows = await db
      .select({
        id: ticketPurchases.id,
        customerName: ticketPurchases.customerName,
        customerEmail: ticketPurchases.customerEmail,
        quantity: ticketPurchases.quantity,
        amount: ticketPurchases.amount,
        status: ticketPurchases.status,
        createdAt: ticketPurchases.createdAt,
        eventTitle: events.title,
      })
      .from(ticketPurchases)
      .innerJoin(events, eq(events.id, ticketPurchases.eventId))
      .where(eq(events.organizerId, row.id))
      .orderBy(sql`${ticketPurchases.createdAt} DESC`)
      .limit(50);

    const subRows = await db
      .select()
      .from(subscriptionReferences)
      .where(eq(subscriptionReferences.userId, userId))
      .orderBy(sql`${subscriptionReferences.fulfilledAt} DESC`);

    return {
      id: row.id,
      userId: row.userId,
      email: row.email,
      businessName: row.businessName,
      bankName: row.bankName,
      bankCode: row.bankCode,
      accountNumber: row.accountNumber,
      subaccountCode: row.subaccountCode,
      testSubaccountCode: row.testSubaccountCode,
      tier: row.tier,
      proExpiresAt: row.proExpiresAt,
      suspended: row.suspended,
      createdAt: row.createdAt,
      eventCount: eventsResult.length,
      ticketsSold: eventsResult.reduce((s, e) => s + e.ticketsSold, 0),
      revenue: eventsResult.reduce((s, e) => s + e.revenue, 0),
      events: eventsResult,
      recentPurchases: purchaseRows.map(p => ({
        id: p.id,
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        eventTitle: p.eventTitle,
        quantity: p.quantity,
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt,
      })),
      subscriptionHistory: subRows.map(s => ({
        reference: s.reference,
        plan: s.plan,
        amountKobo: s.amountKobo,
        fulfilledAt: s.fulfilledAt,
      })),
    };
  }

  async suspendUser(userId: string, suspended: boolean): Promise<User> {
    const [row] = await db.update(users).set({ suspended }).where(eq(users.id, userId)).returning();
    if (!row) throw new Error("User not found");
    return this._mapUser(row);
  }

  async getAdminSubscriptions(): Promise<{ stats: AdminSubscriptionStats; subscriptions: AdminSubscriptionRow[] }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        tier: users.tier,
        billingCycle: users.billingCycle,
        proExpiresAt: users.proExpiresAt,
        cancelledAt: users.cancelledAt,
        businessName: organizers.businessName,
      })
      .from(users)
      .leftJoin(organizers, eq(organizers.userId, users.id))
      .where(sql`${users.tier} = 'pro' OR ${users.proExpiresAt} IS NOT NULL`)
      .orderBy(sql`${users.proExpiresAt} DESC NULLS FIRST`);

    const paidRows = await db
      .select({
        userId: subscriptionReferences.userId,
        total: sql<number>`cast(coalesce(sum(${subscriptionReferences.amountKobo}), 0) as bigint)`,
      })
      .from(subscriptionReferences)
      .groupBy(subscriptionReferences.userId);
    const paidMap = new Map(paidRows.map(r => [r.userId, Number(r.total)]));

    const firstPayRows = await db
      .select({
        userId: subscriptionReferences.userId,
        firstAt: sql<string>`min(${subscriptionReferences.fulfilledAt})`,
      })
      .from(subscriptionReferences)
      .groupBy(subscriptionReferences.userId);
    const firstPayMap = new Map(firstPayRows.map(r => [r.userId, new Date(r.firstAt)]));

    const grantRows = await db
      .select({ userId: proGrants.userId, note: proGrants.note, grantedAt: proGrants.grantedAt })
      .from(proGrants)
      .orderBy(sql`${proGrants.grantedAt} DESC`);
    const grantMap = new Map<string, { note: string; grantedAt: Date }>();
    for (const g of grantRows) {
      if (!grantMap.has(g.userId)) grantMap.set(g.userId, { note: g.note, grantedAt: g.grantedAt });
    }

    const subscriptions: AdminSubscriptionRow[] = rows.map(r => {
      const expiresAt = r.proExpiresAt;
      const cancelledAt = r.cancelledAt;
      const isLifetime = r.tier === "pro" && !expiresAt && !cancelledAt;
      const isCancelled = !!cancelledAt && (!expiresAt || expiresAt > now);
      const isExpired = !!expiresAt && expiresAt <= now;
      const isActive = r.tier === "pro" && !isCancelled && !isExpired;

      let status: "active" | "cancelled" | "expired" | "lifetime";
      if (isLifetime) status = "lifetime";
      else if (isCancelled) status = "cancelled";
      else if (isActive) status = "active";
      else status = "expired";

      const grant = grantMap.get(r.id);
      let plan = r.billingCycle ?? "";
      if (!plan) plan = grant ? "granted" : (isLifetime ? "lifetime" : "monthly");
      const startedAt = firstPayMap.get(r.id) ?? grant?.grantedAt ?? null;

      return {
        userId: r.id,
        email: r.email,
        businessName: r.businessName ?? null,
        plan,
        startedAt,
        expiresAt,
        status,
        totalPaid: paidMap.get(r.id) ?? 0,
        cancelledAt: r.cancelledAt,
        grantNote: grant?.note ?? null,
      };
    });

    const activeSubscribers = subscriptions.filter(s => s.status === "active" || s.status === "lifetime").length;
    const churnedThisMonth = subscriptions.filter(s => {
      const expiredThis = s.expiresAt && s.expiresAt >= monthStart && s.expiresAt <= now;
      const cancelledThis = s.cancelledAt && new Date(s.cancelledAt) >= monthStart;
      return expiredThis || cancelledThis;
    }).length;

    const [revRow] = await db
      .select({ total: sql<number>`cast(coalesce(sum(${subscriptionReferences.amountKobo}), 0) as bigint)` })
      .from(subscriptionReferences)
      .where(sql`${subscriptionReferences.fulfilledAt} >= ${monthStart}`);
    const revenueThisMonth = Number(revRow?.total ?? 0);

    return { stats: { activeSubscribers, churnedThisMonth, revenueThisMonth }, subscriptions };
  }

  async extendSubscription(userId: string, months: number): Promise<User> {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) throw new Error("User not found");
    const base = u.proExpiresAt && u.proExpiresAt > new Date() ? u.proExpiresAt : new Date();
    const newExpiry = new Date(base.getTime() + months * 30.44 * 24 * 60 * 60 * 1000);
    const [updated] = await db.update(users)
      .set({ proExpiresAt: newExpiry, tier: "pro" })
      .where(eq(users.id, userId)).returning();
    const org = await this.getOrganizerByUserId(userId);
    if (org) await this.updateOrganizerTier(org.id, "pro");
    return this._mapUser(updated);
  }

  async upgradeToYearly(userId: string): Promise<User> {
    const newExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const [updated] = await db.update(users)
      .set({ billingCycle: "yearly", proExpiresAt: newExpiry, tier: "pro", cancelledAt: null })
      .where(eq(users.id, userId)).returning();
    if (!updated) throw new Error("User not found");
    const org = await this.getOrganizerByUserId(userId);
    if (org) await this.updateOrganizerTier(org.id, "pro");
    return this._mapUser(updated);
  }

  async grantFreePro(userId: string, grantedBy: string, note: string): Promise<User> {
    const proExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const user = await this.updateUserTier(userId, "pro", proExpiresAt);
    await db.update(users).set({ billingCycle: "granted", cancelledAt: null }).where(eq(users.id, userId));
    const org = await this.getOrganizerByUserId(userId);
    if (org) await this.updateOrganizerTier(org.id, "pro");
    await db.insert(proGrants).values({ id: randomUUID(), userId, grantedBy, note });
    return user;
  }

  async getAllEventsAdmin(): Promise<AdminEventRow[]> {
    const rows = await db
      .select({
        id: events.id,
        title: events.title,
        date: events.date,
        startTime: events.startTime,
        location: events.location,
        status: events.status,
        isActive: events.isActive,
        suspendedByAdmin: events.suspendedByAdmin,
        paymentMethod: events.paymentMethod,
        maxTickets: events.maxTickets,
        createdAt: events.createdAt,
        organizerId: events.organizerId,
        businessName: organizers.businessName,
        organizerEmail: users.email,
      })
      .from(events)
      .leftJoin(organizers, eq(events.organizerId, organizers.id))
      .leftJoin(users, eq(organizers.userId, users.id))
      .orderBy(sql`${events.date} DESC`);

    const ticketCounts = await db
      .select({ eventId: ticketTypes.eventId, sold: sql<number>`cast(coalesce(sum(quantity_sold), 0) as int)` })
      .from(ticketTypes)
      .groupBy(ticketTypes.eventId);
    const soldMap = new Map(ticketCounts.map(r => [r.eventId, r.sold]));

    const revenueRows = await db
      .select({
        eventId: ticketPurchases.eventId,
        revenue: sql<number>`cast(coalesce(sum(${ticketPurchases.amount}), 0) as bigint)`,
      })
      .from(ticketPurchases)
      .where(eq(ticketPurchases.status, "confirmed"))
      .groupBy(ticketPurchases.eventId);
    const revenueMap = new Map(revenueRows.map(r => [r.eventId, Number(r.revenue)]));

    return rows.map(r => ({
      id: r.id,
      title: r.title,
      date: r.date,
      startTime: r.startTime ?? null,
      location: r.location,
      status: r.status,
      isActive: r.isActive,
      suspendedByAdmin: r.suspendedByAdmin,
      paymentMethod: r.paymentMethod,
      maxTickets: r.maxTickets,
      createdAt: r.createdAt,
      organizerId: r.organizerId,
      businessName: r.businessName ?? 'Unknown',
      organizerEmail: r.organizerEmail ?? '',
      ticketsSold: soldMap.get(r.id) ?? 0,
      revenue: revenueMap.get(r.id) ?? 0,
    }));
  }

  async getAdminAnalytics(): Promise<AdminAnalyticsData> {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Build the 12-month label array
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    // Subscription revenue by month
    const subRevRows = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${subscriptionReferences.fulfilledAt}), 'YYYY-MM')`,
        revenue: sql<number>`cast(coalesce(sum(${subscriptionReferences.amountKobo}), 0) as bigint)`,
      })
      .from(subscriptionReferences)
      .where(sql`${subscriptionReferences.fulfilledAt} >= ${twelveMonthsAgo}`)
      .groupBy(sql`date_trunc('month', ${subscriptionReferences.fulfilledAt})`)
      .orderBy(sql`date_trunc('month', ${subscriptionReferences.fulfilledAt})`);

    // Ticket revenue + count by month
    const ticketMonthRows = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${ticketPurchases.createdAt}), 'YYYY-MM')`,
        revenue: sql<number>`cast(coalesce(sum(${ticketPurchases.amount}), 0) as bigint)`,
        count: sql<number>`cast(coalesce(sum(${ticketPurchases.quantity}), 0) as int)`,
      })
      .from(ticketPurchases)
      .where(and(eq(ticketPurchases.status, "confirmed"), sql`${ticketPurchases.createdAt} >= ${twelveMonthsAgo}`))
      .groupBy(sql`date_trunc('month', ${ticketPurchases.createdAt})`)
      .orderBy(sql`date_trunc('month', ${ticketPurchases.createdAt})`);

    const subRevMap = new Map(subRevRows.map(r => [r.month, Number(r.revenue)]));
    const ticketRevMap = new Map(ticketMonthRows.map(r => [r.month, Number(r.revenue)]));
    const ticketCountMap = new Map(ticketMonthRows.map(r => [r.month, r.count]));

    const revenueByMonth = months.map(month => ({
      month,
      subscriptionRevenue: subRevMap.get(month) ?? 0,
      ticketFeeRevenue: Math.round((ticketRevMap.get(month) ?? 0) * 0.025),
    }));

    const ticketsByMonth = months.map(month => ({
      month,
      count: ticketCountMap.get(month) ?? 0,
      revenue: ticketRevMap.get(month) ?? 0,
    }));

    // Top 5 events by tickets sold
    const topEventsRows = await db
      .select({
        id: ticketTypes.eventId,
        sold: sql<number>`cast(coalesce(sum(${ticketTypes.quantitySold}), 0) as int)`,
      })
      .from(ticketTypes)
      .groupBy(ticketTypes.eventId)
      .orderBy(sql`sum(${ticketTypes.quantitySold}) desc`)
      .limit(5);

    const topEventIds = topEventsRows.map(r => r.id).filter(Boolean);
    const topEventDetails = topEventIds.length > 0
      ? await db.select({ id: events.id, title: events.title }).from(events).where(inArray(events.id, topEventIds))
      : [];
    const topEventTitleMap = new Map(topEventDetails.map(e => [e.id, e.title]));

    const topEventRevRows = topEventIds.length > 0
      ? await db
          .select({
            eventId: ticketPurchases.eventId,
            revenue: sql<number>`cast(coalesce(sum(${ticketPurchases.amount}), 0) as bigint)`,
          })
          .from(ticketPurchases)
          .where(and(eq(ticketPurchases.status, "confirmed"), inArray(ticketPurchases.eventId, topEventIds)))
          .groupBy(ticketPurchases.eventId)
      : [];
    const topEventRevMap = new Map(topEventRevRows.map(r => [r.eventId, Number(r.revenue)]));

    const topEventsByTickets = topEventsRows.map(r => ({
      id: r.id,
      title: topEventTitleMap.get(r.id) ?? "Unknown",
      ticketsSold: r.sold,
      revenue: topEventRevMap.get(r.id) ?? 0,
    }));

    // Top 5 organizers by revenue processed
    const topOrgRows = await db
      .select({
        organizerId: ticketPurchases.organizerId,
        revenue: sql<number>`cast(coalesce(sum(${ticketPurchases.amount}), 0) as bigint)`,
        tickets: sql<number>`cast(coalesce(sum(${ticketPurchases.quantity}), 0) as int)`,
      })
      .from(ticketPurchases)
      .where(and(eq(ticketPurchases.status, "confirmed"), sql`${ticketPurchases.organizerId} is not null`))
      .groupBy(ticketPurchases.organizerId)
      .orderBy(sql`sum(${ticketPurchases.amount}) desc`)
      .limit(5);

    const topOrgIds = topOrgRows.map(r => r.organizerId!).filter(Boolean);
    const topOrgDetails = topOrgIds.length > 0
      ? await db
          .select({ id: organizers.id, businessName: organizers.businessName, email: users.email })
          .from(organizers)
          .innerJoin(users, eq(users.id, organizers.userId))
          .where(inArray(organizers.id, topOrgIds))
      : [];
    const topOrgMap = new Map(topOrgDetails.map(o => [o.id, { businessName: o.businessName, email: o.email }]));

    const topOrganizersByRevenue = topOrgRows.map(r => ({
      id: r.organizerId!,
      businessName: topOrgMap.get(r.organizerId!)?.businessName ?? "Unknown",
      email: topOrgMap.get(r.organizerId!)?.email ?? "",
      revenue: Number(r.revenue),
      ticketsSold: r.tickets,
    }));

    // Subscription growth (last 12 months, cumulative)
    const subGrowthRows = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${subscriptionReferences.fulfilledAt}), 'YYYY-MM')`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(subscriptionReferences)
      .where(sql`${subscriptionReferences.fulfilledAt} >= ${twelveMonthsAgo}`)
      .groupBy(sql`date_trunc('month', ${subscriptionReferences.fulfilledAt})`);

    const [beforeRow] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(subscriptionReferences)
      .where(sql`${subscriptionReferences.fulfilledAt} < ${twelveMonthsAgo}`);

    const subGrowthMap = new Map(subGrowthRows.map(r => [r.month, r.count]));
    let cumulative = beforeRow?.count ?? 0;
    const subscriptionGrowth = months.map(month => {
      const newSubscriptions = subGrowthMap.get(month) ?? 0;
      cumulative += newSubscriptions;
      return { month, newSubscriptions, cumulative };
    });

    // Free vs Pro ratio (among organizers)
    const tierRows = await db
      .select({ tier: users.tier, count: sql<number>`cast(count(*) as int)` })
      .from(users)
      .innerJoin(organizers, eq(organizers.userId, users.id))
      .groupBy(users.tier);
    const tierMap = new Map(tierRows.map(r => [r.tier, r.count]));
    const tierRatio = { free: tierMap.get("free") ?? 0, pro: tierMap.get("pro") ?? 0 };

    // Average tickets per event
    const [evCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(events);
    const [ttSold] = await db
      .select({ total: sql<number>`cast(coalesce(sum(${ticketTypes.quantitySold}), 0) as int)` })
      .from(ticketTypes);
    const avgTicketsPerEvent = (evCount?.count ?? 0) > 0
      ? Number(((ttSold?.total ?? 0) / evCount.count).toFixed(1))
      : 0;

    // All-time totals
    const [totalTixRev] = await db
      .select({ total: sql<number>`cast(coalesce(sum(${ticketPurchases.amount}), 0) as bigint)` })
      .from(ticketPurchases)
      .where(eq(ticketPurchases.status, "confirmed"));
    const [totalSubRev] = await db
      .select({ total: sql<number>`cast(coalesce(sum(${subscriptionReferences.amountKobo}), 0) as bigint)` })
      .from(subscriptionReferences);

    return {
      revenueByMonth,
      ticketsByMonth,
      topEventsByTickets,
      topOrganizersByRevenue,
      subscriptionGrowth,
      tierRatio,
      avgTicketsPerEvent,
      totalTicketRevenue: Number(totalTixRev?.total ?? 0),
      totalSubscriptionRevenue: Number(totalSubRev?.total ?? 0),
    };
  }

  async adminSuspendEvent(eventId: string, suspended: boolean): Promise<Event> {
    const [row] = await db.update(events)
      .set({ suspendedByAdmin: suspended })
      .where(eq(events.id, eventId))
      .returning();
    if (!row) throw new Error("Event not found");
    return this._mapEvent(row);
  }

  async adminDeleteEvent(eventId: string): Promise<void> {
    await db.delete(ticketTypes).where(eq(ticketTypes.eventId, eventId));
    await db.delete(events).where(eq(events.id, eventId));
  }

  async setUserRole(userId: string, role: string): Promise<User> {
    const [row] = await db.update(users).set({ role }).where(eq(users.id, userId)).returning();
    if (!row) throw new Error("User not found");
    return this._mapUser(row);
  }

  async getAdminStats(): Promise<AdminStats> {
    const [usersCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(users);
    const [organizersCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(organizers);
    const [eventsCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(events);
    const [activeEventsCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(events).where(eq(events.isActive, true));
    const [ticketsSold] = await db.select({ total: sql<number>`cast(coalesce(sum(quantity_sold), 0) as int)` }).from(ticketTypes);
    const [proUsers] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(users).where(eq(users.tier, "pro"));
    const [totalRevenue] = await db.select({ total: sql<number>`cast(coalesce(sum(${ticketPurchases.amount}), 0) as bigint)` }).from(ticketPurchases).where(eq(ticketPurchases.status, "confirmed"));
    const [monthlySubRevenue] = await db.select({ total: sql<number>`cast(coalesce(sum(${subscriptionReferences.amountKobo}), 0) as bigint)` }).from(subscriptionReferences).where(sql`date_trunc('month', ${subscriptionReferences.fulfilledAt}) = date_trunc('month', now())`);
    const [signupsThisWeek] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(users).where(sql`${users.createdAt} >= now() - interval '7 days'`);
    const [signupsThisMonth] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(users).where(sql`date_trunc('month', ${users.createdAt}) = date_trunc('month', now())`);
    const totalEventsCount = eventsCount?.count ?? 0;
    const activeCount = activeEventsCount?.count ?? 0;
    return {
      totalUsers: usersCount?.count ?? 0,
      totalOrganizers: organizersCount?.count ?? 0,
      totalEvents: totalEventsCount,
      activeEvents: activeCount,
      inactiveEvents: totalEventsCount - activeCount,
      totalTicketsSold: ticketsSold?.total ?? 0,
      totalRevenue: Number(totalRevenue?.total ?? 0),
      proUsers: proUsers?.count ?? 0,
      monthlySubscriptionRevenue: Number(monthlySubRevenue?.total ?? 0),
      newSignupsThisWeek: signupsThisWeek?.count ?? 0,
      newSignupsThisMonth: signupsThisMonth?.count ?? 0,
    };
  }

  async getAdminChartData(): Promise<AdminChartData> {
    const signupRows = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(users)
      .where(sql`${users.createdAt} >= now() - interval '30 days'`)
      .groupBy(sql`date_trunc('day', ${users.createdAt})`)
      .orderBy(sql`date_trunc('day', ${users.createdAt})`);

    const ticketRows = await db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${ticketPurchases.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`cast(coalesce(sum(${ticketPurchases.quantity}), 0) as int)`,
      })
      .from(ticketPurchases)
      .where(sql`${ticketPurchases.createdAt} >= now() - interval '30 days' AND ${ticketPurchases.status} = 'confirmed'`)
      .groupBy(sql`date_trunc('day', ${ticketPurchases.createdAt})`)
      .orderBy(sql`date_trunc('day', ${ticketPurchases.createdAt})`);

    const fillDays = (data: { date: string; count: number }[]) => {
      const map = new Map(data.map(d => [d.date, d.count]));
      return Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        const dateStr = d.toISOString().split("T")[0];
        return { date: dateStr, count: map.get(dateStr) ?? 0 };
      });
    };

    return {
      signupsLast30Days: fillDays(signupRows),
      ticketSalesLast30Days: fillDays(ticketRows),
    };
  }

  private _mapDiscountCode(row: typeof discountCodes.$inferSelect): DiscountCode {
    return {
      id: row.id,
      eventId: row.eventId,
      code: row.code,
      type: row.type as "percent" | "fixed",
      value: row.value,
      appliesTo: row.appliesTo as "all" | "specific",
      appliesToTicketTypeId: row.appliesToTicketTypeId ?? null,
      usageLimit: row.usageLimit ?? null,
      timesUsed: row.timesUsed,
      expiresAt: row.expiresAt ?? null,
      createdAt: row.createdAt,
    };
  }
}

export const storage = new DbStorage();
