import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type BroadcastPriority = "info" | "announcement" | "warning" | "urgent" | "maintenance";

export type Broadcast = {
  id: string;
  college_id: string;
  creator_id: string;
  title: string;
  message: string;
  priority: BroadcastPriority;
  target_roles: string[];
  duration_hours: number;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  profiles?: {
    display_name: string | null;
    role: string | null;
  } | null;
};

/**
 * Fetch active, unexpired broadcasts strictly for the given college.
 * Prevents cross-organizational interference by filtering by college_id.
 */
export async function getActiveBroadcasts(
  collegeId: string | null | undefined,
  userRole?: string
): Promise<Broadcast[]> {
  if (!collegeId) return [];

  try {
    const adminClient = createAdminClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await adminClient
      .from("broadcasts")
      .select("id, college_id, creator_id, title, message, priority, target_roles, duration_hours, created_at, expires_at, is_active, profiles:creator_id(display_name, role)")
      .eq("college_id", collegeId)
      .eq("is_active", true)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false });

    if (error) {
      // Table might not exist yet before migration
      console.warn("[getActiveBroadcasts] Query notice:", error.message);
      return [];
    }

    if (!data) return [];

    // Filter by role audience if specific role provided
    return (data as any[]).filter((b) => {
      if (!b.target_roles || b.target_roles.includes("all")) return true;
      if (userRole && b.target_roles.includes(userRole)) return true;
      if (userRole === "college_admin") return true; // Admins can always see all their org's broadcasts
      return false;
    });
  } catch (err) {
    console.warn("[getActiveBroadcasts] Caught error:", err);
    return [];
  }
}

/**
 * Fetch all broadcasts (active and historical) for an organization admin.
 */
export async function getAdminBroadcasts(collegeId: string): Promise<{
  active: Broadcast[];
  expired: Broadcast[];
  tableExists: boolean;
}> {
  if (!collegeId) return { active: [], expired: [], tableExists: true };

  try {
    const adminClient = createAdminClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await adminClient
      .from("broadcasts")
      .select("id, college_id, creator_id, title, message, priority, target_roles, duration_hours, created_at, expires_at, is_active, profiles:creator_id(display_name, role)")
      .eq("college_id", collegeId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      if (error.code === "PGRST205" || error.message.includes("does not exist") || error.message.includes("schema cache")) {
        return { active: [], expired: [], tableExists: false };
      }
      return { active: [], expired: [], tableExists: true };
    }

    const items = (data as any[]) || [];
    const active = items.filter((b) => b.is_active && new Date(b.expires_at) > new Date(nowIso));
    const expired = items.filter((b) => !b.is_active || new Date(b.expires_at) <= new Date(nowIso));

    return { active, expired, tableExists: true };
  } catch (err) {
    return { active: [], expired: [], tableExists: false };
  }
}
