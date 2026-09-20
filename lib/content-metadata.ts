import type { Metadata } from "next";
import { SITE_URL } from "@/lib/config";

/**
 * Consistent metadata for permanent publisher/editorial pages.
 *
 * Legal pages may be `noindex, follow` by policy while remaining linked in the
 * footer for users and AdSense reviewers. Indexable content pages receive a
 * canonical and matching social metadata.
 */
export function contentMetadata({
  title,
  description,
  path,
  index = true,
}: {
  title: string;
  description: string;
  path: `/${string}`;
  index?: boolean;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: {
      index,
      follow: true,
      googleBot: { index, follow: true },
    },
    openGraph: {
      type: "article",
      locale: "ar_AR",
      siteName: "موقع جدول - jdwal",
      url,
      title,
      description,
      images: [
        {
          url: "/logo-full.png",
          width: 1024,
          height: 1024,
          alt: "موقع جدول لمباريات اليوم ونتائج كرة القدم",
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/logo-full.png"],
    },
  };
}
