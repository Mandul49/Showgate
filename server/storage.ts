import {
  type Order, type InsertOrder, type EventConfig,
  type User, type UserRole, type UserTier,
  type Organizer, type CreateOrganizerData,
  type Event, type CreateEventData, type UpdateEventData,
  type TicketType, type CreateTicketTypeData, type UpdateTicketTypeData,
  type TicketPurchase, type CreateTicketPurchaseData,
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
  getTotalTicketsSold(): Promise<number>;
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
}

export class MemStorage implements IStorage {
  private orders: Map<string, Order> = new Map();
  private eventConfig: EventConfig = { ...DEFAULT_CONFIG };
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, string> = new Map();
  private organizers: Map<string, Organizer> = new Map();
  private organizersByUserId: Map<string, string> = new Map();
  private events: Map<string, Event> = new Map();
  private eventsByOrganizerId: Map<string, Set<string>> = new Map();
  private ticketTypes: Map<string, TicketType> = new Map();
  private ticketTypesByEventId: Map<string, Set<string>> = new Map();
  private ticketPurchases: Map<string, TicketPurchase> = new Map();
  private purchasesByReference: Map<string, string> = new Map();
  private purchasesByEventId: Map<string, Set<string>> = new Map();

  // ── Orders ───────────────────────────────────────────────────────────────

  async createOrder(insertOrder: InsertOrder, status = "confirmed"): Promise<Order> {
    const id = randomUUID();
    const order: Order = { ...insertOrder, id, status, createdAt: new Date() };
    this.orders.set(id, order);
    return order;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getTotalTicketsSold(): Promise<number> {
    return Array.from(this.orders.values()).reduce((sum, o) => sum + o.quantity, 0);
  }

  // ── Event Config ─────────────────────────────────────────────────────────

  async getEventConfig(): Promise<EventConfig> {
    return { ...this.eventConfig };
  }

  async saveEventConfig(config: EventConfig): Promise<EventConfig> {
    this.eventConfig = { ...config };
    return { ...this.eventConfig };
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async createUser(email: string, passwordHash: string, role: UserRole, tier: UserTier): Promise<User> {
    const id = randomUUID();
    const user: User = { id, email, passwordHash, role, tier, proExpiresAt: null, createdAt: new Date() };
    this.users.set(id, user);
    this.usersByEmail.set(email.toLowerCase(), id);
    return user;
  }

  async updateUserTier(userId: string, tier: UserTier, proExpiresAt: Date | null): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    const updated: User = { ...user, tier, proExpiresAt };
    this.users.set(userId, updated);
    return updated;
  }

  async getUsersWithExpiredPro(): Promise<User[]> {
    const now = new Date();
    return Array.from(this.users.values()).filter(
      (u) => u.tier === "pro" && u.proExpiresAt !== null && u.proExpiresAt <= now
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const id = this.usersByEmail.get(email.toLowerCase());
    return id ? this.users.get(id) : undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  // ── Organizers ────────────────────────────────────────────────────────────

  async createOrganizer(data: CreateOrganizerData): Promise<Organizer> {
    const id = randomUUID();
    const organizer: Organizer = { ...data, id, createdAt: new Date() };
    this.organizers.set(id, organizer);
    this.organizersByUserId.set(data.userId, id);
    return organizer;
  }

  async getOrganizerByUserId(userId: string): Promise<Organizer | undefined> {
    const id = this.organizersByUserId.get(userId);
    return id ? this.organizers.get(id) : undefined;
  }

  async getOrganizerById(id: string): Promise<Organizer | undefined> {
    return this.organizers.get(id);
  }

  async updateOrganizerTier(organizerId: string, tier: UserTier): Promise<Organizer> {
    const org = this.organizers.get(organizerId);
    if (!org) throw new Error("Organizer not found");
    const updated: Organizer = { ...org, tier };
    this.organizers.set(organizerId, updated);
    return updated;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async createEvent(data: CreateEventData): Promise<Event> {
    const id = randomUUID();
    const event: Event = { ...data, id, createdAt: new Date() };
    this.events.set(id, event);
    if (!this.eventsByOrganizerId.has(data.organizerId)) {
      this.eventsByOrganizerId.set(data.organizerId, new Set());
    }
    this.eventsByOrganizerId.get(data.organizerId)!.add(id);
    return event;
  }

  async getEventsByOrganizerId(organizerId: string): Promise<Event[]> {
    const ids = this.eventsByOrganizerId.get(organizerId) ?? new Set<string>();
    return Array.from(ids)
      .map((id) => this.events.get(id))
      .filter((e): e is Event => !!e)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getEventById(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async updateEvent(id: string, updates: UpdateEventData): Promise<Event> {
    const event = this.events.get(id);
    if (!event) throw new Error("Event not found");
    const updated: Event = { ...event, ...updates };
    this.events.set(id, updated);
    return updated;
  }

  // ── Ticket Types ──────────────────────────────────────────────────────────

  async createTicketType(data: CreateTicketTypeData): Promise<TicketType> {
    const id = randomUUID();
    const tt: TicketType = { ...data, id, quantitySold: 0, createdAt: new Date() };
    this.ticketTypes.set(id, tt);
    if (!this.ticketTypesByEventId.has(data.eventId)) {
      this.ticketTypesByEventId.set(data.eventId, new Set());
    }
    this.ticketTypesByEventId.get(data.eventId)!.add(id);
    return tt;
  }

  async getTicketTypesByEventId(eventId: string): Promise<TicketType[]> {
    const ids = this.ticketTypesByEventId.get(eventId) ?? new Set<string>();
    return Array.from(ids)
      .map((id) => this.ticketTypes.get(id))
      .filter((t): t is TicketType => !!t);
  }

  async getTicketTypeById(id: string): Promise<TicketType | undefined> {
    return this.ticketTypes.get(id);
  }

  async updateTicketType(id: string, updates: UpdateTicketTypeData): Promise<TicketType> {
    const tt = this.ticketTypes.get(id);
    if (!tt) throw new Error("Ticket type not found");
    const updated: TicketType = { ...tt, ...updates };
    this.ticketTypes.set(id, updated);
    return updated;
  }

  async incrementTicketTypeSold(id: string, quantity: number): Promise<TicketType> {
    const tt = this.ticketTypes.get(id);
    if (!tt) throw new Error("Ticket type not found");
    const updated: TicketType = { ...tt, quantitySold: tt.quantitySold + quantity };
    this.ticketTypes.set(id, updated);
    return updated;
  }

  // ── Ticket Purchases ──────────────────────────────────────────────────────

  async createTicketPurchase(data: CreateTicketPurchaseData): Promise<TicketPurchase> {
    const id = randomUUID();
    const purchase: TicketPurchase = { ...data, id, createdAt: new Date() };
    this.ticketPurchases.set(id, purchase);
    this.purchasesByReference.set(data.reference, id);
    if (!this.purchasesByEventId.has(data.eventId)) {
      this.purchasesByEventId.set(data.eventId, new Set());
    }
    this.purchasesByEventId.get(data.eventId)!.add(id);
    return purchase;
  }

  async getTicketPurchaseByReference(reference: string): Promise<TicketPurchase | undefined> {
    const id = this.purchasesByReference.get(reference);
    return id ? this.ticketPurchases.get(id) : undefined;
  }

  async getTicketPurchasesByEventId(eventId: string): Promise<TicketPurchase[]> {
    const ids = this.purchasesByEventId.get(eventId) ?? new Set<string>();
    return Array.from(ids)
      .map((id) => this.ticketPurchases.get(id))
      .filter((p): p is TicketPurchase => !!p)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export const storage = new MemStorage();
