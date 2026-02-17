import { supabase } from "@/integrations/supabase/client";

export type ScheduleInput = {
  companyId: string;
  siteId: string;
  templateId: string;
  dueTime: string; // "14:00"
  timezone?: string; // default Europe/London
  recurrence: "daily" | "weekly" | "monthly";
  weekdays?: number[]; // weekly: 1..7
  monthday?: number;   // monthly: 1..31
  startDate?: string;  // YYYY-MM-DD
  endDate?: string | null;
  active?: boolean;
};

export async function listSchedules(companyId: string, siteId: string) {
  const { data, error } = await supabase
    .from("check_schedules")
    .select("id,company_id,site_id,template_id,active,timezone,due_time,recurrence,weekdays,monthday,start_date,end_date,created_at")
    .eq("company_id", companyId)
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createSchedule(input: ScheduleInput) {
  const payload = {
    company_id: input.companyId,
    site_id: input.siteId,
    template_id: input.templateId,
    active: input.active ?? true,
    timezone: input.timezone ?? "Europe/London",
    due_time: input.dueTime.length === 5 ? `${input.dueTime}:00` : input.dueTime,
    recurrence: input.recurrence,
    weekdays: input.weekdays ?? null,
    monthday: input.monthday ?? null,
    start_date: input.startDate ?? new Date().toISOString().slice(0, 10),
    end_date: input.endDate ?? null,
  };

  const { data, error } = await supabase
    .from("check_schedules")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function setScheduleActive(scheduleId: string, active: boolean) {
  const { data, error } = await supabase
    .from("check_schedules")
    .update({ active })
    .eq("id", scheduleId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSchedule(scheduleId: string) {
  const { error } = await supabase.from("check_schedules").delete().eq("id", scheduleId);
  if (error) throw error;
  return true;
}
