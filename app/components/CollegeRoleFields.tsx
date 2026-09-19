"use client";

import { useEffect, useState } from "react";

type College = {
  id: string;
  name: string;
  allow_worker_signup: boolean;
  allow_admin_signup: boolean;
};

export default function CollegeRoleFields({
  colleges,
  defaultCollegeId = "",
  defaultRole = "user",
  approvalNote = "Worker and College Admin access requires approval after you continue.",
}: {
  colleges: College[];
  defaultCollegeId?: string;
  defaultRole?: string;
  approvalNote?: string;
}) {
  const [collegeId, setCollegeId] = useState(defaultCollegeId);
  const [role, setRole] = useState(defaultRole);

  const college = colleges.find((c) => c.id === collegeId);
  const canWorker = !!college?.allow_worker_signup;
  const canAdmin = !!college?.allow_admin_signup;

  // If the selected role is no longer offered by the newly-selected
  // college, fall back to plain user rather than silently submitting a
  // role that college isn't accepting right now.
  useEffect(() => {
    if (role === "worker" && !canWorker) setRole("user");
    if (role === "college_admin" && !canAdmin) setRole("user");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collegeId]);

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        College
        <select
          name="college_id"
          required
          value={collegeId}
          onChange={(e) => setCollegeId(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2"
        >
          <option value="">Select your college</option>
          {colleges.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {!collegeId ? (
        <p className="text-xs text-neutral-400">
          Select a college first to see which roles are available.
        </p>
      ) : (
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1 font-medium">I am a...</legend>
          <label className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2">
            <input
              type="radio"
              name="requested_role"
              value="user"
              checked={role === "user"}
              onChange={() => setRole("user")}
            />
            Student / general user
          </label>
          {canWorker && (
            <label className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2">
              <input
                type="radio"
                name="requested_role"
                value="worker"
                checked={role === "worker"}
                onChange={() => setRole("worker")}
              />
              Worker (maintenance / support staff)
            </label>
          )}
          {canAdmin && (
            <label className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2">
              <input
                type="radio"
                name="requested_role"
                value="college_admin"
                checked={role === "college_admin"}
                onChange={() => setRole("college_admin")}
              />
              College Admin
            </label>
          )}
          {canWorker || canAdmin ? (
            <p className="text-xs text-neutral-500">{approvalNote}</p>
          ) : (
            <p className="text-xs text-neutral-500">
              This college is only accepting student / general user sign-ups right now.
            </p>
          )}
        </fieldset>
      )}
    </>
  );
}
