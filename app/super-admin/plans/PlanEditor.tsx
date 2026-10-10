"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Save } from "lucide-react";
import { ButtonSpinner } from "@/app/components/Spinner";
import { savePlan, deletePlan } from "@/app/super-admin/plans/actions";


type Plan = {
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly_paise: number;
  price_yearly_paise: number;
  max_storage_gb: number;
  max_complaints_per_month: number;
  max_workers: number;
  max_departments: number;
  max_admins: number;
  data_download_free: boolean;
  messaging_enabled: boolean;
  message_retention_hours: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
};

const defaultPlan: Plan = {
  name: "", slug: "", description: "", price_monthly_paise: 0, price_yearly_paise: 0,
  max_storage_gb: 5, max_complaints_per_month: 100, max_workers: 10, max_departments: 5,
  max_admins: 1, data_download_free: false, messaging_enabled: false, message_retention_hours: 24,
  features: [], is_active: true, sort_order: 0,
};

export default function PlanEditor({ mode, plan }: { mode: "create" | "edit"; plan?: Plan }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Plan>(plan ?? defaultPlan);
  const [newFeature, setNewFeature] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof Plan, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await savePlan(form);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={mode === "create"
          ? "inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          : "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        }
      >
        {mode === "create" ? <><Plus className="h-4 w-4" />New Plan</> : "Edit Plan"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl my-8">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-bold">{mode === "create" ? "Create New Plan" : `Edit: ${form.name}`}</h2>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5 text-neutral-500" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-neutral-600">Plan Name *</span>
                  <input value={form.name} onChange={e => set("name", e.target.value)} required
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-neutral-600">Slug * (lowercase, no spaces)</span>
                  <input value={form.slug} onChange={e => set("slug", e.target.value.toLowerCase().replace(/\s/g,""))} required
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-neutral-600">Description</span>
                <input value={form.description ?? ""} onChange={e => set("description", e.target.value)}
                  className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-neutral-600">Monthly Price (paise, 1₹=100)</span>
                  <input type="number" value={form.price_monthly_paise} onChange={e => set("price_monthly_paise", Number(e.target.value))} min={0}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-neutral-600">Yearly Price (paise)</span>
                  <input type="number" value={form.price_yearly_paise} onChange={e => set("price_yearly_paise", Number(e.target.value))} min={0}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
                </label>
              </div>

              <p className="text-xs text-neutral-400">Use -1 for unlimited values</p>
              <div className="grid grid-cols-3 gap-3">
                {(["max_storage_gb","max_complaints_per_month","max_workers","max_departments","max_admins","message_retention_hours","sort_order"] as const).map(k => (
                  <label key={k} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-neutral-600">{k.replace(/_/g," ")}</span>
                    <input type="number" value={(form as any)[k]} onChange={e => set(k, Number(e.target.value))}
                      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
                  </label>
                ))}
              </div>

              <div className="flex gap-6">
                {(["data_download_free","messaging_enabled","is_active"] as const).map(k => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form[k] as boolean} onChange={e => set(k, e.target.checked)} className="h-4 w-4 rounded" />
                    {k.replace(/_/g," ")}
                  </label>
                ))}
              </div>

              <div>
                <p className="text-xs font-medium text-neutral-600 mb-1">Features (bullet points)</p>
                <div className="flex gap-2 mb-2">
                  <input value={newFeature} onChange={e => setNewFeature(e.target.value)}
                    placeholder="Add feature..." className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm" />
                  <button type="button" onClick={() => { if(newFeature.trim()){set("features",[...form.features,newFeature.trim()]);setNewFeature("");} }}
                    className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-white">Add</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.features.map((f,i) => (
                    <span key={i} className="flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs">
                      {f}
                      <button type="button" onClick={() => set("features", form.features.filter((_,j)=>j!==i))}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                {mode === "edit" && plan?.id && (
                  <button type="button" onClick={async()=>{if(confirm("Delete this plan?")){await deletePlan(plan.id!);setOpen(false);router.refresh();}}}
                    className="text-xs text-red-600 hover:text-red-700 font-medium">Delete Plan</button>
                )}
                <button type="submit" disabled={loading}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50">
                  {loading ? <ButtonSpinner /> : <Save className="h-4 w-4" />}
                  {mode === "create" ? "Create Plan" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
