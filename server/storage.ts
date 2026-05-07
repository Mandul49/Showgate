import { type Order, type InsertOrder, type EventConfig, type TicketTier } from "@shared/schema";
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
  paystackPublicKey: "",
  paystackSecretKey: "",
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
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getTotalTicketsSold(): Promise<number>;
  getEventConfig(): Promise<EventConfig>;
  saveEventConfig(config: EventConfig): Promise<EventConfig>;
}

export class MemStorage implements IStorage {
  private orders: Map<string, Order>;
  private eventConfig: EventConfig;

  constructor() {
    this.orders = new Map();
    this.eventConfig = { ...DEFAULT_CONFIG };
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = randomUUID();
    const order: Order = {
      ...insertOrder,
      id,
      status: "confirmed",
      createdAt: new Date(),
    };
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
    const orders = Array.from(this.orders.values());
    return orders.reduce((sum, o) => sum + o.quantity, 0);
  }

  async getEventConfig(): Promise<EventConfig> {
    return { ...this.eventConfig };
  }

  async saveEventConfig(config: EventConfig): Promise<EventConfig> {
    this.eventConfig = { ...config };
    return { ...this.eventConfig };
  }
}

export const storage = new MemStorage();
