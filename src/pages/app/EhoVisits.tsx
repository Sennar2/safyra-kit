import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VisitRow = {
  id: string;
  visit_date: string;
  officer_name: string | null;
  overall_rating: number | null;
  status: "open" | "actions_in_progress" | "closed";
  notes: string | null;
};

export default function EhoVisits() {
  const nav = useNavigate();
  const { activeCompanyId, activeSiteId } = useTenant();

  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [openActionsByVisit, setOpenActionsByVisit] = useState<Record<string, number>>({});

  async function load() {
    if (!activeCompanyId || !activeSiteId) {
      setVisits([]);
      setOpenActionsByVisit({});
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("eho_visits")
      .select("id, visit_date, visit_time, council_name, officer_name, overall_rating, status, notes")
      .eq("company_id", activeCompanyId)
      .eq("site_id", activeSiteId)
      .order("visit_date", { ascending: false });

    if (error) {
      setVisits([]);
      setOpenActionsByVisit({});
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as VisitRow[];
    setVisits(rows);

    // fetch action counts
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      const { data: acts } = await supabase
        .from("eho_visit_actions")
        .select("visit_id, status")
        .in("visit_id", ids);

      const counts: Record<string, number> = {};
      for (const a of (acts ?? []) as any[]) {
        if (a.status !== "done") counts[a.visit_id] = (counts[a.visit_id] ?? 0) + 1;
      }
      setOpenActionsByVisit(counts);
    } else {
      setOpenActionsByVisit({});
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, activeSiteId]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">EHO Visits</h1>
          <p className="text-muted-foreground">
            Track inspection outcomes, section ratings, uploads, and action plans.
          </p>
        </div>

        <Button
          onClick={() => nav("/app/eho/new")}
          disabled={!activeCompanyId || !activeSiteId}
        >
          New EHO visit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : visits.length === 0 ? (
            <div className="text-muted-foreground">No visits yet for this site.</div>
          ) : (
            <div className="space-y-2">
              {visits.map((v) => {
                const openCount = openActionsByVisit[v.id] ?? 0;
                return (
                  <button
                    key={v.id}
                    onClick={() => nav(`/app/eho/${v.id}`)}
                    className="w-full text-left rounded-lg border p-3 hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">
                          {v.visit_date}
                          {v.officer_name ? ` • ${v.officer_name}` : ""}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          Status: {v.status}
                          {v.notes ? ` • ${v.notes}` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center rounded-md border px-2 py-1 text-sm font-semibold">
                          Rating {v.overall_rating ?? "—"}
                        </span>

                        {openCount > 0 && (
                          <span className="inline-flex items-center rounded-md border px-2 py-1 text-sm font-semibold">
                            {openCount} open
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}