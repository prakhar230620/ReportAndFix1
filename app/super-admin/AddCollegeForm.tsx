"use client";

import { useState, useTransition } from "react";
import { createCollege } from "./actions";

export default function AddCollegeForm() {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("college");
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-neutral-200 p-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white"
        >
          + Add institution
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Institution name"
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
          >
            <option value="college">College</option>
            <option value="school">School</option>
            <option value="office">Office</option>
            <option value="company">Company</option>
          </select>
          <button
            disabled={pending || !name.trim()}
            onClick={() =>
              startTransition(async () => {
                const fd = new FormData();
                fd.set("name", name);
                fd.set("category", category);
                const res = await createCollege(fd);
                if (res.error) alert(res.error);
                else {
                  setName("");
                  setOpen(false);
                }
              })
            }
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white disabled:opacity-40"
          >
            Create
          </button>
          <button onClick={() => setOpen(false)} className="text-xs text-neutral-500">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
