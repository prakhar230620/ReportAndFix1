"use client";

import { useState, useTransition } from "react";
import { createCollege } from "./actions";

const CATEGORIES = [
  { value: "college", label: "College" },
  { value: "university", label: "University" },
  { value: "school", label: "School" },
  { value: "office", label: "Corporate / Office" },
  { value: "company", label: "Company" },
  { value: "hospital", label: "Hospital / Healthcare" },
  { value: "community", label: "Residential / Society" },
  { value: "other", label: "Other" },
];

export default function AddCollegeForm() {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("college");
  const [address, setAddress] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [allowWorker, setAllowWorker] = useState(true);
  const [allowAdmin, setAllowAdmin] = useState(true);

  function resetForm() {
    setName("");
    setCategory("college");
    setAddress("");
    setContactEmail("");
    setContactPhone("");
    setAllowWorker(true);
    setAllowAdmin(true);
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", name.trim());
      fd.set("category", category);
      fd.set("address", address.trim());
      fd.set("contact_email", contactEmail.trim());
      fd.set("contact_phone", contactPhone.trim());
      fd.set("allow_worker_signup", String(allowWorker));
      fd.set("allow_admin_signup", String(allowAdmin));

      const res = await createCollege(fd);
      if (res.error) {
        alert(res.error);
      } else {
        resetForm();
      }
    });
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-neutral-800"
        >
          <span className="text-sm">+</span> Add Organisation
        </button>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Add New Organisation</h3>
                <p className="text-xs text-neutral-500">
                  Provision a new organization on the platform with standard issue categories.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
              <div>
                <label className="mb-1 block font-medium text-neutral-700">
                  Organisation Name *
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Stanford University or Acme HQ"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-neutral-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-neutral-700">Address / City</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 100 Main Campus Dr, City"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-neutral-700">Contact Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="admin@organisation.com"
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-neutral-700">Contact Phone</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-md bg-neutral-50 p-3">
                <span className="font-medium text-neutral-800">Registration Permissions</span>
                <label className="flex items-center gap-2 text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={allowWorker}
                    onChange={(e) => setAllowWorker(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  Allow worker / maintenance staff registration
                </label>
                <label className="flex items-center gap-2 text-xs text-neutral-700">
                  <input
                    type="checkbox"
                    checked={allowAdmin}
                    onChange={(e) => setAllowAdmin(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  Allow organisation admin registration
                </label>
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !name.trim()}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40"
                >
                  {pending ? "Creating..." : "Create Organisation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
