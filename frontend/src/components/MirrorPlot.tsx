type Peak = { mz: number; intensity: number };

export function MirrorPlot({
  peaksA,
  peaksB,
  precursorMz,
  height = 320,
  labelA = "query",
  labelB = "library",
}: {
  peaksA: Peak[];
  peaksB: Peak[];
  precursorMz?: number;
  height?: number;
  labelA?: string;
  labelB?: string;
}) {
  const maxMz = Math.max(
    ...peaksA.map((p) => p.mz),
    ...peaksB.map((p) => p.mz),
    precursorMz ?? 0,
    50
  ) * 1.06;
  const mid = height / 2;

  function x(mz: number) {
    return 48 + (mz / maxMz) * 932;
  }

  return (
    <div className="spectrum-grid relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f]">
      <div className="absolute top-2 left-4 text-[11px] font-mono text-teal-600 dark:text-ion-400">{labelA}</div>
      <div className="absolute bottom-2 left-4 text-[11px] font-mono text-amber-600">{labelB}</div>
      <svg viewBox={`0 0 1000 ${height}`} className="w-full" role="img" aria-label="Mirror mass spectrum">
        <line x1="48" y1={mid} x2="980" y2={mid} stroke="currentColor" className="text-zinc-300 dark:text-zinc-700" />
        {precursorMz ? (
          <line x1={x(precursorMz)} x2={x(precursorMz)} y1="12" y2={height - 12} stroke="#f59e0b" strokeDasharray="4 4" opacity="0.55" />
        ) : null}
        {peaksA.map((peak, idx) => (
          <line
            key={`a-${idx}`}
            x1={x(peak.mz)}
            x2={x(peak.mz)}
            y1={mid}
            y2={mid - peak.intensity * (mid - 20)}
            stroke="#14b8a6"
            strokeWidth="1.6"
          />
        ))}
        {peaksB.map((peak, idx) => (
          <line
            key={`b-${idx}`}
            x1={x(peak.mz)}
            x2={x(peak.mz)}
            y1={mid}
            y2={mid + peak.intensity * (mid - 20)}
            stroke="#f59e0b"
            strokeWidth="1.6"
          />
        ))}
        <text x="960" y={height - 8} className="fill-zinc-500" fontSize="11" fontFamily="JetBrains Mono" textAnchor="end">
          {maxMz.toFixed(0)} m/z
        </text>
      </svg>
    </div>
  );
}
