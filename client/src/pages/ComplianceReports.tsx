import AegisLayout from "@/components/AegisLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CheckCircle, Download, FileText, Plus, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const frameworks = [
  {
    id: "pdpa",
    name: "PDPA",
    fullName: "Personal Data Protection Act (Singapore)",
    description: "Governs the collection, use, and disclosure of personal data in Singapore.",
    checks: [
      "Data inventory for AI training datasets",
      "Consent management for personal data processing",
      "Data breach notification procedures",
      "Cross-border data transfer controls",
      "Data Protection Officer designation",
    ],
  },
  {
    id: "eu_ai_act",
    name: "EU AI Act",
    fullName: "European Union Artificial Intelligence Act",
    description: "Risk-based regulatory framework for AI systems operating in the EU.",
    checks: [
      "AI system risk classification (Unacceptable / High / Limited / Minimal)",
      "Conformity assessment for high-risk AI",
      "Technical documentation and record-keeping",
      "Human oversight mechanisms",
      "Transparency and explainability requirements",
    ],
  },
  {
    id: "mas",
    name: "MAS",
    fullName: "Monetary Authority of Singapore Guidelines",
    description: "MAS guidelines on responsible use of AI in financial services.",
    checks: [
      "Model risk management framework",
      "Fairness, ethics, accountability, and transparency (FEAT)",
      "Explainability of AI-driven decisions",
      "Ongoing monitoring and validation",
      "Board and senior management accountability",
    ],
  },
];

export default function ComplianceReports() {
  const [generating, setGenerating] = useState<string | null>(null);

  const { data: reports, isLoading, refetch } = trpc.compliance.list.useQuery();
  const generateMutation = trpc.compliance.generate.useMutation({
    onSuccess: () => {
      toast.success("Compliance report generated");
      setGenerating(null);
      refetch();
    },
    onError: (e: { message: string }) => {
      toast.error(e.message);
      setGenerating(null);
    },
  });

  const handleGenerate = (framework: string) => {
    setGenerating(framework);
    generateMutation.mutate({ framework: framework as "pdpa" | "eu_ai_act" | "mas" });
  };

  return (
    <AegisLayout title="Compliance Reporting">
      <div className="p-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          Generate compliance checklists and reports aligned with PDPA, EU AI Act, and MAS guidelines.
        </p>

        {/* Framework Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {frameworks.map((fw) => (
            <Card key={fw.id} className="glass-card border-border">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{fw.name}</p>
                    <p className="text-[10px] text-muted-foreground">{fw.fullName}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{fw.description}</p>
                <div className="space-y-1.5 mb-4">
                  {fw.checks.map((check) => (
                    <div key={check} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                      <span>{check}</span>
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleGenerate(fw.id)}
                  disabled={generating === fw.id || generateMutation.isPending}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {generating === fw.id ? "Generating..." : `Generate ${fw.name} Report`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Generated Reports */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Generated Reports
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl shimmer" />)}
            </div>
          ) : reports?.length === 0 ? (
            <Card className="glass-card border-border">
              <CardContent className="py-12 text-center">
                <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No reports generated yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Use the buttons above to generate your first compliance report.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {reports?.map((report) => {
                const fw = frameworks.find((f) => f.id === report.framework);
                const summary = report.summary as { totalChecks?: number; passed?: number; failed?: number; score?: number } | null;
                return (
                  <Card key={report.id} className="glass-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">{report.title}</p>
                              <Badge variant="outline" className="text-[9px] text-primary border-primary/30">{fw?.name ?? report.framework}</Badge>
                              <Badge variant="outline" className={`text-[9px] capitalize ${
                                report.status === "final" ? "text-green-400 border-green-400/30" :
                                "text-yellow-400 border-yellow-400/30"
                              }`}>{report.status}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Generated {new Date(report.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              {summary?.score !== undefined && ` · Score: ${summary.score}/100`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {summary && (
                            <div className="flex items-center gap-3 text-xs">
                              <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle className="w-3 h-3" />{summary.passed ?? 0} passed
                              </span>
                              <span className="flex items-center gap-1 text-red-400">
                                <XCircle className="w-3 h-3" />{summary.failed ?? 0} failed
                              </span>
                            </div>
                          )}
                          {report.fileUrl && (
                            <Button variant="outline" size="sm" className="h-7 text-xs bg-transparent" asChild>
                              <a href={report.fileUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="w-3 h-3 mr-1" />
                                Download
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AegisLayout>
  );
}
