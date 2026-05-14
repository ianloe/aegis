import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import AgentRegistry from "./pages/AgentRegistry";
import DataPolicies from "./pages/DataPolicies";
import AuditTrail from "./pages/AuditTrail";
import ApprovalQueue from "./pages/ApprovalQueue";
import RiskScoring from "./pages/RiskScoring";
import ComplianceReports from "./pages/ComplianceReports";
import ShadowAI from "./pages/ShadowAI";
import VendorTransparency from "./pages/VendorTransparency";
import LlmAnalysis from "./pages/LlmAnalysis";
import Discovery from "./pages/Discovery";
import AgentAAEF from "./pages/AgentAAEF";
import AAEFDashboard from "./pages/AAEFDashboard";
import Notifications from "./pages/Notifications";
import UserManagement from "./pages/UserManagement";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/agents" component={AgentRegistry} />
      <Route path="/policies" component={DataPolicies} />
      <Route path="/audit" component={AuditTrail} />
      <Route path="/approvals" component={ApprovalQueue} />
      <Route path="/risk" component={RiskScoring} />
      <Route path="/compliance" component={ComplianceReports} />
      <Route path="/shadow-ai" component={ShadowAI} />
      <Route path="/discovery" component={Discovery} />
      <Route path="/aaef" component={AAEFDashboard} />
      <Route path="/agents/:id/aaef" component={AgentAAEF} />
      <Route path="/vendor" component={VendorTransparency} />
      <Route path="/analysis" component={LlmAnalysis} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/users" component={UserManagement} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
