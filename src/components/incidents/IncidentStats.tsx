import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export default function IncidentStats() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const { data: incidents } = await supabase
        .from("incidents")
        .select("type, status");

      const { data: actions } = await supabase
        .from("incident_actions")
        .select("status, due_date");

      const total = incidents?.length ?? 0;
      const accident = incidents?.filter(i => i.type === "accident").length ?? 0;
      const near_miss = incidents?.filter(i => i.type === "near_miss").length ?? 0;
      const open = incidents?.filter(i => i.status === "open").length ?? 0;

      const openActions = actions?.filter(a => a.status === "open").length ?? 0;
      const overdueActions =
        actions?.filter(a =>
          a.status === "open" &&
          a.due_date &&
          new Date(a.due_date) < new Date()
        ).length ?? 0;

      setStats({ total, accident, near_miss, open, openActions, overdueActions });
    }

    load();
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <Stat label="Total Incidents" value={stats.total} />
      <Stat label="Accidents" value={stats.accident} />
      <Stat label="Near Misses" value={stats.near_miss} />
      <Stat label="Open Incidents" value={stats.open} />
      <Stat label="Open Actions" value={stats.openActions} />
      <Stat label="Overdue Actions" value={stats.overdueActions} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}