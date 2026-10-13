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

  return (
    <div className="stack-lg">
      <section className="mast">
        <div className="mast-copy">
          <p className="kicker">A notebook for mass spectra</p>
          <h1>You have a spectrum. Peakwise tries to name the molecule.</h1>
          <div className="double-rule" aria-hidden="true" />
          <p className="lede" style={{ marginTop: "1.15rem" }}>
            {BRAND.sentence} That is the whole job — useful when you are hunting a drug, a metabolite, or a disease marker and the instrument has given you peaks instead of a name.
          </p>
          <div className="actions">
            <button type="button" className="btn-primary" onClick={() => onOpen("workbench")}>
              Identify a spectrum
            </button>
            <button type="button" className="btn-ghost" onClick={() => onOpen("help")}>
              Explain this like I’m new
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
          <figcaption>Caffeine · [M+H]+ · 20 eV. This list is already filled in on Identify.</figcaption>
        </figure>
        <ol className="steps">
          <li>
            <span className="step-no">1</span>
            <p>
              <strong>The instrument</strong> breaks a molecule and weighs the pieces. Each line is a piece.
            </p>
          </li>
          <li>
            <span className="step-no">2</span>
            <p>
              <strong>You paste those lines</strong> — two numbers per line, mass then height.
            </p>
          </li>
          <li>
            <span className="step-no">3</span>
            <p>
              <strong>Peakwise ranks names</strong> from a library of known drugs and metabolites, and will suggest close cousins if the hit is weak.
            </p>
          </li>
        </ol>
      </section>

      <section className="plate stat-strip" aria-label="Library figures">
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
          <p className="stat-value" style={{ fontSize: "clamp(1.35rem, 1rem + 0.6vw, 1.85rem)" }}>
            any browser
          </p>
          <p className="stat-label">Works in</p>
          <p className="stat-hint">phone, tablet, laptop, GitHub Pages</p>
        </div>
      </section>
    </div>
  );
}
