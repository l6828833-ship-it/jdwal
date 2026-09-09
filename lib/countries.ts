/**
 * Country name (as the provider spells it) -> ISO 3166-1 alpha-2 + Arabic name.
 *
 * Footballdata.io returns English country names on teams, leagues and venues.
 * We map to ISO codes so flags can be rendered, and to Arabic for display.
 *
 * Flags are emoji (regional indicator pairs), so there are no image assets or
 * extra network requests. `flagEmoji` is the only place that knows this, so
 * swapping to sprite images later is a one-function change.
 */

interface CountryInfo {
  code: string;
  ar: string;
}

const COUNTRIES: Record<string, CountryInfo> = {
  // --- Home nations (emoji uses subdivision tag sequences) ---
  england: { code: "gb-eng", ar: "إنجلترا" },
  scotland: { code: "gb-sct", ar: "إسكتلندا" },
  wales: { code: "gb-wls", ar: "ويلز" },
  "northern ireland": { code: "gb-nir", ar: "أيرلندا الشمالية" },

  // --- Europe ---
  spain: { code: "es", ar: "إسبانيا" },
  italy: { code: "it", ar: "إيطاليا" },
  germany: { code: "de", ar: "ألمانيا" },
  france: { code: "fr", ar: "فرنسا" },
  portugal: { code: "pt", ar: "البرتغال" },
  netherlands: { code: "nl", ar: "هولندا" },
  belgium: { code: "be", ar: "بلجيكا" },
  austria: { code: "at", ar: "النمسا" },
  switzerland: { code: "ch", ar: "سويسرا" },
  greece: { code: "gr", ar: "اليونان" },
  turkey: { code: "tr", ar: "تركيا" },
  türkiye: { code: "tr", ar: "تركيا" },
  ukraine: { code: "ua", ar: "أوكرانيا" },
  russia: { code: "ru", ar: "روسيا" },
  poland: { code: "pl", ar: "بولندا" },
  czechia: { code: "cz", ar: "التشيك" },
  "czech republic": { code: "cz", ar: "التشيك" },
  denmark: { code: "dk", ar: "الدنمارك" },
  norway: { code: "no", ar: "النرويج" },
  sweden: { code: "se", ar: "السويد" },
  finland: { code: "fi", ar: "فنلندا" },
  iceland: { code: "is", ar: "آيسلندا" },
  ireland: { code: "ie", ar: "أيرلندا" },
  croatia: { code: "hr", ar: "كرواتيا" },
  serbia: { code: "rs", ar: "صربيا" },
  slovakia: { code: "sk", ar: "سلوفاكيا" },
  slovenia: { code: "si", ar: "سلوفينيا" },
  hungary: { code: "hu", ar: "المجر" },
  romania: { code: "ro", ar: "رومانيا" },
  bulgaria: { code: "bg", ar: "بلغاريا" },
  cyprus: { code: "cy", ar: "قبرص" },
  israel: { code: "il", ar: "إسرائيل" },
  albania: { code: "al", ar: "ألبانيا" },
  "north macedonia": { code: "mk", ar: "مقدونيا الشمالية" },
  "bosnia and herzegovina": { code: "ba", ar: "البوسنة والهرسك" },
  montenegro: { code: "me", ar: "الجبل الأسود" },
  kosovo: { code: "xk", ar: "كوسوفو" },
  moldova: { code: "md", ar: "مولدوفا" },
  belarus: { code: "by", ar: "بيلاروسيا" },
  lithuania: { code: "lt", ar: "ليتوانيا" },
  latvia: { code: "lv", ar: "لاتفيا" },
  estonia: { code: "ee", ar: "إستونيا" },
  luxembourg: { code: "lu", ar: "لوكسمبورغ" },
  malta: { code: "mt", ar: "مالطا" },
  andorra: { code: "ad", ar: "أندورا" },
  "san marino": { code: "sm", ar: "سان مارينو" },
  gibraltar: { code: "gi", ar: "جبل طارق" },
  "faroe islands": { code: "fo", ar: "جزر فارو" },
  armenia: { code: "am", ar: "أرمينيا" },
  azerbaijan: { code: "az", ar: "أذربيجان" },
  georgia: { code: "ge", ar: "جورجيا" },
  kazakhstan: { code: "kz", ar: "كازاخستان" },

  // --- Arab world ---
  "saudi arabia": { code: "sa", ar: "السعودية" },
  egypt: { code: "eg", ar: "مصر" },
  morocco: { code: "ma", ar: "المغرب" },
  algeria: { code: "dz", ar: "الجزائر" },
  tunisia: { code: "tn", ar: "تونس" },
  libya: { code: "ly", ar: "ليبيا" },
  qatar: { code: "qa", ar: "قطر" },
  "united arab emirates": { code: "ae", ar: "الإمارات" },
  uae: { code: "ae", ar: "الإمارات" },
  kuwait: { code: "kw", ar: "الكويت" },
  bahrain: { code: "bh", ar: "البحرين" },
  oman: { code: "om", ar: "عُمان" },
  jordan: { code: "jo", ar: "الأردن" },
  lebanon: { code: "lb", ar: "لبنان" },
  iraq: { code: "iq", ar: "العراق" },
  syria: { code: "sy", ar: "سوريا" },
  palestine: { code: "ps", ar: "فلسطين" },
  yemen: { code: "ye", ar: "اليمن" },
  sudan: { code: "sd", ar: "السودان" },
  mauritania: { code: "mr", ar: "موريتانيا" },
  somalia: { code: "so", ar: "الصومال" },
  djibouti: { code: "dj", ar: "جيبوتي" },
  comoros: { code: "km", ar: "جزر القمر" },

  // --- Americas ---
  "united states": { code: "us", ar: "الولايات المتحدة" },
  usa: { code: "us", ar: "الولايات المتحدة" },
  // The provider labels the US national team "USMNT".
  usmnt: { code: "us", ar: "الولايات المتحدة" },
  panama: { code: "pa", ar: "بنما" },
  haiti: { code: "ht", ar: "هايتي" },
  curacao: { code: "cw", ar: "كوراساو" },
  jamaica: { code: "jm", ar: "جامايكا" },
  "costa rica": { code: "cr", ar: "كوستاريكا" },
  honduras: { code: "hn", ar: "هندوراس" },
  "trinidad and tobago": { code: "tt", ar: "ترينيداد وتوباغو" },
  canada: { code: "ca", ar: "كندا" },
  mexico: { code: "mx", ar: "المكسيك" },
  brazil: { code: "br", ar: "البرازيل" },
  argentina: { code: "ar", ar: "الأرجنتين" },
  uruguay: { code: "uy", ar: "أوروغواي" },
  chile: { code: "cl", ar: "تشيلي" },
  colombia: { code: "co", ar: "كولومبيا" },
  peru: { code: "pe", ar: "بيرو" },
  paraguay: { code: "py", ar: "باراغواي" },
  ecuador: { code: "ec", ar: "الإكوادور" },
  bolivia: { code: "bo", ar: "بوليفيا" },
  venezuela: { code: "ve", ar: "فنزويلا" },

  // --- Africa (non-Arab) ---
  nigeria: { code: "ng", ar: "نيجيريا" },
  ghana: { code: "gh", ar: "غانا" },
  senegal: { code: "sn", ar: "السنغال" },
  cameroon: { code: "cm", ar: "الكاميرون" },
  "ivory coast": { code: "ci", ar: "ساحل العاج" },
  "côte d'ivoire": { code: "ci", ar: "ساحل العاج" },
  "south africa": { code: "za", ar: "جنوب أفريقيا" },
  kenya: { code: "ke", ar: "كينيا" },
  ethiopia: { code: "et", ar: "إثيوبيا" },
  mali: { code: "ml", ar: "مالي" },
  "burkina faso": { code: "bf", ar: "بوركينا فاسو" },
  "dr congo": { code: "cd", ar: "الكونغو الديمقراطية" },
  "congo dr": { code: "cd", ar: "الكونغو الديمقراطية" },
  "cape verde islands": { code: "cv", ar: "الرأس الأخضر" },
  "cape verde": { code: "cv", ar: "الرأس الأخضر" },
  gabon: { code: "ga", ar: "الغابون" },
  guinea: { code: "gn", ar: "غينيا" },
  benin: { code: "bj", ar: "بنين" },
  togo: { code: "tg", ar: "توغو" },
  uganda: { code: "ug", ar: "أوغندا" },
  tanzania: { code: "tz", ar: "تنزانيا" },
  mozambique: { code: "mz", ar: "موزمبيق" },
  zimbabwe: { code: "zw", ar: "زيمبابوي" },
  namibia: { code: "na", ar: "ناميبيا" },
  botswana: { code: "bw", ar: "بوتسوانا" },
  angola: { code: "ao", ar: "أنغولا" },
  zambia: { code: "zm", ar: "زامبيا" },

  // --- Asia / Oceania ---
  japan: { code: "jp", ar: "اليابان" },
  "south korea": { code: "kr", ar: "كوريا الجنوبية" },
  china: { code: "cn", ar: "الصين" },
  iran: { code: "ir", ar: "إيران" },
  australia: { code: "au", ar: "أستراليا" },
  "new zealand": { code: "nz", ar: "نيوزيلندا" },
  india: { code: "in", ar: "الهند" },
  indonesia: { code: "id", ar: "إندونيسيا" },
  thailand: { code: "th", ar: "تايلاند" },
  uzbekistan: { code: "uz", ar: "أوزبكستان" },
  vietnam: { code: "vn", ar: "فيتنام" },
};

/**
 * Pseudo-regions the provider uses for continental and world competitions.
 * They have no national flag, so the league crest is shown instead.
 */
const NON_NATIONAL = new Set([
  "europe",
  "international",
  "world",
  "africa",
  "asia",
  "south america",
  "north america",
  "oceania",
]);

const NON_NATIONAL_AR: Record<string, string> = {
  europe: "أوروبا",
  international: "دولي",
  world: "العالم",
  africa: "أفريقيا",
  asia: "آسيا",
  "south america": "أمريكا الجنوبية",
  "north america": "أمريكا الشمالية",
  oceania: "أوقيانوسيا",
};

/**
 * Providers do not agree on how to write a country name. API-Football
 * hyphenates them ("Saudi-Arabia", "South-Korea", "Bosnia-and-Herzegovina")
 * where the others use spaces, so hyphens and underscores are folded to spaces
 * before lookup. Without this, every multi-word country silently loses its flag
 * and its Arabic name and falls back to the raw provider spelling.
 */
function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function isNonNationalRegion(name: string | null | undefined): boolean {
  if (!name) return false;
  return NON_NATIONAL.has(normalize(name));
}

/** ISO alpha-2 (or `gb-eng` style subdivision) for a provider country name. */
export function countryCode(name: string | null | undefined): string | null {
  if (!name) return null;
  return COUNTRIES[normalize(name)]?.code ?? null;
}

/** Arabic country name, falling back to the original spelling. */
export function countryNameAr(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = normalize(name);
  return COUNTRIES[key]?.ar ?? NON_NATIONAL_AR[key] ?? name;
}

/**
 * Arabic country name, or null when the name isn't a known country.
 *
 * Used to translate national teams: World Cup entrants come through as country
 * names ("France", "Ivory Coast"), not clubs, so club lookup can't help them.
 */
export function countryNameArOrNull(
  name: string | null | undefined,
): string | null {
  if (!name) return null;
  return COUNTRIES[normalize(name)]?.ar ?? null;
}

const SUBDIVISION_FLAGS: Record<string, string> = {
  // Regional indicator sequences can't express home nations; these use
  // tag sequences, which render on Apple platforms and modern Android.
  "gb-eng": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  "gb-sct": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  "gb-wls": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
  // Northern Ireland has no emoji flag; fall back to the UK flag.
  "gb-nir": "\u{1F1EC}\u{1F1E7}",
  // Kosovo has no emoji flag either.
  xk: "",
};

/** Emoji flag for an ISO code, or "" when none exists. */
export function flagEmoji(code: string | null | undefined): string {
  if (!code) return "";
  const lower = code.toLowerCase();
  if (lower in SUBDIVISION_FLAGS) return SUBDIVISION_FLAGS[lower];
  if (lower.length !== 2) return "";
  const A = 0x1f1e6;
  const a = "a".charCodeAt(0);
  return String.fromCodePoint(
    A + (lower.charCodeAt(0) - a),
    A + (lower.charCodeAt(1) - a),
  );
}

/**
 * Best-effort country for a venue, inferred from the address tail or the
 * competing teams. Footballdata.io venues carry a free-text address with no
 * country field, so this is heuristic and returns null when unsure.
 */
export function countryFromVenueLocation(
  location: string | null | undefined,
): string | null {
  if (!location) return null;
  const parts = location.split(",").map((p) => p.trim());
  for (let i = parts.length - 1; i >= 0; i--) {
    const code = countryCode(parts[i]);
    if (code) return code;
  }
  return null;
}
