/**
 * Versions are pinned to what this machine's Gradle cache already holds, so a
 * first build resolves offline instead of discovering that some newer default
 * does not exist yet. Bump them deliberately, together.
 *
 * Note there is no `org.jetbrains.kotlin.android` here. AGP 9 has built-in Kotlin
 * support and fails the build if that plugin is also applied — the Kotlin version
 * comes from AGP, and only the extra compiler plugins are declared.
 */
plugins {
    id("com.android.application") version "9.4.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.20" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.4.20" apply false
}
