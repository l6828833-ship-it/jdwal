import { NavLink } from "@/components/nav-link";
import { ConsentSettingsButton } from "@/components/consent";

const SECTIONS = [
  {
    title: "عن جدول",
    links: [
      ["/about", "من نحن"],
      ["/how-it-works", "كيف يعمل جدول"],
      ["/editorial-policy", "السياسة التحريرية"],
      ["/contact", "اتصل بنا"],
    ],
  },
  {
    title: "أدلة كرة القدم",
    links: [
      ["/guides/following-live-matches", "متابعة المباريات المباشرة"],
      ["/guides/reading-standings", "شرح جدول ترتيب الدوري"],
      ["/leagues", "الدوريات"],
      ["/scorers", "الهدافون"],
    ],
  },
  {
    title: "السياسات",
    links: [
      ["/privacy", "سياسة الخصوصية"],
      ["/cookies", "سياسة ملفات الارتباط"],
      ["/terms", "شروط الاستخدام"],
      ["/disclaimer", "إخلاء المسؤولية"],
    ],
  },
] as const;

/** Permanent trust/navigation footer rendered on every route. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface px-4 py-7 sm:px-6">
      <div className="grid gap-7 sm:grid-cols-3">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-xs font-bold text-foreground">{section.title}</h2>
            <ul className="mt-3 space-y-2">
              {section.links.map(([href, label]) => (
                <li key={href}>
                  <NavLink
                    href={href}
                    className="text-xs leading-6 text-muted transition-colors hover:text-accent"
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-7 flex flex-col gap-3 border-t border-divider pt-5 text-[0.7rem] leading-6 text-muted-dim sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 موقع جدول (jdwal). جميع الحقوق محفوظة.</p>
        <ConsentSettingsButton />
      </div>
      <p className="mt-3 text-[0.65rem] leading-5 text-muted-dim">
        جدول موقع معلومات رياضية مستقل، ولا يرتبط بالاتحادات أو الدوريات أو الأندية
        المعروضة. العلامات والشعارات مملوكة لأصحابها.
      </p>
    </footer>
  );
}
