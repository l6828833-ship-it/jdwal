package co.jdwal.football.util

import java.util.Locale

/**
 * Picks between the two languages this app ships, outside of resources.
 *
 * Most copy belongs in a `res/values` string resource and does. This exists for the
 * strings that are DATA rather than chrome — curated competition names and
 * knockout-round labels — which are produced in the domain layer while mapping a
 * response, where there is no `Context` to resolve a resource with and no good
 * reason to plumb one through just to name a cup.
 *
 * `Locale.getDefault()` is the right source: Android sets it from the resolved
 * app configuration, so it already reflects any per-app language override the
 * user picked, not just the system language.
 */
object Lang {

    fun isArabic(): Boolean = Locale.getDefault().language == "ar"

    fun pick(english: String, arabic: String): String =
        if (isArabic()) arabic else english

    /**
     * The current locale, forced to Latin digits.
     *
     * Arabic locales default to Eastern Arabic numerals (`٢٠٢٦`), which turns
     * scores, minutes and kickoff times into a different set of glyphs than the
     * ones in the crests and league tables around them. Scorelines are read at a
     * glance, so they stay in one numeral system.
     */
    fun formattingLocale(): Locale = Locale.Builder()
        .setLocale(Locale.getDefault())
        .setUnicodeLocaleKeyword("nu", "latn")
        .build()
}
