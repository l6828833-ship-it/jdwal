# kotlinx.serialization generates serializers as companion objects and synthetic
# members that R8 cannot see are used. Without these, a release build parses the
# API response into empty objects — and it only shows up in the release variant,
# which is the worst way to find out.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Every @Serializable model in this app.
-keep,includedescriptorclasses class co.jdwal.football.data.**$$serializer { *; }
-keepclassmembers class co.jdwal.football.data.** {
    *** Companion;
}
-keepclasseswithmembers class co.jdwal.football.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# OkHttp ships optional references to Conscrypt/BouncyCastle and platform bits
# that are absent on Android.
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
