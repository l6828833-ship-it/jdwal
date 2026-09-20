import type { ReactNode } from "react";
import { NavLink } from "@/components/nav-link";
import { POLICY_LAST_UPDATED_AR, SITE_URL } from "@/lib/config";

export interface ContentSection {
  id: string;
  title: string;
  paragraphs?: ReactNode[];
  bullets?: ReactNode[];
}

interface ContentPageProps {
  title: string;
  description: string;
  path: `/${string}`;
  sections: ContentSection[];
  /** Policy pages show a shared revision date; guides can supply publication. */
  updated?: string;
  eyebrow?: string;
  children?: ReactNode;
  schemaType?: "WebPage" | "AboutPage" | "ContactPage" | "Article";
}

/**
 * Shared shell for legal, trust and original editorial pages.
 * Semantic headings, a table of contents and readable line lengths make these
 * genuine documents rather than thin compliance placeholders.
 */
export function ContentPage({
  title,
  description,
  path,
  sections,
  updated = POLICY_LAST_UPDATED_AR,
  eyebrow = "موقع جدول",
  children,
  schemaType = "WebPage",
}: ContentPageProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": `${SITE_URL}${path}#webpage`,
    url: `${SITE_URL}${path}`,
    name: title,
    description,
    inLanguage: "ar",
    dateModified: "2026-09-08",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };

  return (
    <>
      <header className="border-b border-border bg-surface px-4 py-5 sm:px-6">
        <NavLink
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline"
        >
          <span aria-hidden="true">→</span>
          العودة إلى المباريات
        </NavLink>
        <p className="text-xs font-semibold text-accent">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
          {description}
        </p>
        <p className="mt-3 text-[0.7rem] text-muted-dim">
          آخر تحديث: {updated}
        </p>
      </header>

      <main className="px-3 py-5 sm:px-4">
        <div className="rounded-xl border border-border bg-surface p-4 sm:p-6">
          <nav aria-label="محتويات الصفحة" className="mb-7 border-b border-divider pb-5">
            <h2 className="text-sm font-bold text-foreground">محتويات الصفحة</h2>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-xs leading-6 text-muted transition-colors hover:text-accent"
                  >
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="space-y-8">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-20">
                <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
                {section.paragraphs?.map((paragraph, index) => (
                  <p key={index} className="mt-3 text-sm leading-8 text-muted">
                    {paragraph}
                  </p>
                ))}
                {section.bullets && section.bullets.length > 0 && (
                  <ul className="mt-3 list-disc space-y-2 pe-5 text-sm leading-7 text-muted marker:text-accent">
                    {section.bullets.map((bullet, index) => (
                      <li key={index}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            {children}
          </article>
        </div>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}

export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <NavLink href={href} className="font-semibold text-accent hover:underline">
      {children}
    </NavLink>
  );
}
