import { createClient } from "@/lib/supabase/server";
import VoteButton from "@/app/components/VoteButton";
import ShareButton from "@/app/components/ShareButton";
import BackButton from "@/app/components/BackButton";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: complaint } = await supabase
    .from("complaints")
    .select(
      "id, public_id, title, description, status, priority, is_anonymous, created_at, completed_at, resolution_seconds, location_id, categories(name), locations(name)"
    )
    .eq("public_id", publicId)
    .maybeSingle();

  if (!complaint) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-2 px-6 text-center">
        <BackButton className="self-start" />
        <h1 className="text-xl font-semibold">Not found</h1>
        <p className="text-neutral-600">No complaint with this ID exists.</p>
      </main>
    );
  }

  const [{ count: voteCount }, { data: history }, { data: media }, votedRow] =
    await Promise.all([
      supabase
        .from("complaint_votes")
        .select("id", { count: "exact", head: true })
        .eq("complaint_id", complaint.id),
      supabase
        .from("complaint_status_history")
        .select("previous_status, new_status, note, created_at")
        .eq("complaint_id", complaint.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("complaint_media")
        .select("storage_path, media_type, created_at")
        .eq("complaint_id", complaint.id)
        .order("created_at", { ascending: true }),
      user
        ? supabase
            .from("complaint_votes")
            .select("id")
            .eq("complaint_id", complaint.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const mediaWithUrls = await Promise.all(
    (media ?? []).map(async (m) => {
      const { data } = await supabase.storage
        .from("complaint-media")
        .createSignedUrl(m.storage_path, 3600);
      return { ...m, url: data?.signedUrl ?? null };
    })
  );

  const category = (complaint as any).categories?.name;
  const { data: locationPath } = await supabase.rpc("location_full_path" as never, {
    p_location_id: complaint.location_id,
  } as never);
  const locationSummary = (locationPath as unknown as string) ?? (complaint as any).locations?.name ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-4 px-6 py-10">
      <BackButton />
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{complaint.public_id}</span>
        <ShareButton path={`/issues/${complaint.public_id}`} title={complaint.title} />
      </div>

      <h1 className="text-xl font-semibold">{complaint.title}</h1>
      <p className="text-sm text-neutral-500">
        {category} · {locationSummary}
      </p>
      {complaint.description && (
        <p className="text-sm text-neutral-700">{complaint.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span className="rounded-full bg-neutral-200 px-2 py-0.5">{complaint.status}</span>
        <span className="rounded-full bg-neutral-200 px-2 py-0.5">{complaint.priority}</span>
        {complaint.is_anonymous && (
          <span className="rounded-full bg-neutral-200 px-2 py-0.5">Anonymous report</span>
        )}
      </div>

      <VoteButton
        complaintId={complaint.id}
        initialVoteCount={voteCount ?? 0}
        initialHasVoted={!!votedRow.data}
        isLoggedIn={!!user}
        loginNext={`/issues/${publicId}`}
      />

      {mediaWithUrls.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Photos</h2>
          <div className="flex flex-wrap gap-2">
            {mediaWithUrls.map(
              (m, i) =>
                m.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img loading="lazy" decoding="async"
                    key={i}
                    src={m.url}
                    alt={m.media_type}
                    className="h-28 w-28 rounded-md object-cover"
                  />
                )
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Timeline</h2>
        <ul className="flex flex-col gap-2 text-xs text-neutral-600">
          <li>
            <span className="font-medium">Reported</span> ·{" "}
            {new Date(complaint.created_at).toLocaleString()}
          </li>
          {(history ?? []).map((h, i) => (
            <li key={i}>
              <span className="font-medium">
                {h.previous_status} → {h.new_status}
              </span>{" "}
              · {new Date(h.created_at).toLocaleString()}
              {h.note && <div className="text-neutral-500">{h.note}</div>}
            </li>
          ))}
          {complaint.status === "completed" && complaint.completed_at && (
            <li>
              <span className="font-medium">Completed</span> ·{" "}
              {new Date(complaint.completed_at).toLocaleString()}
            </li>
          )}
        </ul>
      </div>
    </main>
  );
}
