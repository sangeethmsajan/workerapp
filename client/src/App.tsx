import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import Tasks from "@/pages/Tasks";
import Team from "@/pages/Team";
import Attendance from "@/pages/Attendance";
import Payroll from "@/pages/Payroll";
import Expenses from "@/pages/Expenses";
import Invoices from "@/pages/Invoices";
import Analytics from "@/pages/Analytics";
import SettingsPage from "@/pages/SettingsPage";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import UsersPage from "@/pages/Users";
import { AuthProvider, RequireAuth, RequireAdmin, useAuth } from "@/lib/auth";
import OnboardingPage from "@/pages/OnboardingPage";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import type { Settings } from "@shared/schema";

function ProtectedApp() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    enabled: !!user,
  });

  useEffect(() => {
    if (user && !isLoading && settings && settings.onboarded === 0 && location !== "/onboarding") {
      setLocation("/onboarding");
    }
  }, [user, settings, isLoading, location, setLocation]);

  if (user && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading settings…</div>
      </div>
    );
  }

  return (
    <RequireAuth>
      <Switch>
        <Route path="/onboarding" component={OnboardingPage} />
        <Route>
          <AppLayout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/projects" component={Projects} />
              <Route path="/tasks" component={Tasks} />
              <Route path="/team" component={Team} />
              <Route path="/attendance" component={Attendance} />
              <Route path="/payroll" component={Payroll} />
              <Route path="/expenses" component={Expenses} />
              <Route path="/invoices" component={Invoices} />
              <Route path="/analytics" component={Analytics} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/users">
                <RequireAdmin>
                  <UsersPage />
                </RequireAdmin>
              </Route>
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </Route>
      </Switch>
    </RequireAuth>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route>
        <ProtectedApp />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
