import { useRef, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import VerifyEmail from "@/pages/verify-email";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
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
  );
}

function MaintenanceBanner() {
  const [location] = useLocation();
  const bannerRef = useRef<HTMLDivElement>(null);
  const { data } = useQuery<{ maintenanceMode: boolean; feePercent: number }>({
    queryKey: ["/api/settings/public"],
    staleTime: 60_000,
  });

  const isVisible = !location.startsWith("/admin") && !!data?.maintenanceMode;

  useEffect(() => {
    const el = bannerRef.current;
    if (!isVisible || !el) {
      document.documentElement.style.setProperty("--maintenance-h", "0px");
      return;
    }
    const update = () =>
      document.documentElement.style.setProperty("--maintenance-h", `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isVisible]);

  if (!isVisible) return null;
  return (
    <div ref={bannerRef} className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black text-sm font-semibold text-center py-2.5 px-4 shadow-lg">
      🚧 We're currently under maintenance. Some features may be temporarily unavailable. We'll be back soon.
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <MaintenanceBanner />
        <div style={{ paddingTop: "var(--maintenance-h, 0px)" }}>
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
