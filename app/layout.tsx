import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Analytics } from "@/components/analytics";
import { AdSense } from "@/components/adsense";
import { BottomNav } from "@/components/bottom-nav";
import { ConsentProvider } from "@/components/consent";
import { SiteFooter } from "@/components/site-footer";
import { ClockSync } from "@/components/clock-sync";
import { TimezoneProvider } from "@/components/timezone-provider";
import { resolveRequestTime } from "@/lib/geo-timezone";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/config";
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
 * Targets the site's strongest Search Console queries naturally: "jdwal",
 * "jdwel", "موقع جدول", and "jdwel مباريات اليوم". `title.template` appends
 * the brand to inner pages without repeating the full homepage title.
 *
 * `metadataBase` makes the relative Open Graph image and canonical URLs
 * absolute. Update NEXT_PUBLIC_SITE_URL once a custom domain is live.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: t.seoTitle,
    template: "%s | موقع جدول - jdwal",
  },
  description: t.seoMetaDescription,
  /**
   * Kept for completeness and for the crawlers that still read it (Bing has
   * historically, Yandex does). Google has ignored the keywords meta tag since
   * 2009, so nothing here moves a Google ranking on its own — the terms that
   * matter are the ones in the title, the headings, the body copy and the
   * structured data, which is why "jadwal" appears in all of those too.
   *
   * "jadwal" is the spelling most people reach for when transliterating جدول,
   * so it belongs alongside "jdwal" and "jdwel" everywhere the brand is stated.
   */
  keywords: [
    "jdwal",
    "jdwel",
    "jadwal",
    "jadwal live",
    "jadwal مباريات",
    "jdwal.co",
    "موقع جدول",
    "jdwel مباريات اليوم",
    "جدول",
    "جدوال",
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
  applicationName: "موقع جدول - jdwal",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "موقع جدول - jdwal",
    locale: "ar_AR",
    url: SITE_URL,
    title: t.seoTitle,
    description: t.seoMetaDescription,
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
    title: t.seoTitle,
    description: t.seoMetaDescription,
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

  /**
   * Site-wide structured data: the `WebSite` and the `Organization` behind it.
   *
   * `alternateName` is the part that earns its keep. It is how the site tells
   * Google that "jdwal", "jadwal", "jdwel" and "جدول" are the SAME entity, so a
   * search for any spelling can resolve to this brand — a knowledge-graph
   * signal, not a keyword list. Both nodes carry `@id`s so per-page markup can
   * reference them instead of restating the whole entity (see app/page.tsx).
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "موقع جدول - jdwal",
        alternateName: [
          "jadwal",
          "jdwel",
          "jdwal.co",
          "جدول",
          "جدوال",
          "موقع جدول",
          "جدول مباريات اليوم",
        ],
        url: SITE_URL,
        description: t.seoMetaDescription,
        inLanguage: "ar",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "موقع جدول - jdwal",
        alternateName: ["جدول", "jdwal", "jdwel", "jadwal"],
        url: SITE_URL,
        email: CONTACT_EMAIL,
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: CONTACT_EMAIL,
          availableLanguage: ["Arabic", "English"],
          url: `${SITE_URL}/contact`,
        },
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/logo-full.png`,
          width: 1024,
          height: 1024,
        },
      },
    ],
  };

  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased">
        <ConsentProvider>
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
              <SiteFooter />
            </div>
            <BottomNav />
          </TimezoneProvider>
          <Analytics />
          <AdSense />
        </ConsentProvider>
      </body>
    </html>
  );
}
