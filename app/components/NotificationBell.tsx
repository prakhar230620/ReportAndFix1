"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  message: string;
  href: string;
  time: number;
};

export default function NotificationBell({
  role,
  collegeId,
  userId,
}: {
  role: "college_admin" | "super_admin" | "worker" | "user";
  collegeId?: string | null;
  userId?: string;
}) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const router = useRouter();
  const supabase = useRef(createClient());

  useEffect(() => {
    const client = supabase.current;
    const channels: ReturnType<typeof client.channel>[] = [];

    function push(n: Omit<Notification, "id" | "time">) {
      setItems((prev) => [{ ...n, id: crypto.randomUUID(), time: Date.now() }, ...prev].slice(0, 20));
      setUnseen((u) => u + 1);
    }

    if (role === "college_admin" && collegeId) {
      channels.push(
        client
          .channel(`complaints-${collegeId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "complaints", filter: `college_id=eq.${collegeId}` },
            (payload) => {
              push({
                message: `New complaint: ${payload.new.title ?? "Untitled"}`,
                href: `/admin/queue/${payload.new.public_id}`,
              });
            }
          )
          .subscribe(),
        client
          .channel(`role-requests-${collegeId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "role_requests", filter: `college_id=eq.${collegeId}` },
            (payload) => {
              push({
                message: `New ${payload.new.requested_role} access request`,
                href: "/admin/role-requests",
              });
            }
          )
          .subscribe()
      );
    }

    if (role === "super_admin") {
      channels.push(
        client
          .channel("admin-requests-platform")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "role_requests", filter: "requested_role=eq.college_admin" },
            () => push({ message: "New Admin access request", href: "/super-admin/admin-requests" })
          )
          .subscribe()
      );
    }

    if (role === "worker" && userId) {
      channels.push(
        client
          .channel(`worker-tasks-${userId}`)
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "complaints", filter: `assigned_worker_id=eq.${userId}` },
            (payload) => {
              if (payload.new.status === "assigned" && payload.old.assigned_worker_id !== userId) {
                push({
                  message: `New task assigned: ${payload.new.title ?? "Untitled"}`,
                  href: `/worker/${payload.new.public_id}`,
                });
              }
            }
          )
          .subscribe()
      );
    }

    return () => {
      channels.forEach((ch) => client.removeChannel(ch));
    };
  }, [role, collegeId, userId]);

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          setUnseen(0);
        }}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unseen > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unseen}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="max-h-80 overflow-y-auto p-2">
            {items.length === 0 && (
              <p className="p-3 text-center text-xs text-neutral-400">
                No notifications yet. New activity appears here live.
              </p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setOpen(false);
                  router.push(n.href);
                }}
                className="block w-full rounded-md p-2 text-left text-sm hover:bg-neutral-50"
              >
                <div className="text-neutral-800">{n.message}</div>
                <div className="text-[10px] text-neutral-400">
                  {new Date(n.time).toLocaleTimeString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
