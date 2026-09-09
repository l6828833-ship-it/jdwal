import { MatchDetailView } from "@/components/match-detail-view";
import { BackHeader } from "@/components/back-header";
import {
  ApiKeyNotice,
  EmptyState,
  LoadErrorNotice,
  PlanGatedNotice,
  QuotaNotice,
} from "@/components/notices";
import { getMatchDetail, hasApiKey, isPlanGatedError } from "@/lib/provider";
import { t } from "@/lib/i18n";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/match/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const matchId = Number(id);
  if (!hasApiKey() || !Number.isInteger(matchId)) {
    return { title: t.appName };
  }

  try {
    const result = await getMatchDetail(matchId);
    if (!result) return { title: t.appName };
    const { home, away, league } = result.match;
    return {
      title: `${home.name} ${t.vs} ${away.name} — ${league.name}`,
      description: `${home.name} ${t.vs} ${away.name} في ${league.name} — النتيجة المباشرة والأهداف وتفاصيل المباراة.`,
      alternates: { canonical: `/match/${matchId}` },
    };
  } catch {
    return { title: t.appName };
  }
}

export default async function MatchPage(props: PageProps<"/match/[id]">) {
  if (!hasApiKey()) return <ApiKeyNotice />;

  const { id } = await props.params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) return <MatchNotFound />;

  let result: Awaited<ReturnType<typeof getMatchDetail>>;
  try {
    result = await getMatchDetail(matchId);
  } catch (error) {
    if (isPlanGatedError(error)) return <PlanGatedNotice />;
    if (error instanceof Error && /budget/i.test(error.message)) {
      return <QuotaNotice />;
    }
    return (
      <LoadErrorNotice
        message={error instanceof Error ? error.message : String(error)}
      />
    );
  }

  // A missing match is almost always a stale link (an id from an older data
  // source, or a fixture that has aged out of the window). Show a calm notice
  // with a way back, not a bare 404.
  if (!result) return <MatchNotFound />;

  return (
    <MatchDetailView initialMatch={result.match} initialNowUnix={result.nowUnix} />
  );
}

function MatchNotFound() {
  return (
    <>
      <BackHeader title={t.matchInfo} />
      <main className="flex flex-1 flex-col px-3 py-6 sm:px-4">
        <EmptyState title={t.matchNotFound} hint={t.matchNotFoundHint} />
      </main>
    </>
  );
}
