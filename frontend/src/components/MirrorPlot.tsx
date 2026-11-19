import { useId } from "react";

type Peak = { mz: number; intensity: number };

export function MirrorPlot({
  peaksA,
  peaksB,
  precursorMz,
  height = 300,
  labelA = "Query",
  labelB = "Library",
}: {
  peaksA: Peak[];
  peaksB: Peak[];
  precursorMz?: number;
  height?: number;
  labelA?: string;
  labelB?: string;
}) {
  const clipId = useId().replace(/:/g, "");
  const maxI = (rows: Peak[]) => Math.max(...rows.map((peak) => Math.abs(peak.intensity)), 1e-9);
  const maxMz =
    Math.max(...peaksA.map((peak) => peak.mz), ...peaksB.map((peak) => peak.mz), precursorMz ?? 0, 50) * 1.08;
  const xOf = (mz: number) => 7 + (mz / maxMz) * 88;
  const precursorX = precursorMz ? xOf(precursorMz) : null;
  const scaleA = maxI(peaksA);
  const scaleB = maxI(peaksB);
  const label = `Mirror plot. ${labelA} above the line, ${labelB} below.`;

  return (
    <div className="plot-frame">
      <ul className="legend">
        <li>
          <span className="swatch" /> {labelA}
        </li>
        <li>
          <span className="swatch library" /> {labelB}
        </li>
      </ul>
      <div className="plot-stage">
        <svg className="plot-svg" style={{ height }} viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label}>
          <title>{label}</title>
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <rect className="peak-clip" x="0" y="0" width="100" height="100" />
            </clipPath>
          </defs>
          <line className="axis-line" x1="6" x2="96" y1="50" y2="50" />
          {precursorX != null ? <line className="precursor-line" x1={precursorX} x2={precursorX} y1="6" y2="94" /> : null}
          <g clipPath={`url(#${clipId})`}>
            {peaksA.map((peak, index) => {
              const x = xOf(peak.mz);
              const y = 50 - (Math.abs(peak.intensity) / scaleA) * 40;
              return <line key={`a-${peak.mz}-${index}`} className="peak" x1={x} x2={x} y1={y} y2="50" />;
            })}
            {peaksB.map((peak, index) => {
              const x = xOf(peak.mz);
              const y = 50 + (Math.abs(peak.intensity) / scaleB) * 40;
              return <line key={`b-${peak.mz}-${index}`} className="peak peak-b" x1={x} x2={x} y1="50" y2={y} />;
            })}
          </g>
        </svg>
      </div>
      <div className="plot-axis">
        <span>m/z</span>
        <span>{maxMz.toFixed(0)}</span>
      </div>
    </div>
  );
}
