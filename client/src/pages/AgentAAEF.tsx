/**
 * AgentAAEF.tsx — AAEF Appraisal view for a single agent
 *
 * Shows:
 *  - Current WAS scorecard with rating badge and mandatory response
 *  - D1–D5 dimension score bars
 *  - Appraisal history table
 *  - Improvement plan tracker
 *  - "New Appraisal" form (slide-in panel)
 */

import { useState, useMemo } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, ChevronLeft, ClipboardList, Plus, TrendingUp } from "lucide-react";
import { Link } from "wouter";

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

const DIMENSION_LABELS = [
  { key: "d1Score", label: "D1 — Task Completion & Accuracy", weight: "25%" },
  { key: "d2Score", label: "D2 — Quality of Judgement", weight: "25%" },
  { key: "d3Score", label: "D3 — Escalation Behaviour", weight: "20%" },
  { key: "d4Score", label: "D4 — Process & Constraint Compliance", weight: "20%" },
  { key: "d5Score", label: "D5 — User Experience & Trust", weight: "10%" },
];

const PLAN_STATUS_COLOURS: Record<string, string> = {
  open: "bg-slate-500/20 text-slate-300",
  in_progress: "bg-blue-500/20 text-blue-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  overdue: "bg-red-500/20 text-red-400",
  escalated: "bg-orange-500/20 text-orange-400",
};

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, label, weight }: { score: number; label: string; weight: string }) {
  const pct = (score / 5) * 100;
  const colour =
    score >= 4 ? "bg-emerald-500" : score === 3 ? "bg-yellow-500" : score === 2 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400 text-xs">
          {score}/5 <span className="text-slate-600 ml-1">({weight})</span>
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── New Appraisal Form ───────────────────────────────────────────────────────

function NewAppraisalDialog({
  agentId,
  agentName,
  onSuccess,
}: {
  agentId: number;
  agentName: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const profiles = trpc.aaef.listProfiles.useQuery(undefined, { enabled: open });
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    profileId: "",
    periodStart: "",
    periodEnd: "",
    appraisalDate: new Date().toISOString().slice(0, 10),
    d1Score: "3",
    d2Score: "3",
    d3Score: "3",
    d4Score: "3",
    d5Score: "3",
    d1Rationale: "",
    d2Rationale: "",
    d3Rationale: "",
    d4Rationale: "",
    d5Rationale: "",
    quantitativeDataSummary: "",
    nextAppraisalDate: "",
    consecutiveLowWas: "0",
    // Improvement plan action (one for now)
    actionDescription: "",
    actionDimension: "overall",
    actionOwner: "",
    actionDueDate: "",
    actionRootCause: "",
    actionSuccessCriteria: "",
  });

  // Live WAS preview
  const previewInput = useMemo(() => {
    if (!form.profileId) return null;
    return {
      profileId: Number(form.profileId),
      d1Score: Number(form.d1Score),
      d2Score: Number(form.d2Score),
      d3Score: Number(form.d3Score),
      d4Score: Number(form.d4Score),
      d5Score: Number(form.d5Score),
      consecutiveLowWas: Number(form.consecutiveLowWas),
    };
  }, [form.profileId, form.d1Score, form.d2Score, form.d3Score, form.d4Score, form.d5Score, form.consecutiveLowWas]);

  const preview = trpc.aaef.previewWAS.useQuery(previewInput!, {
    enabled: !!previewInput,
  });

  const createAppraisal = trpc.aaef.createAppraisal.useMutation({
    onSuccess: () => {
      utils.aaef.listAppraisals.invalidate({ agentId });
      utils.aaef.listImprovementPlans.invalidate({ agentId });
      toast.success("Appraisal recorded — AAEF appraisal saved successfully.");
      setOpen(false);
      onSuccess();
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`);
    },
  });

  const handleSubmit = () => {
    if (!form.profileId || !form.periodStart || !form.periodEnd) {
      toast.error("Please fill in all required fields.");
      return;
    }
    const actions = form.actionDescription.trim()
      ? [
          {
            dimension: form.actionDimension as "D1" | "D2" | "D3" | "D4" | "D5" | "overall",
            actionDescription: form.actionDescription,
            rootCause: form.actionRootCause || undefined,
            successCriteria: form.actionSuccessCriteria || undefined,
            owner: form.actionOwner || "TBD",
            dueDate: form.actionDueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          },
        ]
      : [];

    createAppraisal.mutate({
      agentId,
      profileId: Number(form.profileId),
      periodStart: form.periodStart,
      periodEnd: form.periodEnd,
      appraisalDate: form.appraisalDate,
      d1Score: Number(form.d1Score),
      d2Score: Number(form.d2Score),
      d3Score: Number(form.d3Score),
      d4Score: Number(form.d4Score),
      d5Score: Number(form.d5Score),
      d1Rationale: form.d1Rationale || undefined,
      d2Rationale: form.d2Rationale || undefined,
      d3Rationale: form.d3Rationale || undefined,
      d4Rationale: form.d4Rationale || undefined,
      d5Rationale: form.d5Rationale || undefined,
      quantitativeDataSummary: form.quantitativeDataSummary || undefined,
      nextAppraisalDate: form.nextAppraisalDate || undefined,
      consecutiveLowWas: Number(form.consecutiveLowWas),
      improvementActions: actions,
    });
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New Appraisal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">New AAEF Appraisal — {agentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Profile and period */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-slate-300">Performance Profile *</Label>
              <Select value={form.profileId} onValueChange={(v) => setForm((f) => ({ ...f, profileId: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Select profile..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {profiles.data?.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)} className="text-white">
                      {p.profileCode.toUpperCase()} — {p.profileName.split("—")[1]?.trim() ?? p.profileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Appraisal Date *</Label>
              <Input type="date" value={form.appraisalDate} onChange={set("appraisalDate")} className="bg-slate-800 border-slate-600 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Period Start *</Label>
              <Input type="date" value={form.periodStart} onChange={set("periodStart")} className="bg-slate-800 border-slate-600 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Period End *</Label>
              <Input type="date" value={form.periodEnd} onChange={set("periodEnd")} className="bg-slate-800 border-slate-600 text-white" />
            </div>
          </div>

          {/* Dimension scores */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-300">Dimension Scores (1 = Unacceptable, 5 = Exemplary)</p>
            {DIMENSION_LABELS.map((d, i) => {
              const scoreKey = d.key as keyof typeof form;
              const rationaleKey = `d${i + 1}Rationale` as keyof typeof form;
              return (
                <div key={d.key} className="space-y-1 border border-slate-700 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Label className="text-slate-300 flex-1 text-xs">{d.label}</Label>
                    <Select
                      value={form[scoreKey] as string}
                      onValueChange={(v) => setForm((f) => ({ ...f, [scoreKey]: v }))}
                    >
                      <SelectTrigger className="w-20 bg-slate-800 border-slate-600 text-white text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)} className="text-white">{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    placeholder="Rationale (optional)"
                    value={form[rationaleKey] as string}
                    onChange={set(rationaleKey as string)}
                    className="bg-slate-800/50 border-slate-700 text-white text-xs placeholder:text-slate-500"
                  />
                </div>
              );
            })}
          </div>

          {/* Live WAS preview */}
          {preview.data && (
            <div className={`rounded-lg border p-3 ${RATING_COLOURS[preview.data.rating as Rating]}`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">WAS Preview: {preview.data.was}</span>
                <Badge className={RATING_COLOURS[preview.data.rating as Rating]}>
                  {RATING_LABELS[preview.data.rating as Rating]}
                </Badge>
              </div>
              <p className="text-xs mt-1 opacity-80">{preview.data.mandatoryResponse}</p>
              {preview.data.overrides.triggered && (
                <div className="mt-2 text-xs text-red-300">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  Override: {preview.data.overrides.reasons[0]}
                </div>
              )}
            </div>
          )}

          {/* Quantitative data summary */}
          <div className="space-y-1">
            <Label className="text-slate-300">Quantitative Data Summary</Label>
            <Textarea
              placeholder="Task completion rate, accuracy scores, escalation statistics..."
              value={form.quantitativeDataSummary}
              onChange={set("quantitativeDataSummary")}
              className="bg-slate-800 border-slate-600 text-white text-sm"
              rows={3}
            />
          </div>

          {/* Improvement action (if rating warrants it) */}
          {preview.data && ["developing", "at_risk", "unacceptable"].includes(preview.data.rating) && (
            <div className="space-y-3 border border-orange-500/30 rounded-lg p-3">
              <p className="text-sm font-medium text-orange-400">
                Improvement Plan Action Required
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-slate-300 text-xs">Action Description *</Label>
                  <Textarea
                    placeholder="Describe the specific improvement action..."
                    value={form.actionDescription}
                    onChange={set("actionDescription")}
                    className="bg-slate-800 border-slate-600 text-white text-sm"
                    rows={2}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Dimension</Label>
                  <Select value={form.actionDimension} onValueChange={(v) => setForm((f) => ({ ...f, actionDimension: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      {["D1", "D2", "D3", "D4", "D5", "overall"].map((d) => (
                        <SelectItem key={d} value={d} className="text-white">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Owner</Label>
                  <Input placeholder="Name" value={form.actionOwner} onChange={set("actionOwner")} className="bg-slate-800 border-slate-600 text-white text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Due Date</Label>
                  <Input type="date" value={form.actionDueDate} onChange={set("actionDueDate")} className="bg-slate-800 border-slate-600 text-white text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs">Root Cause</Label>
                  <Input placeholder="Root cause" value={form.actionRootCause} onChange={set("actionRootCause")} className="bg-slate-800 border-slate-600 text-white text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* Next appraisal + consecutive low WAS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Next Appraisal Date</Label>
              <Input type="date" value={form.nextAppraisalDate} onChange={set("nextAppraisalDate")} className="bg-slate-800 border-slate-600 text-white text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">Consecutive Low WAS Periods</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={form.consecutiveLowWas}
                onChange={set("consecutiveLowWas")}
                className="bg-slate-800 border-slate-600 text-white text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-600 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createAppraisal.isPending}>
              {createAppraisal.isPending ? "Saving..." : "Save Appraisal"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentAAEF() {
  const [, params] = useRoute("/agents/:id/aaef");
  const agentId = Number(params?.id);
  const agentQuery = trpc.agents.get.useQuery({ id: agentId }, { enabled: !!agentId });
  const appraisalsQuery = trpc.aaef.listAppraisals.useQuery({ agentId }, { enabled: !!agentId });
  const plansQuery = trpc.aaef.listImprovementPlans.useQuery({ agentId }, { enabled: !!agentId });
  const utils = trpc.useUtils();

  const updatePlan = trpc.aaef.updatePlanStatus.useMutation({
    onSuccess: () => {
      utils.aaef.listImprovementPlans.invalidate({ agentId });
      toast.success("Plan updated");
    },
  });

  const agent = agentQuery.data;
  const appraisals = appraisalsQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const latest = appraisals[0];

  if (agentQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">Agent not found.</div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/agents">
            <Button variant="ghost" size="sm" className="text-slate-400 gap-1">
              <ChevronLeft className="h-4 w-4" />
              Agents
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-white">{agent.name}</h1>
            <p className="text-sm text-slate-400">AAEF Appraisal Record</p>
          </div>
        </div>
        <NewAppraisalDialog
          agentId={agentId}
          agentName={agent.name}
          onSuccess={() => appraisalsQuery.refetch()}
        />
      </div>

      {/* Current WAS scorecard */}
      {latest ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* WAS summary */}
          <Card className="bg-slate-800/50 border-slate-700 md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 font-normal">Current WAS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-white mb-2">{Number(latest.was).toFixed(2)}</div>
              <Badge className={`${RATING_COLOURS[latest.overallRating as Rating]} border text-sm px-3 py-1`}>
                {RATING_LABELS[latest.overallRating as Rating]}
              </Badge>
              {latest.overrideTriggered && (
                <div className="mt-3 flex items-start gap-2 text-xs text-red-400 bg-red-500/10 rounded p-2">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{latest.overrideReason}</span>
                </div>
              )}
              <p className="text-xs text-slate-500 mt-3">
                Appraised {new Date(latest.appraisalDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </CardContent>
          </Card>

          {/* Dimension scores */}
          <Card className="bg-slate-800/50 border-slate-700 md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-400 font-normal">Dimension Scores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {DIMENSION_LABELS.map((d) => (
                <ScoreBar
                  key={d.key}
                  score={(latest as any)[d.key] as number}
                  label={d.label}
                  weight={d.weight}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="bg-slate-800/50 border-slate-700 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
            <ClipboardList className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No appraisals recorded yet.</p>
            <p className="text-xs mt-1">Use the "New Appraisal" button to record the first AAEF evaluation.</p>
          </CardContent>
        </Card>
      )}

      {/* Improvement Plans */}
      {plans.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-400" />
              Improvement Plan Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plans.map((plan) => (
                <div key={plan.id} className="flex items-start justify-between gap-4 border border-slate-700 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">{plan.dimension}</Badge>
                      <Badge className={`text-xs ${PLAN_STATUS_COLOURS[plan.status]}`}>
                        {plan.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-sm text-white">{plan.actionDescription}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Owner: {plan.owner} · Due: {new Date(plan.dueDate).toLocaleDateString("en-GB")}
                      {plan.checkInDate && ` · Check-in: ${new Date(plan.checkInDate).toLocaleDateString("en-GB")}`}
                    </p>
                    {plan.rootCause && (
                      <p className="text-xs text-slate-500 mt-0.5">Root cause: {plan.rootCause}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {plan.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-emerald-600 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => updatePlan.mutate({ planId: plan.id, status: "completed" })}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Done
                      </Button>
                    )}
                    {plan.status === "open" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-blue-600 text-blue-400 hover:bg-blue-500/10"
                        onClick={() => updatePlan.mutate({ planId: plan.id, status: "in_progress" })}
                      >
                        In Progress
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appraisal History */}
      {appraisals.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Appraisal History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-700">
                    <th className="text-left pb-2 pr-4">Date</th>
                    <th className="text-left pb-2 pr-4">Period</th>
                    <th className="text-center pb-2 pr-2">D1</th>
                    <th className="text-center pb-2 pr-2">D2</th>
                    <th className="text-center pb-2 pr-2">D3</th>
                    <th className="text-center pb-2 pr-2">D4</th>
                    <th className="text-center pb-2 pr-2">D5</th>
                    <th className="text-center pb-2 pr-4">WAS</th>
                    <th className="text-left pb-2">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {appraisals.map((a) => (
                    <tr key={a.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="py-2 pr-4 text-slate-300">
                        {new Date(a.appraisalDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-2 pr-4 text-slate-400 text-xs">
                        {new Date(a.periodStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
                        {new Date(a.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      {[a.d1Score, a.d2Score, a.d3Score, a.d4Score, a.d5Score].map((s, i) => (
                        <td key={i} className="py-2 pr-2 text-center">
                          <span className={`font-mono text-xs ${s >= 4 ? "text-emerald-400" : s === 3 ? "text-yellow-400" : s === 2 ? "text-orange-400" : "text-red-400"}`}>
                            {s}
                          </span>
                        </td>
                      ))}
                      <td className="py-2 pr-4 text-center font-semibold text-white">{Number(a.was).toFixed(2)}</td>
                      <td className="py-2">
                        <Badge className={`text-xs ${RATING_COLOURS[a.overallRating as Rating]}`}>
                          {RATING_LABELS[a.overallRating as Rating]}
                        </Badge>
                        {a.overrideTriggered && (
                          <AlertTriangle className="inline h-3 w-3 ml-1 text-red-400" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
