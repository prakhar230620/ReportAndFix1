"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateDisplayName } from "./actions";

export default function ProfileForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [nameBusy, setNameBusy] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function handleNameSave() {
    setNameBusy(true);
    setNameStatus(null);
    const result = await updateDisplayName(name);
    setNameBusy(false);
    setNameStatus(result.error ?? "Saved");
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordDone(false);
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setPasswordBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordBusy(false);
    if (error) setPasswordError(error.message);
    else {
      setPasswordDone(true);
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 rounded-md border border-neutral-300 p-3">
        <h2 className="text-sm font-semibold">Display name</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {nameStatus && <p className="text-xs text-neutral-500">{nameStatus}</p>}
        <button
          onClick={handleNameSave}
          disabled={nameBusy}
          className="self-start rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {nameBusy ? "Saving…" : "Save"}
        </button>
      </div>

      <form
        onSubmit={handlePasswordChange}
        className="flex flex-col gap-2 rounded-md border border-neutral-300 p-3"
      >
        <h2 className="text-sm font-semibold">Change password</h2>
        {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}
        {passwordDone && <p className="text-xs text-green-700">Password updated.</p>}
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={6}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          minLength={6}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={passwordBusy}
          className="self-start rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {passwordBusy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
