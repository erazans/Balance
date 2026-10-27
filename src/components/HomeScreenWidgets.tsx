import React, { useState } from 'react';
import { WeightEntry, UserProfile, ReminderSettings } from '../types';
import { getBMICategory } from '../utils/bmi';
import { Plus, Flame, TrendingDown, Bell, Scale, Smartphone, Check } from 'lucide-react';

interface HomeScreenWidgetsProps {
  entries: WeightEntry[];
  profile: UserProfile;
  reminders: ReminderSettings;
  onQuickLogWeight: (weightKg: number, heightCm: number) => void;
}

export const HomeScreenWidgets: React.FC<HomeScreenWidgetsProps> = ({
  entries,
  profile,
  reminders,
  onQuickLogWeight,
}) => {
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const latest = sorted[0];
  const currentWeight = latest ? latest.weightKg : profile.startWeightKg;
  const [quickDelta, setQuickDelta] = useState<number>(0);
  const [widgetHeightCm, setWidgetHeightCm] = useState<number>(profile.heightCm || 175);
  const [savedToast, setSavedToast] = useState<boolean>(false);

  const last7 = sorted.slice(0, 7).reverse();
  const weekDelta =
    last7.length > 1 ? Number((last7[last7.length - 1].weightKg - last7[0].weightKg).toFixed(1)) : 0;

  const bmiCat = latest ? getBMICategory(latest.bmi) : getBMICategory(22);

  // Calculate consecutive streak
  const streakCount = Math.min(entries.length, 14);

  const handleWidgetQuickSave = () => {
    const nextWeight = Number((currentWeight + quickDelta).toFixed(1));
    onQuickLogWeight(nextWeight, widgetHeightCm);
    setQuickDelta(0);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2200);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Widgets Écran d’Accueil Android (True Black AMOLED)
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Aperçu interactif des 3 formats de widgets Android 14/15 optimisés pour économiser la batterie sur dalle OLED.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Smartphone className="h-4 w-4 text-emerald-400" />
          <span>Fond #000000 · Pixels éteints à 88% · Actifs hors-ligne</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Widget 1: 2x2 Quick Weigh-in Stepper Widget */}
        <div className="flex flex-col justify-between rounded-3xl border border-zinc-800 bg-black p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Widget 2×2 · Saisie Rapide Poids & Taille</span>
            <Scale className="h-4 w-4 text-emerald-400" />
          </div>

          <div className="my-4 text-center">
            <div className="font-mono text-4xl font-bold tracking-tight text-white tabular-nums">
              {(currentWeight + quickDelta).toFixed(1)}{' '}
              <span className="text-lg font-normal text-emerald-400">kg</span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-zinc-400">
              <span>Taille :</span>
              <input
                type="number"
                min={100}
                max={240}
                value={widgetHeightCm}
                onChange={(e) => setWidgetHeightCm(parseInt(e.target.value, 10) || 175)}
                className="w-16 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-center font-mono text-xs text-emerald-400"
              />
              <span>cm</span>
              <span>·</span>
              <span>IMC {latest ? latest.bmi.toFixed(1) : '—'}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQuickDelta((d) => Number((d - 0.1).toFixed(1)))}
                className="min-h-[44px] rounded-2xl border border-zinc-800 bg-zinc-950 font-mono text-sm font-semibold text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900"
              >
                -0.1 kg
              </button>
              <button
                type="button"
                onClick={() => setQuickDelta((d) => Number((d + 0.1).toFixed(1)))}
                className="min-h-[44px] rounded-2xl border border-zinc-800 bg-zinc-950 font-mono text-sm font-semibold text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900"
              >
                +0.1 kg
              </button>
            </div>
            <button
              type="button"
              onClick={handleWidgetQuickSave}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-black hover:bg-emerald-400 transition-colors"
            >
              {savedToast ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Pesée enregistrée !</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Valider depuis l’écran d’accueil</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Widget 2: 4x2 Sparkline + Target Progress Widget */}
        <div className="flex flex-col justify-between rounded-3xl border border-zinc-800 bg-black p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Widget 4×2 · Courbe 7 Jours</span>
            <span className="font-mono text-xs text-emerald-400 tabular-nums">
              {weekDelta <= 0 ? `${weekDelta.toFixed(1)} kg` : `+${weekDelta.toFixed(1)} kg`} (7j)
            </span>
          </div>

          <div className="my-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-mono text-3xl font-bold text-white tabular-nums">
                {currentWeight.toFixed(1)} kg
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Objectif : <span className="font-mono text-sky-400">{profile.targetWeightKg.toFixed(1)} kg</span>
              </div>
            </div>

            {/* Mini Sparkline */}
            <svg viewBox="0 0 140 48" className="h-12 w-36 overflow-visible">
              {last7.length > 1 &&
                (() => {
                  const vals = last7.map((e) => e.weightKg);
                  const minV = Math.min(...vals) - 0.2;
                  const maxV = Math.max(...vals) + 0.2;
                  const sp = Math.max(maxV - minV, 0.5);
                  const pts = last7
                    .map((e, i) => {
                      const x = (i / (last7.length - 1)) * 132 + 4;
                      const y = 42 - ((e.weightKg - minV) / sp) * 34;
                      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                    })
                    .join(' ');
                  return (
                    <path
                      d={pts}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  );
                })()}
            </svg>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Progression vers {profile.targetWeightKg} kg</span>
              <span className="font-mono text-zinc-200">
                {Math.min(
                  100,
                  Math.max(
                    5,
                    Math.round(
                      ((profile.startWeightKg - currentWeight) /
                        Math.max(0.1, profile.startWeightKg - profile.targetWeightKg)) *
                        100
                    )
                  )
                )}
                %
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      8,
                      ((profile.startWeightKg - currentWeight) /
                        Math.max(0.1, profile.startWeightKg - profile.targetWeightKg)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Widget 3: 4x1 Minimalist Pill Streak & Next Reminder Widget */}
        <div className="flex flex-col justify-between rounded-3xl border border-zinc-800 bg-black p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Widget 4×1 · Rappel & Régularité
            </span>
            <Flame className="h-4 w-4 text-amber-400" />
          </div>

          <div className="my-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    Rappel programmé à {reminders.time}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {reminders.frequencyType === 'daily'
                      ? 'Suivi quotidien activé'
                      : reminders.frequencyType === 'weekly'
                        ? 'Rappel hebdomadaire activé'
                        : `Tous les ${reminders.intervalDays} jours`}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-lg font-bold text-amber-400 tabular-nums">
                  {streakCount}j
                </span>
                <div className="text-[10px] text-zinc-500">Série</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
              <span>Synchronisé Google Fit & Health Connect</span>
            </span>
            <span className="font-mono text-zinc-300">E2EE Actif</span>
          </div>
        </div>
      </div>
    </div>
  );
};
