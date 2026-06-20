"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/pages";

type HealthStatus = "ok" | "warn" | "fail";

type HealthPayload = {
  status: HealthStatus;
  checkedAt: string;
  config: {
    endpoint: string;
    projectId: string;
    databaseId: string;
    apiKeyConfigured: boolean;
  };
  checks: Array<{
    name: string;
    status: HealthStatus;
    message: string;
  }>;
  tables: {
    expected: number;
    live: number;
    missing: string[];
  };
  rowCounts: Record<string, number>;
  error?: string;
};

export default function Page() {
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [message, setMessage] = useState("Loading system status...");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setMessage("Checking Corso system status...");

    try {
      const response = await fetch("/api/appwrite/admin/system", { cache: "no-store" });
      const data = await response.json().catch(() => null) as HealthPayload | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "System status check failed.");
      }
      if (!data) {
        throw new Error("System status check returned an empty response.");
      }

      setPayload(data);
      setMessage(data.status === "ok" ? "Corso system is healthy." : "Review the Corso checks below.");
    } catch (error) {
      setPayload(null);
      setMessage(error instanceof Error ? error.message : "System status check failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="System status"
        description="Check Corso deployment readiness, table availability, and imported data counts before making more production changes."
      >
        <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          {loading ? "Checking" : "Refresh"}
        </Button>
      </PageHeader>

      <Card>
        <CardHeader title="Corso health" description={message} />
        {payload ? (
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border border-line bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <StatusIcon status={payload.status} />
                <div>
                  <p className="text-sm text-slate-400">Overall status</p>
                  <p className="text-lg font-semibold uppercase text-white">{payload.status}</p>
                </div>
              </div>
              <dl className="mt-5 grid gap-3 text-sm">
                <Info label="Endpoint" value={payload.config.endpoint} />
                <Info label="Project" value={payload.config.projectId || "Missing"} />
                <Info label="Database" value={payload.config.databaseId || "Missing"} />
                <Info label="Tables" value={`${payload.tables.live}/${payload.tables.expected}`} />
                <Info label="Checked" value={formatCheckedAt(payload.checkedAt)} />
              </dl>
            </div>

            <div className="grid gap-3">
              {payload.checks.map((check) => (
                <div key={check.name} className="flex gap-3 rounded-lg border border-line bg-white/[0.03] p-4">
                  <StatusIcon status={check.status} />
                  <div>
                    <p className="font-semibold text-white">{check.name}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{check.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">{message}</p>
        )}

        {payload ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Object.entries(payload.rowCounts).map(([tableId, count]) => (
              <div key={tableId} className="rounded-lg border border-line bg-black/20 p-3">
                <p className="text-xs uppercase text-slate-500">{tableId.replaceAll("_", " ")}</p>
                <p className="mt-2 text-xl font-semibold text-smart">{count}</p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </>
  );
}

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === "ok") {
    return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-smart" />;
  }

  if (status === "warn") {
    return <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />;
  }

  return <Database className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-medium text-slate-200">{value}</dd>
    </div>
  );
}

function formatCheckedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    timeZone: "Africa/Lagos"
  }).format(date);
}
