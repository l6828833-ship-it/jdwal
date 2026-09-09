import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { ClockSync } from "@/components/clock-sync";
import { TimezoneProvider } from "@/components/timezone-provider";
import { resolveRequestTime } from "@/lib/geo-timezone";
import { SITE_URL } from "@/lib/config";
import { t } from "@/lib/i18n";

const cairo = Cairo({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

/**
 * SEO.
 *
 * Targets the two primary keywords — "jdwal" (the brand, Latin) and
 * "جدول مباريات" (Arabic: "match schedule") — in the title, description and
 * keyword set. `title.template` appends the brand to every inner page's title
 * (e.g. "الدوري الإنجليزي | جدول مباريات") so every page reinforces the terms.
 *
 * `metadataBase` makes the relative Open Graph image and canonical URLs
 * absolute. Update NEXT_PUBLIC_SITE_URL once a custom domain is live.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "جدول مباريات اليوم | jdwal - نتائج مباشرة",
    template: "%s | جدول مباريات - jdwal",
  },
  description:
    "jdwal (جدول) — جدول مباريات اليوم والغد ونتائج مباشرة لكرة القدم: " +
    "الدوريات الكبرى ودوري أبطال أوروبا والدوريات العربية مع الترتيب والهدافين.",
  keywords: [
    "jdwal",
    "jdwel",
    "jadwal",
    "jdwel.com",
    "jdwal.co",
    "جدول",
    "جدول مباريات",
    "جدول مباريات اليوم",
    "مباريات اليوم",
    "نتائج مباشرة",
    "ترتيب الدوريات",
    "الهدافين",
    "دوري أبطال أوروبا",
    "الدوري الإنجليزي",
    "الدوري السعودي",
  ],
  applicationName: "jdwal",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "jdwal",
    locale: "ar_AR",
    url: SITE_URL,
    title: "جدول مباريات اليوم | jdwal - نتائج مباشرة",
    description:
      "جدول مباريات اليوم والغد، نتائج مباشرة، ترتيب الدوريات والهدافين.",
    // The image that surfaces in a shared link / social preview. Its `alt`
    // carries the brand's three spellings and the core Arabic term — the tag on
    // the image the request asked for.
    images: [
      {
        url: "/logo-full.png",
        width: 1024,
        height: 1024,
        alt: "jdwal جدول - جدول مباريات اليوم ونتائج مباشرة (jdwel, jadwal)",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "جدول مباريات اليوم | jdwal",
    description: "جدول مباريات اليوم والغد ونتائج مباشرة لكرة القدم.",
    images: [
      {
        url: "/logo-full.png",
        alt: "jdwal جدول - جدول مباريات اليوم ونتائج مباشرة (jdwel, jadwal)",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  // Google Search Console verification. Paste the token from the
  // "HTML tag" verification method (the content="..." value) here, or set
  // NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in the environment.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  /**
   * Both halves of the request's time context, resolved over the network:
   *
   *  • the visitor's zone, from their IP. When that fails, `resolved` is false
   *    and the provider falls back to the browser's own zone on the client.
   *  • real UTC, from an external authority rather than this machine's clock,
   *    which is then handed to the browser by `<ClockSync>` so the device clock
   *    is not consulted there either.
   */
  const { timezone, resolved, nowUnix } = await resolveRequestTime();

  // WebSite structured data: tells Google the site's name is "jdwal" and its
  // primary purpose ("جدول مباريات"), which strengthens brand-term ranking.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "jdwal",
    alternateName: ["jdwel", "jadwal", "jdwel.com", "jdwal.co", "جدول", "جدول مباريات"],
    url: SITE_URL,
    description:
      "جدول مباريات اليوم والغد ونتائج مباشرة لكرة القدم مع الترتيب والهدافين.",
    inLanguage: "ar",
  };

  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ClockSync serverNowUnix={nowUnix} />
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
