import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Landing from "@/pages/landing";
import { AppLayout } from "@/pages/app/layout";
import Dashboard from "@/pages/app/dashboard";
import AppSessions from "@/pages/app/sessions";
import AppWallet from "@/pages/app/wallet";
import AppRelay from "@/pages/app/relay";
import IntelHub from "@/pages/app/intel";
import DocsPage from "@/pages/docs";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function AppShell() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/app/dashboard" component={Dashboard} />
        <Route path="/app/sessions" component={AppSessions} />
        <Route path="/app/wallet" component={AppWallet} />
        <Route path="/app/relay" component={AppRelay} />
        <Route path="/app/intel" component={IntelHub} />
        <Route path="/app">
          <Redirect to="/app/dashboard" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/docs" component={DocsPage} />
      <Route path="/app/:rest*" component={AppShell} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
