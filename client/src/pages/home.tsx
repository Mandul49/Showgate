import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Calendar, Clock, Ticket, Plus, Minus, ShoppingCart,
  User, Mail, Phone, CreditCard, Star, Zap, Crown, X, ChevronRight
} from "lucide-react";

const EVENT = {
  name: "Musick & Tea 11",
  theme: "The Name of Jesus",
  date: "Sunday, December 13, 2026",
  time: "3:00 PM",
  venue: "Odillins Event Center",
  description: "An evening of worship, music, and fellowship centred on the Name above all names. Come and be refreshed.",
};

const TICKET_TYPES = [
  {
    id: "regular",
    name: "Regular",
    price: 2000,
    description: "Entry ticket to the Musick & Tea 11 concert",
    icon: Ticket,
    color: "from-blue-500 to-blue-600",
    badge: "General",
    perks: ["Full concert access", "Event programme", "Welcome refreshment"],
    ticketsIncluded: 1,
  },
  {
    id: "vip-support",
    name: "VIP Support",
    price: 100000,
    description: "Support the vision and enjoy an elevated experience",
    icon: Crown,
    color: "from-amber-500 to-orange-500",
    badge: "Exclusive",
    perks: ["2 concert tickets included", "Reserved seating", "Special Musick & Tea package", "Recognition in event programme"],
    ticketsIncluded: 2,
  },
];

interface CartItem {
  ticketType: typeof TICKET_TYPES[0];
  quantity: number;
}

const checkoutSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email address"),
  customerPhone: z.string().min(10, "Please enter a valid phone number"),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

const TAX_RATE = 0.075;

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Home() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "" },
  });

  const subtotal = cart.reduce((sum, item) => sum + item.ticketType.price * item.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;
  const totalTickets = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(ticketType: typeof TICKET_TYPES[0]) {
    setCart((prev) => {
      const existing = prev.find((i) => i.ticketType.id === ticketType.id);
      if (existing) {
        return prev.map((i) =>
          i.ticketType.id === ticketType.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ticketType, quantity: 1 }];
    });
    toast({ title: "Added to cart", description: `${ticketType.name} ticket added.` });
  }

  function updateQuantity(ticketId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => i.ticketType.id === ticketId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0)
    );
  }

  function removeFromCart(ticketId: string) {
    setCart((prev) => prev.filter((i) => i.ticketType.id !== ticketId));
  }

  const orderMutation = useMutation({
    mutationFn: async (data: CheckoutForm) => {
      const results = [];
      for (const item of cart) {
        const res = await apiRequest("POST", "/api/orders", {
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          ticketType: item.ticketType.name,
          quantity: item.quantity,
          totalAmount: item.ticketType.price * item.quantity + Math.round(item.ticketType.price * item.quantity * TAX_RATE),
        });
        results.push(await res.json());
      }
      return results;
    },
    onSuccess: (orders) => {
      navigate(`/success?orderId=${orders[0].id}&name=${encodeURIComponent(form.getValues("customerName"))}&total=${total}&tickets=${totalTickets}`);
    },
    onError: (err: any) => {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    },
  });

  function onSubmit(data: CheckoutForm) {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", description: "Please add at least one ticket.", variant: "destructive" });
      return;
    }
    orderMutation.mutate(data);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-slate-100">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 text-white">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="relative max-w-4xl mx-auto px-4 py-12 sm:py-16">
          <div className="flex items-center gap-2 mb-4">
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
              <Zap className="w-3 h-3 mr-1" /> Limited Tickets Available
            </Badge>
          </div>
          <p className="text-amber-300 text-sm font-semibold uppercase tracking-widest mb-2">Theme: {EVENT.theme}</p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-3 tracking-tight">{EVENT.name}</h1>
          <p className="text-purple-200 text-lg mb-6 max-w-xl">{EVENT.description}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <Calendar className="w-4 h-4 text-purple-300" />
              <span>{EVENT.date}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <Clock className="w-4 h-4 text-purple-300" />
              <span>{EVENT.time}</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <MapPin className="w-4 h-4 text-purple-300" />
              <span>{EVENT.venue}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Ticket Selection */}
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Select Your Tickets</h2>
          <p className="text-slate-500 mb-6">Choose the experience that's right for you</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
            {TICKET_TYPES.map((ticket) => {
              const Icon = ticket.icon;
              const cartItem = cart.find((i) => i.ticketType.id === ticket.id);
              return (
                <Card key={ticket.id} className={`relative overflow-hidden border-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${cartItem ? "border-purple-400 shadow-purple-100 shadow-md" : "border-transparent"}`}>
                  <div className={`h-2 bg-gradient-to-r ${ticket.color}`} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-r ${ticket.color}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <Badge variant="secondary" className="text-xs font-medium">{ticket.badge}</Badge>
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">{ticket.name}</h3>
                    <p className="text-slate-500 text-sm mt-1 mb-3">{ticket.description}</p>
                    <ul className="space-y-1 mb-4">
                      {ticket.perks.map((perk) => (
                        <li key={perk} className="flex items-center gap-2 text-xs text-slate-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                          {perk}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto">
                      <p className="text-2xl font-bold text-slate-800">{formatPrice(ticket.price)}</p>
                      <p className="text-xs text-slate-400 mb-3">
                        {ticket.ticketsIncluded > 1 ? `includes ${ticket.ticketsIncluded} tickets` : "per ticket"}
                      </p>
                      {cartItem ? (
                        <div className="flex items-center gap-3">
                          <button onClick={() => updateQuantity(ticket.id, -1)}
                            className="w-8 h-8 rounded-full border-2 border-purple-300 flex items-center justify-center text-purple-600 hover:bg-purple-50 transition-colors">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-bold text-slate-800 w-4 text-center">{cartItem.quantity}</span>
                          <button onClick={() => updateQuantity(ticket.id, 1)}
                            className="w-8 h-8 rounded-full border-2 border-purple-300 flex items-center justify-center text-purple-600 hover:bg-purple-50 transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <Button onClick={() => addToCart(ticket)} className="w-full" variant="outline">
                          <Plus className="w-4 h-4 mr-1" /> Add to Cart
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Cart */}
        {cart.length > 0 && (
          <Card className="border-purple-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <ShoppingCart className="w-5 h-5 text-purple-600" />
                Your Cart
                <Badge className="ml-auto bg-purple-100 text-purple-700 border-0">{totalTickets} ticket{totalTickets !== 1 ? "s" : ""}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.map((item) => (
                <div key={item.ticketType.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md bg-gradient-to-r ${item.ticketType.color}`}>
                      <item.ticketType.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{item.ticketType.name}</p>
                      <p className="text-xs text-slate-500">{formatPrice(item.ticketType.price)} × {item.quantity}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-800">{formatPrice(item.ticketType.price * item.quantity)}</span>
                    <button onClick={() => removeFromCart(item.ticketType.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax (7.5%)</span>
                  <span>{formatPrice(tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 text-base pt-1">
                  <span>Total</span>
                  <span className="text-purple-700">{formatPrice(total)}</span>
                </div>
              </div>
              <Button
                onClick={() => setShowCheckout(true)}
                className="w-full mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-3"
                size="lg"
              >
                Proceed to Checkout <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Checkout Form */}
        {showCheckout && cart.length > 0 && (
          <Card className="border-purple-100 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800">
                <CreditCard className="w-5 h-5 text-purple-600" />
                Complete Your Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input {...field} placeholder="Your full name" className="pl-10" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 font-medium">Phone Number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <Input {...field} placeholder="+234 xxx xxx xxxx" className="pl-10" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 font-medium">Email Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input {...field} type="email" placeholder="your@email.com" className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-amber-800 text-sm font-medium flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Payment on Arrival
                    </p>
                    <p className="text-amber-700 text-xs mt-1">Your ticket will be reserved. Payment ({formatPrice(total)}) is collected at the venue gate.</p>
                  </div>

                  <Button
                    type="submit"
                    disabled={orderMutation.isPending}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-3"
                    size="lg"
                  >
                    {orderMutation.isPending ? (
                      <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Ticket className="w-4 h-4" /> Confirm Reservation — {formatPrice(total)}</span>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Footer Note */}
        <p className="text-center text-slate-400 text-sm pb-4">
          Tickets are non-refundable. Please arrive 30 minutes before the event starts.
        </p>
      </div>
    </div>
  );
}
