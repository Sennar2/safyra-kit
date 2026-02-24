import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

type Json = Record<string, any>;

const A4 = { w: 595.28, h: 841.89 };
const M = 40;
const LINE = 14;

function asText(v: any) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim() ? v : "—";
  return JSON.stringify(v);
}

function safeDateTime(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleString("en-GB");
}

function safeDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleDateString("en-GB");
}

function titleCase(s: string) {
  return s
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function wrapText(text: string, maxChars: number) {
  const s = (text ?? "").toString().trim();
  if (!s) return ["—"];
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxChars) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type Cursor = { pageIndex: number; x: number; y: number };

function addPage(doc: PDFDocument, font: any, fontBold: any) {
  const page = doc.addPage([A4.w, A4.h]);

  // Header
  page.drawText("Safyra", { x: M, y: A4.h - 50, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("Incident Report", {
    x: M + 70,
    y: A4.h - 46,
    size: 12,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });

  page.drawLine({
    start: { x: M, y: A4.h - 70 },
    end: { x: A4.w - M, y: A4.h - 70 },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  });

  // Footer placeholder (page numbers drawn later)
  return page;
}

function ensureSpace(doc: PDFDocument, pages: any[], cursor: Cursor, minY: number, font: any, fontBold: any) {
  if (cursor.y > minY) return pages[cursor.pageIndex];
  const p = addPage(doc, font, fontBold);
  pages.push(p);
  cursor.pageIndex = pages.length - 1;
  cursor.x = M;
  cursor.y = A4.h - 95;
  return p;
}

function h2(page: any, cursor: Cursor, text: string, fontBold: any) {
  page.drawText(text, { x: cursor.x, y: cursor.y, size: 13, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  cursor.y -= 18;
}

function labelValue(page: any, cursor: Cursor, label: string, value: string, font: any, fontBold: any) {
  page.drawText(label, { x: cursor.x, y: cursor.y, size: 9, font: fontBold, color: rgb(0.35, 0.35, 0.35) });
  page.drawText(value || "—", { x: cursor.x + 150, y: cursor.y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
  cursor.y -= LINE;
}

function multiline(page: any, cursor: Cursor, label: string, value: string, font: any, fontBold: any) {
  page.drawText(label, { x: cursor.x, y: cursor.y, size: 9, font: fontBold, color: rgb(0.35, 0.35, 0.35) });
  cursor.y -= 12;

  const lines = wrapText(value, 95);
  for (const ln of lines) {
    page.drawText(ln, { x: cursor.x, y: cursor.y, size: 9, font, color: rgb(0.15, 0.15, 0.15) });
    cursor.y -= LINE;
  }
  cursor.y -= 6;
}

function visibleField(field: any, formData: Json) {
  if (!field?.show_if) return true;
  const k = field.show_if.key;
  const eq = field.show_if.equals;
  return formData?.[k] === eq;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Use POST", { status: 405 });

    const { incident_id } = await req.json().catch(() => ({}));
    if (!incident_id) {
      return new Response(JSON.stringify({ error: "incident_id is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Incident (include what you actually store)
    const { data: incident, error: incErr } = await admin
      .from("incidents")
      .select(
        "id, company_id, site_id, title, type, status, occurred_at, location, reported_by, description, immediate_action, template_id, template_name, template_version, template_is_legal, template_snapshot, form_data, created_at"
      )
      .eq("id", incident_id)
      .single();

    if (incErr) throw incErr;

    // Actions
    const { data: actions, error: actErr } = await admin
      .from("incident_actions")
      .select("id, action_text, assigned_role, due_date, status, action_completed_notes, action_completed_at, created_at")
      .eq("incident_id", incident_id)
      .order("due_date", { ascending: true, nullsFirst: false });

    if (actErr) throw actErr;

    // Attachments
    const { data: attachments, error: attErr } = await admin
      .from("form_attachments")
      .select("id, filename, mime_type, path, created_at, uploaded_by")
      .eq("incident_id", incident_id)
      .order("created_at", { ascending: false });

    if (attErr) throw attErr;

    const formData = (incident.form_data ?? {}) as Json;

    // Schema: prefer snapshot (best for audit), else fetch template schema
    let schema: any = incident.template_snapshot ?? null;

    if (!schema && incident.template_id) {
      const { data: tpl } = await admin
        .from("incident_templates")
        .select("schema")
        .eq("id", incident.template_id)
        .single();
      if (tpl?.schema) schema = tpl.schema;
    }

    // PDF build
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const pages: any[] = [];
    pages.push(addPage(doc, font, fontBold));
    const cursor: Cursor = { pageIndex: 0, x: M, y: A4.h - 95 };

    const page0 = pages[0];

    // ===== Summary
    h2(page0, cursor, "Summary", fontBold);
    ensureSpace(doc, pages, cursor, 120, font, fontBold);

    labelValue(pages[cursor.pageIndex], cursor, "Incident ID", String(incident.id), font, fontBold);
    labelValue(pages[cursor.pageIndex], cursor, "Type", titleCase(String(incident.type)), font, fontBold);
    labelValue(pages[cursor.pageIndex], cursor, "Status", titleCase(String(incident.status)), font, fontBold);
    labelValue(pages[cursor.pageIndex], cursor, "Occurred at", safeDateTime(incident.occurred_at), font, fontBold);
    labelValue(pages[cursor.pageIndex], cursor, "Location", incident.location ?? "—", font, fontBold);
    labelValue(pages[cursor.pageIndex], cursor, "Reported by", incident.reported_by ?? "—", font, fontBold);
    labelValue(pages[cursor.pageIndex], cursor, "Created at", safeDateTime(incident.created_at), font, fontBold);
    cursor.y -= 6;

    ensureSpace(doc, pages, cursor, 140, font, fontBold);
    multiline(pages[cursor.pageIndex], cursor, "Title", incident.title ?? "—", font, fontBold);
    ensureSpace(doc, pages, cursor, 140, font, fontBold);
    multiline(pages[cursor.pageIndex], cursor, "Description", incident.description ?? "—", font, fontBold);
    ensureSpace(doc, pages, cursor, 140, font, fontBold);
    multiline(pages[cursor.pageIndex], cursor, "Immediate action", incident.immediate_action ?? "—", font, fontBold);

    // ===== Template metadata
    ensureSpace(doc, pages, cursor, 140, font, fontBold);
    h2(pages[cursor.pageIndex], cursor, "Template", fontBold);
    ensureSpace(doc, pages, cursor, 140, font, fontBold);

    labelValue(pages[cursor.pageIndex], cursor, "Template name", incident.template_name ?? "—", font, fontBold);
    labelValue(
      pages[cursor.pageIndex],
      cursor,
      "Template version",
      incident.template_version ? String(incident.template_version) : "—",
      font,
      fontBold
    );
    labelValue(pages[cursor.pageIndex], cursor, "Source", incident.template_is_legal ? "Legal" : "Company", font, fontBold);
    cursor.y -= 6;

    // ===== Form answers
    ensureSpace(doc, pages, cursor, 140, font, fontBold);
    h2(pages[cursor.pageIndex], cursor, "Form answers", fontBold);

    if (schema?.sections?.length) {
      for (const section of schema.sections) {
        ensureSpace(doc, pages, cursor, 140, font, fontBold);
        const p = pages[cursor.pageIndex];

        p.drawText(section.title ?? "Section", {
          x: cursor.x,
          y: cursor.y,
          size: 11,
          font: fontBold,
          color: rgb(0.15, 0.15, 0.15),
        });
        cursor.y -= 16;

        if (section.description) {
          const descLines = wrapText(String(section.description), 95);
          for (const ln of descLines) {
            ensureSpace(doc, pages, cursor, 120, font, fontBold);
            pages[cursor.pageIndex].drawText(ln, { x: cursor.x, y: cursor.y, size: 9, font, color: rgb(0.45, 0.45, 0.45) });
            cursor.y -= LINE;
          }
          cursor.y -= 4;
        }

        for (const f of section.fields ?? []) {
          if (!visibleField(f, formData)) continue;

          ensureSpace(doc, pages, cursor, 120, font, fontBold);
          const p2 = pages[cursor.pageIndex];

          const label = f.label ?? f.key;
          const raw = formData[f.key];

          let value = asText(raw);

          // Special formatting for some types
          if (f.type === "date" && typeof raw === "string") value = safeDate(raw);
          if (f.type === "datetime" && typeof raw === "string") value = safeDateTime(raw);

          // body_map: use region label if possible
          if (f.type === "body_map" && typeof raw === "string" && Array.isArray(f.regions)) {
            const found = f.regions.find((r: any) => r.key === raw);
            value = found?.label ?? raw;
          }

          const isLong = (value ?? "").length > 80 || f.type === "textarea";
          if (isLong) multiline(p2, cursor, label, value, font, fontBold);
          else labelValue(p2, cursor, label, value, font, fontBold);
        }

        cursor.y -= 6;
      }
    } else {
      ensureSpace(doc, pages, cursor, 140, font, fontBold);
      multiline(pages[cursor.pageIndex], cursor, "Note", "No template schema snapshot was found for this incident.", font, fontBold);

      // Still print whatever exists in form_data
      const keys = Object.keys(formData ?? {}).sort();
      for (const k of keys) {
        ensureSpace(doc, pages, cursor, 120, font, fontBold);
        labelValue(pages[cursor.pageIndex], cursor, k, asText(formData[k]), font, fontBold);
      }
    }

    // ===== Actions
    ensureSpace(doc, pages, cursor, 140, font, fontBold);
    h2(pages[cursor.pageIndex], cursor, "Actions", fontBold);

    const actRows = (actions ?? []) as any[];
    if (!actRows.length) {
      ensureSpace(doc, pages, cursor, 140, font, fontBold);
      multiline(pages[cursor.pageIndex], cursor, "Actions", "No actions recorded.", font, fontBold);
    } else {
      for (const a of actRows) {
        ensureSpace(doc, pages, cursor, 140, font, fontBold);
        multiline(pages[cursor.pageIndex], cursor, `Action (${titleCase(String(a.status ?? ""))})`, asText(a.action_text), font, fontBold);

        ensureSpace(doc, pages, cursor, 120, font, fontBold);
        labelValue(pages[cursor.pageIndex], cursor, "Assigned role", a.assigned_role ? titleCase(String(a.assigned_role)) : "—", font, fontBold);
        labelValue(pages[cursor.pageIndex], cursor, "Due date", a.due_date ?? "—", font, fontBold);

        if (a.status === "completed") {
          labelValue(pages[cursor.pageIndex], cursor, "Completed at", safeDateTime(a.action_completed_at), font, fontBold);
          multiline(pages[cursor.pageIndex], cursor, "Completion notes", a.action_completed_notes ?? "—", font, fontBold);
        }

        cursor.y -= 8;
      }
    }

    // ===== Attachments
    ensureSpace(doc, pages, cursor, 140, font, fontBold);
    h2(pages[cursor.pageIndex], cursor, "Attachments", fontBold);

    const attRows = (attachments ?? []) as any[];
    if (!attRows.length) {
      ensureSpace(doc, pages, cursor, 140, font, fontBold);
      multiline(pages[cursor.pageIndex], cursor, "Attachments", "No attachments uploaded.", font, fontBold);
    } else {
      for (const f of attRows) {
        ensureSpace(doc, pages, cursor, 120, font, fontBold);
        const name = f.filename ?? f.path ?? "file";
        const meta = `${f.mime_type ?? "file"} • ${safeDateTime(f.created_at)}`;
        labelValue(pages[cursor.pageIndex], cursor, name, meta, font, fontBold);
      }
    }

    // Footer page numbers
    const total = pages.length;
    for (let i = 0; i < total; i++) {
      const p = pages[i];
      p.drawLine({
        start: { x: M, y: 40 },
        end: { x: A4.w - M, y: 40 },
        thickness: 1,
        color: rgb(0.92, 0.92, 0.92),
      });
      p.drawText(`Page ${i + 1} of ${total}`, { x: A4.w - M - 90, y: 25, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    }

    const bytes = await doc.save();

    const titleSafe = String(incident.title ?? "incident").replace(/[^\w\- ]+/g, "_").slice(0, 40);
    const fileName = `Safyra_Incident_${titleSafe}_${String(incident.id).slice(0, 8)}.pdf`;

    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});