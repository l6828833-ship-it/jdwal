import { t } from "@/lib/i18n";

/**
 * Every notice below is marked `data-nosnippet`.
 *
 * These blocks describe the state of the BACKEND, never the football data the
 * page is about, so they must never be eligible as search-result snippet text.
 * Google honours `data-nosnippet` on a container and excludes its text from the
 * snippet while still indexing the page.
 *
 * This is not hypothetical: a crawl that landed while the backend was failing
 * put "تعذّر تحميل البيانات" into the homepage's own Google result, so the site's
 * headline listing advertised an error instead of the day's fixtures. Suppressing
 * the snippet is the last line of defence; the first two are not failing (the
 * backend fix) and not indexing a failed render (see `app/page.tsx`).
 *
 * Shown when the selected backend has no credentials configured. Scores are
 * never faked to fill the gap.
 *
 * Under the default `selfhosted` provider this should not appear: the key lives
 * in the backend, so a misconfigured backend surfaces its own message through
 * `LoadErrorNotice` instead — which names the actual problem rather than
 * pointing at an env var in the wrong project.
 */
export function ApiKeyNotice() {
  return (
    <div
      data-nosnippet
      className="flex flex-1 items-center justify-center px-4 py-16"
    >
      <div className="max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="mb-2 text-base font-bold text-foreground">
          مزود البيانات غير مُعد
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          اضبط <code className="text-accent">SPORTS_PROVIDER</code> ومفتاح المزود
          في الملف <code className="text-accent">.env.local</code> ثم أعد تشغيل
          التطبيق. النتائج تأتي من واجهة البيانات فقط ولا يتم إدخالها يدوياً.
        </p>
      </div>
    </div>
  );
}

interface LoadErrorNoticeProps {
  message: string;
}

export function LoadErrorNotice({ message }: LoadErrorNoticeProps) {
  return (
    <div
      data-nosnippet
      className="flex flex-1 items-center justify-center px-4 py-16"
    >
      <div className="max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="mb-2 text-base font-bold text-foreground">{t.loadFailed}</h1>
        <p dir="ltr" className="break-words text-xs leading-relaxed text-muted">
          {message}
        </p>
      </div>
    </div>
  );
}

/** Daily/monthly request budget reached; cached data only. */
export function QuotaNotice() {
  return (
    <div
      data-nosnippet
      className="flex flex-1 items-center justify-center px-4 py-16"
    >
      <div className="max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="mb-2 text-base font-bold text-foreground">{t.quotaTitle}</h1>
        <p className="text-sm leading-relaxed text-muted">{t.quotaBody}</p>
      </div>
    </div>
  );
}

/**
 * The provider has the data but the current plan doesn't cover that league.
 * Routine on the free plan (5 leagues), so it gets a clear explanation.
 */
export function PlanGatedNotice() {
  return (
    <div
      data-nosnippet
      className="flex flex-1 items-center justify-center px-4 py-16"
    >
      <div className="max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        <h1 className="mb-2 text-base font-bold text-foreground">
          {t.notOnPlanTitle}
        </h1>
        <p className="text-sm leading-relaxed text-muted">{t.notOnPlanBody}</p>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
