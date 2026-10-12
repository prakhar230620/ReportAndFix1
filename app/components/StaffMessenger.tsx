"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  AlertCircle,
  Clock,
  Tag,
  Trash2,
  Lock,
  Sparkles,
  ExternalLink,
  Users,
  User,
  Shield,
  Building2,
  ChevronDown,
  X,
  Check,
  Search,
} from "lucide-react";
import { ButtonSpinner } from "./Spinner";

type StaffMember = {
  id: string;
  display_name: string;
  role: "college_admin" | "dept_admin" | "worker";
  department_id: string | null;
  department_name?: string | null;
};

type Department = {
  id: string;
  name: string;
};

type StaffMessage = {
  id: string;
  college_id: string;
  body: string;
  complaint_id: string | null;
  tagged_user_ids: string[];
  recipient_id?: string | null;
  target_role?: string | null;
  target_department_id?: string | null;
  target_department_name?: string | null;
  expires_at: string;
  created_at: string;
  sender?: {
    id: string;
    display_name: string;
    role: "college_admin" | "dept_admin" | "worker" | "super_admin";
  };
  recipient?: {
    id: string;
    display_name: string;
    role: string;
  } | null;
  complaint?: {
    id: string;
    public_id: string;
    title: string;
    status: string;
  };
};

export default function StaffMessenger({
  collegeId,
  userRole,
  userId,
  initialComplaintId,
  initialComplaintPublicId,
  initialLocked = false,
}: {
  collegeId: string;
  userRole: string;
  userId: string;
  initialComplaintId?: string;
  initialComplaintPublicId?: string;
  initialLocked?: boolean;
}) {
  const [messages, setMessages] = useState<StaffMessage[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(!initialLocked);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState(
    initialComplaintPublicId ? `#${initialComplaintPublicId} ` : ""
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(initialLocked);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Recipient / Audience selection state
  const [targetType, setTargetType] = useState<"all" | "role" | "department" | "direct">("all");
  const [targetRole, setTargetRole] = useState<"college_admin" | "dept_admin" | "worker">("worker");
  const [targetDeptId, setTargetDeptId] = useState<string>("");
  const [recipientId, setRecipientId] = useState<string>("");
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const fetchMessages = async () => {
    if (initialLocked) return;
    try {
      const res = await fetch("/api/messages");
      if (!res.ok) {
        const err = await res.json();
        if (res.status === 403 && err.upgradeRequired) {
          setUpgradeRequired(true);
        } else {
          setErrorMsg(err.error || "Failed to load messages");
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setMessages(data.messages || []);
      if (Array.isArray(data.staffMembers)) setStaffMembers(data.staffMembers);
      if (Array.isArray(data.departments)) setDepartments(data.departments);
      setUpgradeRequired(false);
    } catch {
      setErrorMsg("Network error connecting to message service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialLocked) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 10000); // 10s poll for active chat
    return () => clearInterval(interval);
  }, [initialLocked]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: inputText.trim(),
          complaintId: initialComplaintId,
          targetType,
          targetRole: targetType === "role" ? targetRole : "all",
          targetDepartmentId: targetType === "department" ? targetDeptId : null,
          recipientId: targetType === "direct" ? recipientId : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to send message.");
        if (err.upgradeRequired) setUpgradeRequired(true);
        return;
      }

      const { message } = await res.json();
      setMessages((prev) => [...prev, message]);
      setInputText("");
    } catch {
      setErrorMsg("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      const res = await fetch(`/api/messages?id=${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch {
      // ignore
    }
  };

  // Helper label for the current audience pill
  const selectedRecipientMember = staffMembers.find((s) => s.id === recipientId);
  const selectedDept = departments.find((d) => d.id === targetDeptId);

  const getAudienceLabel = () => {
    if (targetType === "direct" && selectedRecipientMember) {
      return `Direct: ${selectedRecipientMember.display_name} (${formatRoleName(selectedRecipientMember.role)})`;
    }
    if (targetType === "role") {
      if (targetRole === "college_admin") return "Organisation Admins Only";
      if (targetRole === "dept_admin") return "Departmental Admins Only";
      if (targetRole === "worker") return "Field Workers Only";
    }
    if (targetType === "department" && selectedDept) {
      return `Dept: ${selectedDept.name}`;
    }
    return "All Staff (General Operations)";
  };

  function formatRoleName(role?: string) {
    if (role === "college_admin") return "Org Admin";
    if (role === "dept_admin") return "Dept Admin";
    if (role === "worker") return "Worker";
    if (role === "super_admin") return "Super Admin";
    return "Staff";
  }

  // Filter staff members for the selector search
  const filteredStaff = staffMembers.filter((s) =>
    (s.display_name || "").toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    (s.role || "").toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    (s.department_name || "").toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  // Show loading skeleton first
  if (loading) {
    return (
      <div className="flex flex-col h-[400px] rounded-2xl border border-neutral-200 bg-white p-8 items-center justify-center text-neutral-400 text-xs gap-2 shadow-xs">
        <div className="h-4 w-4 rounded-full border-2 border-neutral-300 border-t-neutral-800 animate-spin" />
        <span>Loading messages...</span>
      </div>
    );
  }

  if (upgradeRequired) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-4">
          <Lock className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900">
          Staff In-App Messaging Locked
        </h3>
        <p className="mt-2 text-sm text-neutral-600 max-w-md mx-auto">
          Internal operations messaging with auto-purging 24h retention, complaint tagging, and worker notifications is available on <strong>Professional</strong> and <strong>Enterprise</strong> plans.
        </p>
        {userRole === "college_admin" && (
          <div className="mt-5">
            <Link
              href="/admin/billing"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Upgrade Plan in Billing →</span>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[650px] rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden relative">
      {/* Top Banner: Privacy & Auto-Purge Status */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
        <div className="flex items-center gap-2 text-neutral-700 font-semibold">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          <span>Staff Operations Backchannel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-500 hidden sm:inline">
            🔒 Internal staff only (never shared with users)
          </span>
          <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Clock className="h-3 w-3 text-emerald-600" />
            <span>24-Hour Auto-Purge Active</span>
          </div>
        </div>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-neutral-50/40">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400">
            Loading team messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 text-neutral-400">
            <MessageSquare className="h-8 w-8 text-neutral-300 mb-2" />
            <p className="text-sm font-medium text-neutral-600">No active messages in the last 24 hours</p>
            <p className="text-xs text-neutral-400 max-w-xs mt-1">
              Admins and Workers can coordinate repairs, dispatch tasks, or send direct messages to specific staff.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender?.id === userId;
            const senderRole = m.sender?.role;
            const roleBadgeColor =
              senderRole === "college_admin"
                ? "bg-purple-100 text-purple-800 border-purple-200"
                : senderRole === "dept_admin"
                ? "bg-blue-100 text-blue-800 border-blue-200"
                : senderRole === "worker"
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-neutral-100 text-neutral-800 border-neutral-200";

            const roleLabel = formatRoleName(senderRole);

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-neutral-400">
                  <span className="font-semibold text-neutral-700">
                    {isMe ? "You" : m.sender?.display_name || "Staff"}
                  </span>
                  <span
                    className={`rounded-sm border px-1.5 py-0.2 text-[9px] font-bold uppercase ${roleBadgeColor}`}
                  >
                    {roleLabel}
                  </span>

                  {/* Recipient Targeting Badge */}
                  {m.recipient && (
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.2 text-[9px] font-semibold">
                      <User className="h-2.5 w-2.5" />
                      Direct: {m.recipient.display_name}
                    </span>
                  )}

                  {m.target_role && m.target_role !== "all" && !m.recipient && (
                    <span className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.2 text-[9px] font-semibold">
                      <Shield className="h-2.5 w-2.5" />
                      To: {formatRoleName(m.target_role)}s
                    </span>
                  )}

                  {m.target_department_name && !m.recipient && (
                    <span className="inline-flex items-center gap-1 rounded bg-purple-50 border border-purple-200 text-purple-700 px-1.5 py-0.2 text-[9px] font-semibold">
                      <Building2 className="h-2.5 w-2.5" />
                      Dept: {m.target_department_name}
                    </span>
                  )}

                  <span>
                    {new Date(m.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {(userRole === "college_admin" || userRole === "super_admin" || isMe) && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      title="Delete message"
                      className="opacity-0 hover:opacity-100 text-neutral-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs leading-relaxed ${
                    isMe
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-white text-neutral-800 border border-neutral-200 rounded-bl-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>

                  {/* Linked Complaint Tag */}
                  {m.complaint && (
                    <div
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium ${
                        isMe
                          ? "bg-blue-700/60 border-blue-400/40 text-blue-50"
                          : "bg-neutral-100 border-neutral-200 text-neutral-700"
                      }`}
                    >
                      <Tag className="h-3 w-3" />
                      <span>{m.complaint.public_id}</span>
                      <span className="opacity-75">· {m.complaint.title.slice(0, 24)}</span>
                      <Link
                        href={`/issues/${m.complaint.public_id}`}
                        target="_blank"
                        className="ml-1 hover:underline flex items-center"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Recipient Selection Bar */}
      <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-neutral-500">Send To:</span>
          <button
            type="button"
            onClick={() => setShowRecipientModal(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition shadow-2xs ${
              targetType === "all"
                ? "bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                : targetType === "direct"
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : targetType === "department"
                ? "bg-purple-50 border-purple-200 text-purple-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}
          >
            {targetType === "all" && <Users className="h-3 w-3 text-neutral-500" />}
            {targetType === "direct" && <User className="h-3 w-3 text-indigo-600" />}
            {targetType === "role" && <Shield className="h-3 w-3 text-blue-600" />}
            {targetType === "department" && <Building2 className="h-3 w-3 text-purple-600" />}
            <span className="truncate max-w-[200px] sm:max-w-[280px]">{getAudienceLabel()}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        </div>

        {targetType !== "all" && (
          <button
            type="button"
            onClick={() => {
              setTargetType("all");
              setRecipientId("");
              setTargetDeptId("");
            }}
            className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700 flex items-center gap-0.5"
          >
            <span>Reset to All</span>
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-red-50 px-4 py-2 text-xs text-red-600 border-t border-red-100 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-neutral-200 bg-white p-3"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            targetType === "direct" && selectedRecipientMember
              ? `Message ${selectedRecipientMember.display_name}...`
              : "Message staff (tag #CMP-12345 or coordinate tasks)..."
          }
          className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
        />

        <button
          type="submit"
          disabled={sending || !inputText.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {sending ? (
            <ButtonSpinner />
          ) : (
            <>
              <span>Send</span>
              <Send className="h-3 w-3" />
            </>
          )}
        </button>
      </form>

      {/* Recipient Picker Modal / Popover */}
      {showRecipientModal && (
        <div className="absolute inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 w-full max-w-md max-h-[90%] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Select Message Recipient</h3>
                <p className="text-[11px] text-neutral-500">Choose who can view and receive this staff message</p>
              </div>
              <button
                onClick={() => setShowRecipientModal(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-4 space-y-4 flex-1">
              {/* General Staff broadcast */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                  Broadcast to Everyone
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTargetType("all");
                    setRecipientId("");
                    setTargetDeptId("");
                    setShowRecipientModal(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition ${
                    targetType === "all"
                      ? "border-blue-500 bg-blue-50/60 font-semibold text-blue-900"
                      : "border-neutral-200 hover:bg-neutral-50 text-neutral-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold">All Staff Members</div>
                      <div className="text-[10px] text-neutral-500">All Org Admins, Dept Admins & Workers</div>
                    </div>
                  </div>
                  {targetType === "all" && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              </div>

              {/* By Role */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                  Filter By Staff Role
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetType("role");
                      setTargetRole("college_admin");
                      setRecipientId("");
                      setTargetDeptId("");
                      setShowRecipientModal(false);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center text-xs transition ${
                      targetType === "role" && targetRole === "college_admin"
                        ? "border-purple-500 bg-purple-50 font-bold text-purple-900"
                        : "border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    <Shield className="h-4 w-4 text-purple-600 mb-1" />
                    <span className="font-semibold text-[11px]">Org Admins</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetType("role");
                      setTargetRole("dept_admin");
                      setRecipientId("");
                      setTargetDeptId("");
                      setShowRecipientModal(false);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center text-xs transition ${
                      targetType === "role" && targetRole === "dept_admin"
                        ? "border-blue-500 bg-blue-50 font-bold text-blue-900"
                        : "border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    <Shield className="h-4 w-4 text-blue-600 mb-1" />
                    <span className="font-semibold text-[11px]">Dept Admins</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetType("role");
                      setTargetRole("worker");
                      setRecipientId("");
                      setTargetDeptId("");
                      setShowRecipientModal(false);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center text-xs transition ${
                      targetType === "role" && targetRole === "worker"
                        ? "border-amber-500 bg-amber-50 font-bold text-amber-900"
                        : "border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                    }`}
                  >
                    <User className="h-4 w-4 text-amber-600 mb-1" />
                    <span className="font-semibold text-[11px]">Field Workers</span>
                  </button>
                </div>
              </div>

              {/* By Department */}
              {departments.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                    Filter By Department
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {departments.map((dept) => {
                      const isSelected = targetType === "department" && targetDeptId === dept.id;
                      return (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => {
                            setTargetType("department");
                            setTargetDeptId(dept.id);
                            setRecipientId("");
                            setShowRecipientModal(false);
                          }}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-left text-xs transition ${
                            isSelected
                              ? "border-purple-500 bg-purple-50 font-bold text-purple-900"
                              : "border-neutral-200 hover:bg-neutral-50 text-neutral-700"
                          }`}
                        >
                          <Building2 className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          <span className="truncate">{dept.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Direct Person to Person */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Direct Message to Specific Staff ({staffMembers.length})
                  </span>
                </div>

                <div className="relative mb-2">
                  <Search className="h-3.5 w-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Search staff name or role..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-neutral-100 rounded-xl p-1 bg-neutral-50/50">
                  {filteredStaff.length === 0 ? (
                    <div className="text-center py-4 text-xs text-neutral-400">
                      No staff members found
                    </div>
                  ) : (
                    filteredStaff.map((staff) => {
                      const isSelected = targetType === "direct" && recipientId === staff.id;
                      return (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => {
                            setTargetType("direct");
                            setRecipientId(staff.id);
                            setTargetDeptId("");
                            setShowRecipientModal(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition ${
                            isSelected
                              ? "bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold"
                              : "hover:bg-white text-neutral-800"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-neutral-200 text-neutral-700 font-bold flex items-center justify-center text-[10px]">
                              {staff.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-xs leading-none">{staff.display_name}</div>
                              <div className="text-[10px] text-neutral-400 mt-0.5">
                                {formatRoleName(staff.role)}
                                {staff.department_name && ` · ${staff.department_name}`}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-neutral-200 px-5 py-3 bg-neutral-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRecipientModal(false)}
                className="px-4 py-1.5 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
