import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletBridge } from "@/components/wallet-bridge";
import { StallListener } from "@/components/stall-listener";
import { registerProxySW } from "@/lib/proxy";

import Landing from "@/pages/landing";
import { AppLayout } from "@/pages/app/layout";
import Dashboard from "@/pages/app/dashboard";
import AppSessions from "@/pages/app/sessions";
import AppWallet from "@/pages/app/wallet";
import IntelHub from "@/pages/app/intel";
import RemoteSession from "@/pages/app/remote";
import Trading from "@/pages/app/trading";
import Chart from "@/pages/app/chart";
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
        <Route path="/app/relay">
          <Redirect to="/app/sessions" />
        </Route>
        <Route path="/app/intel" component={IntelHub} />
        <Route path="/app/remote" component={RemoteSession} />
        <Route path="/app/trading" component={Trading} />
        <Route path="/app/chart" component={Chart} />
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
  useEffect(() => {
    registerProxySW().catch(() => {
      /* SW unsupported or blocked — proxy launch will surface the error */
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <WalletBridge />
        <StallListener />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
