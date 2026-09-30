plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "co.jdwal.football"
    compileSdk = 37

    defaultConfig {
        applicationId = "co.jdwal.football"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        /**
         * The backend this app reads, injected as a build field rather than
         * hard-coded in Kotlin so a debug build can be pointed at a local
         * instance without touching source. It is the SAME service the website
         * uses — see the project root's DEPLOY.md.
         */
        buildConfigField(
            "String",
            "API_BASE_URL",
            "\"https://sportscore-main-git-44974813699.europe-west1.run.app\"",
        )

        // Arabic is the product language, not a translation of an English app.
        resourceConfigurations += setOf("ar", "en")
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            /**
             * No signingConfig here on purpose.
             *
             * Play App Signing means the upload key is a local secret, and a
             * keystore path or password committed to a repository is a leak
             * waiting to happen. Create the key once and put its credentials in
             * `~/.gradle/gradle.properties`, then add a signingConfig that reads
             * them — see README.md in this directory.
             */
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    packaging {
        resources.excludes += setOf(
            "/META-INF/{AL2.0,LGPL2.1}",
            "/META-INF/DEPENDENCIES",
        )
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.08.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.19.0")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.11.0")
    implementation("androidx.navigation:navigation-compose:2.10.0")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended:1.7.8")

    // Plain OkHttp plus kotlinx.serialization, no Retrofit: this app calls four
    // endpoints, and an interface-generating HTTP client earns its weight at a
    // far larger surface than that.
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")

    // Crests and player photos come from the data source's CDN over https.
    implementation("io.coil-kt.coil3:coil-compose:3.6.2")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.6.2")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
