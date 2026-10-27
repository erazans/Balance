import React, { useState, useMemo, useEffect } from 'react';
import {
  WeightEntry,
  UserProfile,
  ThemeMode,
  ReminderSettings,
  SyncSettings,
  PeriodFilter,
  XiaomiScaleModel,
} from './types';
import {
  calculateBMI,
  getBMICategory,
  getHealthyWeightRange,
  computeXiaomiBodyMetrics,
} from './utils/bmi';
import {
  encryptHealthVault,
  decryptHealthVault,
  computeKeyFingerprint,
  EncryptedVaultBundle,
} from './utils/crypto';
import { exportEntriesToCSV, exportReportToPDF } from './utils/export';
import { WeightTrendChart, WeeklyProgressChart } from './components/WeightChart';
import { XiaomiScale3DViewer } from './components/XiaomiScale3DViewer';
import { XiaomiBluetoothModal } from './components/XiaomiBluetoothModal';
import { HomeScreenWidgets } from './components/HomeScreenWidgets';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { usePWAInstall, useOnlineStatus } from './hooks/usePWAInstall';
import {
  Bluetooth,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  Plus,
  Bell,
  Activity,
  Trash2,
  RefreshCw,
  Calendar,
  Smartphone,
  Sliders,
  RotateCcw,
  PackageCheck,
  Ruler,
  Scale,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

// Clean v2 storage keys for a 100% zeroed fresh installation state
const STORAGE_KEYS = {
  ENTRIES: 'kiloobsidian_entries_clean_v2',
  PROFILE: 'kiloobsidian_profile_clean_v2',
  THEME: 'kiloobsidian_theme_clean_v2',
  REMINDERS: 'kiloobsidian_reminders_clean_v2',
  SYNC: 'kiloobsidian_sync_clean_v2',
  E2EE_VAULT: 'kiloobsidian_e2ee_vault_clean_v2',
};

const CLEAN_INITIAL_PROFILE: UserProfile = {
  name: 'Utilisateur',
  heightCm: 175,
  birthYear: 1995,
  gender: 'male',
  targetWeightKg: 70.0,
  startWeightKg: 0,
  startDate: new Date().toISOString().slice(0, 10),
  unit: 'kg',
  configured: false,
};

const CLEAN_INITIAL_REMINDERS: ReminderSettings = {
  enabled: true,
  frequencyType: 'weekly',
  intervalDays: 3,
  weeklyDay: 1, // Lundi
  time: '07:30',
  smartAnomalyAlert: true,
};

const CLEAN_INITIAL_SYNC: SyncSettings = {
  googleFitConnected: false,
  googleFitLastSync: 'Jamais synchronisé',
  googleFitAutoSync: true,
  healthConnectConnected: false,
  healthConnectLastSync: 'Jamais synchronisé',
  healthConnectPermissions: [
    'android.permission.health.READ_WEIGHT',
    'android.permission.health.WRITE_WEIGHT',
    'android.permission.health.READ_HEIGHT',
    'android.permission.health.WRITE_HEIGHT',
    'android.permission.health.READ_BODY_FAT',
    'android.permission.health.WRITE_BODY_FAT',
  ],
  cloudBackupEnabled: false,
  cloudLastBackup: 'Aucune sauvegarde',
  e2eeKeyFingerprint: 'NON-CONFIGURÉ',
};

export default function App() {
  // Clean up legacy v1 keys on first run so the app is guaranteed at 0
  useEffect(() => {
    try {
      localStorage.removeItem('kiloobsidian_entries_v1');
      localStorage.removeItem('kiloobsidian_profile_v1');
      localStorage.removeItem('kiloobsidian_e2ee_vault_v1');
    } catch {
      // ignore
    }
  }, []);

  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return saved ? JSON.parse(saved) : CLEAN_INITIAL_PROFILE;
    } catch {
      return CLEAN_INITIAL_PROFILE;
    }
  });

  // Zeroed out initial entries (empty array for clean installation)
  const [entries, setEntries] = useState<WeightEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ENTRIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode;
      return saved || 'amoled';
    } catch {
      return 'amoled';
    }
  });

  const [reminders, setReminders] = useState<ReminderSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REMINDERS);
      return saved ? JSON.parse(saved) : CLEAN_INITIAL_REMINDERS;
    } catch {
      return CLEAN_INITIAL_REMINDERS;
    }
  });

  const [syncSettings, setSyncSettings] = useState<SyncSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SYNC);
      return saved ? JSON.parse(saved) : CLEAN_INITIAL_SYNC;
    } catch {
      return CLEAN_INITIAL_SYNC;
    }
  });

  // Navigation & Modals State
  const [activeNavSection, setActiveNavSection] = useState<
    'dashboard' | 'scale3d' | 'sync' | 'widgets' | 'history'
  >('dashboard');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [chartMetric, setChartMetric] = useState<
    'weight' | 'bmi' | 'bodyFat' | 'muscle' | 'height'
  >('weight');
  const [selectedScaleModel, setSelectedScaleModel] =
    useState<XiaomiScaleModel>('mi-body-comp-2');

  const [isBleModalOpen, setIsBleModalOpen] = useState<boolean>(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState<boolean>(false);

  // Manual Entry Modal Inputs (Weight + Height)
  const [manualWeight, setManualWeight] = useState<string>('70.0');
  const [manualHeight, setManualHeight] = useState<string>(String(profile.heightCm || 175));
  const [manualDate, setManualDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [manualImpedance, setManualImpedance] = useState<string>('470');
  const [manualNote, setManualNote] = useState<string>('');

  // First-Run Clean Setup Inputs
  const [onboardingName, setOnboardingName] = useState<string>('');
  const [onboardingHeight, setOnboardingHeight] = useState<string>('175');
  const [onboardingWeight, setOnboardingWeight] = useState<string>('');
  const [onboardingTarget, setOnboardingTarget] = useState<string>('70.0');
  const [onboardingBirthYear, setOnboardingBirthYear] = useState<string>('1995');
  const [onboardingGender, setOnboardingGender] = useState<'male' | 'female'>('male');

  // E2EE Cloud Encryption State
  const [e2eePassphrase, setE2eePassphrase] = useState<string>('');
  const [encryptedBundle, setEncryptedBundle] = useState<EncryptedVaultBundle | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.E2EE_VAULT);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const { isInstallable, isInstalled, install } = usePWAInstall();
  const isOnline = useOnlineStatus();

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
    } catch {
      // ignore
    }
  }, [entries]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, themeMode);
    } catch {
      // ignore
    }
  }, [themeMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));
    } catch {
      // ignore
    }
  }, [reminders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC, JSON.stringify(syncSettings));
    } catch {
      // ignore
    }
  }, [syncSettings]);

  const effectiveTheme = useMemo<'amoled' | 'dark' | 'light'>(() => {
    if (themeMode === 'auto') {
      const hour = new Date().getHours();
      const isNight = hour >= 19 || hour < 7;
      if (isNight) return 'amoled';
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'amoled' : 'dark';
    }
    return themeMode;
  }, [themeMode]);

  const isLightMode = effectiveTheme === 'light';

  const filteredEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
    if (periodFilter === 'all') return sorted;

    const now = Date.now();
    if (periodFilter === 'custom') {
      return sorted.filter(
        (e) => e.date >= customStartDate && e.date <= customEndDate
      );
    }

    const daysMap: Record<Exclude<PeriodFilter, 'all' | 'custom'>, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
    };
    const cutoff = now - daysMap[periodFilter] * 24 * 60 * 60 * 1000;
    return sorted.filter((e) => e.timestamp >= cutoff);
  }, [entries, periodFilter, customStartDate, customEndDate]);

  const latestEntry: WeightEntry | null = entries.length > 0 ? entries[0] : null;
  const oldestInPeriod: WeightEntry | null =
    filteredEntries.length > 0 ? filteredEntries[filteredEntries.length - 1] : null;

  const currentWeightVal = latestEntry ? latestEntry.weightKg : 0;
  const currentHeightVal = latestEntry?.heightCm || profile.heightCm;
  const currentBmiVal = latestEntry
    ? latestEntry.bmi
    : currentWeightVal > 0
      ? calculateBMI(currentWeightVal, currentHeightVal)
      : 0;

  const periodDeltaKg =
    latestEntry && oldestInPeriod
      ? Number((latestEntry.weightKg - oldestInPeriod.weightKg).toFixed(1))
      : 0;

  const remainingToTargetKg =
    latestEntry
      ? Number((latestEntry.weightKg - profile.targetWeightKg).toFixed(1))
      : 0;

  const bmiCategory = getBMICategory(currentBmiVal || 21.5);
  const healthyRange = getHealthyWeightRange(currentHeightVal);

  const showNotice = (msg: string) => {
    setStatusBanner(msg);
    window.setTimeout(() => setStatusBanner(null), 4000);
  };

  // Factory Reset Function ("Mettre à zéro l'application")
  const handleFactoryReset = () => {
    try {
      Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
    setEntries([]);
    setProfile(CLEAN_INITIAL_PROFILE);
    setReminders(CLEAN_INITIAL_REMINDERS);
    setSyncSettings(CLEAN_INITIAL_SYNC);
    setEncryptedBundle(null);
    setE2eePassphrase('');
    setIsResetConfirmOpen(false);
    showNotice('Application remise à zéro avec succès (Installation propre vierge).');
  };

  const handleRecordEntry = (newEntryData: Omit<WeightEntry, 'id'>) => {
    const entry: WeightEntry = {
      ...newEntryData,
      id: `entry-${Date.now()}`,
    };
    // Also update profile heightCm and startWeightKg if it's the very first entry
    setProfile((prev) => ({
      ...prev,
      heightCm: entry.heightCm || prev.heightCm,
      startWeightKg: prev.startWeightKg > 0 ? prev.startWeightKg : entry.weightKg,
      configured: true,
    }));
    setEntries((prev) =>
      [entry, ...prev].sort((a, b) => b.timestamp - a.timestamp)
    );
    showNotice(
      `Mesure enregistrée : ${entry.weightKg.toFixed(1)} kg · Taille ${entry.heightCm} cm · IMC ${entry.bmi.toFixed(1)}`
    );
  };

  const handleFirstInstallSetup = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Math.max(100, Math.min(240, parseInt(onboardingHeight, 10) || 175));
    const t = Math.max(30, Math.min(250, parseFloat(onboardingTarget) || 70.0));
    const by = Math.max(1920, Math.min(2020, parseInt(onboardingBirthYear, 10) || 1995));
    const w = parseFloat(onboardingWeight);

    const nextProfile: UserProfile = {
      name: onboardingName.trim() || 'Utilisateur',
      heightCm: h,
      birthYear: by,
      gender: onboardingGender,
      targetWeightKg: Number(t.toFixed(1)),
      startWeightKg: !isNaN(w) && w > 0 ? Number(w.toFixed(1)) : 0,
      startDate: new Date().toISOString().slice(0, 10),
      unit: 'kg',
      configured: true,
    };
    setProfile(nextProfile);
    setManualHeight(String(h));

    if (!isNaN(w) && w >= 25 && w <= 250) {
      const age = new Date().getFullYear() - by;
      const metrics = computeXiaomiBodyMetrics(w, h, age, onboardingGender, 470);
      const now = new Date();
      const firstEntry: WeightEntry = {
        id: `entry-${now.getTime()}`,
        date: now.toISOString().slice(0, 10),
        timestamp: now.getTime(),
        weightKg: Number(w.toFixed(1)),
        heightCm: h,
        bmi: metrics.bmi,
        bodyFatPct: metrics.bodyFatPct,
        muscleMassKg: metrics.muscleMassKg,
        waterPct: metrics.waterPct,
        visceralFat: metrics.visceralFat,
        boneMassKg: metrics.boneMassKg,
        basalMetabolismKcal: metrics.basalMetabolismKcal,
        impedanceOhm: 470,
        source: 'manual',
        note: 'Première pesée initiale (Installation clean)',
      };
      setEntries([firstEntry]);
      showNotice(
        `Profil configuré (${h} cm) et 1ère pesée (${w.toFixed(1)} kg · IMC ${metrics.bmi.toFixed(1)}) enregistrée.`
      );
    } else {
      showNotice(
        `Profil initialisé à zéro (Taille : ${h} cm · Cible : ${t.toFixed(1)} kg). Prêt pour votre 1ère pesée.`
      );
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(manualWeight);
    const h = Math.max(100, Math.min(240, parseInt(manualHeight, 10) || profile.heightCm));
    if (isNaN(w) || w < 25 || w > 250) return;

    const imp = parseInt(manualImpedance, 10) || 470;
    const age = new Date().getFullYear() - profile.birthYear;
    const metrics = computeXiaomiBodyMetrics(w, h, age, profile.gender, imp);

    const ts = new Date(`${manualDate}T07:30:00`).getTime() || Date.now();
    handleRecordEntry({
      date: manualDate,
      timestamp: ts,
      weightKg: Number(w.toFixed(1)),
      heightCm: h,
      bmi: metrics.bmi,
      bodyFatPct: metrics.bodyFatPct,
      muscleMassKg: metrics.muscleMassKg,
      waterPct: metrics.waterPct,
      visceralFat: metrics.visceralFat,
      boneMassKg: metrics.boneMassKg,
      basalMetabolismKcal: metrics.basalMetabolismKcal,
      impedanceOhm: imp,
      source: 'manual',
      syncedGoogleFit: syncSettings.googleFitConnected,
      syncedHealthConnect: syncSettings.healthConnectConnected,
      note: manualNote.trim() || `Pesée manuelle (${w.toFixed(1)} kg · ${h} cm)`,
    });
    setIsManualModalOpen(false);
    setManualNote('');
  };

  const handleDeleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((item) => item.id !== id));
    showNotice('Mesure supprimée de l’historique.');
  };

  const handleTestReminderNotification = async () => {
    const title = 'KiloObsidian · Rappel de pesée';
    const body = latestEntry
      ? `Il est l'heure de votre suivi (${reminders.time}). Dernier poids : ${latestEntry.weightKg.toFixed(1)} kg (${currentHeightVal} cm).`
      : `Il est l'heure de votre première pesée (${reminders.time}).`;

    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          new Notification(title, { body, icon: '/pwa-192x192.png' });
          showNotice('Notification système Android envoyée avec succès.');
          return;
        }
      } catch {
        // Fallback
      }
    }
    showNotice(`${title} — ${body}`);
  };

  const handleRunEncryptedCloudBackup = async () => {
    if (!e2eePassphrase.trim()) {
      showNotice('Veuillez saisir une phrase secrète de chiffrement E2EE.');
      return;
    }
    try {
      const bundle = await encryptHealthVault(
        { profile, entries, reminders },
        e2eePassphrase,
        entries.length
      );
      setEncryptedBundle(bundle);
      localStorage.setItem(STORAGE_KEYS.E2EE_VAULT, JSON.stringify(bundle));
      const nowTime = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setSyncSettings((prev) => ({
        ...prev,
        cloudBackupEnabled: true,
        cloudLastBackup: `Aujourd’hui à ${nowTime}`,
        e2eeKeyFingerprint: bundle.keyFingerprint,
      }));
      showNotice(
        `Sauvegarde Cloud chiffrée de bout en bout (AES-256-GCM · Empreinte ${bundle.keyFingerprint}) effectuée.`
      );
    } catch {
      showNotice('Erreur lors du chiffrement AES-256-GCM.');
    }
  };

  const handleDownloadEncryptedVault = () => {
    if (!encryptedBundle) return;
    const blob = new Blob([JSON.stringify(encryptedBundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kiloobsidian-vault-e2ee-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleVerifyDecryptVault = async () => {
    if (!encryptedBundle) return;
    try {
      const decrypted = await decryptHealthVault<{
        entries: WeightEntry[];
      }>(encryptedBundle, e2eePassphrase);
      showNotice(
        `Intégrité E2EE vérifiée : ${decrypted.entries.length} mesures déchiffrées sans perte.`
      );
    } catch {
      showNotice('Clé secrète invalide : impossible de déchiffrer le coffre Cloud.');
    }
  };

  const handleSyncGoogleHealth = (target: 'fit' | 'healthconnect') => {
    const nowTime = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    if (target === 'fit') {
      setSyncSettings((prev) => ({
        ...prev,
        googleFitConnected: true,
        googleFitLastSync: `Aujourd’hui à ${nowTime}`,
      }));
      showNotice(
        `Synchronisation Google Fit (com.google.weight, com.google.height & body.fat.percentage) activée.`
      );
    } else {
      setSyncSettings((prev) => ({
        ...prev,
        healthConnectConnected: true,
        healthConnectLastSync: `Aujourd’hui à ${nowTime}`,
      }));
      showNotice(
        `Synchronisation Android Health Connect (WeightRecord, HeightRecord, BodyFatRecord) activée.`
      );
    }
  };

  const bgCanvasClass =
    effectiveTheme === 'amoled'
      ? 'bg-black text-zinc-100'
      : effectiveTheme === 'dark'
        ? 'bg-zinc-950 text-zinc-100'
        : 'bg-zinc-50 text-zinc-900';

  const cardSurfaceClass =
    effectiveTheme === 'amoled'
      ? 'bg-[#09090B] border-zinc-800/80'
      : effectiveTheme === 'dark'
        ? 'bg-zinc-900/90 border-zinc-800'
        : 'bg-white border-zinc-200 shadow-xs';

  return (
    <div className={`min-h-screen pb-24 lg:pb-12 transition-colors ${bgCanvasClass}`}>
      {/* Top Bar Contract: 1-row, 3-zone header (Brand | 5 Nav Links | 1 Primary CTA) */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between gap-8 border-b px-6 py-4 ${
          effectiveTheme === 'light'
            ? 'border-zinc-200 bg-white/95'
            : 'border-zinc-900 bg-black/95'
        }`}
      >
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveNavSection('dashboard');
          }}
          className="text-lg font-bold tracking-tight whitespace-nowrap shrink-0"
        >
          KiloObsidian
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
          <button
            type="button"
            onClick={() => setActiveNavSection('dashboard')}
            className={`hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 ${
              activeNavSection === 'dashboard' ? 'text-emerald-400 font-semibold' : ''
            }`}
          >
            Courbe & IMC
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveNavSection('scale3d');
              document.getElementById('scale3d')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 ${
              activeNavSection === 'scale3d' ? 'text-emerald-400 font-semibold' : ''
            }`}
          >
            Balance Xiaomi 3D
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveNavSection('sync');
              document.getElementById('sync')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 ${
              activeNavSection === 'sync' ? 'text-emerald-400 font-semibold' : ''
            }`}
          >
            Google Health & Cloud
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveNavSection('widgets');
              document.getElementById('widgets')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 ${
              activeNavSection === 'widgets' ? 'text-emerald-400 font-semibold' : ''
            }`}
          >
            Widgets & Rappels
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveNavSection('history');
              document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0 ${
              activeNavSection === 'history' ? 'text-emerald-400 font-semibold' : ''
            }`}
          >
            Historique & Export
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setManualHeight(String(profile.heightCm || 175));
              setManualWeight(latestEntry ? latestEntry.weightKg.toFixed(1) : '70.0');
              setIsManualModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-black bg-emerald-500 rounded-xl hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0"
          >
            Saisir Poids & Taille
          </button>
        </div>
      </header>

      {/* Toast / Status Notification Banner */}
      {statusBanner && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-300">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="ml-4 text-emerald-400 hover:underline"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl space-y-8 px-4 pt-6 sm:px-6">
        {/* Workspace Utility Strip (Quick Height/Weight, Bluetooth BLE, APK Build, Factory Reset, Theme) */}
        <div
          className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-3.5 ${cardSurfaceClass}`}
        >
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <span className="font-medium text-zinc-200">{profile.name}</span>
            <span aria-hidden="true">·</span>
            <span>
              Taille : <strong className="font-mono text-white">{profile.heightCm} cm</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Cible : <strong className="font-mono text-emerald-400">{profile.targetWeightKg.toFixed(1)} kg</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-zinc-300">
              {entries.length} mesure{entries.length > 1 ? 's' : ''} enregistrée{entries.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Theme Selector */}
            <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-black p-1">
              {(
                [
                  { id: 'amoled', label: 'True Black OLED' },
                  { id: 'auto', label: 'Auto' },
                  { id: 'dark', label: 'Ardoise' },
                  { id: 'light', label: 'Jour' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeMode(t.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                    themeMode === t.id
                      ? 'bg-emerald-500 text-black font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsBleModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 whitespace-nowrap"
            >
              <Bluetooth className="h-3.5 w-3.5" />
              <span>Balance Xiaomi BLE</span>
            </button>

            {!isInstalled && (
              <button
                type="button"
                onClick={async () => {
                  if (isInstallable) {
                    await install();
                  } else {
                    setIsInstallGuideOpen(true);
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 whitespace-nowrap"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Installer sur Android</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 whitespace-nowrap"
              title="Remettre toutes les données de l'application à zéro"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Remise à zéro</span>
            </button>
          </div>
        </div>

        {/* Clean First-Installation Onboarding Card (Shown when 0 entries exist) */}
        {entries.length === 0 && (
          <section className="rounded-3xl border border-emerald-500/30 bg-[#050807] p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div>
                <h1 className="text-xl font-bold text-white">
                  Première Installation Clean — Configuration Initiale (0 donnée)
                </h1>
                <p className="mt-1 text-xs text-zinc-400">
                  L’application est entièrement remise à zéro. Renseignez votre taille (cm), votre objectif et optionnellement votre première pesée pour démarrer votre suivi.
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-400">
                ÉTAT : VIERGE (0 MESURE) · PRÊT POUR APK
              </span>
            </div>

            <form onSubmit={handleFirstInstallSetup} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <label className="block text-xs text-zinc-400">Prénom / Profil</label>
                <input
                  type="text"
                  placeholder="Ex: Maxime"
                  value={onboardingName}
                  onChange={(e) => setOnboardingName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-emerald-400 font-medium">
                  Taille (cm) *
                </label>
                <input
                  type="number"
                  min={100}
                  max={240}
                  required
                  value={onboardingHeight}
                  onChange={(e) => setOnboardingHeight(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-emerald-500/50 bg-black px-3 py-2 font-mono text-sm font-bold text-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400">
                  1er Poids (kg, optionnel)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={25}
                  max={250}
                  placeholder="Laisser vide = 0"
                  value={onboardingWeight}
                  onChange={(e) => setOnboardingWeight(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400">Poids Cible (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  min={30}
                  max={220}
                  required
                  value={onboardingTarget}
                  onChange={(e) => setOnboardingTarget(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400">Année de naissance</label>
                <input
                  type="number"
                  min={1920}
                  max={2022}
                  value={onboardingBirthYear}
                  onChange={(e) => setOnboardingBirthYear(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 font-mono text-sm text-zinc-200"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-black hover:bg-emerald-400 transition-colors"
                >
                  Initialiser le profil
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Top 4-Column Biometric KPI Strip (Shows — when zeroed out) */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={`rounded-2xl border p-5 ${cardSurfaceClass}`}>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Poids Actuel</span>
              <span className="font-mono">{latestEntry ? latestEntry.date : 'Aucune pesée'}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold tracking-tight tabular-nums">
                {latestEntry ? `${latestEntry.weightKg.toFixed(1)} kg` : '— kg'}
              </span>
              {latestEntry && (
                <span
                  className={`font-mono text-xs font-semibold tabular-nums ${
                    periodDeltaKg <= 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {periodDeltaKg > 0 ? `+${periodDeltaKg}` : periodDeltaKg} kg
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              {latestEntry
                ? `Départ : ${profile.startWeightKg.toFixed(1)} kg`
                : 'En attente de votre première pesée'}
            </p>
          </div>

          <div className={`rounded-2xl border p-5 ${cardSurfaceClass}`}>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Taille & Indice IMC</span>
              <span className="font-mono text-emerald-400">{currentHeightVal} cm</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2.5">
              <span className="font-mono text-3xl font-bold tracking-tight tabular-nums">
                {latestEntry ? latestEntry.bmi.toFixed(1) : '—'}
              </span>
              <span className={`text-xs font-semibold ${latestEntry ? bmiCategory.color : 'text-zinc-500'}`}>
                {latestEntry ? bmiCategory.label : 'Saisissez un poids'}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Plage normale ({currentHeightVal} cm) :{' '}
              <span className="font-mono text-zinc-200">
                {healthyRange.min} – {healthyRange.max} kg
              </span>
            </p>
          </div>

          <div className={`rounded-2xl border p-5 ${cardSurfaceClass}`}>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Composition BIA Xiaomi</span>
              <span className="font-mono">
                {latestEntry?.impedanceOhm ? `${latestEntry.impedanceOhm} Ω` : '— Ω'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-4">
              <div>
                <span className="font-mono text-2xl font-bold tabular-nums">
                  {latestEntry?.bodyFatPct !== undefined
                    ? `${latestEntry.bodyFatPct.toFixed(1)}%`
                    : '—%'}
                </span>
                <span className="ml-1 text-xs text-zinc-400">Grasse</span>
              </div>
              <div>
                <span className="font-mono text-2xl font-bold text-sky-400 tabular-nums">
                  {latestEntry?.muscleMassKg !== undefined
                    ? `${latestEntry.muscleMassKg.toFixed(1)} kg`
                    : '— kg'}
                </span>
                <span className="ml-1 text-xs text-zinc-400">Muscle</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Eau : <span className="font-mono">{latestEntry?.waterPct ?? '—'}%</span> · Viscérale :{' '}
              <span className="font-mono">Niv. {latestEntry?.visceralFat ?? '—'}</span>
            </p>
          </div>

          <div className={`rounded-2xl border p-5 ${cardSurfaceClass}`}>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Objectif & Métabolisme</span>
              <span className="font-mono">Cible {profile.targetWeightKg.toFixed(1)} kg</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold tracking-tight text-emerald-400 tabular-nums">
                {latestEntry
                  ? remainingToTargetKg > 0
                    ? `-${remainingToTargetKg.toFixed(1)} kg`
                    : 'Atteint'
                  : `${profile.targetWeightKg.toFixed(1)} kg`}
              </span>
              <span className="text-xs text-zinc-400">
                {latestEntry ? 'restants' : 'cible'}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Métabolisme basal :{' '}
              <span className="font-mono text-zinc-200">
                {latestEntry?.basalMetabolismKcal
                  ? `${latestEntry.basalMetabolismKcal} kcal/j`
                  : '— kcal/j'}
              </span>
            </p>
          </div>
        </section>

        {/* Main Interactive Curve + Height & BMI Calibration Section */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left 2 Columns: Weight, Height & Biometrics Curve over Defined Period */}
          <div className={`rounded-3xl border p-6 lg:col-span-2 ${cardSurfaceClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Courbe Graphique (Poids, Taille, IMC & Composition)
                </h2>
                <p className="text-xs text-zinc-400">
                  Suivi chronologique sur période définie avec moyenne mobile sur 7 jours.
                </p>
              </div>

              {/* Metric Selector including Taille (cm) */}
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-zinc-900 p-1">
                {(
                  [
                    { id: 'weight', label: 'Poids (kg)' },
                    { id: 'height', label: 'Taille (cm)' },
                    { id: 'bmi', label: 'IMC' },
                    { id: 'bodyFat', label: 'Grasse (%)' },
                    { id: 'muscle', label: 'Muscle (kg)' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setChartMetric(m.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      chartMetric === m.id
                        ? 'bg-emerald-500 text-black font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Period Filter Controls + Custom Date Range Picker */}
            <div className="my-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-800/90 bg-black p-1">
                {(
                  [
                    { id: '7d', label: '7 Jours' },
                    { id: '30d', label: '30 Jours' },
                    { id: '90d', label: '90 Jours' },
                    { id: '1y', label: '1 An' },
                    { id: 'all', label: 'Tout' },
                    { id: 'custom', label: 'Période personnalisée' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriodFilter(p.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      periodFilter === p.id
                        ? 'bg-zinc-800 text-emerald-400 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {periodFilter === 'custom' && (
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono text-xs text-zinc-200"
                  />
                  <span className="text-zinc-500">au</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono text-xs text-zinc-200"
                  />
                </div>
              )}
            </div>

            <WeightTrendChart
              entries={filteredEntries}
              targetWeightKg={profile.targetWeightKg}
              metric={chartMetric}
              isLightMode={isLightMode}
            />
          </div>

          {/* Right Column: Direct Height & Weight Input + Clinical WHO BMI Gauge */}
          <div className={`flex flex-col justify-between rounded-3xl border p-6 ${cardSurfaceClass}`}>
            <div>
              <h2 className="text-lg font-semibold">Saisie Taille & Suivi de l’IMC</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Ajustez votre taille en centimètres à tout moment ou lors de chaque pesée.
              </p>

              {/* Direct Height (cm) & Target Weight Calibration */}
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-zinc-800/90 bg-black p-3.5">
                <div>
                  <label htmlFor="profile-height" className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                    <Ruler className="h-3.5 w-3.5" />
                    <span>Votre Taille (cm)</span>
                  </label>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      id="profile-height"
                      type="number"
                      min={100}
                      max={240}
                      value={profile.heightCm}
                      onChange={(e) => {
                        const h = parseInt(e.target.value, 10) || 175;
                        setProfile((p) => ({ ...p, heightCm: h }));
                        setManualHeight(String(h));
                      }}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-base font-bold text-white"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-target" className="flex items-center gap-1.5 text-xs font-medium text-sky-400">
                    <Scale className="h-3.5 w-3.5" />
                    <span>Poids Cible (kg)</span>
                  </label>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <input
                      id="profile-target"
                      type="number"
                      step="0.1"
                      min={35}
                      max={200}
                      value={profile.targetWeightKg}
                      onChange={(e) => {
                        const t = parseFloat(e.target.value) || 70;
                        setProfile((p) => ({ ...p, targetWeightKg: t }));
                      }}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-base font-bold text-sky-400"
                    />
                  </div>
                </div>
              </div>

              {/* BMI Spectrum Bar */}
              <div className="mt-5">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-3xl font-bold tabular-nums">
                    {latestEntry ? latestEntry.bmi.toFixed(1) : '—'}
                  </span>
                  <span className={`text-xs font-semibold ${latestEntry ? bmiCategory.color : 'text-zinc-500'}`}>
                    {latestEntry ? bmiCategory.label : 'Aucune mesure'}
                  </span>
                </div>

                <div className="relative mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-900 flex">
                  <div className="h-full w-[22%] bg-sky-500" title="Insuffisance pondérale (<18.5)" />
                  <div className="h-full w-[34%] bg-emerald-500" title="Corpulence normale (18.5-24.9)" />
                  <div className="h-full w-[24%] bg-amber-500" title="Surpoids (25.0-29.9)" />
                  <div className="h-full w-[20%] bg-rose-500" title="Obésité (≥30.0)" />
                </div>

                {latestEntry && (
                  <div className="relative h-5 w-full">
                    <div
                      className="absolute -top-1 -translate-x-1/2 font-mono text-[11px] font-bold text-white"
                      style={{
                        left: `${Math.min(96, Math.max(4, ((latestEntry.bmi - 14) / 22) * 100))}%`,
                      }}
                    >
                      ▲
                    </div>
                  </div>
                )}

                <div className="mt-1 flex justify-between font-mono text-[10px] text-zinc-500">
                  <span>15.0</span>
                  <span>18.5</span>
                  <span>25.0</span>
                  <span>30.0</span>
                  <span>35.0</span>
                </div>

                <p className="mt-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-3 text-xs leading-relaxed text-zinc-300">
                  {latestEntry
                    ? bmiCategory.advice
                    : `Pour une taille de ${profile.heightCm} cm, votre poids de forme OMS se situe entre ${healthyRange.min} kg et ${healthyRange.max} kg.`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setManualHeight(String(profile.heightCm));
                setManualWeight(latestEntry ? latestEntry.weightKg.toFixed(1) : '70.0');
                setIsManualModalOpen(true);
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-semibold text-black hover:bg-emerald-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Nouvelle saisie Poids (kg) & Taille (cm)</span>
            </button>
          </div>
        </section>

        {/* Detailed Weekly Progression Statistics */}
        {entries.length > 0 && (
          <section className={`rounded-3xl border p-6 ${cardSurfaceClass}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Statistiques Détaillées & Progression Hebdomadaire
                </h2>
                <p className="text-xs text-zinc-400">
                  Comparaison des moyennes hebdomadaires et vélocité de progression.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span>
                  Moyenne période :{' '}
                  <strong className="font-mono text-white">
                    {(
                      filteredEntries.reduce((a, b) => a + b.weightKg, 0) /
                      Math.max(1, filteredEntries.length)
                    ).toFixed(1)}{' '}
                    kg
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Total mesures :{' '}
                  <strong className="font-mono text-emerald-400">{entries.length}</strong>
                </span>
              </div>
            </div>
            <WeeklyProgressChart entries={entries} isLightMode={isLightMode} />
          </section>
        )}

        {/* Three.js 3D Interactive Xiaomi Scale Studio Showcase */}
        <section id="scale3d" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                Studio 3D Temps Réel — Balances Xiaomi (Toutes Générations)
              </h2>
              <p className="text-sm text-zinc-400">
                Modèle procédural composite PBR (verre trempé, 4 électrodes acier brossé 304L, bobine BIA cuivre-or, capteurs en G et barre 8-électrodes).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBleModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
            >
              <Bluetooth className="h-4 w-4" />
              <span>Ouvrir la console Bluetooth GATT Xiaomi</span>
            </button>
          </div>

          <XiaomiScale3DViewer
            selectedModel={selectedScaleModel}
            onSelectModel={setSelectedScaleModel}
            currentWeightKg={currentWeightVal}
            currentBmi={currentBmiVal}
            impedanceOhm={latestEntry?.impedanceOhm ?? 0}
            onQuickWeighIn={() => setIsBleModalOpen(true)}
          />
        </section>

        {/* Google Fit, Google Health Connect & E2EE Cloud Synchronization Hub */}
        <section id="sync" className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Google Fit & Health Connect Card */}
          <div className={`rounded-3xl border p-6 ${cardSurfaceClass}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">
                  Google Fit & Android Health Connect
                </h3>
                <p className="text-xs text-zinc-400">
                  Centralisation Poids, Taille & Masse Grasse
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {/* Google Fit Block */}
              <div className="rounded-2xl border border-zinc-800/80 bg-black p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Google Fit API</div>
                    <div className="font-mono text-[11px] text-zinc-400">
                      com.google.weight · com.google.height
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      syncSettings.googleFitConnected ? 'text-emerald-400' : 'text-zinc-500'
                    }`}
                  >
                    {syncSettings.googleFitConnected ? 'Connecté' : 'Prêt'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                  <span>Sync : {syncSettings.googleFitLastSync}</span>
                  <button
                    type="button"
                    onClick={() => handleSyncGoogleHealth('fit')}
                    className="flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Connecter / Sync</span>
                  </button>
                </div>
              </div>

              {/* Google Health Connect Block */}
              <div className="rounded-2xl border border-zinc-800/80 bg-black p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Google Health Connect (Android 14+)
                    </div>
                    <div className="font-mono text-[11px] text-zinc-400">
                      WeightRecord · HeightRecord · BodyFatRecord
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      syncSettings.healthConnectConnected ? 'text-sky-400' : 'text-zinc-500'
                    }`}
                  >
                    {syncSettings.healthConnectConnected ? 'Actif' : 'Prêt'}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                  <span>Sync : {syncSettings.healthConnectLastSync}</span>
                  <button
                    type="button"
                    onClick={() => handleSyncGoogleHealth('healthconnect')}
                    className="flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
                    <span>Connecter / Sync</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* End-to-End Encrypted (E2EE) Cloud Backup Vault */}
          <div className={`rounded-3xl border p-6 ${cardSurfaceClass}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">
                  Sauvegarde Cloud Chiffrée (E2EE)
                </h3>
                <p className="text-xs text-zinc-400">
                  Web Crypto PBKDF2 + AES-256-GCM Zero-Knowledge
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label htmlFor="e2ee-key" className="block text-xs text-zinc-400">
                  Phrase secrète de chiffrement local
                </label>
                <input
                  id="e2ee-key"
                  type="password"
                  placeholder="Créer votre clé secrète E2EE..."
                  value={e2eePassphrase}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setE2eePassphrase(val);
                    if (val) {
                      const fp = await computeKeyFingerprint(val);
                      setSyncSettings((s) => ({ ...s, e2eeKeyFingerprint: fp }));
                    }
                  }}
                  className="mt-1.5 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 font-mono text-xs text-emerald-400"
                />
              </div>

              <div className="rounded-2xl border border-zinc-800/80 bg-black p-3.5 font-mono text-[11px] text-zinc-400">
                <div>ALGORITHME : AES-256-GCM (PBKDF2 120 000 itérations)</div>
                <div className="mt-1 text-emerald-400">
                  EMPREINTE CLÉ : {syncSettings.e2eeKeyFingerprint}
                </div>
                <div className="mt-1">
                  DERNIER SNAPSHOT : {syncSettings.cloudLastBackup}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRunEncryptedCloudBackup}
                  className="flex-1 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-semibold text-black hover:bg-emerald-400 whitespace-nowrap"
                >
                  Chiffrer & Sauvegarder
                </button>
                {encryptedBundle && (
                  <>
                    <button
                      type="button"
                      onClick={handleVerifyDecryptVault}
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                    >
                      Vérifier
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadEncryptedVault}
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                      title="Télécharger l'archive chiffrée .json"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Personalized Reminders & Periodic Notification Scheduler */}
          <div className={`rounded-3xl border p-6 ${cardSurfaceClass}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">
                  Rappels Programmés & Notifications
                </h3>
                <p className="text-xs text-zinc-400">
                  Quotidien, hebdomadaire ou tous les X jours
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3.5">
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-black p-1 border border-zinc-800">
                {(
                  [
                    { id: 'daily', label: 'Quotidien' },
                    { id: 'weekly', label: 'Hebdo' },
                    { id: 'every_x_days', label: 'Tous les X j.' },
                  ] as const
                ).map((freq) => (
                  <button
                    key={freq.id}
                    type="button"
                    onClick={() =>
                      setReminders((r) => ({ ...r, frequencyType: freq.id }))
                    }
                    className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                      reminders.frequencyType === freq.id
                        ? 'bg-emerald-500 text-black font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {freq.label}
                  </button>
                ))}
              </div>

              {reminders.frequencyType === 'every_x_days' && (
                <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black px-3.5 py-2 text-xs">
                  <span className="text-zinc-300">Intervalle en jours :</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={reminders.intervalDays}
                      onChange={(e) =>
                        setReminders((r) => ({
                          ...r,
                          intervalDays: Math.max(2, parseInt(e.target.value, 10) || 2),
                        }))
                      }
                      className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-center font-mono text-white"
                    />
                    <span className="text-zinc-400">jours</span>
                  </div>
                </div>
              )}

              {reminders.frequencyType === 'weekly' && (
                <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black px-3.5 py-2 text-xs">
                  <span className="text-zinc-300">Jour de pesée :</span>
                  <select
                    value={reminders.weeklyDay}
                    onChange={(e) =>
                      setReminders((r) => ({
                        ...r,
                        weeklyDay: parseInt(e.target.value, 10),
                      }))
                    }
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-white"
                  >
                    <option value={1}>Lundi matin</option>
                    <option value={3}>Mercredi matin</option>
                    <option value={5}>Vendredi matin</option>
                    <option value={0}>Dimanche matin</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black px-3.5 py-2 text-xs">
                <span className="text-zinc-300">Heure du rappel :</span>
                <input
                  type="time"
                  value={reminders.time}
                  onChange={(e) =>
                    setReminders((r) => ({ ...r, time: e.target.value }))
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-emerald-400"
                />
              </div>

              <button
                type="button"
                onClick={handleTestReminderNotification}
                className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
              >
                Tester la notification de rappel
              </button>
            </div>
          </div>
        </section>

        {/* Home Screen Widgets Section */}
        <section id="widgets" className={`rounded-3xl border p-6 ${cardSurfaceClass}`}>
          <HomeScreenWidgets
            entries={entries}
            profile={profile}
            reminders={reminders}
            onQuickLogWeight={(w, h) => {
              const validH = Math.max(100, Math.min(240, h || profile.heightCm));
              const validW = w > 0 ? w : 70.0;
              const age = new Date().getFullYear() - profile.birthYear;
              const m = computeXiaomiBodyMetrics(
                validW,
                validH,
                age,
                profile.gender,
                latestEntry?.impedanceOhm ?? 470
              );
              handleRecordEntry({
                date: new Date().toISOString().slice(0, 10),
                timestamp: Date.now(),
                weightKg: validW,
                heightCm: validH,
                bmi: m.bmi,
                bodyFatPct: m.bodyFatPct,
                muscleMassKg: m.muscleMassKg,
                waterPct: m.waterPct,
                visceralFat: m.visceralFat,
                boneMassKg: m.boneMassKg,
                basalMetabolismKcal: m.basalMetabolismKcal,
                impedanceOhm: latestEntry?.impedanceOhm ?? 470,
                source: 'manual',
                syncedGoogleFit: syncSettings.googleFitConnected,
                syncedHealthConnect: syncSettings.healthConnectConnected,
                note: 'Saisie rapide depuis le Widget Écran d’Accueil Android',
              });
            }}
          />
        </section>

        {/* Complete Historical Data Log & Export Section */}
        <section id="history" className={`rounded-3xl border p-6 ${cardSurfaceClass}`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                Historique des Mesures ({filteredEntries.length} entrée{filteredEntries.length > 1 ? 's' : ''})
              </h2>
              <p className="text-xs text-zinc-400">
                Stockage local hors-ligne. Exportable en PDF et CSV avec Poids (kg), Taille (cm) et IMC.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  exportReportToPDF(
                    filteredEntries,
                    profile,
                    periodFilter.toUpperCase()
                  )
                }
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-black hover:bg-emerald-400"
              >
                <FileText className="h-4 w-4" />
                <span>Exporter Bilan PDF</span>
              </button>
              <button
                type="button"
                onClick={() => exportEntriesToCSV(filteredEntries, profile)}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
              >
                <FileSpreadsheet className="h-4 w-4 text-sky-400" />
                <span>Exporter CSV</span>
              </button>
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-black p-8 text-center">
              <p className="text-sm font-medium text-zinc-300">
                Aucune mesure enregistrée (Historique vierge à zéro).
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Utilisez le bouton « Saisir Poids & Taille » ou connectez une balance Xiaomi Bluetooth pour ajouter votre première entrée.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="py-3 pr-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Poids</th>
                    <th className="py-3 px-4 font-medium">Taille</th>
                    <th className="py-3 px-4 font-medium">IMC</th>
                    <th className="py-3 px-4 font-medium">Masse Grasse</th>
                    <th className="py-3 px-4 font-medium">Masse Musculaire</th>
                    <th className="py-3 px-4 font-medium">Eau</th>
                    <th className="py-3 px-4 font-medium">Source</th>
                    <th className="py-3 pl-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 font-mono">
                  {filteredEntries.map((entry) => {
                    const cat = getBMICategory(entry.bmi);
                    return (
                      <tr key={entry.id} className="hover:bg-zinc-900/40">
                        <td className="py-3 pr-4 text-zinc-300 whitespace-nowrap">
                          {entry.date}
                        </td>
                        <td className="py-3 px-4 font-bold text-white tabular-nums whitespace-nowrap">
                          {entry.weightKg.toFixed(1)} kg
                        </td>
                        <td className="py-3 px-4 text-emerald-400 tabular-nums whitespace-nowrap">
                          {entry.heightCm || profile.heightCm} cm
                        </td>
                        <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                          <span className={cat.color}>{entry.bmi.toFixed(1)}</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-300 tabular-nums whitespace-nowrap">
                          {entry.bodyFatPct !== undefined
                            ? `${entry.bodyFatPct.toFixed(1)}%`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-sky-400 tabular-nums whitespace-nowrap">
                          {entry.muscleMassKg !== undefined
                            ? `${entry.muscleMassKg.toFixed(1)} kg`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-zinc-300 tabular-nums whitespace-nowrap">
                          {entry.waterPct !== undefined
                            ? `${entry.waterPct.toFixed(1)}%`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 font-sans text-zinc-400 whitespace-nowrap">
                          {entry.source === 'xiaomi-ble'
                            ? `Xiaomi BLE (${entry.scaleModel || 'Mi Scale'})`
                            : 'Saisie manuelle'}
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-rose-400"
                            title="Supprimer cette pesée"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-5 items-center border-t border-zinc-900 bg-black/95 px-2 md:hidden">
        <button
          type="button"
          onClick={() => setActiveNavSection('dashboard')}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
            activeNavSection === 'dashboard' ? 'text-emerald-400' : 'text-zinc-400'
          }`}
        >
          <Activity className="h-5 w-5" />
          <span className="mt-1">Courbe</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveNavSection('scale3d');
            document.getElementById('scale3d')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
            activeNavSection === 'scale3d' ? 'text-emerald-400' : 'text-zinc-400'
          }`}
        >
          <Bluetooth className="h-5 w-5" />
          <span className="mt-1">Xiaomi 3D</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setManualHeight(String(profile.heightCm || 175));
            setManualWeight(latestEntry ? latestEntry.weightKg.toFixed(1) : '70.0');
            setIsManualModalOpen(true);
          }}
          className="flex flex-col items-center justify-center min-h-[44px]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-black">
            <Plus className="h-5 w-5" />
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveNavSection('widgets');
            document.getElementById('widgets')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
            activeNavSection === 'widgets' ? 'text-emerald-400' : 'text-zinc-400'
          }`}
        >
          <Smartphone className="h-5 w-5" />
          <span className="mt-1">Widgets</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveNavSection('history');
            document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center min-h-[44px] text-[10px] font-medium ${
            activeNavSection === 'history' ? 'text-emerald-400' : 'text-zinc-400'
          }`}
        >
          <FileText className="h-5 w-5" />
          <span className="mt-1">Exports</span>
        </button>
      </nav>

      {/* Xiaomi Bluetooth BLE Modal */}
      <XiaomiBluetoothModal
        isOpen={isBleModalOpen}
        onClose={() => setIsBleModalOpen(false)}
        profile={profile}
        latestWeightKg={currentWeightVal}
        selectedModel={selectedScaleModel}
        onSelectModel={setSelectedScaleModel}
        onRecordEntry={handleRecordEntry}
      />

      {/* Manual Weight & Height Entry Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <form
            onSubmit={handleManualSubmit}
            className="w-full max-w-md rounded-3xl border border-zinc-800 bg-[#050507] p-6 text-zinc-100 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-semibold text-white">
                Saisir le Poids (kg) & la Taille (cm)
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400">Poids (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min={25}
                    max={250}
                    required
                    value={manualWeight}
                    onChange={(e) => setManualWeight(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2.5 font-mono text-lg font-bold text-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-emerald-400 font-medium">
                    Taille (cm) *
                  </label>
                  <input
                    type="number"
                    min={100}
                    max={240}
                    required
                    value={manualHeight}
                    onChange={(e) => setManualHeight(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-emerald-500/40 bg-black px-3 py-2.5 font-mono text-lg font-bold text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400">Date de mesure</label>
                  <input
                    type="date"
                    required
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400">
                    Impédance BIA (Ω)
                  </label>
                  <input
                    type="number"
                    value={manualImpedance}
                    onChange={(e) => setManualImpedance(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 font-mono text-xs text-sky-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400">Note ou contexte</label>
                <input
                  type="text"
                  placeholder="Ex: Pesée matinale à jeun"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-200"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-semibold text-black hover:bg-emerald-400"
              >
                Enregistrer Poids & Taille
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Android Phone Installation Modal */}
      <AndroidInstallModal
        isOpen={isInstallGuideOpen}
        onClose={() => setIsInstallGuideOpen(false)}
      />

      {/* Factory Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-[#050507] p-6 text-zinc-100 shadow-2xl">
            <h3 className="text-base font-semibold text-white">
              Remettre l’application entièrement à zéro ?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
              Cette action efface toutes les pesées locales, réinitialise le profil, les clés E2EE et les compteurs pour retrouver l’état exact d’une première installation propre.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleFactoryReset}
                className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-black hover:bg-rose-400"
              >
                Confirmer la remise à zéro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
