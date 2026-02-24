import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

type Json = Record<string, any>;

function asText(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function safeDate(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleDateString("en-GB");
}

function safeTime(s?: string | null) {
  if (!s) return "";
  if (/^\d{2}:\d{2}/.test(String(s))) return String(s).slice(0, 5);
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? String(s)
    : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

type DrawText = {
  page: number; // 0-indexed
  x: number;
  y: number;
  size?: number;
  maxWidth?: number;
  lineHeight?: number;
};

type YesNo = {
  yes: { page: number; x: number; y: number };
  no: { page: number; x: number; y: number };
};

type BodyRegionDot = { page: number; x: number; y: number };

const DEFAULT_FONT_SIZE = 10;

// =======================================================
// ✅ EDIT ONLY THIS BLOCK LATER: MAP coordinates
// =======================================================
const MAP: Record<
  "incident" | "accident" | "near_miss",
  {
    templateFile: string;
    fields: Record<string, DrawText>;
    yesno: Record<string, YesNo>;
    bodyDots: Record<string, BodyRegionDot>;
  }
> = {
  incident: {
    templateFile: "Incident.pdf",

    // ✅ All text fields from your schema keys
    // Start with x/y=0 placeholders; map them using debug PDF once.
    fields: {
      // --- Site details
      "site.tel": { page: 0, x: 0, y: 0, size: 10, maxWidth: 200 },
      "site.email": { page: 0, x: 0, y: 0, size: 10, maxWidth: 260 },
      "site.no": { page: 0, x: 0, y: 0, size: 10, maxWidth: 120 },

      // --- Person reporting
      "report.reported_date": { page: 0, x: 0, y: 0, size: 10 },
      "report.first_name": { page: 0, x: 0, y: 0, size: 10, maxWidth: 180 },
      "report.last_name": { page: 0, x: 0, y: 0, size: 10, maxWidth: 180 },
      "report.position_title": { page: 0, x: 0, y: 0, size: 10, maxWidth: 200 },
      "report.dob": { page: 0, x: 0, y: 0, size: 10 },
      "report.gender": { page: 0, x: 0, y: 0, size: 10 },
      "report.address_house": { page: 0, x: 0, y: 0, size: 10, maxWidth: 140 },
      "report.address_street": { page: 0, x: 0, y: 0, size: 10, maxWidth: 260 },
      "report.address_town": { page: 0, x: 0, y: 0, size: 10, maxWidth: 180 },
      "report.address_county": { page: 0, x: 0, y: 0, size: 10, maxWidth: 180 },
      "report.address_postcode": { page: 0, x: 0, y: 0, size: 10, maxWidth: 120 },
      "report.address_country": { page: 0, x: 0, y: 0, size: 10, maxWidth: 160 },
      "report.tel": { page: 0, x: 0, y: 0, size: 10, maxWidth: 160 },
      "report.email": { page: 0, x: 0, y: 0, size: 10, maxWidth: 260 },
      "report.sia_badge": { page: 0, x: 0, y: 0, size: 10, maxWidth: 160 },

      // --- Incident details
      "incident.date": { page: 0, x: 0, y: 0, size: 10 },
      "incident.time": { page: 0, x: 0, y: 0, size: 10 },
      "incident.location": { page: 0, x: 0, y: 0, size: 10, maxWidth: 320 },
      "incident.type": { page: 0, x: 0, y: 0, size: 10, maxWidth: 200 },
      "incident.first_aid_treatment": { page: 0, x: 0, y: 0, size: 10, maxWidth: 480, lineHeight: 12 },

      // --- Hospital / severity / police / event / CCTV (text fields)
      "severity.unconscious_details": { page: 1, x: 0, y: 0, size: 10, maxWidth: 480, lineHeight: 12 },
      "severity.resuscitation_detail": { page: 1, x: 0, y: 0, size: 10, maxWidth: 480, lineHeight: 12 },
      "police.involved_detail": { page: 1, x: 0, y: 0, size: 10, maxWidth: 480, lineHeight: 12 },
      "police.crime_reference": { page: 1, x: 0, y: 0, size: 10, maxWidth: 240 },
      "event.private_hire_detail": { page: 1, x: 0, y: 0, size: 10, maxWidth: 480, lineHeight: 12 },
      "cctv.available_detail": { page: 1, x: 0, y: 0, size: 10, maxWidth: 480, lineHeight: 12 },

      // --- Evidence
      "evidence.detail": { page: 1, x: 0, y: 0, size: 10, maxWidth: 480, lineHeight: 12 },
      "evidence.bag_number": { page: 1, x: 0, y: 0, size: 10, maxWidth: 180 },

      // --- Narrative
      "narrative.description": { page: 2, x: 0, y: 0, size: 10, maxWidth: 500, lineHeight: 12 },
      "narrative.causes": { page: 2, x: 0, y: 0, size: 10, maxWidth: 500, lineHeight: 12 },
      "narrative.additional_info": { page: 2, x: 0, y: 0, size: 10, maxWidth: 500, lineHeight: 12 },

      // --- Affected person
      "affected.first_name": { page: 2, x: 0, y: 0, size: 10, maxWidth: 180 },
      "affected.last_name": { page: 2, x: 0, y: 0, size: 10, maxWidth: 180 },
      "affected.status": { page: 2, x: 0, y: 0, size: 10, maxWidth: 120 },
      "affected.position": { page: 2, x: 0, y: 0, size: 10, maxWidth: 180 },
      "affected.employment_status": { page: 2, x: 0, y: 0, size: 10, maxWidth: 180 },
      "affected.employee_no": { page: 2, x: 0, y: 0, size: 10, maxWidth: 120 },
      "affected.return_to_work_date": { page: 2, x: 0, y: 0, size: 10 },
      "affected.lost_time_days": { page: 2, x: 0, y: 0, size: 10 },
      "affected.sick_notes": { page: 2, x: 0, y: 0, size: 10, maxWidth: 480, lineHeight: 12 },
      "affected.dob": { page: 2, x: 0, y: 0, size: 10 },
      "affected.gender": { page: 2, x: 0, y: 0, size: 10 },
      "affected.address_house": { page: 2, x: 0, y: 0, size: 10, maxWidth: 140 },
      "affected.address_street": { page: 2, x: 0, y: 0, size: 10, maxWidth: 260 },
      "affected.address_town": { page: 2, x: 0, y: 0, size: 10, maxWidth: 180 },
      "affected.address_county": { page: 2, x: 0, y: 0, size: 10, maxWidth: 180 },
      "affected.address_postcode": { page: 2, x: 0, y: 0, size: 10, maxWidth: 120 },
      "affected.address_country": { page: 2, x: 0, y: 0, size: 10, maxWidth: 160 },
      "affected.tel": { page: 2, x: 0, y: 0, size: 10, maxWidth: 160 },
      "affected.email": { page: 2, x: 0, y: 0, size: 10, maxWidth: 260 },
      "injury.comments": { page: 2, x: 0, y: 0, size: 10, maxWidth: 480, lineHeight: 12 },

      // --- Witness
      "witness.first_name": { page: 3, x: 0, y: 0, size: 10, maxWidth: 180 },
      "witness.second_name": { page: 3, x: 0, y: 0, size: 10, maxWidth: 180 },
      "witness.status": { page: 3, x: 0, y: 0, size: 10, maxWidth: 120 },
      "witness.dob": { page: 3, x: 0, y: 0, size: 10 },
      "witness.gender": { page: 3, x: 0, y: 0, size: 10 },
      "witness.address_house": { page: 3, x: 0, y: 0, size: 10, maxWidth: 140 },
      "witness.address_street": { page: 3, x: 0, y: 0, size: 10, maxWidth: 260 },
      "witness.address_town": { page: 3, x: 0, y: 0, size: 10, maxWidth: 180 },
      "witness.address_county": { page: 3, x: 0, y: 0, size: 10, maxWidth: 180 },
      "witness.address_postcode": { page: 3, x: 0, y: 0, size: 10, maxWidth: 120 },
      "witness.address_country": { page: 3, x: 0, y: 0, size: 10, maxWidth: 160 },
      "witness.tel": { page: 3, x: 0, y: 0, size: 10, maxWidth: 160 },
      "witness.email": { page: 3, x: 0, y: 0, size: 10, maxWidth: 260 },
      "witness.statement": { page: 3, x: 0, y: 0, size: 10, maxWidth: 500, lineHeight: 12 },
      "witness.sia_badge": { page: 3, x: 0, y: 0, size: 10, maxWidth: 160 },

      // --- Photos / RIDDOR / Investigation
      "riddor.injury_category": { page: 4, x: 0, y: 0, size: 10, maxWidth: 260 },
      "riddor.reporting_method": { page: 4, x: 0, y: 0, size: 10, maxWidth: 260 },
      "investigation.investigator_name": { page: 4, x: 0, y: 0, size: 10, maxWidth: 260 },
      "investigation.date": { page: 4, x: 0, y: 0, size: 10 },
      "investigation.action_to_reduce_recurrence": { page: 4, x: 0, y: 0, size: 10, maxWidth: 500, lineHeight: 12 },
      "investigation.by_whom": { page: 4, x: 0, y: 0, size: 10, maxWidth: 260 },
      "investigation.by_when": { page: 4, x: 0, y: 0, size: 10 }
    },

    // ✅ All yes/no checkbox keys from your schema
    yesno: {
      "incident.ambulance_offered": { yes: { page: 0, x: 0, y: 0 }, no: { page: 0, x: 0, y: 0 } },
      "incident.ambulance_called": { yes: { page: 0, x: 0, y: 0 }, no: { page: 0, x: 0, y: 0 } },
      "incident.first_aider_attended": { yes: { page: 0, x: 0, y: 0 }, no: { page: 0, x: 0, y: 0 } },

      "severity.went_to_hospital": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },
      "severity.kept_over_24h": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },
      "severity.unconscious": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },
      "severity.resuscitation_required": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },

      "police.involved": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },
      "police.anyone_cautioned": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },

      "event.private_hire": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },
      "cctv.available": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },

      "fire.fire_brigade_called": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },
      "fire.building_evacuated": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },
      "work.work_related": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },
      "evidence.seized": { yes: { page: 1, x: 0, y: 0 }, no: { page: 1, x: 0, y: 0 } },

      "photos.taken": { yes: { page: 4, x: 0, y: 0 }, no: { page: 4, x: 0, y: 0 } }
    },

    // ✅ Body map region dot coordinates (place dot on body picture)
    bodyDots: {
      front_head: { page: 2, x: 0, y: 0 },
      front_neck: { page: 2, x: 0, y: 0 },
      front_chest: { page: 2, x: 0, y: 0 },
      front_abdomen: { page: 2, x: 0, y: 0 },
      front_pelvis: { page: 2, x: 0, y: 0 },
      front_left_arm: { page: 2, x: 0, y: 0 },
      front_right_arm: { page: 2, x: 0, y: 0 },
      front_left_hand: { page: 2, x: 0, y: 0 },
      front_right_hand: { page: 2, x: 0, y: 0 },
      front_left_leg: { page: 2, x: 0, y: 0 },
      front_right_leg: { page: 2, x: 0, y: 0 },
      front_left_foot: { page: 2, x: 0, y: 0 },
      front_right_foot: { page: 2, x: 0, y: 0 },

      back_head: { page: 2, x: 0, y: 0 },
      back_neck: { page: 2, x: 0, y: 0 },
      back_upper_back: { page: 2, x: 0, y: 0 },
      back_lower_back: { page: 2, x: 0, y: 0 },
      back_left_arm: { page: 2, x: 0, y: 0 },
      back_right_arm: { page: 2, x: 0, y: 0 },
      back_left_leg: { page: 2, x: 0, y: 0 },
      back_right_leg: { page: 2, x: 0, y: 0 }
    }
  },

  accident: {
    templateFile: "Accident.pdf",
    fields: {},
    yesno: {},
    bodyDots: {}
  },

  near_miss: {
    templateFile: "Near Miss.pdf",
    fields: {},
    yesno: {},
    bodyDots: {}
  }
};

// =======================================================
// Helpers
// =======================================================
function wrapLines(text: string, maxChars: number) {
  const s = (text ?? "").toString().trim();
  if (!s) return [""];
  const words = s.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxChars) line = next;
    else {
      if (line) out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out;
}

function drawWrapped(page: any, font: any, text: string, x: number, y: number, size: number, maxWidth: number, lineHeight: number) {
  const approxChars = Math.max(10, Math.floor(maxWidth / (size * 0.55)));
  const lines = wrapLines(text, approxChars);
  let yy = y;
  for (const ln of lines) {
    page.drawText(ln, { x, y: yy, size, font, color: rgb(0, 0, 0) });
    yy -= lineHeight;
  }
}

function drawDebugGrid(page: any, font: any) {
  const w = page.getWidth();
  const h = page.getHeight();

  for (let x = 0; x <= w; x += 50) {
    page.drawLine({ start: { x, y: 0 }, end: { x, y: h }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
    page.drawText(String(x), { x: x + 2, y: h - 12, size: 7, font, color: rgb(0.6, 0.6, 0.6) });
  }
  for (let y = 0; y <= h; y += 50) {
    page.drawLine({ start: { x: 0, y }, end: { x: w, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
    page.drawText(String(y), { x: 2, y: y + 2, size: 7, font, color: rgb(0.6, 0.6, 0.6) });
  }
}

// =======================================================
// Edge Function
// =======================================================
serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Use POST", { status: 405 });

    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    const { incident_id } = await req.json().catch(() => ({}));
    if (!incident_id) {
      return new Response(JSON.stringify({ error: "incident_id is required" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing env SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Fetch incident
    const { data: incident, error: incErr } = await admin
      .from("incidents")
      .select("id, type, occurred_at, form_data")
      .eq("id", incident_id)
      .single();
    if (incErr) throw incErr;

    const typeKey = String(incident.type ?? "incident") as "incident" | "accident" | "near_miss";
    const tpl = MAP[typeKey];
    if (!tpl) throw new Error(`No PDF template configured for type: ${typeKey}`);

    // Load PDF background from function filesystem
    const pdfBytes = await Deno.readFile(new URL(`./templates/${tpl.templateFile}`, import.meta.url));
    const doc = await PDFDocument.load(pdfBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const pages = doc.getPages();
    const formData = (incident.form_data ?? {}) as Json;

    // Debug grid on all pages
    if (debug) {
      for (const p of pages) drawDebugGrid(p, font);
    }

    // Draw text fields
    for (const [k, cfg] of Object.entries(tpl.fields)) {
      const page = pages[cfg.page];
      if (!page) continue;

      const raw = formData[k];
      const txt = asText(raw);

      const size = cfg.size ?? DEFAULT_FONT_SIZE;
      const maxWidth = cfg.maxWidth ?? 420;
      const lineHeight = cfg.lineHeight ?? 12;

      if (cfg.maxWidth || cfg.lineHeight) {
        drawWrapped(page, font, txt, cfg.x, cfg.y, size, maxWidth, lineHeight);
      } else {
        page.drawText(txt || "", { x: cfg.x, y: cfg.y, size, font, color: rgb(0, 0, 0) });
      }
    }

    // Draw yes/no “X”
    for (const [k, cfg] of Object.entries(tpl.yesno)) {
      const v = formData[k];
      if (v === true) {
        const page = pages[cfg.yes.page];
        if (page) page.drawText("X", { x: cfg.yes.x, y: cfg.yes.y, size: 12, font, color: rgb(0, 0, 0) });
      } else if (v === false) {
        const page = pages[cfg.no.page];
        if (page) page.drawText("X", { x: cfg.no.x, y: cfg.no.y, size: 12, font, color: rgb(0, 0, 0) });
      }
    }

    // Draw body map dot for injury.body_location
    const region = formData["injury.body_location"];
    if (region && tpl.bodyDots?.[region]) {
      const dot = tpl.bodyDots[region];
      const page = pages[dot.page];
      if (page) {
        page.drawCircle({
          x: dot.x,
          y: dot.y,
          size: 4,
          color: rgb(1, 0, 0)
        });
      }
    }

    const out = await doc.save();
    const fileName = `Safyra_${typeKey}_Report_${String(incident.id).slice(0, 8)}.pdf`;

    return new Response(out, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${fileName}"`
      }
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
});