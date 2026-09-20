import { useMemo } from "react";

type Peak = { mz: number; intensity: number; label?: string };

export function SpectrumPlot({
  peaks,
  precursorMz,
  highlightMz,
  height = 260,
}: {
  peaks: Peak[];
  precursorMz?: number;
  highlightMz?: number;
  height?: number;
}) {
  const { maxMz, items } = useMemo(() => {
    if (!peaks.length) return { maxMz: 200, items: [] as Peak[] };
    const maxMz = Math.max(...peaks.map((p) => p.mz), precursorMz ?? 0) * 1.06;
    return { maxMz, items: peaks };
  }, [peaks, precursorMz]);

  return (
    <div className="spectrum-grid relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f]">
      <svg viewBox={`0 0 1000 ${height}`} className="w-full" role="img" aria-label="Mass spectrum">
        <line x1="48" y1={height - 28} x2="980" y2={height - 28} stroke="currentColor" className="text-zinc-300 dark:text-zinc-700" />
        <line x1="48" y1="16" x2="48" y2={height - 28} stroke="currentColor" className="text-zinc-300 dark:text-zinc-700" />
        {precursorMz ? (
          <line
            x1={48 + ((precursorMz / maxMz) * 932)}
            x2={48 + ((precursorMz / maxMz) * 932)}
            y1="16"
            y2={height - 28}
            stroke="#b55233"
            strokeDasharray="4 4"
            opacity="0.7"
          />
        ) : null}
        {items.map((peak, idx) => {
          const x = 48 + (peak.mz / maxMz) * 932;
          const y2 = height - 28;
          const y1 = y2 - peak.intensity * (height - 56);
          const active = highlightMz !== undefined && Math.abs(peak.mz - highlightMz) < 0.3;
          return (
            <g key={`${peak.mz}-${idx}`}>
              <line
                x1={x}
                x2={x}
                y1={y1}
                y2={y2}
                stroke={active ? "#b55233" : "#231c16"}
                strokeWidth={active ? 3 : 1.6}
              />
            </g>
          );
        })}
        <text x="48" y={height - 8} className="fill-zinc-500" fontSize="12" fontFamily="JetBrains Mono">
          m/z
        </text>
        <text x="960" y={height - 8} className="fill-zinc-500" fontSize="12" fontFamily="JetBrains Mono" textAnchor="end">
          {maxMz.toFixed(0)}
        </text>
        {precursorMz ? (
          <text x={48 + ((precursorMz / maxMz) * 932)} y="14" className="fill-amber-500" fontSize="11" fontFamily="JetBrains Mono" textAnchor="middle">
            precursor {precursorMz.toFixed(4)}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
