import { useEffect, useState } from "react";
import { fetchStats } from "../api";
import { BRAND } from "../brand";
import { SpectrumPlot } from "../components/SpectrumPlot";

const CAFFEINE = [
  { mz: 83.0604, intensity: 0.22 },
  { mz: 110.0713, intensity: 0.41 },
  { mz: 138.0662, intensity: 0.82 },
  { mz: 195.0877, intensity: 1 },
];

export function OverviewPage({ onOpen, demo }: { onOpen: (page: string) => void; demo?: boolean }) {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    const nodes = document.querySelectorAll(".reveal");
    if (typeof IntersectionObserver === "undefined") {
      nodes.forEach((node) => node.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        }
      },
      { threshold: 0.15 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [stats]);

  return (
    <div className="stack-lg">
      <section className="mast">
        <div className="mast-copy">
          <p className="hero-brand">{BRAND.name}</p>
          <p className="kicker" style={{ marginTop: "1rem" }}>
            LC-MS/MS → ranked SMILES
          </p>
          <h1 style={{ marginTop: "0.65rem", fontSize: "clamp(1.55rem, 1.1rem + 1.2vw, 2.15rem)", fontWeight: 600, maxWidth: "28ch" }}>
            Lab-instrument precision for naming the molecule in your spectrum.
          </h1>
          <div className="accent-bar" aria-hidden="true" />
          <p className="lede" style={{ marginTop: "1.15rem" }}>
            {BRAND.sentence} Paste peaks, run analysis, read the ranked structures — Input → Analysis → Ranked.
          </p>
          <div className="actions">
            <button type="button" className="btn-primary" onClick={() => onOpen("workbench")}>
              Open Identify
            </button>
            <button type="button" className="btn-ghost" onClick={() => onOpen("help")}>
              Plain English
            </button>
          </div>
          <p className="hint" style={{ marginTop: "1rem", maxWidth: "36rem" }}>
            {demo
              ? "This copy works without installing anything. Try caffeine first; the peak list is already filled in."
              : "The local model is running. Library search plus a fingerprint network will rank structures."}
          </p>
        </div>
        <figure className="plate mast-plot">
          <SpectrumPlot peaks={CAFFEINE} precursorMz={195.0877} height={280} />
          <figcaption>Caffeine · [M+H]+ · 20 eV · precursor 195.0877</figcaption>
        </figure>
        <ol className="steps">
          <li>
            <span className="step-no">01</span>
            <p>
              <strong>Input</strong> — paste m/z and intensity lines from the instrument.
            </p>
          </li>
          <li>
            <span className="step-no">02</span>
            <p>
              <strong>Analysis</strong> — Peakwise scores library hits and fingerprint candidates.
            </p>
          </li>
          <li>
            <span className="step-no">03</span>
            <p>
              <strong>Ranked structures</strong> — review SMILES, confidence, and fragment rationale.
            </p>
          </li>
        </ol>
      </section>

      <section className="plate stat-strip reveal" aria-label="Library figures">
        <div>
          <p className="stat-value">{String(stats?.n_molecules ?? "—")}</p>
          <p className="stat-label">Molecules in the library</p>
          <p className="stat-hint">drugs, metabolites, markers</p>
        </div>
        <div>
          <p className="stat-value">{String(stats?.n_spectra ?? "—")}</p>
          <p className="stat-label">Spectra on file</p>
          <p className="stat-hint">several energies and adducts</p>
        </div>
        <div>
          <p className="stat-value">100%</p>
          <p className="stat-label">Top-10 name found</p>
          <p className="stat-hint">held-out scaffolds, bundled set</p>
        </div>
        <div>
          <p className="stat-value" style={{ fontSize: "clamp(1.25rem, 1rem + 0.5vw, 1.7rem)", color: "var(--ink)" }}>
            any browser
          </p>
          <p className="stat-label">Works in</p>
          <p className="stat-hint">phone, tablet, laptop, GitHub Pages</p>
        </div>
      </section>
    </div>
  );
}
