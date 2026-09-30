package co.jdwal.football.domain

import co.jdwal.football.util.Lang

/**
 * What phase of a competition a fixture belongs to.
 *
 * One definition used by two callers that must agree: the bracket, to order the
 * rounds, and the label logic, to know that a round's trailing number is NOT a
 * matchday. Keeping them apart is how "دور الـ 32" once became "الجولة 32" on the
 * website — the label was rewritten as a matchday and the bracket then matched
 * nothing.
 *
 * Every pattern matches both languages, because the phase is free text from the
 * backend and which language the backend answers in is its own setting, not the
 * app's. The specific rounds must be tested before the general one:
 * "نصف النهائي" contains "النهائي", exactly as "semi-final" contains "final", so
 * array order is what prevents a semi-final being filed as the final.
 */
data class KnockoutRound(val labelEn: String, val labelAr: String, val rank: Int) {
    val label: String get() = Lang.pick(labelEn, labelAr)
}

object Rounds {

    private val ORDER: List<Pair<Regex, KnockoutRound>> = listOf(
        re("play.?off|preliminary|qualif|تمهيد|تصفيات|ملحق") to
            KnockoutRound("Qualifying rounds", "الأدوار التمهيدية", 0),
        re("round of 64|last 64|دور ال\\S*\\s*64") to
            KnockoutRound("Round of 64", "دور الـ64", 1),
        re("round of 32|last 32|دور ال\\S*\\s*32") to
            KnockoutRound("Round of 32", "دور الـ32", 2),
        re("round of 16|last 16|1/8|دور ال\\S*\\s*16|ثمن النهائي") to
            KnockoutRound("Round of 16", "دور الـ16", 3),
        re("quarter|last 8|1/4|ربع النهائي") to
            KnockoutRound("Quarter-final", "ربع النهائي", 4),
        re("semi|last 4|1/2|نصف النهائي") to
            KnockoutRound("Semi-final", "نصف النهائي", 5),
        re("3rd place|third place|المركز الثالث") to
            KnockoutRound("Third-place play-off", "تحديد المركز الثالث", 6),
        re("final|النهائي") to
            KnockoutRound("Final", "النهائي", 7),
    )

    private fun re(pattern: String) = Regex(pattern, RegexOption.IGNORE_CASE)

    fun classify(phase: String?): KnockoutRound? {
        if (phase.isNullOrBlank()) return null
        return ORDER.firstOrNull { (regex, _) -> regex.containsMatchIn(phase) }?.second
    }

    fun isKnockout(phase: String?): Boolean = classify(phase) != null

    /**
     * The label to show for a fixture's phase.
     *
     * A knockout round is recognised and renamed in the app's language. A group
     * passes through as the backend named it. A league matchday arrives as
     * "Round 12" or "الجولة 12" — synthesized from a number, so it is rebuilt in
     * the app's language. A cup's numbered round ("الدور 3" / "3rd Round") is NOT
     * a matchday and is left alone: reading its 3 as a game week is what produced
     * "الجولة 3" for a Carabao Cup tie.
     */
    fun label(phase: String?): String? {
        val text = phase?.trim().orEmpty()
        if (text.isEmpty()) return null
        if (isKnockout(text)) return classify(text)?.label ?: text
        // A cup round names itself; no `\b`, which does not work after Arabic.
        if (Regex("^\\s*(ال)?دور(\\s|$)|^\\s*\\d+(st|nd|rd|th)\\s+round\\b", RegexOption.IGNORE_CASE)
                .containsMatchIn(text)
        ) {
            return text
        }
        val matchday = Regex("^(?:round|الجولة)\\s+(\\d+)$", RegexOption.IGNORE_CASE).find(text)
        return if (matchday != null) {
            val number = matchday.groupValues[1]
            Lang.pick("Round $number", "الجولة $number")
        } else {
            text
        }
    }
}
