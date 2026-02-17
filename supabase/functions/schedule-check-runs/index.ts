import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ScheduleRow = {
  id: string;
  company_id: string;
  site_id: string;
  template_id: string;
  active: boolean;
  timezone: string;
  due_time: string; // "14:00:00"
  recurrence: "daily" | "weekly" | "monthly";
  weekdays: number[] | null; // 1..7
  monthday: number | null;   // 1..31
  start_date: string;        // YYYY-MM-DD
  end_date: string | null;   // YYYY-MM-DD
};

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * We keep it simple:
 * - Use UTC day boundaries inside function
 * - due_at is computed as "today at due_time" in UTC.
 * Later we can switch to true timezone conversion (Europe/London DST) using Temporal.
 */
function buildDueAtUtc(today: Date, due_time: string) {
  const [hh, mm] = due_time.split(":");
  const due = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), Number(hh), Number(mm), 0, 0));
  return due.toISOString();
}

// ISO dow 1..7 (Mon..Sun) from UTC date
function isoDowUTC(d: Date) {
  const js = d.getUTCDay(); // 0 Sun..6 Sat
  return js === 0 ? 7 : js;
}

function inDateRange(todayIso: string, start: string, end: string | null) {
  if (todayIso < start) return false;
  if (end && todayIso > end) return false;
  return true;
}

function scheduleApplies(s: ScheduleRow, today: Date) {
  const todayIso = toISODate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())));
  if (!inDateRange(todayIso, s.start_date, s.end_date)) return false;

  if (s.recurrence === "daily") return true;

  if (s.recurrence === "weekly") {
    const dow = isoDowUTC(today);
    const days = s.weekdays ?? [];
    return days.includes(dow);
  }

  if (s.recurrence === "monthly") {
    const day = today.getUTCDate();
    return s.monthday === day;
  }

  return false;
}

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;

    if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
    if (!serviceRoleKey) throw new Error("Missing SERVICE_ROLE_KEY");

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date(); // UTC
    const todayIso = toISODate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));

    // 1) Get active schedules
    const { data: schedules, error: sErr } = await admin
      .from("check_schedules")
      .select("id,company_id,site_id,template_id,active,timezone,due_time,recurrence,weekdays,monthday,start_date,end_date")
      .eq("active", true);

    if (sErr) throw sErr;

    const rows = (schedules ?? []) as ScheduleRow[];

    // 2) For each schedule that applies today, insert a run (if not exists)
    const inserts: any[] = [];
    for (const s of rows) {
      if (!scheduleApplies(s, now)) continue;

      const due_at = buildDueAtUtc(now, s.due_time);

      inserts.push({
        company_id: s.company_id,
        site_id: s.site_id,
        template_id: s.template_id,
        schedule_id: s.id,
        status: "open",
        due_at,
      });
    }

    if (inserts.length === 0) {
      return new Response(JSON.stringify({ ok: true, today: todayIso, created: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3) Upsert-like behavior via unique constraint (schedule_id, due_at)
    // We insert and ignore conflicts by doing "upsert" with no changes.
    const { error: iErr, data: inserted } = await admin
      .from("check_entries")
      .upsert(inserts, { onConflict: "schedule_id,due_at", ignoreDuplicates: true })
      .select("id");

    if (iErr) throw iErr;

    return new Response(JSON.stringify({ ok: true, today: todayIso, created: inserted?.length ?? 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
