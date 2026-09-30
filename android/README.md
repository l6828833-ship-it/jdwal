# Football Live — Android

A **native** Android client for the same football backend the website uses. No
WebView: every screen is Jetpack Compose reading JSON directly. That is not a
style preference — Play review rejects an app whose functionality is "just a
website", and a wrapper would also drag the cookie banner, the ad slots and a
desktop layout onto a phone.

Lives beside the web app rather than inside it. It is deliberately **not** under
`../app/`, which is Next.js's App Router directory — a folder there becomes a live
URL segment and would break the site's build.

## What it does

| Screen | Source |
| --- | --- |
| Matches — day strip, grouped by competition, live clock | `/fixtures/getFixtures?date=&timezoneName=` |
| Match detail — score, incident timeline, facts | `/fixtures/getFixtures?id=` |
| Leagues → standings, groups split out | `/standings/getStandings?league=&season=` |
| Top scorers, per competition | `/players/getTopScorers?league=&season=` |

## Build

No JDK on the PATH is required; Android Studio's bundled one works.

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"

# Debug APK
gradle :app:assembleDebug

# Release, minified (unsigned until you add a signing config)
gradle :app:assembleRelease
```

Or just open this directory in Android Studio — `File ▸ Open`, pick `android/`
(not the repository root, which is a Next.js project Studio will not recognise).
`./gradlew` is committed, so a clean checkout builds without Studio too.

### Launcher icon

Generated from the source artwork rather than hand-cut, so every density and the
themed-icon layer stay in sync:

```bash
java tools/GenIcons.java <source-1024px.png> app/src/main/res \
  app/src/main/ic_launcher-playstore.png
```

This writes the five legacy densities, the round variants, the adaptive
foreground (scaled into the 66dp safe zone so no mask clips the ball), a
monochrome layer for themed icons, and the 512px Play Store asset. The
`ic_launcher_background` colour in `res/values/colors.xml` is set to the flat
background baked into the artwork so the opaque foreground has no visible edge
during launcher parallax.

To check the masks without installing:

```bash
java tools/PreviewMask.java app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png out.png
```

It uses `javax.imageio` from the JDK deliberately: this machine has only `sips`,
which resizes but cannot composite onto a padded canvas, and pulling in
ImageMagick for a build step is a dependency nobody else will have.

Versions are pinned to what was already in the local Gradle cache — AGP 9.4.0,
Kotlin 2.4.20, Compose BOM 2026.08.00, Gradle 9.6, `compileSdk 37`. Note AGP 9
supplies Kotlin itself: applying `org.jetbrains.kotlin.android` **fails** the
build, which is why only the Compose and serialization compiler plugins are
declared.

## Signing, and why there is no keystore here

`buildTypes.release` has no `signingConfig` on purpose. With Play App Signing the
upload key is a local secret, and a keystore path or password committed to a
repository is a leak waiting to happen.

Create the key once:

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Put the credentials in `~/.gradle/gradle.properties` (outside this repo):

```properties
FOOTBALL_STORE_FILE=/absolute/path/to/upload.jks
FOOTBALL_STORE_PASSWORD=…
FOOTBALL_KEY_ALIAS=upload
FOOTBALL_KEY_PASSWORD=…
```

Then add to `app/build.gradle.kts`:

```kotlin
android {
    signingConfigs {
        create("release") {
            storeFile = file(providers.gradleProperty("FOOTBALL_STORE_FILE").get())
            storePassword = providers.gradleProperty("FOOTBALL_STORE_PASSWORD").get()
            keyAlias = providers.gradleProperty("FOOTBALL_KEY_ALIAS").get()
            keyPassword = providers.gradleProperty("FOOTBALL_KEY_PASSWORD").get()
        }
    }
    buildTypes.getByName("release") {
        signingConfig = signingConfigs.getByName("release")
    }
}
```

Play wants an App Bundle, not an APK:

```bash
gradle :app:bundleRelease   # app/build/outputs/bundle/release/app-release.aab
```

## Play Console notes

- **Store title**: "Football Live: Scores & Results" is 31 characters and the
  limit is 30. Use something like `Football Live: Scores&Results` (29) as the
  listing title. The launcher label stays the short `Football Live`, which is
  correct anyway — a long label is truncated under the icon.
- **Data safety form**: the app collects nothing. One `INTERNET` permission, no
  analytics, no ads, no accounts, no storage. Say exactly that.
- **Privacy policy URL**: required. Point it at `https://jdwal.co/privacy`.
- **Content rating**: sports results, no user content, no gambling — the
  questionnaire lands on "Everyone".
- `minSdk 24` covers ~99% of active devices; `targetSdk 36` meets the current
  Play requirement.

## How it reaches the backend

The same Cloud Run service the website uses, called directly over HTTPS:

```
BuildConfig.API_BASE_URL = https://sportscore-main-git-44974813699.europe-west1.run.app
```

Set in `app/build.gradle.kts` as a `buildConfigField`, so the value is a compile
constant rather than something read at runtime.

Nothing special is needed to make this work, and two things that usually come up
do not apply:

- **No auth.** The service is deployed with unauthenticated invocation, so
  `INTERNET` is the only permission required. Verified: `GET /health` with no
  `Origin` and no credentials returns 200.
- **CORS is irrelevant.** The `Access-Control-Allow-Origin` header exists for
  browsers, which enforce the same-origin policy. OkHttp does not — an Android
  client is not subject to CORS at all, so no server change is needed for the app
  to be allowed to call it. Verified with `User-Agent: okhttp/4.12.0`.

`usesCleartextTraffic="false"` is set in the manifest, which is fine because the
`run.app` hostname is HTTPS-only. It does mean a plain-HTTP staging URL will be
blocked outright rather than failing subtly — point `API_BASE_URL` at an HTTPS
host, or add a debug-only network security config.

### Two things to settle before shipping

**Move to a stable hostname.** `sportscore-main-git-44974813699.europe-west1.run.app`
is Cloud Run's generated name and it is tied to the service, project number and
region. Recreate the service, rename it, or move region and the URL changes — and
an APK already on a user's phone cannot be hot-fixed. Map a domain
(`api.jdwal.co`) and point `API_BASE_URL` at that, so the backend can move
without stranding every installed copy.

**Cold starts.** Scaled to zero, the first request after an idle period pays
container startup plus the upstream fetch. The client's 10 s connect / 15 s read
timeouts absorb it, but it reads as a slow first launch. `--min-instances=1`
removes it.

Unauthenticated and public also means the endpoint is callable by anyone who
unzips the APK and reads the string — there is no way to keep a secret in a
client binary, so if abuse or egress cost becomes a concern the answer is
server-side rate limiting by IP, not a key in the app.

## Language

English is the default, Arabic is a translation.

- `res/values/strings.xml` is English and serves every locale the app has no
  resources for. `res/values-ar/strings.xml` is Arabic, and `supportsRtl` stays
  true, so an Arabic device gets an Arabic RTL app.
- Weekday and month names come from the JDK's locale data, not a hardcoded table,
  so they follow the locale for free. Digits are pinned to Latin numerals in both
  languages — see `util/Lang.formattingLocale()` — because a scoreline read at a
  glance should not switch numeral systems.
- Competition names and knockout-round labels carry both languages in code
  (`domain/Leagues.kt`, `domain/Rounds.kt`) rather than in resources. They are
  produced while mapping a response, where there is no `Context`.

**Names in the data are the backend's choice, not the app's.** Team, player and
stage names are localized by the upstream source, and the backend's default is
Arabic because that is what the website wants. So every request sends `lang`, and
the backend resolves it to an upstream language id. Without that, an English
build shows English chrome around Arabic team names. A backend that does not yet
honour `lang` ignores it and keeps answering in its default, so the app is safe
to ship ahead of the server.

## Things carried over from the web app's bugs

Each of these was a real defect on the website, fixed here from the start:

- **The day is the DEVICE's day.** Every dated request sends `timezoneName`, and
  the parameter is `timezoneName` — the backend silently ignores `timezone` and
  answers for the wrong day. Asking in UTC while showing local times loses the
  reader's own small hours from "today".
- **The match clock is never derived from kickoff.** Only the feed's elapsed
  minute is used, advanced locally between polls, with a guard that settles a
  match the feed has left stuck on "live" past a sane window.
- **Own goals** are attributed to the scorer's own club but placed on the side
  that benefited, so a row cannot read as though a player plays for the opposing
  team.
- **Round labels** are classified in both Arabic and English, and a cup round's
  trailing number is never read as a matchday — "الدور 3" is not "الجولة 3", and
  "3rd Round" is not "Round 3".
- **Group tables** are split by the group label, so position 1 does not appear
  twelve times in a World Cup table. A single-table league is not split.
- **Curated names win** over the feed's, which stacks the current phase onto the
  competition name.
- Competitions nobody follows — women's, youth, reserves, lower divisions — are
  filtered out, the same rule the site uses.
