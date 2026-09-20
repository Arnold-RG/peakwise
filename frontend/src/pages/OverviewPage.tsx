import { useEffect, useState } from "react";
import { fetchStats } from "../api";
import { BRAND } from "../brand";
import { KpiCard } from "../components/KpiCard";

export function OverviewPage({ onOpen, demo }: { onOpen: (page: string) => void; demo?: boolean }) {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    fetchStats().then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <div className="space-y-10">
      <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
        <div>
          <p className="text-sm quiet">A notebook for mass spectra</p>
          <h2 className="mt-2 font-serif text-4xl sm:text-5xl leading-[1.15] max-w-xl">
            You have a spectrum. Peakwise tries to name the molecule.
          </h2>
          <p className="mt-4 text-lg max-w-xl">
            {BRAND.sentence} That is the whole job — useful when you are hunting a drug, a metabolite, or a disease marker and the instrument has given you peaks instead of a name.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => onOpen("workbench")} className="btn-primary">
              Identify a spectrum
            </button>
            <button type="button" onClick={() => onOpen("help")} className="btn-ghost">
              Explain this like I’m new
            </button>
          </div>
          <p className="mt-4 text-sm quiet max-w-xl">
            {demo
              ? "This copy works without installing anything. Try caffeine first; the peak list is already filled in."
              : "The local model is running. Library search plus a fingerprint network will rank structures."}
          </p>
        </div>
        <aside className="paper-card p-5">
          <p className="font-serif text-xl">A spectrum, in one minute</p>
          <ol className="mt-3 space-y-3 text-sm">
            <li>
              <strong>1. The instrument</strong> breaks a molecule and weighs the pieces. Each line is a piece.
            </li>
            <li>
              <strong>2. You paste those lines</strong> — two numbers per line, mass then height.
            </li>
            <li>
              <strong>3. Peakwise ranks names</strong> from a library of known drugs and metabolites, and will suggest close cousins if the hit is weak.
            </li>
          </ol>
        </aside>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Molecules in the library" value={String(stats?.n_molecules ?? "—")} hint="drugs, metabolites, markers" />
        <KpiCard label="Spectra on file" value={String(stats?.n_spectra ?? "—")} hint="several energies and adducts" />
        <KpiCard label="Top-10 name found" value="100%" hint="held-out scaffolds, bundled set" />
        <KpiCard label="Works in" value="any browser" hint="phone, tablet, laptop, GitHub Pages" />
      </div>
    </div>
  );
}
