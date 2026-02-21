// src/pages/app/Suppliers.tsx
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTenant } from "@/lib/tenantContext";
import {
  listSuppliers,
  createSupplier,
  setSupplierActive,
  type SupplierRow,
  type SupplierStatus,
} from "@/lib/suppliers";

import {
  listSupplierProducts,
  createSupplierProduct,
  updateSupplierProduct,
  deleteSupplierProduct,
  type SupplierProductRow,
} from "@/lib/supplierProducts";

import {
  listSupplierDocuments,
  createSupplierDocument,
  updateSupplierDocument,
  deleteSupplierDocument,
  type SupplierDocumentRow,
  type SupplierDocStatus,
} from "@/lib/supplierDocuments";

import {
  listSupplierDeliveries,
  createSupplierDelivery,
  listDeliveryItems,
  addDeliveryItem,
  deleteDeliveryItem,
  type SupplierDeliveryRow,
  type SupplierDeliveryItemRow,
  type SupplierDeliveryStatus,
} from "@/lib/supplierDeliveries";

import { listSites, listTempProbes, createDeliveryTempRecord } from "@/lib/temps";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  Truck,
  Plus,
  RefreshCw,
  FileText,
  Receipt,
  Package,
  Users,
  ShieldCheck,
  AlertTriangle,
  Search,
  Trash2,
} from "lucide-react";

const SENTINEL_NONE = "__none__";
function toNullableUuid(v: string | null | undefined) {
  if (!v) return null;
  if (v === SENTINEL_NONE) return null;
  return v;
}

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    return Number.isNaN(d.getTime()) ? String(dt) : d.toLocaleString();
  } catch {
    return String(dt);
  }
}

function statusBadge(s: SupplierStatus) {
  if (s === "approved") return <Badge variant="default">approved</Badge>;
  if (s === "pending") return <Badge variant="secondary">pending</Badge>;
  if (s === "blocked") return <Badge variant="destructive">blocked</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

function docStatusBadge(status: SupplierDocStatus) {
  if (status === "valid") return <Badge variant="secondary">valid</Badge>;
  if (status === "review") return <Badge variant="outline">review</Badge>;
  if (status === "missing") return <Badge variant="destructive">missing</Badge>;
  if (status === "expired") return <Badge variant="destructive">expired</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function isExpiredDate(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return false;
  // expires_at is a date; treat midnight local
  return d.getTime() < Date.now();
}

function deliveryStatusBadge(s: SupplierDeliveryStatus) {
  if (s === "received") return <Badge variant="secondary">received</Badge>;
  if (s === "partial") return <Badge variant="outline">partial</Badge>;
  if (s === "rejected") return <Badge variant="destructive">rejected</Badge>;
  if (s === "quarantined") return <Badge variant="destructive">quarantined</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

export default function Suppliers() {
  const { activeCompanyId } = useTenant();

  const [tab, setTab] = useState<"suppliers" | "products" | "deliveries" | "docs" | "contacts" | "performance">(
    "suppliers"
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [q, setQ] = useState("");

  // global supplier filter for tabs
  const [activeSupplierId, setActiveSupplierId] = useState<string>("");

  // Create supplier form
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<string>("general");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAccountRef, setNewAccountRef] = useState("");
  const [newStatus, setNewStatus] = useState<SupplierStatus>("pending");

  // PRODUCTS state
  const [products, setProducts] = useState<SupplierProductRow[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [pName, setPName] = useState("");
  const [pSku, setPSku] = useState("");
  const [pCategory, setPCategory] = useState("");
  const [pAllergens, setPAllergens] = useState("");
  const [pSpecNotes, setPSpecNotes] = useState("");
  const [pApproved, setPApproved] = useState(false);
  const [pTempCheck, setPTempCheck] = useState(false);
  const [pMin, setPMin] = useState<string>("");
  const [pMax, setPMax] = useState<string>("");

  // DOCS state
  const [docs, setDocs] = useState<SupplierDocumentRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [dTitle, setDTitle] = useState("");
  const [dType, setDType] = useState("");
  const [dIssued, setDIssued] = useState<string>("");
  const [dExpires, setDExpires] = useState<string>("");
  const [dStatus, setDStatus] = useState<SupplierDocStatus>("valid");
  const [dNotes, setDNotes] = useState("");

  // DELIVERIES state (simple scaffold)
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [deliveries, setDeliveries] = useState<SupplierDeliveryRow[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const [delSiteId, setDelSiteId] = useState<string>(SENTINEL_NONE); // optional (sentinel)
  const [delStatus, setDelStatus] = useState<SupplierDeliveryStatus>("received");
  const [delInvoiceNumber, setDelInvoiceNumber] = useState("");
  const [delInvoiceTotal, setDelInvoiceTotal] = useState<string>("");
  const [delNotes, setDelNotes] = useState("");

  const [openDeliveryId, setOpenDeliveryId] = useState<string | null>(null);
  const [deliveryItems, setDeliveryItems] = useState<Record<string, SupplierDeliveryItemRow[]>>({});

  const [itemProductId, setItemProductId] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");
  const [itemQty, setItemQty] = useState<string>("");
  const [itemUnit, setItemUnit] = useState<string>("pcs");
  const [itemNotes, setItemNotes] = useState<string>("");

  // DELIVERY TEMP MODAL
  type DeliveryTempResult = "ok" | "reject" | "quarantine";

  const [tempOpen, setTempOpen] = useState(false);
  const [tempDeliveryId, setTempDeliveryId] = useState<string | null>(null);

  const [probeOptions, setProbeOptions] = useState<{ id: string; name: string; serial?: string | null }[]>([]);
  const [probeId, setProbeId] = useState<string>(SENTINEL_NONE);
  const [tempC, setTempC] = useState<string>("");
  const [tempResult, setTempResult] = useState<DeliveryTempResult>("ok");
  const [tempNotes, setTempNotes] = useState<string>("");

  const [savingTemp, setSavingTemp] = useState(false);

  const openTempModal = (deliveryId: string) => {
    setTempDeliveryId(deliveryId);
    setProbeId(SENTINEL_NONE);
    setTempC("");
    setTempResult("ok");
    setTempNotes("");
    setTempOpen(true);
  };

const submitDeliveryTemp = async () => {
  if (!tempDeliveryId || !activeCompanyId) return;

  const parsed = Number(tempC);
  if (!Number.isFinite(parsed)) {
    setErr("Please enter a valid temperature (number).");
    return;
  }

  // find the delivery row
  const delivery = deliveries.find((d) => d.id === tempDeliveryId);
  if (!delivery) {
    setErr("Delivery not found.");
    return;
  }

  if (!delivery.site_id) {
    setErr("This delivery has no site assigned. Please assign a site before logging temperature.");
    return;
  }

  const selectedProbeId = probeId === SENTINEL_NONE ? null : probeId;

  setErr(null);
  setSavingTemp(true);

  try {
    await createDeliveryTempRecord({
      companyId: activeCompanyId,
      siteId: delivery.site_id,
      valueC: parsed,
      probeId: selectedProbeId,
      notes: tempNotes.trim() || null,

      itemName: "Delivery temperature check",
      supplier: delivery.supplier?.name ?? null,
      deliveryResult: tempResult,

      supplierDeliveryId: delivery.id,
      supplierId: delivery.supplier_id ?? null,

      requiresAction: tempResult !== "ok",
      actionNotes: tempResult !== "ok" ? "Delivery temperature out of range" : null,
      actionDueAt: null,
    });

    setTempOpen(false);
    await loadDeliveries();
  } catch (e: any) {
    console.error(e);
    setErr(e?.message ?? "Failed to log delivery temperature");
  } finally {
    setSavingTemp(false);
  }
};

  const loadSuppliers = async (companyId: string) => {
    setErr(null);
    setLoading(true);
    try {
      const data = await listSuppliers(companyId);
      setRows(data);

      // keep supplier selection stable
      if (!activeSupplierId && data[0]?.id) setActiveSupplierId(data[0].id);
      if (activeSupplierId && !data.some((x) => x.id === activeSupplierId)) {
        setActiveSupplierId(data[0]?.id ?? "");
      }
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to load suppliers");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!activeCompanyId) return;
    setErr(null);
    setProductsLoading(true);
    try {
      const data = await listSupplierProducts(activeCompanyId, activeSupplierId || null);
      setProducts(data);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to load products");
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const loadDocs = async () => {
    if (!activeCompanyId) return;
    setErr(null);
    setDocsLoading(true);
    try {
      const data = await listSupplierDocuments(activeCompanyId, activeSupplierId || null);
      setDocs(data);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to load documents");
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const loadDeliveries = async () => {
    if (!activeCompanyId) return;
    setErr(null);
    setDeliveriesLoading(true);
    try {
      const [dels, s] = await Promise.all([
        listSupplierDeliveries(activeCompanyId, activeSupplierId || null, 50),
        listSites(activeCompanyId),
      ]);
      setDeliveries(dels);
      setSites((s ?? []).map((x) => ({ id: x.id, name: x.name })));
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to load deliveries");
      setDeliveries([]);
      setSites([]);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  useEffect(() => {
    if (!activeCompanyId) return;
    loadSuppliers(activeCompanyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  // Load probes once per company
  useEffect(() => {
    if (!activeCompanyId) return;

    (async () => {
      try {
        const probes = await listTempProbes(activeCompanyId);
        setProbeOptions((probes ?? []).map((p: any) => ({ id: p.id, name: p.name, serial: p.serial ?? null })));
      } catch (e) {
        console.error("Failed to load probes", e);
      }
    })();
  }, [activeCompanyId]);

  // Load per-tab data when switching tabs / supplier changes
  useEffect(() => {
    if (!activeCompanyId) return;
    if (!activeSupplierId) return;

    if (tab === "products") loadProducts();
    if (tab === "docs") loadDocs();
    if (tab === "deliveries") {
  loadDeliveries();
  loadProducts(); // ✅ makes "Map to product" dropdown populate
}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeSupplierId, activeCompanyId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;

    return rows.filter((s) => {
      const hay = [s.name, s.type ?? "", s.email ?? "", s.phone ?? "", s.account_ref ?? "", s.status ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.active).length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const blocked = rows.filter((r) => r.status === "blocked").length;
    return { total, active, pending, blocked };
  }, [rows]);

  const resetCreate = () => {
    setNewName("");
    setNewType("general");
    setNewEmail("");
    setNewPhone("");
    setNewAccountRef("");
    setNewStatus("pending");
  };

  const onCreateSupplier = async () => {
    if (!activeCompanyId) return;
    if (!newName.trim()) return;

    setErr(null);
    setSaving(true);
    try {
      await createSupplier(activeCompanyId, {
        name: newName.trim(),
        type: newType.trim() || "general",
        email: newEmail.trim() || null,
        phone: newPhone.trim() || null,
        account_ref: newAccountRef.trim() || null,
        status: newStatus,
      });

      setCreateOpen(false);
      resetCreate();
      await loadSuppliers(activeCompanyId);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to create supplier");
    } finally {
      setSaving(false);
    }
  };

  const onCreateProduct = async () => {
    if (!activeCompanyId || !activeSupplierId) return;
    if (!pName.trim()) return;

    setErr(null);
    setSaving(true);
    try {
      const min = pMin.trim() === "" ? null : Number(pMin);
      const max = pMax.trim() === "" ? null : Number(pMax);

      await createSupplierProduct(activeCompanyId, {
        supplier_id: activeSupplierId,
        name: pName.trim(),
        sku: pSku.trim() || null,
        category: pCategory.trim() || null,
        allergens: pAllergens.trim() || null,
        spec_notes: pSpecNotes.trim() || null,
        approved: pApproved,
        requires_temp_check: pTempCheck,
        storage_temp_min_c: Number.isNaN(min as any) ? null : min,
        storage_temp_max_c: Number.isNaN(max as any) ? null : max,
        active: true,
      });

      setPName("");
      setPSku("");
      setPCategory("");
      setPAllergens("");
      setPSpecNotes("");
      setPApproved(false);
      setPTempCheck(false);
      setPMin("");
      setPMax("");

      await loadProducts();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to create product");
    } finally {
      setSaving(false);
    }
  };

  const onCreateDoc = async () => {
    if (!activeCompanyId || !activeSupplierId) return;
    if (!dTitle.trim()) return;

    setErr(null);
    setSaving(true);
    try {
      await createSupplierDocument(activeCompanyId, {
        supplier_id: activeSupplierId,
        title: dTitle.trim(),
        doc_type: dType.trim() || null,
        issued_at: dIssued || null,
        expires_at: dExpires || null,
        status: dStatus,
        notes: dNotes.trim() || null,
      });

      setDTitle("");
      setDType("");
      setDIssued("");
      setDExpires("");
      setDStatus("valid");
      setDNotes("");

      await loadDocs();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to create document");
    } finally {
      setSaving(false);
    }
  };

  const onCreateDelivery = async () => {
    if (!activeCompanyId || !activeSupplierId) return;

    setErr(null);
    setSaving(true);
    try {
      const total = delInvoiceTotal.trim() === "" ? null : Number(delInvoiceTotal);

      const d = await createSupplierDelivery(activeCompanyId, {
        supplier_id: activeSupplierId,
        site_id: toNullableUuid(delSiteId),
        status: delStatus,
        invoice_number: delInvoiceNumber.trim() || null,
        invoice_total: Number.isNaN(total as any) ? null : total,
        notes: delNotes.trim() || null,
      });

      setDelSiteId(SENTINEL_NONE);
      setDelStatus("received");
      setDelInvoiceNumber("");
      setDelInvoiceTotal("");
      setDelNotes("");

      await loadDeliveries();
      setOpenDeliveryId(d.id);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to create delivery");
    } finally {
      setSaving(false);
    }
  };

  const onOpenDelivery = async (deliveryId: string) => {
    if (!activeCompanyId) return;
    setOpenDeliveryId((prev) => (prev === deliveryId ? null : deliveryId));

    // load items once
    if (!deliveryItems[deliveryId]) {
      try {
        const items = await listDeliveryItems(activeCompanyId, deliveryId);
        setDeliveryItems((prev) => ({ ...prev, [deliveryId]: items }));
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load delivery items");
      }
    }
  };

  const onAddDeliveryItem = async () => {
    if (!activeCompanyId || !openDeliveryId) return;
    setErr(null);
    setSaving(true);
    try {
      const qty = itemQty.trim() === "" ? null : Number(itemQty);

      const created = await addDeliveryItem(activeCompanyId, {
        delivery_id: openDeliveryId,
        supplier_product_id: itemProductId || null,
        item_name: itemName.trim() || null,
        qty: Number.isNaN(qty as any) ? null : qty,
        unit: itemUnit.trim() || null,
        line_notes: itemNotes.trim() || null,
      });

      setDeliveryItems((prev) => ({
        ...prev,
        [openDeliveryId]: [...(prev[openDeliveryId] ?? []), created],
      }));

      setItemProductId("");
      setItemName("");
      setItemQty("");
      setItemUnit("pcs");
      setItemNotes("");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  const supplierOptions = rows;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Truck className="w-7 h-7" />
            Supplier Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage suppliers, products, deliveries/invoices, and compliance documents (SALSA / allergen specs / insurance).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => activeCompanyId && loadSuppliers(activeCompanyId)}
            disabled={loading || !activeCompanyId}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>

          <Button onClick={() => setCreateOpen(true)} disabled={!activeCompanyId} className="gap-2">
            <Plus className="w-4 h-4" />
            Add supplier
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="Suppliers" value={kpis.total} icon={<Truck className="w-5 h-5" />} />
        <KpiCard title="Active" value={kpis.active} icon={<ShieldCheck className="w-5 h-5" />} />
        <KpiCard title="Pending" value={kpis.pending} icon={<AlertTriangle className="w-5 h-5" />} />
        <KpiCard title="Blocked" value={kpis.blocked} icon={<AlertTriangle className="w-5 h-5" />} />
      </div>

      {err && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="mt-6 flex flex-col md:flex-row md:items-center gap-3">
        <div className="text-xs text-muted-foreground">Supplier context</div>
        <div className="min-w-[280px]">
          <Select value={activeSupplierId} onValueChange={setActiveSupplierId} disabled={!supplierOptions.length}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              {supplierOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!supplierOptions.length ? (
          <div className="text-xs text-muted-foreground">Create a supplier first.</div>
        ) : null}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-6">
        <TabsList>
          <TabsTrigger value="suppliers" className="gap-2">
            <Truck className="w-4 h-4" /> Suppliers
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="w-4 h-4" /> Products
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="gap-2">
            <Receipt className="w-4 h-4" /> Deliveries & Invoices
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-2">
            <FileText className="w-4 h-4" /> Documents
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2">
            <Users className="w-4 h-4" /> Contacts
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Performance
          </TabsTrigger>
        </TabsList>

        {/* SUPPLIERS */}
        <TabsContent value="suppliers" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suppliers</CardTitle>
              <CardDescription>Search, approve/blocked, and toggle active/inactive.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by name, account ref, email, type…"
                    className="pl-9"
                  />
                </div>
              </div>

              {loading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No suppliers found. Click <span className="font-semibold">Add supplier</span> to create one.
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((s) => (
                    <div key={s.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className={cn(
                              "font-semibold truncate hover:underline",
                              activeSupplierId === s.id && "text-emerald-700"
                            )}
                            onClick={() => setActiveSupplierId(s.id)}
                          >
                            {s.name}
                          </button>
                          {statusBadge(s.status)}
                          <Badge variant={s.active ? "secondary" : "outline"}>{s.active ? "active" : "inactive"}</Badge>
                          {s.type ? <Badge variant="outline">{s.type}</Badge> : null}
                        </div>

                        <div className="text-xs text-muted-foreground mt-1">
                          {s.account_ref ? `Ref: ${s.account_ref} • ` : ""}
                          {s.email ? `Email: ${s.email} • ` : ""}
                          {s.phone ? `Phone: ${s.phone} • ` : ""}
                          Created: {fmt(s.created_at)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-xs text-muted-foreground">Active</div>
                        <Switch
                          checked={s.active}
                          onCheckedChange={async (val) => {
                            if (!activeCompanyId) return;
                            try {
                              setErr(null);
                              await setSupplierActive(s.id, !!val);
                              await loadSuppliers(activeCompanyId);
                            } catch (e: any) {
                              setErr(e?.message ?? "Failed to update supplier");
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {createOpen && (
            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Add supplier</span>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateOpen(false);
                      resetCreate();
                    }}
                    disabled={saving}
                  >
                    Close
                  </Button>
                </CardTitle>
                <CardDescription>Create a supplier profile (then add products + documents).</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Supplier name *</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Bidfood, Brakes, Local Fishmonger" />
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="e.g. general, meat, fish, dairy, produce" />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={(v) => setNewStatus(v as SupplierStatus)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">pending</SelectItem>
                      <SelectItem value="approved">approved</SelectItem>
                      <SelectItem value="blocked">blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="accounts@…" />
                </div>

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+44…" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Account / Supplier reference</Label>
                  <Input value={newAccountRef} onChange={(e) => setNewAccountRef(e.target.value)} placeholder="Your internal ref / supplier account number" />
                </div>

                <Separator className="md:col-span-2" />

                <div className="md:col-span-2 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Next: add products (temp ranges) + documents (expiry).
                  </div>
                  <Button onClick={onCreateSupplier} disabled={!activeCompanyId || saving || !newName.trim()} className="gap-2">
                    <Plus className="w-4 h-4" />
                    {saving ? "Saving…" : "Create supplier"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PRODUCTS */}
        <TabsContent value="products" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supplier products</CardTitle>
              <CardDescription>
                Add products you buy from this supplier. We’ll link “requires temp check” to Temps next.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!activeSupplierId ? (
                <div className="text-sm text-muted-foreground">Select a supplier above first.</div>
              ) : (
                <>
                  <div className="rounded-xl border border-border p-4">
                    <div className="font-semibold">Add product</div>
                    <div className="text-xs text-muted-foreground">Use min/max storage temps for chilled items.</div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Product name *</Label>
                        <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Chicken thighs 2.5kg" />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Input value={pCategory} onChange={(e) => setPCategory(e.target.value)} placeholder="e.g. meat, dairy, produce" />
                      </div>

                      <div className="space-y-2">
                        <Label>SKU (optional)</Label>
                        <Input value={pSku} onChange={(e) => setPSku(e.target.value)} placeholder="Supplier SKU" />
                      </div>
                      <div className="space-y-2">
                        <Label>Allergens (optional)</Label>
                        <Input value={pAllergens} onChange={(e) => setPAllergens(e.target.value)} placeholder="e.g. milk, eggs, gluten" />
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <Label>Spec notes</Label>
                        <Input value={pSpecNotes} onChange={(e) => setPSpecNotes(e.target.value)} placeholder="Any spec / traceability notes…" />
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0">
                          <div className="font-semibold">Approved</div>
                          <div className="text-xs text-muted-foreground">Only approved products should be used.</div>
                        </div>
                        <Switch checked={pApproved} onCheckedChange={setPApproved} />
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                        <div className="min-w-0">
                          <div className="font-semibold">Requires temp check</div>
                          <div className="text-xs text-muted-foreground">We’ll connect this to Temps.</div>
                        </div>
                        <Switch checked={pTempCheck} onCheckedChange={setPTempCheck} />
                      </div>

                      <div className="space-y-2">
                        <Label>Min storage temp (°C)</Label>
                        <Input value={pMin} onChange={(e) => setPMin(e.target.value)} placeholder="e.g. 0" inputMode="decimal" />
                      </div>
                      <div className="space-y-2">
                        <Label>Max storage temp (°C)</Label>
                        <Input value={pMax} onChange={(e) => setPMax(e.target.value)} placeholder="e.g. 5" inputMode="decimal" />
                      </div>

                      <div className="md:col-span-2 flex items-center justify-end">
                        <Button onClick={onCreateProduct} disabled={!pName.trim() || saving} className="gap-2">
                          <Plus className="w-4 h-4" />
                          Add product
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <div className="font-semibold">Products list</div>
                    <div className="text-xs text-muted-foreground">Toggle approved/active quickly.</div>

                    <div className="mt-3">
                      {productsLoading ? (
                        <div className="text-sm text-muted-foreground">Loading…</div>
                      ) : products.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No products yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {products.map((p) => (
                            <div key={p.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="font-semibold truncate">{p.name}</div>
                                  {p.approved ? <Badge variant="default">approved</Badge> : <Badge variant="secondary">not approved</Badge>}
                                  <Badge variant={p.active ? "secondary" : "outline"}>{p.active ? "active" : "inactive"}</Badge>
                                  {p.requires_temp_check ? <Badge variant="outline">temp check</Badge> : null}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {p.category ? `Category: ${p.category} • ` : ""}
                                  {p.sku ? `SKU: ${p.sku} • ` : ""}
                                  {p.storage_temp_min_c !== null || p.storage_temp_max_c !== null
                                    ? `Temp: ${p.storage_temp_min_c ?? "—"} → ${p.storage_temp_max_c ?? "—"} °C • `
                                    : ""}
                                  Updated: {fmt(p.updated_at)}
                                </div>
                                {p.allergens ? <div className="text-xs mt-1">Allergens: <span className="text-muted-foreground">{p.allergens}</span></div> : null}
                                {p.spec_notes ? <div className="text-xs mt-1 text-muted-foreground">{p.spec_notes}</div> : null}
                              </div>

                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-muted-foreground">Approved</div>
                                  <Switch
                                    checked={p.approved}
                                    onCheckedChange={async (val) => {
                                      try {
                                        setErr(null);
                                        await updateSupplierProduct(p.id, { approved: !!val });
                                        await loadProducts();
                                      } catch (e: any) {
                                        setErr(e?.message ?? "Failed to update product");
                                      }
                                    }}
                                  />
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-muted-foreground">Active</div>
                                  <Switch
                                    checked={p.active}
                                    onCheckedChange={async (val) => {
                                      try {
                                        setErr(null);
                                        await updateSupplierProduct(p.id, { active: !!val });
                                        await loadProducts();
                                      } catch (e: any) {
                                        setErr(e?.message ?? "Failed to update product");
                                      }
                                    }}
                                  />
                                </div>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      setErr(null);
                                      await deleteSupplierProduct(p.id);
                                      await loadProducts();
                                    } catch (e: any) {
                                      setErr(e?.message ?? "Failed to delete product");
                                    }
                                  }}
                                  className="gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="docs" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supplier documents</CardTitle>
              <CardDescription>
                Track insurance, SALSA/BRC, HACCP, allergen specs — with expiry dates.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {!activeSupplierId ? (
                <div className="text-sm text-muted-foreground">Select a supplier above first.</div>
              ) : (
                <>
                  <div className="rounded-xl border border-border p-4">
                    <div className="font-semibold">Add document</div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Title *</Label>
                        <Input value={dTitle} onChange={(e) => setDTitle(e.target.value)} placeholder="e.g. Public Liability Insurance" />
                      </div>

                      <div className="space-y-2">
                        <Label>Doc type</Label>
                        <Input value={dType} onChange={(e) => setDType(e.target.value)} placeholder="e.g. insurance, allergen-spec, salsa" />
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={dStatus} onValueChange={(v) => setDStatus(v as SupplierDocStatus)}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="valid">valid</SelectItem>
                            <SelectItem value="review">review</SelectItem>
                            <SelectItem value="expired">expired</SelectItem>
                            <SelectItem value="missing">missing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Issued (optional)</Label>
                        <Input type="date" value={dIssued} onChange={(e) => setDIssued(e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label>Expires (optional)</Label>
                        <Input type="date" value={dExpires} onChange={(e) => setDExpires(e.target.value)} />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Notes</Label>
                        <Input value={dNotes} onChange={(e) => setDNotes(e.target.value)} placeholder="Any notes…" />
                      </div>

                      <div className="md:col-span-2 flex items-center justify-end">
                        <Button onClick={onCreateDoc} disabled={!dTitle.trim() || saving} className="gap-2">
                          <Plus className="w-4 h-4" />
                          Add document
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <div className="font-semibold">Documents list</div>
                    <div className="text-xs text-muted-foreground">Expiry is highlighted automatically.</div>

                    <div className="mt-3">
                      {docsLoading ? (
                        <div className="text-sm text-muted-foreground">Loading…</div>
                      ) : docs.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No documents yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {docs.map((d) => {
                            const expired = isExpiredDate(d.expires_at) || d.status === "expired";
                            return (
                              <div
                                key={d.id}
                                className={cn(
                                  "rounded-lg border p-3 flex items-start justify-between gap-3",
                                  expired ? "border-red-200" : "border-border"
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-semibold truncate">{d.title}</div>
                                    {docStatusBadge(d.status)}
                                    {expired ? <Badge variant="destructive">expired</Badge> : null}
                                    {d.doc_type ? <Badge variant="outline">{d.doc_type}</Badge> : null}
                                  </div>

                                  <div className="text-xs text-muted-foreground mt-1">
                                    Issued: {d.issued_at ?? "—"} • Expires:{" "}
                                    <span className={cn(expired && "text-red-600 font-medium")}>{d.expires_at ?? "—"}</span>
                                    {" • "}
                                    Updated: {fmt(d.updated_at)}
                                  </div>

                                  {d.notes ? <div className="text-xs text-muted-foreground mt-1">{d.notes}</div> : null}

                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          setErr(null);
                                          const next = d.status === "valid" ? "review" : "valid";
                                          await updateSupplierDocument(d.id, { status: next as SupplierDocStatus });
                                          await loadDocs();
                                        } catch (e: any) {
                                          setErr(e?.message ?? "Failed to update document");
                                        }
                                      }}
                                    >
                                      Toggle valid/review
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          setErr(null);
                                          await deleteSupplierDocument(d.id);
                                          await loadDocs();
                                        } catch (e: any) {
                                          setErr(e?.message ?? "Failed to delete document");
                                        }
                                      }}
                                      className="gap-2"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete
                                    </Button>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <div className="text-xs text-muted-foreground">Status</div>
                                  <Select
                                    value={d.status}
                                    onValueChange={async (v) => {
                                      try {
                                        setErr(null);
                                        await updateSupplierDocument(d.id, { status: v as SupplierDocStatus });
                                        await loadDocs();
                                      } catch (e: any) {
                                        setErr(e?.message ?? "Failed to update status");
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-9 w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="valid">valid</SelectItem>
                                      <SelectItem value="review">review</SelectItem>
                                      <SelectItem value="expired">expired</SelectItem>
                                      <SelectItem value="missing">missing</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DELIVERIES (scaffold) */}
        <TabsContent value="deliveries" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deliveries & invoices</CardTitle>
              <CardDescription>
                Log deliveries and add line items (mapped to products). Next we link to Temps “Delivery” checks.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {!activeSupplierId ? (
                <div className="text-sm text-muted-foreground">Select a supplier above first.</div>
              ) : (
                <>
                  <div className="rounded-xl border border-border p-4">
                    <div className="font-semibold">Create delivery</div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Site (optional)</Label>
                        <Select value={delSiteId || SENTINEL_NONE} onValueChange={setDelSiteId}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select site (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SENTINEL_NONE}>No site</SelectItem>
                            {sites.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={delStatus} onValueChange={(v) => setDelStatus(v as SupplierDeliveryStatus)}>
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="received">received</SelectItem>
                            <SelectItem value="partial">partial</SelectItem>
                            <SelectItem value="rejected">rejected</SelectItem>
                            <SelectItem value="quarantined">quarantined</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Invoice number</Label>
                        <Input value={delInvoiceNumber} onChange={(e) => setDelInvoiceNumber(e.target.value)} placeholder="e.g. INV-1234" />
                      </div>

                      <div className="space-y-2">
                        <Label>Invoice total</Label>
                        <Input value={delInvoiceTotal} onChange={(e) => setDelInvoiceTotal(e.target.value)} placeholder="e.g. 256.90" inputMode="decimal" />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Notes</Label>
                        <Input value={delNotes} onChange={(e) => setDelNotes(e.target.value)} placeholder="Any notes…" />
                      </div>

                      <div className="md:col-span-2 flex items-center justify-end">
                        <Button onClick={onCreateDelivery} disabled={saving} className="gap-2">
                          <Plus className="w-4 h-4" />
                          Create delivery
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <div className="font-semibold">Recent deliveries</div>

                    <div className="mt-3">
                      {deliveriesLoading ? (
                        <div className="text-sm text-muted-foreground">Loading…</div>
                      ) : deliveries.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No deliveries yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {deliveries.map((d) => (
                            <div key={d.id} className="rounded-lg border border-border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-semibold truncate">
                                      Delivery • {d.supplier?.name ?? "Supplier"}
                                    </div>
                                    {deliveryStatusBadge(d.status)}
                                    {d.site?.name ? <Badge variant="outline">{d.site.name}</Badge> : null}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Delivered: {fmt(d.delivered_at)}
                                    {d.invoice_number ? ` • Invoice: ${d.invoice_number}` : ""}
                                    {d.invoice_total !== null ? ` • Total: ${d.invoice_total}` : ""}
                                  </div>
                                  {d.notes ? <div className="text-xs text-muted-foreground mt-1">{d.notes}</div> : null}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <Button size="sm" variant="outline" onClick={() => openTempModal(d.id)}>
                                    Log delivery temp
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => onOpenDelivery(d.id)}>
                                    {openDeliveryId === d.id ? "Hide items" : "Manage items"}
                                  </Button>
                                </div>
                              </div>

                              {openDeliveryId === d.id ? (
                                <div className="mt-3 rounded-lg border border-border p-3 bg-muted/20 space-y-3">
                                  <div className="font-semibold">Line items</div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <div className="space-y-2">
                                      <Label>Map to product (optional)</Label>
                                      <Select
                                        value={itemProductId ? itemProductId : SENTINEL_NONE}
                                        onValueChange={(v) => {
  const nextId = v === SENTINEL_NONE ? "" : v;
  setItemProductId(nextId);

  // Auto-fill name from product (still editable)
  if (nextId) {
    const p = products.find((x) => x.id === nextId);
    if (p && !itemName.trim()) setItemName(p.name);
  }
}}
                                      >
                                        <SelectTrigger className="h-10">
                                          <SelectValue placeholder="Select product (optional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value={SENTINEL_NONE}>No product</SelectItem>
                                          {products
                                            .filter((p) => p.supplier_id === activeSupplierId)
                                            .map((p) => (
                                              <SelectItem key={p.id} value={p.id}>
                                                {p.name}
                                              </SelectItem>
                                            ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-2">
  <Label>Item name {itemProductId ? "(override allowed)" : "*"}</Label>
  <Input
    value={itemName}
    onChange={(e) => setItemName(e.target.value)}
    placeholder={itemProductId ? "Optional override (e.g. replacement brand/size)" : "e.g. Mozzarella 1kg"}
  />
  {itemProductId ? (
    <div className="text-xs text-muted-foreground">
      Product is mapped, but you can override the name for last-minute replacements.
    </div>
  ) : null}
</div>

                                    <div className="space-y-2">
                                      <Label>Qty</Label>
                                      <Input value={itemQty} onChange={(e) => setItemQty(e.target.value)} placeholder="e.g. 2" inputMode="decimal" />
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Unit</Label>
                                      <Input value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} placeholder="e.g. pcs, kg, case" />
                                    </div>

                                    <div className="md:col-span-2 space-y-2">
                                      <Label>Line notes</Label>
                                      <Input value={itemNotes} onChange={(e) => setItemNotes(e.target.value)} placeholder="Any notes…" />
                                    </div>

                                    <div className="md:col-span-2 flex items-center justify-end">
                                      <Button
                                        onClick={onAddDeliveryItem}
                                        disabled={saving || (!itemProductId && !itemName.trim())}
                                        className="gap-2"
                                      >
                                        <Plus className="w-4 h-4" />
                                        Add item
                                      </Button>
                                    </div>
                                  </div>

                                  <Separator />

                                  <div className="space-y-2">
                                    {(deliveryItems[d.id] ?? []).length === 0 ? (
                                      <div className="text-sm text-muted-foreground">No items yet.</div>
                                    ) : (
                                      (deliveryItems[d.id] ?? []).map((it) => (
                                        <div key={it.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 bg-background">
                                          <div className="min-w-0">
                                            <div className="font-semibold truncate">
                                              {it.product?.name ?? it.item_name ?? "Item"}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {it.qty !== null ? `Qty: ${it.qty} ` : ""}
                                              {it.unit ? `${it.unit}` : ""}
                                              {it.line_notes ? ` • ${it.line_notes}` : ""}
                                            </div>
                                          </div>

                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-2"
                                            onClick={async () => {
                                              try {
                                                setErr(null);
                                                await deleteDeliveryItem(it.id);
                                                const refreshed = await listDeliveryItems(activeCompanyId!, d.id);
                                                setDeliveryItems((prev) => ({ ...prev, [d.id]: refreshed }));
                                              } catch (e: any) {
                                                setErr(e?.message ?? "Failed to delete item");
                                              }
                                            }}
                                          >
                                            <Trash2 className="w-4 h-4" />
                                            Remove
                                          </Button>
                                        </div>
                                      ))
                                    )}
                                  </div>

                                  <div className="text-xs text-muted-foreground">
                                    Next: when a delivery has any “requires temp check” products, we’ll prompt for Temps delivery probe + auto-create actions.
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACTS placeholder */}
        <TabsContent value="contacts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>Next: multiple contacts per supplier (accounts, sales rep, emergency).</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Coming next.</CardContent>
          </Card>
        </TabsContent>

        {/* PERFORMANCE placeholder */}
        <TabsContent value="performance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              <CardDescription>Next: score based on incidents, rejects, missing docs, temp non-compliance.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Coming next.</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DELIVERY TEMP DIALOG */}
      <Dialog open={tempOpen} onOpenChange={setTempOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log delivery temperature</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Probe</Label>
              <Select value={probeId} onValueChange={setProbeId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select probe (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SENTINEL_NONE}>No probe</SelectItem>
                  {probeOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.serial ? ` (${p.serial})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Temperature (°C)</Label>
              <Input value={tempC} onChange={(e) => setTempC(e.target.value)} placeholder="e.g. 3.2" inputMode="decimal" />
            </div>

            <div className="grid gap-2">
              <Label>Result</Label>
              <Select value={tempResult} onValueChange={(v) => setTempResult(v as DeliveryTempResult)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                  <SelectItem value="quarantine">Quarantine</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={tempNotes}
                onChange={(e) => setTempNotes(e.target.value)}
                placeholder="Optional notes (packaging, condition, driver, etc.)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTempOpen(false)} disabled={savingTemp}>
              Cancel
            </Button>
            <Button type="button" onClick={submitDeliveryTemp} disabled={savingTemp}>
              {savingTemp ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard(props: { title: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{props.title}</div>
        <div className="text-muted-foreground">{props.icon}</div>
      </div>
      <div className="mt-2 text-3xl font-extrabold">{props.value}</div>
      <div className="mt-1 text-xs text-muted-foreground">This company</div>
    </div>
  );
}