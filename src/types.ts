export type XiaomiScaleModel =
  | 'mi-scale-1'
  | 'mi-scale-2'
  | 'mi-body-comp-2'
  | 'mi-eight-electrode';

export type MeasurementSource =
  | 'manual'
  | 'xiaomi-ble'
  | 'google-fit'
  | 'health-connect';

export interface WeightEntry {
  id: string;
  date: string; // ISO YYYY-MM-DD
  timestamp: number; // ms
  weightKg: number;
  heightCm: number;
  bmi: number;
  bodyFatPct?: number;
  muscleMassKg?: number;
  waterPct?: number;
  visceralFat?: number;
  boneMassKg?: number;
  basalMetabolismKcal?: number;
  impedanceOhm?: number;
  source: MeasurementSource;
  scaleModel?: XiaomiScaleModel;
  note?: string;
  syncedGoogleFit?: boolean;
  syncedHealthConnect?: boolean;
}

export interface UserProfile {
  name: string;
  heightCm: number;
  birthYear: number;
  gender: 'male' | 'female';
  targetWeightKg: number;
  startWeightKg: number;
  startDate: string;
  unit: 'kg' | 'lb';
  configured?: boolean;
}

export type ThemeMode = 'amoled' | 'dark' | 'auto' | 'light';

export interface ReminderSettings {
  enabled: boolean;
  frequencyType: 'daily' | 'weekly' | 'every_x_days';
  intervalDays: number; // for every_x_days
  weeklyDay: number; // 0=Dimanche .. 6=Samedi
  time: string; // HH:mm
  smartAnomalyAlert: boolean;
  lastTriggered?: string;
}

export interface SyncSettings {
  googleFitConnected: boolean;
  googleFitLastSync?: string;
  googleFitAutoSync: boolean;
  healthConnectConnected: boolean;
  healthConnectLastSync?: string;
  healthConnectPermissions: string[];
  cloudBackupEnabled: boolean;
  cloudLastBackup?: string;
  e2eeKeyFingerprint?: string;
}

export type PeriodFilter = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';
