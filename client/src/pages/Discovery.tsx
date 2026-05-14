import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  FileSearch,
  Network,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = "low" | "medium" | "high" | "critical";
type FindingStatus = "new" | "reviewed" | "promoted_agent" | "added_shadow" | "dismissed";
type Confidence = "low" | "medium" | "high";

interface Finding {
  id: number;
  toolName: string;
  vendor: string | null;
  category: string | null;
  endpoint: string | null;
  detectionMethod: string;
  confidence: Confidence;
  evidence: string | null;
  riskLevel: RiskLevel;
  riskRationale: string | null;
  status: FindingStatus;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISK_COLOURS: Record<RiskLevel, string> = {
  low: "text-green-400 border-green-400/30 bg-green-400/5",
  medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
  high: "text-orange-400 border-orange-400/30 bg-orange-400/5",
  critical: "text-red-400 border-red-400/30 bg-red-400/5",
};

const CONFIDENCE_COLOURS: Record<Confidence, string> = {
  low: "text-muted-foreground border-border",
  medium: "text-blue-400 border-blue-400/30 bg-blue-400/5",
  high: "text-cyan-400 border-cyan-400/30 bg-cyan-400/5",
};

const STATUS_LABELS: Record<FindingStatus, { label: string; colour: string }> = {
  new: { label: "New", colour: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5" },
  reviewed: { label: "Reviewed", colour: "text-blue-400 border-blue-400/30 bg-blue-400/5" },
  promoted_agent: { label: "Registered", colour: "text-green-400 border-green-400/30 bg-green-400/5" },
  added_shadow: { label: "Shadow AI", colour: "text-orange-400 border-orange-400/30 bg-orange-400/5" },
  dismissed: { label: "Dismissed", colour: "text-muted-foreground border-border" },
};

const METHOD_LABELS: Record<string, string> = {
  dns_probe: "DNS Probe",
  http_probe: "HTTP Probe",
  log_pattern: "Log Pattern",
  audit_pattern: "Audit Pattern",
  llm_extraction: "LLM Extraction",
};

// ─── Finding Card ─────────────────────────────────────────────────────────────

function FindingCard({
  finding,
  onPromoteAgent,
  onPromoteShadow,
  onDismiss,
}: {
  finding: Finding;
  onPromoteAgent: (f: Finding) => void;
  onPromoteShadow: (f: Finding) => void;
  onDismiss: (f: Finding) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isActionable = finding.status === "new" || finding.status === "reviewed";

  return (
    <Card className={`border transition-all ${finding.riskLevel === "critical" ? "border-red-400/30 bg-red-400/3" : finding.riskLevel === "high" ? "border-orange-400/20 bg-orange-400/3" : "glass-card border-border"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Risk icon */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${finding.riskLevel === "critical" ? "bg-red-400/10 border border-red-400/20" : finding.riskLevel === "high" ? "bg-orange-400/10 border border-orange-400/20" : finding.riskLevel === "medium" ? "bg-yellow-400/10 border border-yellow-400/20" : "bg-green-400/10 border border-green-400/20"}`}>
            {finding.riskLevel === "critical" || finding.riskLevel === "high"
              ? <ShieldAlert className={`w-4 h-4 ${finding.riskLevel === "critical" ? "text-red-400" : "text-orange-400"}`} />
              : <ShieldCheck className={`w-4 h-4 ${finding.riskLevel === "medium" ? "text-yellow-400" : "text-green-400"}`} />}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-semibold text-foreground">{finding.toolName}</span>
              {finding.vendor && <span className="text-xs text-muted-foreground">by {finding.vendor}</span>}
              <Badge variant="outline" className={`text-[10px] ${RISK_COLOURS[finding.riskLevel]}`}>
                {finding.riskLevel.toUpperCase()}
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${CONFIDENCE_COLOURS[finding.confidence]}`}>
                {finding.confidence} confidence
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${STATUS_LABELS[finding.status].colour}`}>
                {STATUS_LABELS[finding.status].label}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2">
              {finding.category && <span>{finding.category}</span>}
              {finding.endpoint && <span className="font-mono">{finding.endpoint}</span>}
              <span>{METHOD_LABELS[finding.detectionMethod] ?? finding.detectionMethod}</span>
              <span>{new Date(finding.createdAt).toLocaleDateString("en-GB")}</span>
            </div>

            {/* Expandable detail */}
            <button
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {expanded ? "Hide detail" : "Show detail"}
            </button>

            {expanded && (
              <div className="mt-2 space-y-2">
                {finding.riskRationale && (
                  <div className="p-2 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Risk Rationale</p>
                    <p className="text-xs text-foreground">{finding.riskRationale}</p>
                  </div>
                )}
                {finding.evidence && (
                  <div className="p-2 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Evidence</p>
                    <p className="text-xs text-foreground font-mono break-all">{finding.evidence}</p>
                  </div>
                )}
                {finding.reviewNote && (
                  <div className="p-2 rounded-lg bg-muted/30 border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Review Note</p>
                    <p className="text-xs text-foreground">{finding.reviewNote} {finding.reviewedBy && `— ${finding.reviewedBy}`}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          {isActionable && (
            <div className="shrink-0 flex flex-col gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] h-7 px-2 bg-transparent text-blue-400 border-blue-400/30 hover:bg-blue-400/10 whitespace-nowrap"
                onClick={() => onPromoteAgent(finding)}
              >
                <Bot className="w-3 h-3 mr-1" />Register Agent
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] h-7 px-2 bg-transparent text-orange-400 border-orange-400/30 hover:bg-orange-400/10 whitespace-nowrap"
                onClick={() => onPromoteShadow(finding)}
              >
                <AlertTriangle className="w-3 h-3 mr-1" />Shadow AI
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] h-7 px-2 bg-transparent text-muted-foreground border-border hover:bg-muted/20 whitespace-nowrap"
                onClick={() => onDismiss(finding)}
              >
                <XCircle className="w-3 h-3 mr-1" />Dismiss
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Discovery() {
  const [activeTab, setActiveTab] = useState("findings");
  const [logText, setLogText] = useState("");
  const [statusFilter, setStatusFilter] = useState<FindingStatus | "all">("all");

  // Promote to agent dialog state
  const [promoteAgentFinding, setPromoteAgentFinding] = useState<Finding | null>(null);
  const [agentForm, setAgentForm] = useState({ name: "", description: "", owner: "", maxDataTier: "benign" as "benign" | "internal" | "sensitive" });

  // Dismiss dialog state
  const [dismissFinding, setDismissFinding] = useState<Finding | null>(null);
  const [dismissNote, setDismissNote] = useState("");

  // Pi-hole connector state
  const [piholeUrl, setPiholeUrl] = useState("http://10.0.5.24");
  const [piholePassword, setPiholePassword] = useState("");
  const [piholeEnabled, setPiholeEnabled] = useState(false);
  const [piholeSettingsSaved, setPiholeSettingsSaved] = useState(false);

  const utils = trpc.useUtils();

  const { data: scans } = trpc.discovery.scans.useQuery();
  const { data: piholeSettings } = trpc.pihole.getSettings.useQuery();

  // Hydrate form when saved settings load
  useEffect(() => {
    if (piholeSettings) {
      setPiholeUrl(piholeSettings.url);
      setPiholeEnabled(piholeSettings.enabled);
    }
  }, [piholeSettings]);

  const piholeSettingsMutation = trpc.pihole.saveSettings.useMutation({
    onSuccess: () => { toast.success("Pi-hole settings saved"); setPiholeSettingsSaved(true); utils.pihole.getSettings.invalidate(); },
    onError: (e: { message: string }) => toast.error(`Save failed: ${e.message}`),
  });
  const piholePullMutation = trpc.pihole.pullNow.useMutation({
    onSuccess: (d: { scanned: number; newFindings: number; domains: string[] }) => {
      toast.success(`Pi-hole pull complete — ${d.newFindings} new AI service(s) found from ${d.scanned} DNS queries`);
      utils.discovery.findings.invalidate();
      utils.discovery.scans.invalidate();
      utils.discovery.newCount.invalidate();
    },
    onError: (e: { message: string }) => toast.error(`Pi-hole pull failed: ${e.message}`),
  });
  const { data: findings, isLoading: findingsLoading } = trpc.discovery.findings.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const endpointProbeMutation = trpc.discovery.runEndpointProbe.useMutation({
    onSuccess: (d) => {
      toast.success(`Endpoint probe complete — ${d.findingsCount} reachable AI endpoints found`);
      utils.discovery.findings.invalidate();
      utils.discovery.scans.invalidate();
      utils.discovery.newCount.invalidate();
    },
    onError: (e: { message: string }) => toast.error(`Probe failed: ${e.message}`),
  });

  const logAnalysisMutation = trpc.discovery.runLogAnalysis.useMutation({
    onSuccess: (d) => {
      toast.success(`Log analysis complete — ${d.findingsCount} AI tools identified`);
      setLogText("");
      utils.discovery.findings.invalidate();
      utils.discovery.scans.invalidate();
      utils.discovery.newCount.invalidate();
    },
    onError: (e: { message: string }) => toast.error(`Analysis failed: ${e.message}`),
  });

  const auditFingerprintMutation = trpc.discovery.runAuditFingerprint.useMutation({
    onSuccess: (d) => {
      toast.success(`Audit fingerprint complete — ${d.findingsCount} unregistered patterns found`);
      utils.discovery.findings.invalidate();
      utils.discovery.scans.invalidate();
      utils.discovery.newCount.invalidate();
    },
    onError: (e: { message: string }) => toast.error(`Fingerprint failed: ${e.message}`),
  });

  const promoteAgentMutation = trpc.discovery.promoteToAgent.useMutation({
    onSuccess: () => {
      toast.success("Finding promoted — agent registered in the registry");
      setPromoteAgentFinding(null);
      utils.discovery.findings.invalidate();
      utils.discovery.newCount.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const promoteShadowMutation = trpc.discovery.promoteToShadow.useMutation({
    onSuccess: () => {
      toast.success("Finding added to Shadow AI registry");
      utils.discovery.findings.invalidate();
      utils.discovery.newCount.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const dismissMutation = trpc.discovery.dismiss.useMutation({
    onSuccess: () => {
      toast.success("Finding dismissed");
      setDismissFinding(null);
      utils.discovery.findings.invalidate();
      utils.discovery.newCount.invalidate();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const newCount = (findings ?? []).filter((f) => f.status === "new").length;
  const criticalCount = (findings ?? []).filter((f) => f.riskLevel === "critical" && f.status === "new").length;
  const highCount = (findings ?? []).filter((f) => f.riskLevel === "high" && f.status === "new").length;

  const isScanning = endpointProbeMutation.isPending || logAnalysisMutation.isPending || auditFingerprintMutation.isPending || piholePullMutation.isPending;

  return (
    <AegisLayout title="AI Discovery">
      <div className="p-6 space-y-6">
        {/* Header summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <Search className="w-8 h-8 text-blue-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-foreground">{(findings ?? []).length}</p>
                <p className="text-xs text-muted-foreground">Total Findings</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-400/20 bg-yellow-400/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Eye className="w-8 h-8 text-yellow-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-yellow-400">{newCount}</p>
                <p className="text-xs text-muted-foreground">Awaiting Review</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-400/20 bg-red-400/5">
            <CardContent className="p-4 flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-red-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
                <p className="text-xs text-muted-foreground">Critical Risk</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-400/20 bg-orange-400/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-orange-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-orange-400">{highCount}</p>
                <p className="text-xs text-muted-foreground">High Risk</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/30 border border-border">
            <TabsTrigger value="findings" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Findings {newCount > 0 && <span className="ml-1.5 bg-yellow-400 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">{newCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="scan" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Run Scan
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Scan History
            </TabsTrigger>
          </TabsList>

          {/* ── Findings Tab ─────────────────────────────────────────────── */}
          <TabsContent value="findings" className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Discovered AI tools and agents that are not registered in your governance registry.
                Review each finding and either register it as a governed agent, flag it as shadow AI, or dismiss it.
              </p>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FindingStatus | "all")}>
                <SelectTrigger className="w-36 h-8 text-xs bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="promoted_agent">Registered</SelectItem>
                  <SelectItem value="added_shadow">Shadow AI</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {findingsLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-xl shimmer" />)}</div>
            ) : (findings ?? []).length === 0 ? (
              <Card className="glass-card border-border">
                <CardContent className="py-16 text-center">
                  <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No findings yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Run a scan to discover AI tools and agents in your environment.</p>
                  <Button size="sm" className="mt-4" onClick={() => setActiveTab("scan")}>
                    <Zap className="w-3.5 h-3.5 mr-1.5" />Run First Scan
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {(findings as Finding[]).map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    onPromoteAgent={(finding) => {
                      setAgentForm({ name: finding.toolName, description: finding.riskRationale ?? "", owner: "", maxDataTier: "benign" });
                      setPromoteAgentFinding(finding);
                    }}
                    onPromoteShadow={(finding) => promoteShadowMutation.mutate({ findingId: finding.id })}
                    onDismiss={(finding) => { setDismissFinding(finding); setDismissNote(""); }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Scan Tab ──────────────────────────────────────────────────── */}
          <TabsContent value="scan" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Endpoint Probe */}
              <Card className="glass-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Network className="w-4 h-4 text-blue-400" />
                    Endpoint Probe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Probes {50}+ known AI service endpoints via DNS and HTTP to detect which ones are reachable from your network.
                    Surfaces tools like OpenAI, Anthropic, GitHub Copilot, Azure OpenAI, and more.
                  </p>
                  <div className="space-y-1 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400" />LLMs &amp; Chat APIs</div>
                    <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400" />Code assistants</div>
                    <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400" />Autonomous agent frameworks</div>
                    <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400" />Cloud AI platforms</div>
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => endpointProbeMutation.mutate()}
                    disabled={isScanning}
                  >
                    {endpointProbeMutation.isPending ? (
                      <><Activity className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Probing…</>
                    ) : (
                      <><Zap className="w-3.5 h-3.5 mr-1.5" />Run Endpoint Probe</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Log Analysis */}
              <Card className="glass-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileSearch className="w-4 h-4 text-purple-400" />
                    Log Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Paste DNS query logs, proxy access logs, or browser history exports.
                    The AI analyses the text to extract references to AI tools and services.
                  </p>
                  <Textarea
                    className="bg-input border-border text-foreground text-xs font-mono resize-none"
                    rows={5}
                    placeholder={"Paste log text here…\n\nExamples:\n• DNS query logs\n• Proxy/firewall access logs\n• Browser history exports\n• Network traffic summaries"}
                    value={logText}
                    onChange={(e) => setLogText(e.target.value)}
                  />
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => {
                      if (!logText.trim()) return toast.error("Paste some log text first");
                      logAnalysisMutation.mutate({ logText });
                    }}
                    disabled={isScanning || !logText.trim()}
                  >
                    {logAnalysisMutation.isPending ? (
                      <><Activity className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Analysing…</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Analyse Logs</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Audit Fingerprint */}
              <Card className="glass-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    Audit Fingerprint
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Cross-references your existing audit trail for API call patterns that match known AI provider domains
                    but are not attributed to any registered agent.
                  </p>
                  <div className="space-y-1 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400" />Scans last 500 audit entries</div>
                    <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400" />Matches against 50+ AI domains</div>
                    <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400" />Excludes registered agents</div>
                    <div className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400" />No external network calls</div>
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    onClick={() => auditFingerprintMutation.mutate()}
                    disabled={isScanning}
                  >
                    {auditFingerprintMutation.isPending ? (
                      <><Activity className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Scanning…</>
                    ) : (
                      <><Search className="w-3.5 h-3.5 mr-1.5" />Run Fingerprint</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* ── Pi-hole Connector Card ───────────────────────────────── */}
            <Card className="glass-card border-border border-t-2 border-t-cyan-500/40 mt-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  Pi-hole DNS Connector
                  {piholeEnabled && <Badge variant="outline" className="text-[9px] text-cyan-400 border-cyan-400/30 ml-auto">Enabled</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Pulls real DNS query logs from your Pi-hole instance and surfaces any AI service domains as discovery findings.
                  Requires your Pi-hole app password (Settings → API → App Password).
                </p>
                {piholeSettings && (
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    Last sync: {piholeSettings.lastSyncedAt ? new Date(piholeSettings.lastSyncedAt).toLocaleString() : "Never"}
                    {piholeSettings.lastSyncStatus && (
                      <span className={piholeSettings.lastSyncStatus.startsWith("error") ? "text-red-400" : "text-green-400"}>
                        — {piholeSettings.lastSyncStatus}
                      </span>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">Pi-hole URL</Label>
                    <Input
                      value={piholeUrl}
                      onChange={(e) => setPiholeUrl(e.target.value)}
                      placeholder="http://10.0.5.24"
                      className="h-7 text-xs bg-muted/20 border-border"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground mb-1 block">App Password</Label>
                    <Input
                      type="password"
                      value={piholePassword}
                      onChange={(e) => setPiholePassword(e.target.value)}
                      placeholder={piholeSettings?.enabled ? "(saved — enter to update)" : "Pi-hole app password"}
                      className="h-7 text-xs bg-muted/20 border-border"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="pihole-enabled"
                      checked={piholeEnabled}
                      onChange={(e) => setPiholeEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 accent-cyan-500"
                    />
                    <Label htmlFor="pihole-enabled" className="text-[10px] text-muted-foreground cursor-pointer">Enable Pi-hole connector</Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => piholeSettingsMutation.mutate({ url: piholeUrl, appPassword: piholePassword || undefined, enabled: piholeEnabled })}
                    disabled={piholeSettingsMutation.isPending}
                  >
                    {piholeSettingsMutation.isPending ? "Saving…" : "Save Settings"}
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                    onClick={() => piholePullMutation.mutate()}
                    disabled={!piholeEnabled || isScanning || !piholeSettings}
                    title={!piholeEnabled ? "Enable the connector first" : !piholeSettings ? "Save settings first" : ""}
                  >
                    {piholePullMutation.isPending ? (
                      <><Activity className="w-3.5 h-3.5 mr-1.5 animate-pulse" />Pulling…</>
                    ) : (
                      <><Radio className="w-3.5 h-3.5 mr-1.5" />Pull Now</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── History Tab ───────────────────────────────────────────────── */}
          <TabsContent value="history" className="mt-4 space-y-3">
            {(scans ?? []).length === 0 ? (
              <Card className="glass-card border-border">
                <CardContent className="py-12 text-center">
                  <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No scans have been run yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {(scans ?? []).map((scan) => (
                  <Card key={scan.id} className="glass-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${scan.status === "completed" ? "bg-green-400" : scan.status === "failed" ? "bg-red-400" : "bg-yellow-400 animate-pulse"}`} />
                          <div>
                            <p className="text-sm font-medium text-foreground capitalize">
                              {scan.scanType.replace(/_/g, " ")}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {scan.triggeredBy && `By ${scan.triggeredBy} · `}
                              {new Date(scan.createdAt).toLocaleString("en-GB")}
                              {scan.durationMs && ` · ${(scan.durationMs / 1000).toFixed(1)}s`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {scan.findingsCount !== null && scan.findingsCount > 0 && (
                            <span className="text-xs font-semibold text-foreground">
                              {scan.findingsCount} finding{scan.findingsCount !== 1 ? "s" : ""}
                            </span>
                          )}
                          <Badge variant="outline" className={`text-[10px] ${scan.status === "completed" ? "text-green-400 border-green-400/30 bg-green-400/5" : scan.status === "failed" ? "text-red-400 border-red-400/30 bg-red-400/5" : "text-yellow-400 border-yellow-400/30 bg-yellow-400/5"}`}>
                            {scan.status}
                          </Badge>
                        </div>
                      </div>
                      {scan.inputSummary && (
                        <p className="text-[10px] text-muted-foreground mt-2 ml-5">{scan.inputSummary}</p>
                      )}
                      {scan.errorMessage && (
                        <p className="text-[10px] text-red-400 mt-1 ml-5">{scan.errorMessage}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Promote to Agent Dialog ─────────────────────────────────────── */}
      <Dialog open={!!promoteAgentFinding} onOpenChange={(o) => !o && setPromoteAgentFinding(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-400" />Register as Agent
            </DialogTitle>
          </DialogHeader>
          {promoteAgentFinding && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                This will create a new entry in the Agent Registry for <strong className="text-foreground">{promoteAgentFinding.toolName}</strong>.
                You can update the details later from the registry.
              </p>
              <div>
                <Label className="text-xs text-muted-foreground">Agent Name *</Label>
                <Input className="mt-1 bg-input border-border text-foreground" value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea className="mt-1 bg-input border-border text-foreground resize-none" rows={2} value={agentForm.description} onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Owner</Label>
                  <Input className="mt-1 bg-input border-border text-foreground" placeholder="e.g. Engineering Team" value={agentForm.owner} onChange={(e) => setAgentForm({ ...agentForm, owner: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max Data Tier</Label>
                  <Select value={agentForm.maxDataTier} onValueChange={(v) => setAgentForm({ ...agentForm, maxDataTier: v as "benign" | "internal" | "sensitive" })}>
                    <SelectTrigger className="mt-1 bg-input border-border text-foreground h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="benign">Benign</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="sensitive">Sensitive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setPromoteAgentFinding(null)}>Cancel</Button>
                <Button size="sm" onClick={() => {
                  if (!agentForm.name.trim()) return toast.error("Agent name is required");
                  promoteAgentMutation.mutate({
                    findingId: promoteAgentFinding.id,
                    name: agentForm.name,
                    description: agentForm.description || undefined,
                    owner: agentForm.owner || undefined,
                    maxDataTier: agentForm.maxDataTier,
                  });
                }} disabled={promoteAgentMutation.isPending}>
                  {promoteAgentMutation.isPending ? "Registering…" : "Register Agent"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dismiss Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!dismissFinding} onOpenChange={(o) => !o && setDismissFinding(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <XCircle className="w-4 h-4 text-muted-foreground" />Dismiss Finding
            </DialogTitle>
          </DialogHeader>
          {dismissFinding && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Dismiss <strong className="text-foreground">{dismissFinding.toolName}</strong> as a false positive or acceptable risk.
              </p>
              <div>
                <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
                <Textarea className="mt-1 bg-input border-border text-foreground resize-none" rows={2} placeholder="e.g. Approved vendor, internal tool, false positive" value={dismissNote} onChange={(e) => setDismissNote(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setDismissFinding(null)}>Cancel</Button>
                <Button size="sm" variant="outline" className="bg-transparent text-muted-foreground border-border" onClick={() => {
                  dismissMutation.mutate({ findingId: dismissFinding.id, reviewNote: dismissNote || undefined });
                }} disabled={dismissMutation.isPending}>
                  {dismissMutation.isPending ? "Dismissing…" : "Dismiss"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AegisLayout>
  );
}
