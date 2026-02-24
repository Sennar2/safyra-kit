import { useEffect, useMemo, useState } from "react";
import { useTenant } from "@/lib/tenantContext";
import { listIncidentReports, type IncidentReportRow } from "@/lib/incidentReports";
import type { IncidentType } from "@/lib/incidents";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function toCsv(rows: IncidentReportRow[]) {
  const headers = [
    "occurred_at",
    "type",
    "status",
    "title",
    "location",
    "reported_by",
    "actions_count",
    "attachments_count",
  ];

  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map(r =>
      [
        r.occurred_at,
        r.type,
        r.status,
        r.title,
        r.location ?? "",
        r.reported_by ?? "",
        (r.actions?.length ?? 0),
        (r.attachments?.length ?? 0),
      ].map(escape).join(",")
    ),
  ];

  return lines.join("\n");
}

export default function IncidentReports() {
  const { activeCompanyId, activeSiteId } = useTenant();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<IncidentReportRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [type, setType] = useState<IncidentType | "all">("all");
  const [status, setStatus] = useState<"open" | "closed" | "all">("all");

  async function load() {
    if (!activeCompanyId) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await listIncidentReports({
        companyId: activeCompanyId,
        siteId: activeSiteId ?? undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        type,
        status,
        limit: 500,
      });
      setRows(data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load reports");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, activeSiteId]);

  const counts = useMemo(() => {
    const open = rows.filter(r => r.status === "open").length;
    const closed = rows.filter(r => r.status === "closed").length;
    return { total: rows.length, open, closed };
  }, [rows]);

  function downloadCsv() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incidents_report_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Incident reporting</h1>
        <p className="text-muted-foreground">Filter and export incidents (inspection-ready).</p>
      </div>

      {err ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Use date range, type and status.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <div className="text-sm font-medium">From</div>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <div className="text-sm font-medium">To</div>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div>
            <div className="text-sm font-medium">Type</div>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="incident">Incident</SelectItem>
                <SelectItem value="accident">Accident</SelectItem>
                <SelectItem value="near_miss">Near miss</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm font-medium">Status</div>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={load} disabled={loading} className="w-full">
              {loading ? "Loading…" : "Apply"}
            </Button>
          </div>

          <div className="md:col-span-5 flex flex-wrap items-center gap-2 pt-2">
            <Badge variant="secondary">Total {counts.total}</Badge>
            <Badge variant="secondary">Open {counts.open}</Badge>
            <Badge variant="secondary">Closed {counts.closed}</Badge>
            <div className="flex-1" />
            <Button variant="outline" onClick={downloadCsv} disabled={!rows.length}>
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Results</CardTitle>
          <CardDescription>Latest first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!rows.length ? (
            <div className="text-sm text-muted-foreground">No results.</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{r.title}</div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{r.type}</Badge>
                    <Badge variant={r.status === "open" ? "secondary" : "outline"}>{r.status}</Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(r.occurred_at).toLocaleString()}
                  {r.location ? ` • ${r.location}` : ""}
                  {r.reported_by ? ` • Reported by ${r.reported_by}` : ""}
                  {` • Actions ${r.actions?.length ?? 0} • Attachments ${r.attachments?.length ?? 0}`}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}