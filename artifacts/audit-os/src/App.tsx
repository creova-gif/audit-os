import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { MainLayout } from "@/components/layout/main-layout";

import DashboardPage from "@/pages/dashboard";
import EngagementsPage from "@/pages/engagements";
import EngagementDetailPage from "@/pages/engagement-detail";
import AnomaliesPage from "@/pages/anomalies";
import AnomalyDetailPage from "@/pages/anomaly-detail";
import FindingsPage from "@/pages/findings";
import FindingDetailPage from "@/pages/finding-detail";
import WorkingPapersPage from "@/pages/working-papers";
import WorkingPaperDetailPage from "@/pages/working-paper-detail";
import ClientsPage from "@/pages/clients";
import ClientDetailPage from "@/pages/client-detail";
import DataRoomPage from "@/pages/data-room";
import LedgerIngestionPage from "@/pages/ledger-ingestion";
import ClientPortalPage from "@/pages/client-portal";

const queryClient = new QueryClient();

function Router() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        <Route path="/dashboard" component={DashboardPage} />
        
        <Route path="/engagements" component={EngagementsPage} />
        <Route path="/engagements/:id" component={EngagementDetailPage} />
        
        <Route path="/anomalies" component={AnomaliesPage} />
        <Route path="/anomalies/:id" component={AnomalyDetailPage} />
        
        <Route path="/findings" component={FindingsPage} />
        <Route path="/findings/:id" component={FindingDetailPage} />
        
        <Route path="/working-papers" component={WorkingPapersPage} />
        <Route path="/working-papers/:id" component={WorkingPaperDetailPage} />
        
        <Route path="/clients" component={ClientsPage} />
        <Route path="/clients/:id" component={ClientDetailPage} />
        
        <Route path="/data-room" component={DataRoomPage} />
        <Route path="/ledger-ingestion" component={LedgerIngestionPage} />
        <Route path="/client-portal" component={ClientPortalPage} />

        <Route component={NotFound} />
      </Switch>
    </MainLayout>
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
