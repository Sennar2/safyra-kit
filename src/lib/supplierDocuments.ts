// src/lib/supplierDocuments.ts
import { supabase } from "@/integrations/supabase/client";

export type SupplierDocStatus = "valid" | "expired" | "missing" | "review";

export type SupplierDocumentRow = {
  id: string;
  company_id: string;
  supplier_id: string;

  doc_type: string | null;
  title: string;

  issued_at: string | null;   // date
  expires_at: string | null;  // date
  status: SupplierDocStatus;

  notes: string | null;

  file_path: string | null;
  mime_type: string | null;

  created_at: string;
  updated_at: string;

  supplier?: { id: string; name: string } | null;
};

export async function listSupplierDocuments(companyId: string, supplierId?: string | null) {
  let q = supabase
    .from("supplier_documents")
    .select(
      `
      id,company_id,supplier_id,
      doc_type,title,issued_at,expires_at,status,notes,file_path,mime_type,
      created_at,updated_at,
      supplier:suppliers(id,name)
    `
    )
    .eq("company_id", companyId)
    .order("expires_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (supplierId) q = q.eq("supplier_id", supplierId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SupplierDocumentRow[];
}

export async function createSupplierDocument(
  companyId: string,
  input: {
    supplier_id: string;
    title: string;
    doc_type?: string | null;
    issued_at?: string | null;  // yyyy-mm-dd
    expires_at?: string | null; // yyyy-mm-dd
    status?: SupplierDocStatus;
    notes?: string | null;
    file_path?: string | null;
    mime_type?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("supplier_documents")
    .insert({
      company_id: companyId,
      supplier_id: input.supplier_id,
      title: input.title,
      doc_type: input.doc_type ?? null,
      issued_at: input.issued_at ?? null,
      expires_at: input.expires_at ?? null,
      status: input.status ?? "valid",
      notes: input.notes ?? null,
      file_path: input.file_path ?? null,
      mime_type: input.mime_type ?? null,
      updated_at: new Date().toISOString(),
    })
    .select(
      `
      id,company_id,supplier_id,
      doc_type,title,issued_at,expires_at,status,notes,file_path,mime_type,
      created_at,updated_at,
      supplier:suppliers(id,name)
    `
    )
    .single();

  if (error) throw error;
  return data as SupplierDocumentRow;
}

export async function updateSupplierDocument(
  id: string,
  patch: Partial<Pick<
    SupplierDocumentRow,
    "doc_type" | "title" | "issued_at" | "expires_at" | "status" | "notes" | "file_path" | "mime_type"
  >>
) {
  const { data, error } = await supabase
    .from("supplier_documents")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(
      `
      id,company_id,supplier_id,
      doc_type,title,issued_at,expires_at,status,notes,file_path,mime_type,
      created_at,updated_at,
      supplier:suppliers(id,name)
    `
    )
    .single();

  if (error) throw error;
  return data as SupplierDocumentRow;
}

export async function deleteSupplierDocument(id: string) {
  const { error } = await supabase.from("supplier_documents").delete().eq("id", id);
  if (error) throw error;
}