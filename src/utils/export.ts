import { jsPDF } from 'jspdf';
import { WeightEntry, UserProfile } from '../types';
import { getBMICategory } from './bmi';

export function exportEntriesToCSV(entries: WeightEntry[], profile: UserProfile): void {
  const headers = [
    'Date',
    'Heure',
    'Poids (kg)',
    'Taille (cm)',
    'IMC',
    'Categorie IMC',
    'Masse Grasse (%)',
    'Masse Musculaire (kg)',
    'Hydratation (%)',
    'Graisse Viscerale',
    'Masse Osseuse (kg)',
    'Metabolisme Basal (kcal)',
    'Impedance (Ohm)',
    'Source',
    'Modele Balance',
    'Note',
  ];

  const rows = entries.map((e) => {
    const d = new Date(e.timestamp);
    const timeStr = d.toTimeString().slice(0, 5);
    const cat = getBMICategory(e.bmi).label;
    return [
      e.date,
      timeStr,
      e.weightKg.toFixed(1),
      (e.heightCm || profile.heightCm).toFixed(0),
      e.bmi.toFixed(1),
      `"${cat}"`,
      e.bodyFatPct !== undefined ? e.bodyFatPct.toFixed(1) : '',
      e.muscleMassKg !== undefined ? e.muscleMassKg.toFixed(1) : '',
      e.waterPct !== undefined ? e.waterPct.toFixed(1) : '',
      e.visceralFat !== undefined ? String(e.visceralFat) : '',
      e.boneMassKg !== undefined ? e.boneMassKg.toFixed(2) : '',
      e.basalMetabolismKcal !== undefined ? String(e.basalMetabolismKcal) : '',
      e.impedanceOhm !== undefined ? String(e.impedanceOhm) : '',
      e.source,
      e.scaleModel || '',
      `"${(e.note || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kiloobsidian-poids-${profile.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportReportToPDF(
  entries: WeightEntry[],
  profile: UserProfile,
  periodLabel: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
  const latest = sorted[0];
  const oldest = sorted[sorted.length - 1];

  // Header Banner
  doc.setFillColor(9, 9, 11);
  doc.rect(0, 0, 210, 38, 'F');

  doc.setTextColor(16, 185, 129);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('KILOOBSIDIAN — BILAN BIOMÉTRIQUE & SUIVI DE POIDS', 14, 16);

  doc.setTextColor(212, 212, 216);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `Patient / Utilisateur : ${profile.name}  |  Taille : ${profile.heightCm} cm  |  Objectif : ${profile.targetWeightKg.toFixed(1)} kg`,
    14,
    25
  );
  doc.text(
    `Période analysée : ${periodLabel} (${entries.length} mesures)  |  Généré le : ${new Date().toLocaleDateString('fr-FR')}`,
    14,
    31
  );

  if (!latest) {
    doc.setTextColor(40, 40, 40);
    doc.text('Aucune mesure disponible sur cette période.', 14, 55);
    doc.save('kiloobsidian-rapport.pdf');
    return;
  }

  const weights = sorted.map((e) => e.weightKg);
  const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const deltaWeight = latest.weightKg - oldest.weightKg;
  const bmiCat = getBMICategory(latest.bmi);

  // Summary KPI Boxes
  const kpis = [
    { title: 'POIDS ACTUEL', val: `${latest.weightKg.toFixed(1)} kg`, sub: `Objectif: ${profile.targetWeightKg} kg` },
    { title: 'ÉVOLUTION PÉRIODE', val: `${deltaWeight >= 0 ? '+' : ''}${deltaWeight.toFixed(1)} kg`, sub: `Min ${minWeight.toFixed(1)} / Max ${maxWeight.toFixed(1)}` },
    { title: 'IMC ACTUEL', val: `${latest.bmi.toFixed(1)}`, sub: bmiCat.label },
    { title: 'MOYENNE & COMPO', val: `${avgWeight.toFixed(1)} kg`, sub: `Grasse: ${latest.bodyFatPct ?? '--'}% | Muscle: ${latest.muscleMassKg ?? '--'}kg` },
  ];

  kpis.forEach((k, idx) => {
    const x = 14 + idx * 46.5;
    doc.setFillColor(244, 244, 245);
    doc.setDrawColor(228, 228, 231);
    doc.roundedRect(x, 45, 44, 24, 2, 2, 'FD');

    doc.setTextColor(113, 113, 122);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(k.title, x + 3, 51);

    doc.setTextColor(9, 9, 11);
    doc.setFontSize(13);
    doc.text(k.val, x + 3, 59);

    doc.setTextColor(82, 82, 91);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(k.sub, x + 3, 65.5);
  });

  // Mini Vector Trend Curve inside the PDF
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(24, 24, 27);
  doc.text('Courbe d’évolution pondérale sur la période', 14, 79);

  const chartX = 14;
  const chartY = 83;
  const chartW = 182;
  const chartH = 38;
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(212, 212, 216);
  doc.rect(chartX, chartY, chartW, chartH, 'FD');

  const chronological = [...sorted].reverse();
  if (chronological.length > 1) {
    const padMin = Math.min(minWeight, profile.targetWeightKg) - 0.8;
    const padMax = Math.max(maxWeight, profile.targetWeightKg) + 0.8;
    const span = Math.max(padMax - padMin, 1);

    // Target line
    const targetY = chartY + chartH - ((profile.targetWeightKg - padMin) / span) * chartH;
    if (targetY >= chartY && targetY <= chartY + chartH) {
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.3);
      doc.line(chartX, targetY, chartX + chartW, targetY);
    }

    // Weight curve
    doc.setDrawColor(9, 9, 11);
    doc.setLineWidth(0.7);
    for (let i = 0; i < chronological.length - 1; i++) {
      const x1 = chartX + (i / (chronological.length - 1)) * chartW;
      const y1 = chartY + chartH - ((chronological[i].weightKg - padMin) / span) * chartH;
      const x2 = chartX + ((i + 1) / (chronological.length - 1)) * chartW;
      const y2 = chartY + chartH - ((chronological[i + 1].weightKg - padMin) / span) * chartH;
      doc.line(x1, y1, x2, y2);
    }
  }

  // Table Header
  let y = 132;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(24, 24, 27);
  doc.text('Historique détaillé des pesées (30 dernières entrées)', 14, y);
  y += 5;

  doc.setFillColor(24, 24, 27);
  doc.rect(14, y, 182, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('Date', 17, y + 4.8);
  doc.text('Poids (kg)', 48, y + 4.8);
  doc.text('IMC', 76, y + 4.8);
  doc.text('Grasse (%)', 98, y + 4.8);
  doc.text('Muscle (kg)', 124, y + 4.8);
  doc.text('Eau (%)', 152, y + 4.8);
  doc.text('Source', 173, y + 4.8);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  sorted.slice(0, 28).forEach((entry, idx) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 248, 250);
      doc.rect(14, y, 182, 6, 'F');
    }
    doc.setTextColor(39, 39, 42);
    doc.text(entry.date, 17, y + 4.2);
    doc.setFont('helvetica', 'bold');
    doc.text(`${entry.weightKg.toFixed(1)} kg`, 48, y + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.text(entry.bmi.toFixed(1), 76, y + 4.2);
    doc.text(entry.bodyFatPct !== undefined ? `${entry.bodyFatPct.toFixed(1)}%` : '-', 98, y + 4.2);
    doc.text(entry.muscleMassKg !== undefined ? `${entry.muscleMassKg.toFixed(1)} kg` : '-', 124, y + 4.2);
    doc.text(entry.waterPct !== undefined ? `${entry.waterPct.toFixed(1)}%` : '-', 152, y + 4.2);
    doc.text(entry.source === 'xiaomi-ble' ? 'Xiaomi BLE' : entry.source, 173, y + 4.2);
    y += 6;
  });

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(161, 161, 170);
  doc.text(
    'Document généré localement par KiloObsidian (Chiffrement de bout en bout E2EE - Compatible Google Fit & Health Connect).',
    14,
    289
  );

  doc.save(`kiloobsidian-rapport-${new Date().toISOString().slice(0, 10)}.pdf`);
}
