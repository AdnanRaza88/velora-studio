# GitHub Actions Android Build

## Goals
- reproducible APK builds
- debug APK for every PR when practical
- release artifact on tagged builds
- tests before packaging

## Pipeline
```text
checkout
→ JDK setup
→ Gradle cache
→ lint
→ unit tests
→ geometry tests
→ build
→ APK
→ upload artifact
```

## Release
Tagged release:
```text
v0.1.0
→ release build
→ sign using GitHub Secrets
→ publish APK artifact
```

## Secrets
Never commit:
- keystore
- passwords
- provider API keys
- signing credentials

Use GitHub Actions Secrets/Variables.

## Reproducibility
Pin:
- JDK version
- Gradle wrapper
- Android Gradle Plugin
- Kotlin version
- dependency versions where appropriate

## Build variants
- debug
- staging
- release

## Optional later
- Play Console publishing
- internal testing track
- automated screenshot generation
