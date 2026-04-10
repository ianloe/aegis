import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  Bot,
  ClipboardCheck,
  Eye,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const riskTrendData = [
  { day: "Mon", score: 42 },
  { day: "Tue", score: 38 },
  { day: "Wed", score: 55 },
  { day: "Thu", score: 48 },
  { day: "Fri", score: 62 },
  { day: "Sat", score: 45 },
  { day: "Sun", score: 51 },
];

function getRiskLevel(score: number) {
  if (score >= 75) return { label: "Critical", color: "text-red-400", bg: "bg-red-400/10" };
  if (score >= 50) return { label: "High", color: "text-orange-400", bg: "bg-orange-400/10" };
  if (score >= 25) return { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-400/10" };
  return { label: "Low", color: "text-green-400", bg: "bg-green-400/10" };
}

function getActionTypeLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  const agentPieData = stats
    ? [
        { name: "Active", value: stats.agents.active, color: "#4ade80" },
        { name: "Suspended", value: stats.agents.suspended, color: "#facc15" },
        { name: "Decommissioned", value: stats.agents.decommissioned, color: "#6b7280" },
      ].filter((d) => d.value > 0)
    : [];

  const riskLevel = getRiskLevel(stats?.agents.avgRisk ?? 0);

  return (
    <AegisLayout title="Governance Dashboard">
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card border-border stat-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/30 bg-green-400/5">
                  {isLoading ? "—" : stats?.agents.active} active
                </Badge>
              </div>
              <p className="text-2xl font-bold text-foreground">{isLoading ? "—" : stats?.agents.total}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Registered Agents</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border stat-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-orange-400/10 border border-orange-400/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-orange-400" />
                </div>
                <Badge variant="outline" className={`text-[10px] ${riskLevel.color} border-current/30 ${riskLevel.bg}`}>
                  {riskLevel.label}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {isLoading ? "—" : (stats?.agents.avgRisk ?? 0).toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Avg Risk Score</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border stat-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4 text-yellow-400" />
                </div>
                {(stats?.pendingApprovals ?? 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-yellow-400 pulse-dot" style={{ color: "#facc15" }} />
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{isLoading ? "—" : stats?.pendingApprovals}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Pending Approvals</p>
            </CardContent>
          </Card>

          <Card className="glass-card border-border stat-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-red-400/10 border border-red-400/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                {(stats?.flaggedLogs ?? 0) > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-400 pulse-dot" style={{ color: "#f87171" }} />
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{isLoading ? "—" : stats?.flaggedLogs}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Flagged Log Entries</p>
            </CardContent>
          </Card>
        </div>

        {/* Second row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Risk Trend Chart */}
          <Card className="glass-card border-border lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Risk Score Trend (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={riskTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.62 0.18 255)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.62 0.18 255)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.015 240)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.55 0.015 240)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.55 0.015 240)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.13 0.015 240)", border: "1px solid oklch(0.22 0.015 240)", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "oklch(0.93 0.008 240)" }}
                    itemStyle={{ color: "oklch(0.62 0.18 255)" }}
                  />
                  <Area type="monotone" dataKey="score" stroke="oklch(0.62 0.18 255)" strokeWidth={2} fill="url(#riskGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Agent Status Pie */}
          <Card className="glass-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                Agent Status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {agentPieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={agentPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
                        {agentPieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "oklch(0.13 0.015 240)", border: "1px solid oklch(0.22 0.015 240)", borderRadius: "8px", fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 justify-center mt-2">
                    {agentPieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                        {d.name}: {d.value}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[140px] flex items-center justify-center text-muted-foreground text-sm">
                  No agents registered yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent Audit Logs */}
          <Card className="glass-card border-border">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Recent Audit Events
              </CardTitle>
              <Link href="/audit">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">View all</Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg shimmer" />
                ))
              ) : stats?.recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No audit events yet</p>
              ) : (
                stats?.recentLogs.slice(0, 6).map((log) => (
                  <div key={String(log.id)} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${log.flagged ? "bg-red-400" : "bg-green-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground truncate">{log.summary}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {getActionTypeLabel(log.actionType)} · {log.agentName ?? "System"} · {new Date(log.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {log.dataTier && (
                      <Badge variant="outline" className={`text-[9px] shrink-0 ${
                        log.dataTier === "sensitive" ? "text-red-400 border-red-400/30" :
                        log.dataTier === "internal" ? "text-yellow-400 border-yellow-400/30" :
                        "text-green-400 border-green-400/30"
                      }`}>
                        {log.dataTier}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Alerts */}
          <Card className="glass-card border-border">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                Recent Alerts
              </CardTitle>
              <Link href="/notifications">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">View all</Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg shimmer" />
                ))
              ) : stats?.recentAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <ShieldCheck className="w-8 h-8 text-green-400/50" />
                  <p className="text-sm text-muted-foreground">No active alerts</p>
                </div>
              ) : (
                stats?.recentAlerts.map((alert) => (
                  <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                    alert.severity === "critical" ? "border-red-400/20 bg-red-400/5" :
                    alert.severity === "warning" ? "border-yellow-400/20 bg-yellow-400/5" :
                    "border-border bg-card/50"
                  }`}>
                    <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                      alert.severity === "critical" ? "text-red-400" :
                      alert.severity === "warning" ? "text-yellow-400" : "text-blue-400"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">{alert.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{alert.message}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Compliance posture summary */}
        <Card className="glass-card border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Compliance Posture</p>
                  <p className="text-xs text-muted-foreground">PDPA · EU AI Act · MAS</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                {[
                  { label: "Shadow AI Tools", value: stats?.unsanctionedTools ?? 0, alert: true },
                  { label: "Pending Approvals", value: stats?.pendingApprovals ?? 0, alert: (stats?.pendingApprovals ?? 0) > 0 },
                  { label: "Flagged Incidents", value: stats?.flaggedLogs ?? 0, alert: (stats?.flaggedLogs ?? 0) > 0 },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p className={`text-xl font-bold ${item.alert && item.value > 0 ? "text-red-400" : "text-green-400"}`}>
                      {item.value}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
              <Link href="/compliance">
                <Button size="sm" variant="outline" className="bg-transparent">
                  Generate Report
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AegisLayout>
  );
}
