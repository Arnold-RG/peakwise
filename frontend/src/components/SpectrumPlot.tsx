import { useId, useMemo } from "react";

type Peak = { mz: number; intensity: number };

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
  const clipId = useId().replace(/:/g, "");
  const drawn = useMemo(() => {
    const finite = peaks.filter((peak) => Number.isFinite(peak.mz) && Number.isFinite(peak.intensity));
    if (!finite.length) return { maxMz: 200, maxI: 1, items: [] as Peak[] };
    const maxMz = Math.max(...finite.map((peak) => peak.mz), precursorMz ?? 0, 1) * 1.08;
    const maxI = Math.max(...finite.map((peak) => Math.abs(peak.intensity)), 1e-9);
    return { maxMz, maxI, items: finite };
  }, [peaks, precursorMz]);

  if (!drawn.items.length) {
    return (
      <div className="plot-frame plot-empty">
        <p>No peaks to draw yet.</p>
      </div>
    );
  }

  const xOf = (mz: number) => 7 + (mz / drawn.maxMz) * 88;
  const precursorX = precursorMz ? xOf(precursorMz) : null;
  const label = `Mass spectrum, ${drawn.items.length} peaks${precursorMz ? `, precursor ${precursorMz.toFixed(4)}` : ""}`;

  return (
    <div className="plot-frame">
      <div className="plot-stage">
        <svg className="plot-svg" style={{ height }} viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label}>
          <title>{label}</title>
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <rect className="peak-clip" x="0" y="0" width="100" height="100" />
            </clipPath>
          </defs>
          <line className="axis-line" x1="6" x2="96" y1="90" y2="90" />
          {precursorX != null ? <line className="precursor-line" x1={precursorX} x2={precursorX} y1="8" y2="90" /> : null}
          <g clipPath={`url(#${clipId})`}>
            {drawn.items.map((peak, index) => {
              const x = xOf(peak.mz);
              const y = 90 - (Math.abs(peak.intensity) / drawn.maxI) * 76;
              const hot = highlightMz !== undefined && Math.abs(peak.mz - highlightMz) < 0.3;
              return <line key={`${peak.mz}-${index}`} className={hot ? "peak is-hot" : "peak"} x1={x} x2={x} y1={y} y2="90" />;
            })}
          </g>
        </svg>
        {precursorX != null && precursorMz ? (
          <span className="precursor-tag" style={{ left: `${precursorX}%`, transform: precursorX > 72 ? "translateX(-100%)" : "translateX(-40%)" }}>
            {precursorMz.toFixed(4)}
          </span>
        ) : null}
      </div>
      <div className="plot-axis">
        <span>m/z</span>
        <span>{drawn.maxMz.toFixed(0)}</span>
      </div>
    </div>
  );
}
