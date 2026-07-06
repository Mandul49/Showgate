import { useRef, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sun, Moon, Wrench } from "lucide-react";
import { useTheme } from "@/lib/theme";
import Home from "@/pages/home";
import Success from "@/pages/success";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Profile from "@/pages/profile";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Pricing from "@/pages/pricing";
import UpgradeSuccess from "@/pages/upgrade-success";
import EventPage from "@/pages/event-page";
import PurchaseSuccess from "@/pages/purchase-success";
import Analytics from "@/pages/analytics";
import Subscription from "@/pages/subscription";
import AdminPanel from "@/pages/admin-panel";
import AdminOrganizers from "@/pages/admin-organizers";
import AdminOrganizerDetail from "@/pages/admin-organizer-detail";
import AdminSubscriptions from "@/pages/admin-subscriptions";
import AdminEvents from "@/pages/admin-events";
import AdminAnalytics from "@/pages/admin-analytics";
import AdminSettings from "@/pages/admin-settings";
import AdminTeam from "@/pages/admin-team";
import About from "@/pages/about";
import EventsPage from "@/pages/events";
import Privacy from "@/pages/privacy";
import VerifyEmail from "@/pages/verify-email";
import NotFound from "@/pages/not-found";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const raf = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(raf);
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/events" component={EventsPage} />
        <Route path="/about" component={About} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/e/:id" component={EventPage} />
        <Route path="/purchase-success" component={PurchaseSuccess} />
        <Route path="/success" component={Success} />
        <Route path="/login" component={Login} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/profile" component={Profile} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/upgrade-success" component={UpgradeSuccess} />
        <Route path="/analytics/:eventId" component={Analytics} />
        <Route path="/subscription" component={Subscription} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/admin/organizers" component={AdminOrganizers} />
        <Route path="/admin/organizers/:id" component={AdminOrganizerDetail} />
        <Route path="/admin/subscriptions" component={AdminSubscriptions} />
        <Route path="/admin/events" component={AdminEvents} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route path="/admin/team" component={AdminTeam} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function MaintenancePage() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-zinc-950 text-white px-6">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-8">
          <Wrench className="w-9 h-9 text-amber-400" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight mb-3">Under Maintenance</h1>
        <p className="text-zinc-400 text-base leading-relaxed mb-8">
          We're making some improvements to Showgate. We'll be back shortly — thanks for your patience.
        </p>
        <div className="flex items-center gap-2 text-xs text-zinc-600 uppercase tracking-widest font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Work in progress
        </div>
      </div>
    </div>
  );
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data, isLoading } = useQuery<{ maintenanceMode: boolean }>({
    queryKey: ["/api/settings/public"],
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const isAdminRoute = location.startsWith("/admin");

  if (isAdminRoute) return <>{children}</>;
  if (isLoading) return null;
  if (data?.maintenanceMode) return <MaintenancePage />;
  return <>{children}</>;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-6 right-6 z-[9998] w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-colors"
      style={{
        backgroundColor: theme === "dark" ? "#27272a" : "#ffffff",
        border: theme === "dark" ? "1px solid #3f3f46" : "1px solid #e5e7eb",
      }}
      aria-label="Toggle theme"
    >
      {theme === "dark"
        ? <Sun className="w-4 h-4 text-amber-400" />
        : <Moon className="w-4 h-4 text-zinc-500" />
      }
    </button>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <ThemeToggle />
        <MaintenanceGate>
          <Router />
        </MaintenanceGate>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
