/**
 * What phase of a competition a fixture belongs to.
 *
 * One definition, used by two callers that must not disagree:
 *
 *   • the provider normalizer, to decide whether a round label is a MATCHDAY
 *     ("Round 3") or a KNOCKOUT round ("دور الـ 32") — because it derives a
 *     matchday number from the label's trailing digits, and a knockout round's
 *     digits are not a matchday. Getting that wrong relabelled "دور الـ 32" as
 *     "الجولة 32", which then matched nothing here and erased the bracket.
 *   • the bracket, to lay the rounds out in order.
 *
 * Labels are free text from the data source, and the source is asked for Arabic,
 * so every pattern matches BOTH languages. It lived in the bracket component with
 * English-only patterns, which is why no cup ever rendered one.
 */

/** Canonical round order, earliest first. Higher rank = closer to the final. */
export const ROUND_ORDER: Array<{ test: RegExp; ar: string; rank: number }> = [
  {
    test: /play.?off|preliminary|qualif|تمهيد|تصفيات|ملحق/i,
    ar: "الأدوار التمهيدية",
    rank: 0,
  },
  { test: /round of 64|last 64|دور ال\S*\s*64/i, ar: "دور الـ64", rank: 1 },
  { test: /round of 32|last 32|دور ال\S*\s*32/i, ar: "دور الـ32", rank: 2 },
  {
    test: /round of 16|last 16|1\/8|دور ال\S*\s*16|ثمن النهائي/i,
    ar: "دور الـ16",
    rank: 3,
  },
  { test: /quarter|last 8|1\/4|ربع النهائي/i, ar: "ربع النهائي", rank: 4 },
  { test: /semi|last 4|1\/2|نصف النهائي/i, ar: "نصف النهائي", rank: 5 },
  {
    test: /3rd place|third place|المركز الثالث/i,
    ar: "تحديد المركز الثالث",
    rank: 6,
  },
  { test: /final|النهائي/i, ar: "النهائي", rank: 7 },
];

/**
 * The knockout round a label names, or null when it names something else.
 *
 * Order matters and the array carries it: "نصف النهائي" and "ربع النهائي" both
 * CONTAIN "النهائي", exactly as "semi-final" contains "final", so the specific
 * rounds are tested before the general one. `دور ال\S*` tolerates the tatweel in
 * "الـ" and any spacing before the number.
 */
export function classifyRound(
  stage: string | null | undefined,
): { ar: string; rank: number } | null {
  if (!stage) return null;
  for (const round of ROUND_ORDER) {
    if (round.test.test(stage)) return { ar: round.ar, rank: round.rank };
  }
  return null;
}

/** Does this label name a knockout round rather than a matchday or a group? */
export function isKnockoutRound(stage: string | null | undefined): boolean {
  return classifyRound(stage) !== null;
}
