import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="paper-card p-4 sm:p-5">
      <div className="flex items-center justify-between text-sm quiet">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 font-serif text-2xl sm:text-3xl text-ink dark:text-paper-100">{value}</div>
      {hint ? <div className="mt-1 text-sm quiet">{hint}</div> : null}
    </div>
  );
}
