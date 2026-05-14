/**
 * AAEFDashboard.tsx — Organisation-wide AAEF overview
 *
 * Shows:
 *  - WAS distribution across all agents
 *  - Rating breakdown (Exemplary → Unacceptable)
 *  - Override alerts
 *  - Open improvement plan count
 *  - Recent appraisals table with links to agent AAEF pages
 */

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, ClipboardList, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Rating = "exemplary" | "proficient" | "developing" | "at_risk" | "unacceptable";

const RATING_COLOURS: Record<Rating, string> = {
  exemplary: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  proficient: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  developing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  at_risk: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  unacceptable: "bg-red-500/20 text-red-400 border-red-500/30",
};

const RATING_LABELS: Record<Rating, string> = {
  exemplary: "Exemplary",
  proficient: "Proficient",
  developing: "Developing",
  at_risk: "At Risk",
  unacceptable: "Unacceptable",
};

const RATING_ORDER: Rating[] = ["exemplary", "proficient", "developing", "at_risk", "unacceptable"];

const RATING_BAR_COLOURS: Record<Rating, string> = {
  exemplary: "bg-emerald-500",
  proficient: "bg-blue-500",
  developing: "bg-yellow-500",
  at_risk: "bg-orange-500",
  unacceptable: "bg-red-500",
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  colour,
  sub,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  colour: string;
  sub?: string;
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${colour}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AAEFDashboard() {
  const stats = trpc.aaef.dashboardStats.useQuery();

  const data = stats.data;

  // Build rating counts map
  const ratingMap: Record<string, number> = {};
  if (data?.ratingCounts) {
    for (const r of (data.ratingCounts as unknown) as { overallRating: string; count: number }[]) {
      ratingMap[r.overallRating] = r.count;
    }
  }
  const totalAppraisals = Object.values(ratingMap).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">AAEF Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Organisation-wide AI Agent Evaluation Framework overview
          </p>
        </div>
        <Link href="/agents">
          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
            View Agent Registry
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Appraisals"
          value={totalAppraisals}
          icon={ClipboardList}
          colour="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          title="Override Alerts"
          value={data?.overrideCount ?? 0}
          icon={AlertTriangle}
          colour="bg-red-500/10 text-red-400"
          sub="Agents requiring immediate review"
        />
        <StatCard
          title="Open Improvement Plans"
          value={data?.openPlanCount ?? 0}
          icon={TrendingUp}
          colour="bg-orange-500/10 text-orange-400"
          sub="Actions pending completion"
        />
        <StatCard
          title="Exemplary Agents"
          value={ratingMap["exemplary"] ?? 0}
          icon={CheckCircle}
          colour="bg-emerald-500/10 text-emerald-400"
          sub="WAS ≥ 4.5"
        />
      </div>

      {/* Rating distribution */}
      {totalAppraisals > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {RATING_ORDER.map((rating) => {
              const count = ratingMap[rating] ?? 0;
              const pct = totalAppraisals > 0 ? (count / totalAppraisals) * 100 : 0;
              return (
                <div key={rating} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">{RATING_LABELS[rating]}</span>
                    <span className="text-slate-400">
                      {count} <span className="text-slate-600 text-xs">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${RATING_BAR_COLOURS[rating]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent appraisals */}
      {data?.recentAppraisals && (data.recentAppraisals as any[]).length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Recent Appraisals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-700">
                    <th className="text-left pb-2 pr-4">Agent</th>
                    <th className="text-left pb-2 pr-4">Date</th>
                    <th className="text-center pb-2 pr-4">WAS</th>
                    <th className="text-left pb-2 pr-4">Rating</th>
                    <th className="text-left pb-2">Appraised By</th>
                    <th className="text-right pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recentAppraisals as any[]).map((a) => (
                    <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="py-2 pr-4 text-white font-medium">{a.agentName ?? `Agent #${a.agentId}`}</td>
                      <td className="py-2 pr-4 text-slate-400 text-xs">
                        {new Date(a.appraisalDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2 pr-4 text-center font-semibold text-white">
                        {Number(a.was).toFixed(2)}
                        {a.overrideTriggered && (
                          <AlertTriangle className="inline h-3 w-3 ml-1 text-red-400" />
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge className={`text-xs ${RATING_COLOURS[a.overallRating as Rating]}`}>
                          {RATING_LABELS[a.overallRating as Rating]}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-slate-400 text-xs">{a.conductedBy}</td>
                      <td className="py-2 text-right">
                        <Link href={`/agents/${a.agentId}/aaef`}>
                          <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {totalAppraisals === 0 && !stats.isLoading && (
        <Card className="bg-slate-800/50 border-slate-700 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-slate-500">
            <ClipboardList className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No appraisals recorded yet</p>
            <p className="text-xs mt-1 text-center max-w-xs">
              Navigate to any agent in the registry and use the AAEF tab to record the first evaluation.
            </p>
            <Link href="/agents">
              <Button variant="outline" size="sm" className="mt-4 border-slate-600 text-slate-300">
                Go to Agent Registry
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
