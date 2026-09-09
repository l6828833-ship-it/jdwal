import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { TimezoneProvider } from "@/components/timezone-provider";
import { resolveTimezoneFromRequest } from "@/lib/geo-timezone";
import { t } from "@/lib/i18n";

const cairo = Cairo({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${t.appName} — ${t.appTagline}`,
  description: "نتائج مباريات كرة القدم المباشرة، جدول المباريات والمسابقات الكبرى.",
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolve the visitor's zone from their IP. When that fails, `resolved` is
  // false and the provider falls back to the browser's own zone on the client.
  const { timezone, resolved } = await resolveTimezoneFromRequest();

  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased">
        <TimezoneProvider serverTimezone={timezone} resolvedFromIp={resolved}>
          {/* The bottom nav is fixed at every breakpoint, so this padding must
              apply at every breakpoint too, or the last row hides behind it. */}
          <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
            {children}
          </div>
          <BottomNav />
        </TimezoneProvider>
      </body>
    </html>
  );
}
