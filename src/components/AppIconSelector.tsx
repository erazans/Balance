import React, { useState } from 'react';
import {
  APP_ICON_VARIANTS,
  AppIconId,
  AppIconVariant,
  svgStringToDataUrl,
  downloadIconAsPng,
} from '../utils/appIcons';
import { Check, Download, Sparkles, Smartphone } from 'lucide-react';

interface AppIconSelectorProps {
  selectedIconId: AppIconId;
  onSelectIcon: (icon: AppIconVariant) => void;
  isLightMode?: boolean;
}

type LauncherMask = 'squircle' | 'circle' | 'rounded' | 'teardrop';

export const AppIconSelector: React.FC<AppIconSelectorProps> = ({
  selectedIconId,
  onSelectIcon,
  isLightMode = false,
}) => {
  const [launcherMask, setLauncherMask] = useState<LauncherMask>('squircle');

  const getMaskRadiusClass = (mask: LauncherMask) => {
    if (mask === 'circle') return 'rounded-full';
    if (mask === 'teardrop') return 'rounded-tl-full rounded-tr-full rounded-bl-full rounded-br-xl';
    if (mask === 'rounded') return 'rounded-2xl';
    return 'rounded-[28%]'; // Android Adaptive Squircle
  };

  const activeVariant =
    APP_ICON_VARIANTS.find((v) => v.id === selectedIconId) || APP_ICON_VARIANTS[0];

  return (
    <div className="space-y-6">
      {/* Header & Android Adaptive Mask Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <h2 className="text-xl font-semibold">
            Galerie d’Icônes de l’Application (True Black AMOLED & Android Adaptive)
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Choisissez l’icône officielle utilisée sur l’écran d’accueil Android, l’onglet navigateur et le package APK Clean.
          </p>
        </div>

        {/* Android Launcher Shape Preview Selector */}
        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-black p-1">
          {(
            [
              { id: 'squircle', label: 'Squircle Android' },
              { id: 'circle', label: 'Rond Pixel' },
              { id: 'teardrop', label: 'Goutte' },
              { id: 'rounded', label: 'Carré Adouci' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setLauncherMask(m.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                launcherMask === m.id
                  ? 'bg-emerald-500 text-black font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6 Icon Variants Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {APP_ICON_VARIANTS.map((variant) => {
          const isSelected = variant.id === selectedIconId;
          const dataUrl = svgStringToDataUrl(variant.svgContent);

          return (
            <div
              key={variant.id}
              onClick={() => onSelectIcon(variant)}
              className={`group cursor-pointer flex flex-col justify-between rounded-3xl border p-5 transition-all ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-lg'
                  : isLightMode
                    ? 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                    : 'border-zinc-800/90 bg-black hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  {/* Live Adaptive Icon Preview */}
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 p-1.5 border border-zinc-800/80">
                    <img
                      src={dataUrl}
                      alt={variant.name}
                      referrerPolicy="no-referrer"
                      className={`h-full w-full object-cover shadow-md transition-all duration-200 ${getMaskRadiusClass(
                        launcherMask
                      )}`}
                    />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-zinc-400">{variant.tag}</span>
                      {isSelected && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          <span>Active</span>
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-white">
                      {variant.name}
                    </h3>
                    <p className="text-xs text-zinc-400">{variant.subtitle}</p>
                  </div>
                </div>

                <p className="mt-3.5 text-xs leading-relaxed text-zinc-400">
                  {variant.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-800/80 pt-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectIcon(variant);
                  }}
                  className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'bg-emerald-500 text-black'
                      : 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {isSelected ? 'Icône appliquée' : 'Appliquer cette icône'}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadIconAsPng(
                      variant.svgContent,
                      `kiloobsidian-icon-${variant.id}-512x512.png`,
                      512
                    );
                  }}
                  className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-white"
                  title="Télécharger en PNG 512×512 pour Android APK"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                  <span>PNG 512px</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Simulated Android Home Screen Dock Preview */}
      <div className="rounded-2xl border border-zinc-800/90 bg-black p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={svgStringToDataUrl(activeVariant.svgContent)}
              alt={activeVariant.name}
              referrerPolicy="no-referrer"
              className={`h-12 w-12 border border-zinc-800 ${getMaskRadiusClass(
                launcherMask
              )}`}
            />
            <div>
              <div className="text-sm font-semibold text-white">
                Aperçu sur l’écran d’accueil Android :{' '}
                <span className="text-emerald-400">{activeVariant.name}</span>
              </div>
              <div className="text-xs text-zinc-400">
                Nom sous l’icône : <strong className="font-mono text-zinc-200">KiloObsid</strong> · Format adaptable Android 14/15 (192px & 512px)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                downloadIconAsPng(
                  activeVariant.svgContent,
                  `pwa-192x192-${activeVariant.id}.png`,
                  192
                )
              }
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Exporter 192×192 PNG
            </button>
            <button
              type="button"
              onClick={() =>
                downloadIconAsPng(
                  activeVariant.svgContent,
                  `pwa-512x512-${activeVariant.id}.png`,
                  512
                )
              }
              className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400"
            >
              Exporter 512×512 PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
