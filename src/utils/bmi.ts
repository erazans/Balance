import { WeightEntry, UserProfile } from '../types';

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  if (heightM <= 0) return 0;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function getBMICategory(bmi: number): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  advice: string;
  range: string;
} {
  if (bmi < 18.5) {
    return {
      label: 'Insuffisance pondérale',
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/30',
      advice: 'Apport calorique légèrement supérieur recommandé avec suivi nutritionnel.',
      range: '< 18.5',
    };
  }
  if (bmi < 25) {
    return {
      label: 'Corpulence normale',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      advice: 'Poids santé optimal. Maintenez votre équilibre hydrique et musculaire.',
      range: '18.5 – 24.9',
    };
  }
  if (bmi < 30) {
    return {
      label: 'Surpoids',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      advice: 'Un léger déficit calorique et 150 min d’activité cardio par semaine favorisent le retour à la cible.',
      range: '25.0 – 29.9',
    };
  }
  return {
    label: 'Obésité',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    advice: 'Accompagnement médical et suivi régulier de la masse viscérale recommandés.',
    range: '≥ 30.0',
  };
}

export function getHealthyWeightRange(heightCm: number): { min: number; max: number } {
  const heightM = heightCm / 100;
  return {
    min: Number((18.5 * heightM * heightM).toFixed(1)),
    max: Number((24.9 * heightM * heightM).toFixed(1)),
  };
}

/**
 * Xiaomi Mi Body Composition BIA Formula (derived from weight, height, age, sex, and foot-to-foot impedance in Ohms)
 */
export function computeXiaomiBodyMetrics(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: 'male' | 'female',
  impedanceOhm: number
) {
  const bmi = calculateBMI(weightKg, heightCm);
  const sexFactor = gender === 'male' ? 1 : 0;

  // LBM (Lean Body Mass) estimation using bioelectrical impedance
  const lbmBase =
    (heightCm * heightCm) / Math.max(impedanceOhm, 250) * 0.42 +
    weightKg * 0.34 +
    (sexFactor ? 6.8 : 2.1) -
    age * 0.09;
  const clampedLbm = Math.min(Math.max(lbmBase, weightKg * 0.55), weightKg * 0.92);

  const bodyFatKg = Math.max(weightKg - clampedLbm, weightKg * 0.06);
  const bodyFatPct = Number(((bodyFatKg / weightKg) * 100).toFixed(1));
  const muscleMassKg = Number((clampedLbm * 0.94).toFixed(1));
  const boneMassKg = Number((clampedLbm * 0.06).toFixed(2));
  const waterPct = Number(Math.min(Math.max((100 - bodyFatPct) * 0.73, 42), 72).toFixed(1));
  const visceralFat = Math.max(1, Math.min(25, Math.round((bmi - 16) * 0.75 + (age - 20) * 0.12 + (sexFactor ? 1.5 : 0))));
  const basalMetabolismKcal = Math.round(
    gender === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161
  );

  return {
    bmi,
    bodyFatPct,
    muscleMassKg,
    boneMassKg,
    waterPct,
    visceralFat,
    basalMetabolismKcal,
  };
}

export function generateSeedEntries(profile: UserProfile): WeightEntry[] {
  const now = new Date();
  const entries: WeightEntry[] = [];
  const totalDays = 95;
  let currentWeight = 79.4;
  const age = now.getFullYear() - profile.birthYear;

  // Deterministic pseudo-random generator so chart looks natural and consistent
  let seed = 421337;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = totalDays; i >= 0; i--) {
    // Skip a few days occasionally to mimic real user weigh-ins (approx 5-6 times a week)
    if (i > 7 && nextRand() < 0.16) continue;

    const entryDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    entryDate.setHours(7, Math.floor(15 + nextRand() * 35), 0, 0);
    const isoDate = entryDate.toISOString().split('T')[0];

    // Gradual downward progress toward target (79.4 -> ~73.8) with realistic daily water fluctuation
    const dailyDrift = -0.055 + (nextRand() - 0.48) * 0.32;
    currentWeight = Number(Math.max(profile.targetWeightKg - 1, currentWeight + dailyDrift).toFixed(1));
    const impedance = Math.round(465 + (currentWeight - 74) * 3.5 + (nextRand() - 0.5) * 14);

    const metrics = computeXiaomiBodyMetrics(
      currentWeight,
      profile.heightCm,
      age,
      profile.gender,
      impedance
    );

    const models = ['mi-body-comp-2', 'mi-scale-2', 'mi-eight-electrode'] as const;
    const chosenModel = i % 5 === 0 ? 'mi-eight-electrode' : models[0];

    entries.push({
      id: `seed-${isoDate}`,
      date: isoDate,
      timestamp: entryDate.getTime(),
      weightKg: currentWeight,
      heightCm: profile.heightCm,
      bmi: metrics.bmi,
      bodyFatPct: metrics.bodyFatPct,
      muscleMassKg: metrics.muscleMassKg,
      waterPct: metrics.waterPct,
      visceralFat: metrics.visceralFat,
      boneMassKg: metrics.boneMassKg,
      basalMetabolismKcal: metrics.basalMetabolismKcal,
      impedanceOhm: impedance,
      source: i % 9 === 0 ? 'google-fit' : 'xiaomi-ble',
      scaleModel: chosenModel,
      syncedGoogleFit: true,
      syncedHealthConnect: true,
      note: i === 0 ? 'Pesée matinale à jeun — Xiaomi Mi Body Composition Scale 2' : undefined,
    });
  }

  return entries.sort((a, b) => b.timestamp - a.timestamp);
}
