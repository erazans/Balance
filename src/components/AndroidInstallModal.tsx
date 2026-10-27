import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download, Share, MoreVertical, CheckCircle2, HelpCircle } from 'lucide-react';

export const AndroidInstallModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [installTriggered, setInstallTriggered] = useState(false);

  if (!isOpen) return null;

  const handleDirectWebApkInstall = async () => {
    const ok = await install();
    if (ok) {
      setInstallTriggered(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-[#050507] p-6 text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Installer KiloObsidian sur votre téléphone Android
              </h2>
              <p className="text-xs text-zinc-400">
                Installation WebAPK native signée par Google Play Protect (Sans erreur de package)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:text-white"
          >
            Fermer
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          {/* Why raw APK fails explanation */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-200 leading-relaxed">
            <strong>Pourquoi le fichier .apk brut affiche « Impossible d’installer / Problème d’analyse du package » ?</strong>
            <p className="mt-1 text-amber-300/90">
              Android exige qu’un fichier <code>.apk</code> soit compilé en binaire par le SDK Android (<code>aapt2</code> + bytecode <code>classes.dex</code> + signature cryptographique V2/V3). Le serveur d’aperçu Cloud étant un conteneur Node.js sans SDK Android/Java, voici les <strong>2 méthodes 100 % fonctionnelles</strong> pour l’installer sur votre téléphone :
            </p>
          </div>

          {/* Method 1: Instant WebAPK on Android Phone (Recommended, 10 seconds) */}
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-300">
                Méthode 1 (Immédiate) — Installation WebAPK Android
              </span>
              <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-black">
                RECOMMANDÉ
              </span>
            </div>
            <p className="mt-1.5 text-zinc-300 leading-relaxed">
              Chrome sur Android génère et signe automatiquement un vrai <strong>WebAPK natif</strong> pour KiloObsidian (plein écran AMOLED, icône sur l’écran d’accueil, Bluetooth Xiaomi & fonctionnement 100 % hors-ligne).
            </p>

            {isInstallable && !isInstalled ? (
              <button
                type="button"
                onClick={handleDirectWebApkInstall}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-black hover:bg-emerald-400 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Installer directement l’application sur ce téléphone</span>
              </button>
            ) : isInstalled || installTriggered ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-black/60 p-3 text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>L’application est déjà installée sur votre appareil !</span>
              </div>
            ) : (
              <ol className="mt-3 space-y-2 rounded-xl border border-zinc-800 bg-black/80 p-3.5 text-zinc-200">
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-emerald-400">1.</span>
                  <span>
                    Ouvrez ce lien dans <strong>Google Chrome</strong> sur votre téléphone Android :{' '}
                    <code className="break-all text-emerald-400 select-all">
                      {window.location.origin}
                    </code>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-emerald-400">2.</span>
                  <span className="flex items-center gap-1 flex-wrap">
                    Appuyez sur le menu <MoreVertical className="inline h-3.5 w-3.5 text-emerald-400" /> en haut à droite de Chrome.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-emerald-400">3.</span>
                  <span>
                    Sélectionnez <strong>« Installer l’application »</strong> (ou <strong>« Ajouter à l’écran d’accueil »</strong>).
                  </span>
                </li>
              </ol>
            )}
          </div>

          {/* Method 2: True Native Signed APK via included Capacitor / GitHub Actions */}
          <div className="rounded-2xl border border-zinc-800 bg-black p-4">
            <div className="text-sm font-semibold text-white">
              Méthode 2 — Compiler le fichier .APK binaire signé (Capacitor / GitHub)
            </div>
            <p className="mt-1 text-zinc-400 leading-relaxed">
              Le projet inclut la configuration complète <code>capacitor.config.json</code>, le script <code>./build-android-apk.sh</code> et le workflow automatique <code>.github/workflows/build-android-apk.yml</code> :
            </p>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-zinc-300">
              <li>• Sur GitHub : Pushez le dépôt → Onglet Actions → Téléchargez <code>app-debug.apk</code></li>
              <li>• En local (PC/Mac avec Android Studio) : Exécutez <code>bash build-android-apk.sh</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
