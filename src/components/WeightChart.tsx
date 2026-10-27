import React, { useMemo, useState } from 'react';
import { WeightEntry } from '../types';

interface WeightTrendChartProps {
  entries: WeightEntry[];
  targetWeightKg: number;
  metric: 'weight' | 'bmi' | 'bodyFat' | 'muscle' | 'height';
  isLightMode?: boolean;
}

export const WeightTrendChart: React.FC<WeightTrendChartProps> = ({
  entries,
  targetWeightKg,
  metric,
  isLightMode = false,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chronological = useMemo(
    () => [...entries].sort((a, b) => a.timestamp - b.timestamp),
    [entries]
  );

  const getValue = (e: WeightEntry) => {
    if (metric === 'bmi') return e.bmi;
    if (metric === 'bodyFat') return e.bodyFatPct ?? 18;
    if (metric === 'muscle') return e.muscleMassKg ?? 55;
    if (metric === 'height') return e.heightCm ?? 175;
    return e.weightKg;
  };

  const unitLabel = useMemo(() => {
    if (metric === 'bmi') return 'IMC';
    if (metric === 'bodyFat') return '%';
    if (metric === 'height') return 'cm';
    return 'kg';
  }, [metric]);

  // Compute 7-point exponential moving average
  const movingAvg = useMemo(() => {
    const result: number[] = [];
    const alpha = 0.28;
    chronological.forEach((e, idx) => {
      const val = getValue(e);
      if (idx === 0) {
        result.push(val);
      } else {
        result.push(Number((alpha * val + (1 - alpha) * result[idx - 1]).toFixed(2)));
      }
    });
    return result;
  }, [chronological, metric]);

  if (chronological.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 text-sm text-zinc-500">
        Aucune mesure enregistrée sur cette période. Ajoutez une pesée ou réduisez le filtre de dates.
      </div>
    );
  }

  const values = chronological.map(getValue);
  const rawMin = Math.min(...values, metric === 'weight' ? targetWeightKg : Infinity);
  const rawMax = Math.max(...values, metric === 'weight' ? targetWeightKg : -Infinity);
  const padding = Math.max((rawMax - rawMin) * 0.18, 0.8);
  const minVal = rawMin - padding;
  const maxVal = rawMax + padding;
  const range = Math.max(maxVal - minVal, 1);

  const width = 760;
  const height = 250;
  const padL = 44;
  const padR = 18;
  const padT = 18;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const getX = (index: number) => {
    if (chronological.length === 1) return padL + plotW / 2;
    return padL + (index / (chronological.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    return padT + plotH - ((val - minVal) / range) * plotH;
  };

  const points = chronological.map((e, i) => ({
    x: getX(i),
    y: getY(getValue(e)),
    maY: getY(movingAvg[i]),
    entry: e,
    val: getValue(e),
    maVal: movingAvg[i],
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const maPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.maY.toFixed(1)}`)
    .join(' ');

  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  const targetY = metric === 'weight' ? getY(targetWeightKg) : null;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const v = minVal + t * range;
    return { val: v, y: getY(v) };
  });

  const activePoint = hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : points[points.length - 1];

  return (
    <div className="relative select-none">
      {/* Top interactive readout bar */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-2xl font-bold tracking-tight tabular-nums">
            {activePoint.val.toFixed(1)} {unitLabel}
          </span>
          <span className="text-xs text-zinc-400">
            Moy. mobile 7j :{' '}
            <strong className="font-mono text-emerald-400 tabular-nums">
              {activePoint.maVal.toFixed(1)} {unitLabel}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-mono">{activePoint.entry.date}</span>
          <span aria-hidden="true">·</span>
          <span>
            {activePoint.entry.source === 'xiaomi-ble'
              ? 'Xiaomi Bluetooth'
              : activePoint.entry.source === 'google-fit'
                ? 'Google Fit'
                : activePoint.entry.source === 'health-connect'
                  ? 'Health Connect'
                  : 'Saisie manuelle'}
          </span>
        </div>
      </div>

      {/* SVG Curve */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-60 w-full overflow-visible"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={padL}
                y1={t.y}
                x2={width - padR}
                y2={t.y}
                stroke={isLightMode ? '#E4E4E7' : '#18181B'}
                strokeWidth="1"
              />
              <text
                x={padL - 8}
                y={t.y + 3}
                textAnchor="end"
                className="fill-zinc-500 font-mono text-[10px]"
              >
                {t.val.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Target Weight Line */}
          {targetY !== null && targetY >= padT && targetY <= padT + plotH && (
            <g>
              <line
                x1={padL}
                y1={targetY}
                x2={width - padR}
                y2={targetY}
                stroke="#38BDF8"
                strokeWidth="1.2"
                strokeDasharray="5 4"
              />
              <text
                x={width - padR - 4}
                y={targetY - 5}
                textAnchor="end"
                className="fill-sky-400 font-mono text-[10px]"
              >
                Cible {targetWeightKg.toFixed(1)} kg
              </text>
            </g>
          )}

          {/* Shaded Gradient Area */}
          {areaPath && <path d={areaPath} fill="url(#weightAreaGrad)" />}

          {/* 7-day Moving Average Smooth Curve */}
          {points.length > 1 && (
            <path
              d={maPath}
              fill="none"
              stroke="#34D399"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.7"
            />
          )}

          {/* Primary Measurement Curve */}
          {points.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="#10B981"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points & Interactive Scrubber Hitboxes */}
          {points.map((p, idx) => {
            const isHovered = hoverIdx === idx || (hoverIdx === null && idx === points.length - 1);
            return (
              <g key={p.entry.id}>
                {isHovered && (
                  <line
                    x1={p.x}
                    y1={padT}
                    x2={p.x}
                    y2={padT + plotH}
                    stroke="#10B981"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    opacity="0.5"
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 5 : points.length > 40 ? 2 : 3}
                  fill={isHovered ? '#10B981' : isLightMode ? '#FFFFFF' : '#000000'}
                  stroke="#10B981"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                />
                {/* Invisible touch/mouse column for smooth scrubbing */}
                <rect
                  x={p.x - Math.max(plotW / points.length / 2, 6)}
                  y={padT}
                  width={Math.max(plotW / points.length, 12)}
                  height={plotH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(idx)}
                  onClick={() => setHoverIdx(idx)}
                />
              </g>
            );
          })}

          {/* X Axis Date Labels */}
          {[0, Math.floor(points.length * 0.25), Math.floor(points.length * 0.5), Math.floor(points.length * 0.75), points.length - 1]
            .filter((v, i, a) => a.indexOf(v) === i && points[v])
            .map((idx) => {
              const p = points[idx];
              return (
                <text
                  key={idx}
                  x={p.x}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-zinc-500 font-mono text-[10px]"
                >
                  {p.entry.date.slice(5)}
                </text>
              );
            })}
        </svg>
      </div>
    </div>
  );
};

interface WeeklyProgressChartProps {
  entries: WeightEntry[];
  isLightMode?: boolean;
}

export const WeeklyProgressChart: React.FC<WeeklyProgressChartProps> = ({
  entries,
  isLightMode = false,
}) => {
  const weeklyStats = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    const map = new Map<string, { weights: number[]; bmis: number[]; fats: number[]; label: string }>();

    sorted.forEach((entry) => {
      const d = new Date(entry.timestamp);
      // Compute Monday of the week
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      const key = monday.toISOString().slice(0, 10);
      const label = `Sem. ${monday.getDate().toString().padStart(2, '0')}/${(monday.getMonth() + 1).toString().padStart(2, '0')}`;

      if (!map.has(key)) {
        map.set(key, { weights: [], bmis: [], fats: [], label });
      }
      const bucket = map.get(key)!;
      bucket.weights.push(entry.weightKg);
      bucket.bmis.push(entry.bmi);
      if (entry.bodyFatPct !== undefined) bucket.fats.push(entry.bodyFatPct);
    });

    const weeks = Array.from(map.entries())
      .map(([key, val]) => {
        const avgWeight = Number((val.weights.reduce((a, b) => a + b, 0) / val.weights.length).toFixed(1));
        const avgBmi = Number((val.bmis.reduce((a, b) => a + b, 0) / val.bmis.length).toFixed(1));
        const avgFat = val.fats.length
          ? Number((val.fats.reduce((a, b) => a + b, 0) / val.fats.length).toFixed(1))
          : null;
        return {
          key,
          label: val.label,
          avgWeight,
          avgBmi,
          avgFat,
          count: val.weights.length,
        };
      })
      .slice(-8); // Last 8 weeks

    return weeks.map((w, idx) => ({
      ...w,
      delta: idx === 0 ? 0 : Number((w.avgWeight - weeks[idx - 1].avgWeight).toFixed(2)),
    }));
  }, [entries]);

  if (weeklyStats.length === 0) return null;

  const minW = Math.min(...weeklyStats.map((w) => w.avgWeight)) - 1;
  const maxW = Math.max(...weeklyStats.map((w) => w.avgWeight)) + 0.5;
  const span = Math.max(maxW - minW, 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {weeklyStats.map((w) => {
          const heightPct = Math.max(18, Math.min(100, ((w.avgWeight - minW) / span) * 100));
          const isLoss = w.delta <= 0;
          return (
            <div
              key={w.key}
              className={`flex flex-col justify-between rounded-xl border p-3 ${
                isLightMode
                  ? 'border-zinc-200 bg-zinc-50'
                  : 'border-zinc-800/80 bg-zinc-950/80'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="font-mono">{w.label}</span>
                <span className="font-mono">{w.count}p</span>
              </div>

              <div className="my-3 flex h-24 items-end justify-center">
                <div className="relative flex h-full w-full items-end justify-center rounded-lg bg-zinc-900/40 p-1">
                  <div
                    className={`w-full rounded-md transition-all duration-300 ${
                      isLoss ? 'bg-emerald-500/80' : 'bg-amber-500/80'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="font-mono text-sm font-bold tabular-nums">
                  {w.avgWeight.toFixed(1)} kg
                </div>
                <div
                  className={`font-mono text-[11px] tabular-nums ${
                    w.delta < 0
                      ? 'text-emerald-400'
                      : w.delta > 0
                        ? 'text-amber-400'
                        : 'text-zinc-500'
                  }`}
                >
                  {w.delta > 0 ? `+${w.delta.toFixed(1)}` : w.delta.toFixed(1)} kg/sem
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
