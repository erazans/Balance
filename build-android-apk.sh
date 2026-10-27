#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  KiloObsidian v1.0.1 — Compilation APK Android Native  "
echo "========================================================"

# 1. Compilation du bundle de production Vite + Service Worker Offline
echo "[1/4] Build de l'application web (Vite + PWA Offline)..."
npm install
npm run build

# 2. Installation de Capacitor Android si non présent
if [ ! -d "android" ]; then
  echo "[2/4] Initialisation du projet natif Android (Capacitor)..."
  npm install @capacitor/core @capacitor/cli @capacitor/android
  npx cap add android
else
  echo "[2/4] Synchronisation avec le dossier Android existant..."
fi

# 3. Synchronisation des assets web vers Android
echo "[3/4] Copie du build vers android/app/src/main/assets/public..."
npx cap sync android

# 4. Compilation de l'APK signé avec Gradle
echo "[4/4] Compilation de l'APK avec Gradle (assembleDebug)..."
cd android
chmod +x gradlew
./gradlew assembleDebug

cp app/build/outputs/apk/debug/app-debug.apk ../public/KiloObsidian-v1.0.1-clean-release.apk
echo "========================================================"
echo "SUCCÈS : APK installable généré dans :"
echo "  -> public/KiloObsidian-v1.0.1-clean-release.apk"
echo "========================================================"
