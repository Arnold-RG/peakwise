import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { fetchMetrics, fetchStats } from "../api";
import { KpiCard } from "../components/KpiCard";
import { prefersReducedMotion, useDark } from "../theme";

function pct(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function num(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toFixed(2);
}

function score(value?: number) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

export function EvaluatePage() {
  const dark = useDark();
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics()
      .then(setMetrics)
      .catch(() => setError("Train the library first: python scripts/build_library.py"));
    fetchStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const hybrid = (metrics?.hybrid as Record<string, number>) || {};
  const cosine = (metrics?.cosine_retrieval_baseline as Record<string, number>) || {};
  const byClass = (metrics?.by_class as Record<string, Record<string, number>>) || {};
  const classNames = Object.keys(byClass);
  const ink = dark ? "#f6f1e8" : "#1a1410";
  const muted = dark ? "#d4c6b4" : "#5c5148";
  const split = dark ? "#3a332c" : "#e2d6c8";
  const sheet = dark ? "#1c1916" : "#fbf8f3";
  const hybridColor = dark ? "#e0a8b0" : "#7a2e38";
  const cosineColor = dark ? "#9dceba" : "#1e4a38";
  const labels = ["Top 1", "Top 10", "Tanimoto 1", "Tanimoto 10", "Formula"];
  const reduce = prefersReducedMotion();

  const compareOption = {
    backgroundColor: "transparent",
    color: [hybridColor, cosineColor],
    textStyle: { fontFamily: "Outfit, sans-serif", color: ink },
    tooltip: {
      trigger: "axis",
      backgroundColor: sheet,
      borderColor: split,
      textStyle: { color: ink, fontFamily: "Outfit, sans-serif" },
    },
    legend: { data: ["Hybrid", "Cosine"], textStyle: { color: muted } },
    grid: { left: 48, right: 12, top: 36, bottom: 28 },
    xAxis: { type: "category", data: labels, axisLabel: { color: muted, interval: 0, hideOverlap: true }, axisLine: { lineStyle: { color: split } } },
    yAxis: { type: "value", max: 1, name: "Score", nameTextStyle: { color: muted }, axisLabel: { color: muted }, splitLine: { lineStyle: { color: split } } },
    series: [
      { name: "Hybrid", type: "bar", barMaxWidth: 28, data: [score(hybrid.top1_accuracy), score(hybrid.top10_accuracy), score(hybrid.top1_tanimoto), score(hybrid.top10_tanimoto), score(hybrid.formula_accuracy)] },
      { name: "Cosine", type: "bar", barMaxWidth: 28, data: [score(cosine.top1_accuracy), score(cosine.top10_accuracy), score(cosine.top1_tanimoto), score(cosine.top10_tanimoto), score(cosine.formula_accuracy)] },
    ],
    animation: !reduce,
  };

  const classOption = {
    backgroundColor: "transparent",
    color: [hybridColor],
    textStyle: { fontFamily: "Outfit, sans-serif", color: ink },
    tooltip: { trigger: "axis", backgroundColor: sheet, borderColor: split, textStyle: { color: ink } },
    grid: { left: 120, right: 16, top: 12, bottom: 32 },
    xAxis: { type: "value", max: 1, name: "Top-10 Tanimoto", nameTextStyle: { color: muted }, axisLabel: { color: muted }, splitLine: { lineStyle: { color: split } } },
    yAxis: { type: "category", data: classNames, axisLabel: { color: muted } },
    series: [{ type: "bar", barMaxWidth: 18, data: classNames.map((name) => byClass[name]?.top10_tanimoto ?? 0) }],
    animation: !reduce,
  };

  return (
    <div className="stack-lg">
      <header>
        <p className="kicker">Held-out scaffolds</p>
        <h1 style={{ marginTop: "0.55rem" }}>How well Peakwise names molecules</h1>
        <p className="lede" style={{ marginTop: "0.8rem" }}>
          Top-10 means the true name appeared somewhere in the first ten guesses. {hybrid.n ? `${hybrid.n} molecules were held out of the bundled set.` : "These figures are the bundled held-out set."}
        </p>
      </header>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {!metrics && !error ? <p className="quiet">Reading the held-out numbers…</p> : null}
      <div className="kpi-row">
        <KpiCard label="Top-1 accuracy" value={pct(hybrid.top1_accuracy)} hint={hybrid.n ? `${hybrid.n} held-out molecules` : undefined} />
        <KpiCard label="Top-10 accuracy" value={pct(hybrid.top10_accuracy)} />
        <KpiCard label="Tanimoto at 1" value={num(hybrid.top1_tanimoto)} />
        <KpiCard label="Formula accuracy" value={pct(hybrid.formula_accuracy)} />
      </div>

      {metrics ? (
        <div className="table-wrap" tabIndex={0}>
          <table className="ledger">
            <caption>Hybrid model and cosine retrieval</caption>
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Top-1</th>
                <th scope="col">Top-10</th>
                <th scope="col">Tanimoto at 1</th>
                <th scope="col">Tanimoto at 10</th>
                <th scope="col">Formula</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Hybrid</th>
                <td className="mono">{pct(hybrid.top1_accuracy)}</td>
                <td className="mono">{pct(hybrid.top10_accuracy)}</td>
                <td className="mono">{num(hybrid.top1_tanimoto)}</td>
                <td className="mono">{num(hybrid.top10_tanimoto)}</td>
                <td className="mono">{pct(hybrid.formula_accuracy)}</td>
              </tr>
              <tr>
                <th scope="row">Cosine</th>
                <td className="mono">{pct(cosine.top1_accuracy)}</td>
                <td className="mono">{pct(cosine.top10_accuracy)}</td>
                <td className="mono">{num(cosine.top1_tanimoto)}</td>
                <td className="mono">{num(cosine.top10_tanimoto)}</td>
                <td className="mono">{pct(cosine.formula_accuracy)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}

      {metrics ? (
        <section className="plate stack">
          <h2>The same scores, drawn</h2>
          <p className="hint">Scores run from 0 to 1. Tanimoto is fingerprint similarity, not a percentage.</p>
          <ReactECharts key={dark ? "dark" : "light"} option={compareOption} opts={{ renderer: "svg" }} style={{ height: 320 }} />
        </section>
      ) : null}

      {classNames.length ? (
        <section className="plate stack">
          <h2>By chemical class</h2>
          <ReactECharts option={classOption} opts={{ renderer: "svg" }} style={{ height: Math.max(280, classNames.length * 32) }} />
        </section>
      ) : null}

      {stats ? (
        <p className="quiet">
          Library: {String(stats.n_molecules)} molecules · {String(stats.n_spectra)} spectra · the fingerprint model is {stats.model_loaded ? "loaded" : "not loaded in this session"}.
        </p>
      ) : null}
      {metrics?.notes ? <p className="quiet">{String(metrics.notes)}</p> : null}
    </div>
  );
}
