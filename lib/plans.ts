// lib/plans.ts
// Plan feature-gate helpers

export type Plan = {
  id: string;
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
  sort_order: number;
};

export type PlanNotificationType =
  | "expiry_warning_15d"
  | "expiry_warning_7d"
  | "expiry_warning_3d"
  | "expiry_warning_1d"
  | "plan_expired"
  | "payment_failed"
  | "payment_success"
  | "plan_assigned"
  | "refund_processed"
  | "soft_delete_warning"
  | "terms_updated"
  | "staff_message";

export type OrgSubscription = {
  id: string;
  college_id: string;
  plan_id: string;
  status: "trial" | "active" | "grace" | "expired" | "frozen" | "cancelled" | "manually_assigned";
  billing_cycle: "monthly" | "yearly";
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  plans?: Plan;
};

/** Format paise to ₹ string */
export function formatPrice(paise: number): string {
  if (paise === 0) return "Free";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

/** Get days remaining in subscription */
export function getDaysRemaining(periodEnd: string): number {
  return Math.max(0, Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 86400000));
}

/** Is subscription currently active? */
export function isSubscriptionActive(status: OrgSubscription["status"]): boolean {
  return ["trial", "active", "grace", "manually_assigned"].includes(status);
}

/** Is subscription in warning zone (≤15 days left)? */
export function isExpiryWarning(periodEnd: string): boolean {
  return getDaysRemaining(periodEnd) <= 15;
}

/** Plan feature gating */
export function canUseMessaging(plan: Plan | null | undefined): boolean {
  return plan?.messaging_enabled ?? false;
}

export function canDownloadFree(plan: Plan | null | undefined): boolean {
  return plan?.data_download_free ?? false;
}

export function isUnlimited(val: number): boolean {
  return val === -1;
}

export function planFeatureLabel(val: number, unit: string): string {
  return val === -1 ? `Unlimited ${unit}` : `${val} ${unit}`;
}

/** Calculate download charge based on plan */
export function getDownloadChargePaise(plan: Plan | null | undefined): number {
  if (!plan || plan.data_download_free) return 0;
  // Starter: ₹499, Standard: ₹299, Professional: free, Enterprise: free
  const charges: Record<string, number> = {
    starter: 49900,
    standard: 29900,
    professional: 0,
    enterprise: 0,
  };
  return charges[plan.slug] ?? 49900;
}

/** Plan tier color for UI */
export function planColor(slug: string): { bg: string; text: string; border: string } {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    starter:      { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200" },
    standard:     { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200" },
    professional: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
    enterprise:   { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  };
  return colors[slug] ?? { bg: "bg-neutral-100", text: "text-neutral-700", border: "border-neutral-200" };
}
