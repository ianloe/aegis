import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Bot,
  Eye,
  Brain,
  ClipboardCheck,
  TrendingUp,
  ArrowRight,
  Activity,
  Lock,
  FileText,
} from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

const features = [
  { icon: Bot, title: "Agent Registry", description: "Register, classify, and manage AI agents with lifecycle controls and least-privilege access profiles." },
  { icon: Eye, title: "Audit Trail", description: "Immutable, tamper-evident log collection with structured search across all agent actions and data access events." },
  { icon: ClipboardCheck, title: "Approval Queue", description: "Human-in-the-loop workflows for high-risk actions including data deletion, financial transactions, and external communications." },
  { icon: TrendingUp, title: "Risk Scoring", description: "Per-agent risk scores calculated from access scope, action frequency, data sensitivity, and anomaly signals." },
  { icon: Brain, title: "LLM Analysis", description: "AI-powered log analysis that flags suspicious patterns and generates plain-English risk summaries with remediation guidance." },
  { icon: FileText, title: "Compliance Reports", description: "Automated compliance checklists and reports aligned with PDPA, EU AI Act, and MAS guidelines." },
];

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="font-bold text-foreground">Aegis</span>
              <span className="text-muted-foreground text-xs ml-2">AI Governance Platform</span>
            </div>
          </div>
          <Button asChild size="sm">
            <a href={getLoginUrl()}>Sign In <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></a>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <Badge variant="outline" className="mb-6 text-primary border-primary/30 bg-primary/5 text-xs">
          <Activity className="w-3 h-3 mr-1.5" />
          Enterprise AI Governance
        </Badge>
        <h1 className="text-5xl font-bold text-foreground mb-6 leading-tight">
          Govern your AI agents<br />
          <span className="text-primary">with confidence</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Aegis gives security teams full visibility and control over every AI agent operating within their organisation — from deployment to decommission.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button asChild size="lg" className="px-8">
            <a href={getLoginUrl()}>Get Started <ArrowRight className="w-4 h-4 ml-2" /></a>
          </Button>
          <Button variant="outline" size="lg" className="px-8 bg-transparent">
            <Lock className="w-4 h-4 mr-2" />
            Enterprise Security
          </Button>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-3 gap-8 text-center">
          {[
            { label: "Compliance Frameworks", value: "3", sub: "PDPA · EU AI Act · MAS" },
            { label: "Data Sensitivity Tiers", value: "3", sub: "Benign · Internal · Sensitive" },
            { label: "RBAC Roles", value: "3", sub: "Admin · Analyst · Viewer" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold text-primary mb-1">{stat.value}</p>
              <p className="text-sm font-medium text-foreground mb-0.5">{stat.label}</p>
              <p className="text-xs text-muted-foreground">{stat.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Everything you need to govern AI</h2>
          <p className="text-muted-foreground">A complete platform built for security teams managing AI deployments at scale.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="glass-card rounded-xl p-6 stat-card">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Ready to secure your AI deployments?</h2>
          <p className="text-muted-foreground mb-6">Join organisations using Aegis to maintain governance, compliance, and control over their AI agents.</p>
          <Button asChild size="lg">
            <a href={getLoginUrl()}>Access Dashboard <ArrowRight className="w-4 h-4 ml-2" /></a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <p>Aegis AI Governance Platform &mdash; Built for enterprise security teams</p>
      </footer>
    </div>
  );
}
