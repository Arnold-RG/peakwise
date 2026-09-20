import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { fetchMetrics, fetchStats } from "../api";
import { KpiCard } from "../components/KpiCard";

export function EvaluatePage() {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dark = document.documentElement.classList.contains("dark");

  useEffect(() => {
    fetchMetrics().then(setMetrics).catch(() => setError("Train the library first: python scripts/build_library.py"));
    fetchStats().then(setStats).catch(() => setStats(null));
  }, []);

  const hybrid = (metrics?.hybrid as Record<string, number>) || {};
  const cosine = (metrics?.cosine_retrieval_baseline as Record<string, number>) || {};
  const byClass = (metrics?.by_class as Record<string, Record<string, number>>) || {};
  const classNames = Object.keys(byClass);

  const compareOption = {
    color: ["#14b8a6", "#f59e0b"],
    textStyle: { fontFamily: "DM Sans, sans-serif", color: dark ? "#e4e4e7" : "#3f3f46" },
    tooltip: { trigger: "axis" },
    legend: { data: ["Hybrid", "Cosine baseline"], textStyle: { color: dark ? "#a1a1aa" : "#52525b" } },
    grid: { left: 48, right: 24, top: 40, bottom: 40 },
    xAxis: { type: "category", data: ["Top-1 acc", "Top-10 acc", "Tanimoto@1", "Tanimoto@10", "Formula acc"] },
    yAxis: { type: "value", max: 1 },
    series: [
      { name: "Hybrid", type: "bar", data: [hybrid.top1_accuracy, hybrid.top10_accuracy, hybrid.top1_tanimoto, hybrid.top10_tanimoto, hybrid.formula_accuracy] },
      { name: "Cosine baseline", type: "bar", data: [cosine.top1_accuracy, cosine.top10_accuracy, cosine.top1_tanimoto, cosine.top10_tanimoto, cosine.formula_accuracy] },
    ],
  };

  const classOption = {
    color: ["#14b8a6"],
    textStyle: { fontFamily: "DM Sans, sans-serif", color: dark ? "#e4e4e7" : "#3f3f46" },
    tooltip: { trigger: "axis" },
    grid: { left: 120, right: 24, top: 24, bottom: 40 },
    xAxis: { type: "value", max: 1, name: "Top-10 Tanimoto" },
    yAxis: { type: "category", data: classNames },
    series: [{ type: "bar", data: classNames.map((name) => byClass[name]?.top10_tanimoto ?? 0) }],
  };

  return (
    <div className="space-y-6">
      <div className="paper-card p-5">
        <h2 className="font-serif text-2xl">How well Peakwise names molecules</h2>
        <p className="mt-2 text-sm quiet">Held-out scaffolds on the bundled set. Top-10 means the true name appeared somewhere in the first ten guesses.</p>
      </div>
      {error ? <div className="paper-card p-4">{error}</div> : null}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Top-1 accuracy" value={hybrid.top1_accuracy?.toFixed(2) ?? "—"} hint={`${hybrid.n ?? 0} held-out molecules`} />
        <KpiCard label="Top-10 accuracy" value={hybrid.top10_accuracy?.toFixed(2) ?? "—"} />
        <KpiCard label="Tanimoto @1" value={hybrid.top1_tanimoto?.toFixed(2) ?? "—"} />
        <KpiCard label="Formula accuracy" value={hybrid.formula_accuracy?.toFixed(2) ?? "—"} />
      </div>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5">
        <h2 className="font-semibold mb-3">Hybrid model vs cosine retrieval</h2>
        <ReactECharts option={compareOption} style={{ height: 360 }} />
        <p className="text-xs quiet mt-2">Scaffold-split evaluation on the bundled Peakwise library.</p>
      </div>
      {classNames.length ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5">
          <h2 className="font-semibold mb-3">Slice performance by chemical class</h2>
          <ReactECharts option={classOption} style={{ height: Math.max(280, classNames.length * 28) }} />
        </div>
      ) : null}
      {stats ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5 text-sm text-zinc-500">
          Library: {String(stats.n_molecules)} molecules · {String(stats.n_spectra)} spectra · model {stats.model_loaded ? "loaded" : "missing"}
        </div>
      ) : null}
      {metrics?.notes ? <p className="text-sm text-zinc-500">{String(metrics.notes)}</p> : null}
    </div>
  );
}
