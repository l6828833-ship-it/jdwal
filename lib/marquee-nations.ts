/**
 * National teams whose friendlies are worth showing.
 *
 * International friendlies are a single competition holding every country on
 * Earth — on a FIFA window day that is ~50 fixtures, most of them Vanuatu v Fiji
 * or Myanmar v Guam. So the competition is carried, but a fixture in it is only
 * shown when at least one side is a big European nation, an Arab nation, or a
 * Latin American nation. See `isMarqueeFriendly`.
 *
 * Pure data + string matching, no server imports: lib/grouping.ts runs in the
 * browser too.
 */

/** Big European football nations. */
const EUROPE = [
  "إسبانيا", "اسبانيا", "spain",
  "فرنسا", "france",
  "إنجلترا", "انجلترا", "england",
  "ألمانيا", "المانيا", "germany",
  "إيطاليا", "ايطاليا", "italy",
  "البرتغال", "portugal",
  "هولندا", "netherlands", "holland",
  "بلجيكا", "belgium",
  "كرواتيا", "croatia",
];

/** Latin American nations: all of CONMEBOL, plus Mexico. */
const LATIN = [
  "البرازيل", "brazil",
  "الأرجنتين", "الارجنتين", "argentina",
  "الأوروغواي", "الأوروجواي", "أوروغواي", "أوروجواي", "uruguay",
  "كولومبيا", "colombia",
  "تشيلي", "شيلي", "chile",
  "البيرو", "بيرو", "peru",
  "الإكوادور", "الاكوادور", "ecuador",
  "باراغواي", "باراجواي", "البارغواي", "paraguay",
  "فنزويلا", "venezuela",
  "بوليفيا", "bolivia",
  "المكسيك", "mexico",
];

/** All 22 Arab League members. */
const ARAB = [
  "السعودية", "saudi arabia",
  "مصر", "egypt",
  "المغرب", "morocco",
  "الجزائر", "algeria",
  "تونس", "tunisia",
  "ليبيا", "libya",
  "السودان", "sudan",
  "الإمارات", "الامارات", "الإمارات العربية المتحدة", "uae", "united arab emirates",
  "قطر", "qatar",
  "الكويت", "kuwait",
  "البحرين", "bahrain",
  "عمان", "عُمان", "oman",
  "اليمن", "yemen",
  "العراق", "iraq",
  "سوريا", "سورية", "syria",
  "الأردن", "الاردن", "jordan",
  "لبنان", "lebanon",
  "فلسطين", "palestine",
  "موريتانيا", "mauritania",
  "جيبوتي", "djibouti",
  "الصومال", "somalia",
  "جزر القمر", "القمر", "comoros",
];

/**
 * Fold the spelling variants that differ between sources: hamza forms, taa
 * marbuta, alif maqsura, diacritics, and a leading "ال". Matching is EXACT on
 * the folded name, never a substring — "تونس" must not match a club whose name
 * happens to contain it.
 */
function fold(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, "") // harakat (e.g. عُمان)
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/^ال/, "")
    .replace(/[\s\-_.]+/g, " ")
    .trim();
}

const MARQUEE = new Set([...EUROPE, ...LATIN, ...ARAB].map(fold));

/**
 * A youth, women's or Olympic side carries its country's name plus a marker
 * ("السعودية تحت 20", "Brazil U23", "كندا - سيدات"). Those are not the senior
 * team, so they never qualify a friendly on their own.
 */
const NOT_SENIOR = /\bu-?\d{2}\b|تحت\s*\d{2}|سيدات|نساء|women|أولمبي|olympic|شباب|youth/i;

function isMarqueeTeam(...names: Array<string | null | undefined>): boolean {
  return names.some(
    (name) => !!name && !NOT_SENIOR.test(name) && MARQUEE.has(fold(name)),
  );
}

interface TeamNames {
  name: string;
  nameOriginal?: string | null;
}

/** True when at least one side is a big European, Arab or Latin nation. */
export function isMarqueeFriendly(home: TeamNames, away: TeamNames): boolean {
  return (
    isMarqueeTeam(home.name, home.nameOriginal) ||
    isMarqueeTeam(away.name, away.nameOriginal)
  );
}
