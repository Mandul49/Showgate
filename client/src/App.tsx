import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Success from "@/pages/success";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import CheckYourEmail from "@/pages/check-your-email";
import ResendVerification from "@/pages/resend-verification";
import VerifyEmail from "@/pages/verify-email";
import Profile from "@/pages/profile";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Pricing from "@/pages/pricing";
import UpgradeSuccess from "@/pages/upgrade-success";
import EventPage from "@/pages/event-page";
import PurchaseSuccess from "@/pages/purchase-success";
import Analytics from "@/pages/analytics";
import Subscription from "@/pages/subscription";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/e/:id" component={EventPage} />
      <Route path="/purchase-success" component={PurchaseSuccess} />
      <Route path="/success" component={Success} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/check-your-email" component={CheckYourEmail} />
      <Route path="/resend-verification" component={ResendVerification} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/profile" component={Profile} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/upgrade-success" component={UpgradeSuccess} />
      <Route path="/analytics/:eventId" component={Analytics} />
      <Route path="/subscription" component={Subscription} />
      <Route path="/admin">
        <Redirect to="/dashboard" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
