import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Bot, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";

function getRiskLevel(score: number) {
  if (score >= 75) return { label: "Critical", color: "text-red-400", bg: "border-red-400/20 bg-red-400/5" };
  if (score >= 50) return { label: "High", color: "text-orange-400", bg: "border-orange-400/20 bg-orange-400/5" };
  if (score >= 25) return { label: "Medium", color: "text-yellow-400", bg: "border-yellow-400/20 bg-yellow-400/5" };
  return { label: "Low", color: "text-green-400", bg: "border-green-400/20 bg-green-400/5" };
}

function getRiskColor(score: number) {
  if (score >= 75) return "#f87171";
  if (score >= 50) return "#fb923c";
  if (score >= 25) return "#facc15";
  return "#4ade80";
}

const radarData = [
  { factor: "Access Scope", value: 60 },
  { factor: "Action Freq.", value: 45 },
  { factor: "Data Sensitivity", value: 80 },
  { factor: "Anomaly Signals", value: 30 },
  { factor: "Approval Rate", value: 55 },
];

export default function RiskScoring() {
  const { data: agents, isLoading, refetch } = trpc.agents.list.useQuery();

  const calcMutation = trpc.riskScores.calculate.useMutation({
    onSuccess: (d: { score: number }) => {
      toast.success(`Risk recalculated: ${d.score.toFixed(1)}`);
      refetch();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const barData = (agents ?? []).map((a) => ({
    name: a.name.length > 12 ? a.name.slice(0, 12) + "…" : a.name,
    score: Number(a.riskScore ?? 0),
  }));

  const handleRecalculateAll = () => {
    (agents ?? []).forEach((a) => calcMutation.mutate({ agentId: a.id }));
  };

  return (
    <AegisLayout title="Risk Scoring Engine">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Per-agent risk scores calculated from access scope, action frequency, data sensitivity, and anomaly signals.
          </p>
          <Button size="sm" variant="outline" className="bg-transparent" onClick={handleRecalculateAll} disabled={calcMutation.isPending}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            {calcMutation.isPending ? "Recalculating..." : "Recalculate All"}
          </Button>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="glass-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Agent Risk Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No agents registered</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.015 240)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.55 0.015 240)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "oklch(0.55 0.015 240)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.13 0.015 240)", border: "1px solid oklch(0.22 0.015 240)", borderRadius: "8px", fontSize: "12px" }}
                      labelStyle={{ color: "oklch(0.93 0.008 240)" }}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={getRiskColor(entry.score)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                Risk Factor Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="oklch(0.22 0.015 240)" />
                  <PolarAngleAxis dataKey="factor" tick={{ fontSize: 10, fill: "oklch(0.55 0.015 240)" }} />
                  <Radar name="Risk" dataKey="value" stroke="oklch(0.62 0.18 255)" fill="oklch(0.62 0.18 255)" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Agent Risk Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 rounded-xl shimmer" />)}
          </div>
        ) : (agents ?? []).length === 0 ? (
          <Card className="glass-card border-border">
            <CardContent className="py-16 text-center">
              <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No agents to score yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...(agents ?? [])].sort((a, b) => Number(b.riskScore ?? 0) - Number(a.riskScore ?? 0)).map((agent) => {
              const score = Number(agent.riskScore ?? 0);
              const level = getRiskLevel(score);
              const pct = Math.min(100, score);
              const color = getRiskColor(score);
              return (
                <Card key={agent.id} className={`border ${level.bg}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                        <p className="text-[10px] text-muted-foreground">{agent.vendor ?? "Unknown"} · {agent.agentType ?? "AI Agent"}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${level.color} border-current/30`}>{level.label}</Badge>
                    </div>
                    <div className="flex items-end gap-3 mb-3">
                      <p className="text-3xl font-bold" style={{ color }}>{score.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground mb-1">/ 100</p>
                    </div>
                    <div className="h-2 rounded-full bg-border overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-[9px] capitalize ${
                        agent.status === "active" ? "text-green-400 border-green-400/30" :
                        agent.status === "suspended" ? "text-yellow-400 border-yellow-400/30" :
                        "text-gray-400 border-gray-400/30"
                      }`}>{agent.status}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-6 text-muted-foreground hover:text-foreground"
                        onClick={() => calcMutation.mutate({ agentId: agent.id })}
                        disabled={calcMutation.isPending}
                      >
                        Recalculate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AegisLayout>
  );
}
