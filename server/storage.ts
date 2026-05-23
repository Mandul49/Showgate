import { type Order, type InsertOrder, type EventConfig, type User, type UserRole, type UserTier } from "@shared/schema";
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
}

export class MemStorage implements IStorage {
  private orders: Map<string, Order>;
  private eventConfig: EventConfig;
  private users: Map<string, User>;
  private usersByEmail: Map<string, string>; // email → id

  constructor() {
    this.orders = new Map();
    this.eventConfig = { ...DEFAULT_CONFIG };
    this.users = new Map();
    this.usersByEmail = new Map();
  }

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
    const user: User = { id, email, passwordHash, role, tier, createdAt: new Date() };
    this.users.set(id, user);
    this.usersByEmail.set(email.toLowerCase(), id);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const id = this.usersByEmail.get(email.toLowerCase());
    if (!id) return undefined;
    return this.users.get(id);
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }
}

export const storage = new MemStorage();
