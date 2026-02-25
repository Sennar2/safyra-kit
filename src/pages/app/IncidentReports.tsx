import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Stats = {
  total: number;
  accident: number;
  near_miss: number;
  incident: number;
  open_actions: number;
  overdue_actions: number;
};

export default function IncidentReports() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  async function loadStats() {
    setLoading(true);

    let query = supabase.from("incidents").select("*");

    if (dateFrom) query = query.gte("occurred_at", dateFrom);
    if (dateTo) query = query.lte("occurred_at", dateTo);
    if (type !== "all") query = query.eq("type", type);
    if (status !== "all") query = query.eq("status", status);

    const { data } = await query;

    const total = data?.length ?? 0;

    const accident = data?.filter((i) => i.type === "accident").length ?? 0;
    const near_miss = data?.filter((i) => i.type === "near_miss").length ?? 0;
    const incidentCount = data?.filter((i) => i.type === "incident").length ?? 0;

    const { data: actions } = await supabase
      .from("incident_actions")
      .select("*");

    const open_actions = actions?.filter((a) => a.status === "open").length ?? 0;

    const overdue_actions =
      actions?.filter(
        (a) =>
          a.status === "open" &&
          a.due_date &&
          new Date(a.due_date) < new Date()
      ).length ?? 0;

    setStats({
      total,
      accident,
      near_miss,
      incident: incidentCount,
      open_actions,
      overdue_actions,
    });

    setLoading(false);
  }

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <h1 className="text-2xl font-semibold">Incident Reports Dashboard</h1>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="incident">Incident</SelectItem>
              <SelectItem value="accident">Accident</SelectItem>
              <SelectItem value="near_miss">Near Miss</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={loadStats} disabled={loading}>
            {loading ? "Loading…" : "Apply Filters"}
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total Incidents" value={stats.total} />
          <StatCard label="Accidents" value={stats.accident} />
          <StatCard label="Near Misses" value={stats.near_miss} />
          <StatCard label="Open Actions" value={stats.open_actions} />
          <StatCard label="Overdue Actions" value={stats.overdue_actions} />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}