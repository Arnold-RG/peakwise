import type { ReactNode } from "react";

export function KpiCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <figure className="plate" style={{ margin: 0 }}>
      <figcaption className="stat-label">{label}</figcaption>
      <p className="stat-value" style={{ marginTop: "0.45rem" }}>
        {value}
      </p>
      {hint ? <p className="stat-hint">{hint}</p> : null}
    </figure>
  );
}
