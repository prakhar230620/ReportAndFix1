import { createClient } from "@/lib/supabase/server";
import VoteButton from "@/app/components/VoteButton";
import ShareButton from "@/app/components/ShareButton";
import BackButton from "@/app/components/BackButton";

export const maxDuration = 30;

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ college?: string }>;
}) {
  const { college } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let collegeId = college;
  let collegeName = "";

  if (!collegeId && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("college_id, colleges(name)")
      .eq("id", user.id)
      .single();
    collegeId = profile?.college_id ?? undefined;
    collegeName = (profile?.colleges as any)?.name ?? "";
  }

  const { data: colleges } = await supabase.from("colleges").select("id, name").order("name");

  if (!collegeId) {
    if (colleges && colleges.length === 1) {
      collegeId = colleges[0].id;
      collegeName = colleges[0].name;
    } else {
      return (
        <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-3 px-6 py-10">
          <h1 className="text-xl font-semibold">Choose a campus</h1>
          {(colleges ?? []).map((c) => (
            <a
              key={c.id}
              href={`/feed?college=${c.id}`}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {c.name}
            </a>
          ))}
        </main>
      );
    }
  } else if (!collegeName) {
    collegeName = colleges?.find((c) => c.id === collegeId)?.name ?? "";
  }

  const [{ data: openIssues }, { data: completedIssues }, votedRows] = await Promise.all([
    supabase.rpc("get_today_open_issues" as never, { p_college_id: collegeId } as never),
    supabase.rpc("get_completed_issues" as never, { p_college_id: collegeId } as never),
    user
      ? supabase.from("complaint_votes").select("complaint_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { complaint_id: string }[] }),
  ]);

  const votedSet = new Set((votedRows.data ?? []).map((r) => r.complaint_id));

  async function signedUrl(path: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage
      .from("complaint-media")
      .createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }

  const openWithThumbs = await Promise.all(
    (openIssues ?? []).map(async (issue: any) => ({
      ...issue,
      thumbUrl: await signedUrl(issue.before_media_path),
    }))
  );

  const completedWithImages = await Promise.all(
    (completedIssues ?? []).map(async (issue: any) => ({
      ...issue,
      beforeUrl: await signedUrl(issue.before_media_path),
      afterUrl: await signedUrl(issue.after_media_path),
    }))
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-8 px-6 py-8 pb-28">
      <BackButton />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{collegeName}</h1>
        <a href="/" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
          Home
        </a>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Open Issues</h2>
        <div className="flex flex-col gap-3">
          {openWithThumbs.map((issue) => (
            <div key={issue.id} className="rounded-md border border-neutral-200 p-3 text-sm">
              {issue.thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={issue.thumbUrl}
                  alt=""
                  className="mb-2 h-32 w-full rounded-md object-cover"
                />
              )}
              <a href={`/issues/${issue.public_id}`} className="font-medium text-neutral-900 hover:text-blue-600">
                {issue.title}
              </a>
              <div className="mt-1 text-neutral-500">
                {issue.category_name} · {issue.location_name}
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-neutral-500">
                  {issue.status} · {issue.priority}
                </span>
                <div className="flex items-center gap-2">
                  <ShareButton path={`/issues/${issue.public_id}`} title={issue.title} />
                  <VoteButton
                    complaintId={issue.id}
                    initialVoteCount={Number(issue.vote_count)}
                    initialHasVoted={votedSet.has(issue.id)}
                    isLoggedIn={!!user}
                    loginNext="/feed"
                  />
                </div>
              </div>
            </div>
          ))}
          {openWithThumbs.length === 0 && (
            <p className="text-sm text-neutral-500">No open issues right now.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Completed Issues</h2>
        <div className="flex flex-col gap-3">
          {completedWithImages.map((issue) => (
            <a
              key={issue.id}
              href={`/issues/${issue.public_id}`}
              className="rounded-md border border-neutral-200 p-3 text-sm"
            >
              <div className="mb-2 flex gap-2">
                {issue.beforeUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={issue.beforeUrl}
                    alt="Before"
                    className="h-24 w-1/2 rounded-md object-cover"
                  />
                )}
                {issue.afterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={issue.afterUrl}
                    alt="After"
                    className="h-24 w-1/2 rounded-md object-cover"
                  />
                )}
              </div>
              <div className="font-medium">{issue.title}</div>
              <div className="mt-1 text-neutral-500">
                {issue.category_name} · {issue.location_name}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                Resolved in {formatDuration(issue.resolution_seconds)} · {issue.vote_count} joined
              </div>
            </a>
          ))}
          {completedWithImages.length === 0 && (
            <p className="text-sm text-neutral-500">Nothing completed yet.</p>
          )}
        </div>
      </section>

      <a
        href="/locations"
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-2xl text-white shadow-lg"
        aria-label="Report an issue"
      >
        +
      </a>
    </main>
  );
}
