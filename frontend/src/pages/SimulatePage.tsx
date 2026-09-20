import { useState } from "react";
import { simulateMolecule } from "../api";
import { MoleculeSvg } from "../components/MoleculeSvg";
import { SpectrumPlot } from "../components/SpectrumPlot";

export function SimulatePage() {
  const [smiles, setSmiles] = useState("Cn1cnc2c1c(=O)n(C)c(=O)n2C");
  const [adduct, setAdduct] = useState("[M+H]+");
  const [energy, setEnergy] = useState("20");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const data = await simulateMolecule({ smiles, adduct, collision_energy: Number(energy) });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  const peaks = (result?.peaks as Array<{ mz: number; intensity: number }>) || [];
  const isotopes = (result?.isotope_pattern as Array<{ mz: number; intensity: number }>) || [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5 space-y-3">
        <h2 className="font-serif text-2xl">Turn a structure into a spectrum</h2>
        <p className="text-sm text-zinc-500">MassSpecGym challenge 3: molecular graph → MS/MS peaks via CID neutral losses and diagnostic ions.</p>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">SMILES</label>
        <textarea className="w-full h-28 font-mono text-sm bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2" value={smiles} onChange={(e) => setSmiles(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <select className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2 text-sm" value={adduct} onChange={(e) => setAdduct(e.target.value)}>
            {["[M+H]+", "[M+Na]+", "[M-H]-"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <input className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2 text-sm font-mono" value={energy} onChange={(e) => setEnergy(e.target.value)} />
        </div>
        <button onClick={run} disabled={loading} className="w-full btn-primary">
          {loading ? "Working…" : "Draw a spectrum from this structure"}
        </button>
        {error ? <div className="rounded-lg border border-rose-200 dark:border-rose-800/30 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300 p-3 text-sm">{error}</div> : null}
      </section>
      <section className="xl:col-span-2 space-y-4">
        <SpectrumPlot peaks={peaks} precursorMz={result ? Number(result.precursor_mz) : undefined} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5">
            <div className="text-sm text-zinc-500">Predicted structure</div>
            <MoleculeSvg svg={result?.svg as string} className="h-48 mt-2" />
            <div className="mt-2 text-sm font-mono">{result ? String(result.formula) : "—"} · {result ? Number(result.precursor_mz).toFixed(4) : ""}</div>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5">
            <div className="text-sm text-zinc-500 mb-2">MS1 isotope envelope</div>
            <SpectrumPlot peaks={isotopes} height={180} />
          </div>
        </div>
      </section>
    </div>
  );
}
