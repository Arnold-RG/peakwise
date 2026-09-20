import { useEffect, useMemo, useState } from "react";
import { Copy, Download, FlaskConical, Loader2, Sparkles, Upload } from "lucide-react";
import { fetchExamples, predictSpectrum, type Candidate, type Peak, type PredictResponse } from "../api";
import { KpiCard } from "../components/KpiCard";
import { MirrorPlot } from "../components/MirrorPlot";
import { MoleculeSvg } from "../components/MoleculeSvg";
import { SpectrumPlot } from "../components/SpectrumPlot";

function peaksFromText(text: string): Peak[] {
  return text
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[\s,]+/))
    .filter((parts) => parts.length >= 2)
    .map((parts) => ({ mz: Number(parts[0]), intensity: Number(parts[1]) }))
    .filter((p) => Number.isFinite(p.mz) && Number.isFinite(p.intensity));
}

export function WorkbenchPage() {
  const [examples, setExamples] = useState<Array<Record<string, unknown>>>([]);
  const [peakText, setPeakText] = useState("138.0662 0.82\n110.0713 0.41\n195.0877 1.00\n83.0604 0.22");
  const [precursor, setPrecursor] = useState("195.0877");
  const [adduct, setAdduct] = useState("[M+H]+");
  const [energy, setEnergy] = useState("20");
  const [formula, setFormula] = useState("");
  const [useFormula, setUseFormula] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [highlight, setHighlight] = useState<number | undefined>();
  const [history, setHistory] = useState<Array<{ name: string; smiles: string; confidence: number }>>([]);

  useEffect(() => {
    fetchExamples()
      .then(setExamples)
      .catch(() => setExamples([]));
  }, []);

  const peaks = useMemo(() => peaksFromText(peakText), [peakText]);

  function loadExample(ex: Record<string, unknown>) {
    const pts = (ex.peaks as Peak[]) || [];
    setPeakText(pts.map((p) => `${p.mz} ${p.intensity}`).join("\n"));
    setPrecursor(String(ex.precursor_mz ?? ""));
    setAdduct(String(ex.adduct ?? "[M+H]+"));
    setEnergy(String(ex.collision_energy ?? 20));
    setFormula("");
    setResult(null);
    setSelected(null);
  }

  async function runPredict() {
    setLoading(true);
    setError(null);
    try {
      const data = await predictSpectrum({
        peaks,
        precursor_mz: precursor ? Number(precursor) : null,
        adduct,
        collision_energy: Number(energy),
        formula: formula || null,
        use_formula: useFormula,
        top_k: 10,
      });
      setResult(data);
      setSelected(data.candidates[0] ?? null);
      if (data.predicted_smiles) {
        setHistory((prev) => [{ name: data.predicted_name || "unknown", smiles: data.predicted_smiles as string, confidence: data.confidence }, ...prev].slice(0, 8));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Peaks" value={peaks.length} hint="Normalized on submit" icon={<Sparkles className="h-4 w-4" />} />
        <KpiCard label="Precursor m/z" value={precursor || "—"} hint={adduct} />
        <KpiCard label="Confidence" value={result ? result.confidence.toFixed(2) : "—"} hint={result?.confidence_label} />
        <KpiCard label="Spectrum QC" value={result?.spectrum_quality?.label || "—"} hint={result?.best_formula || "run a prediction"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-1 space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5">
            <h2 className="font-serif text-2xl">Paste the peak list</h2>
            <p className="text-sm quiet mt-1">Two numbers per line: mass, then height. Or pick a known example below.</p>
            <label className="block text-xs font-medium text-zinc-500 mt-4 mb-1.5">Peak list</label>
            <textarea
              className="w-full h-40 bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              value={peakText}
              onChange={(e) => setPeakText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void runPredict();
                }
              }}
            />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Precursor m/z</label>
                <input className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2 text-sm font-mono" value={precursor} onChange={(e) => setPrecursor(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Collision energy (eV)</label>
                <input className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2 text-sm font-mono" value={energy} onChange={(e) => setEnergy(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Adduct</label>
                <select className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2 text-sm" value={adduct} onChange={(e) => setAdduct(e.target.value)}>
                  {["[M+H]+", "[M+Na]+", "[M+NH4]+", "[M+K]+", "[M-H]-", "[M+H-H2O]+"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Formula (bonus track)</label>
                <input className="w-full bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2 text-sm font-mono" placeholder="C8H10N4O2" value={formula} onChange={(e) => setFormula(e.target.value)} />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={useFormula} onChange={(e) => setUseFormula(e.target.checked)} className="accent-teal-500" />
              Enumerate formulae from precursor mass
            </label>
            <p className="mt-2 text-[11px] text-zinc-500">Tip: Ctrl+Enter predicts. Peak lists accept space, comma, or tab separators.</p>
            <button
              onClick={runPredict}
              disabled={loading || peaks.length === 0}
              className="mt-4 w-full btn-primary"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Naming…</span>
              ) : (
                <span className="inline-flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Name this spectrum</span>
              )}
            </button>
            {error ? <div className="mt-3 rounded-lg border border-rose-200 dark:border-rose-800/30 bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300 p-3 text-sm">{error}</div> : null}
            {history.length ? (
              <div className="mt-4">
                <div className="text-xs text-zinc-500 mb-1">Recent predictions</div>
                <div className="space-y-1">
                  {history.map((h, i) => (
                    <div key={`${h.smiles}-${i}`} className="text-xs font-mono truncate text-zinc-500">
                      {h.confidence.toFixed(2)} · {h.name}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Demo spectra</h3>
              <Upload className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 max-h-72 overflow-auto pr-1">
              {examples.map((ex) => (
                <button
                  key={String(ex.name)}
                  onClick={() => loadExample(ex)}
                  className="text-left rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-3 py-2 transition-colors"
                >
                  <div className="text-sm font-medium">{String(ex.name)}</div>
                  <div className="text-xs text-zinc-500 font-mono">{String(ex.formula)} · {String(ex.role)}</div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="xl:col-span-2 space-y-4">
          <SpectrumPlot peaks={peaks} precursorMz={precursor ? Number(precursor) : undefined} highlightMz={highlight} />
          {result ? (
            <div className={`grid gap-4 transition-all duration-300 ${selected ? "xl:grid-cols-3" : "grid-cols-1"}`}>
              <div className={`${selected ? "xl:col-span-2" : ""} rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] overflow-hidden`}>
                <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Ranked structures</div>
                    <div className="text-xs text-zinc-500">Hybrid of spectral cosine, analog cosine, and predicted Morgan fingerprint</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${result.known_vs_novel === "known" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                    {result.known_vs_novel}
                  </span>
                </div>
                <div className="overflow-auto max-h-[420px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 z-10 text-zinc-500">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Rank</th>
                        <th className="text-left px-4 py-2 font-medium">Molecule</th>
                        <th className="text-left px-4 py-2 font-medium">Hybrid</th>
                        <th className="text-left px-4 py-2 font-medium">Cosine</th>
                        <th className="text-left px-4 py-2 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.candidates.map((cand, idx) => (
                        <tr
                          key={cand.smiles}
                          onClick={() => setSelected(cand)}
                          className={`border-b border-zinc-100 dark:border-zinc-800 cursor-pointer transition-colors ${selected?.smiles === cand.smiles ? "bg-teal-50 dark:bg-teal-900/40" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                        >
                          <td className="px-4 py-3 font-mono text-zinc-500">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{cand.name}</div>
                            <div className="text-xs font-mono text-zinc-500 truncate max-w-[280px]">{cand.smiles}</div>
                          </td>
                          <td className="px-4 py-3 w-32">
                            <div className="h-2 rounded-sm bg-zinc-200 dark:bg-zinc-700">
                              <div className="h-2 rounded-sm bg-teal-500" style={{ width: `${Math.max(8, cand.hybrid_score * 100)}%` }} />
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono">{cand.spectral_cosine.toFixed(3)}</td>
                          <td className="px-4 py-3 text-xs">{cand.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {selected ? (
                <aside className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-zinc-500">Selected candidate</div>
                      <h3 className="text-lg font-semibold">{selected.name}</h3>
                    </div>
                    <button className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => setSelected(null)}>
                      ×
                    </button>
                  </div>
                  <MoleculeSvg svg={selected.svg} className="mt-3 h-44" />
                  <div className="mt-3 font-mono text-xs break-all bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1 flex items-start justify-between gap-2">
                    <span>{selected.smiles}</span>
                    <button
                      className="shrink-0 text-zinc-500 hover:text-teal-600"
                      onClick={() => navigator.clipboard.writeText(selected.smiles)}
                      title="Copy SMILES"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {selected.inchikey ? <div className="mt-1 text-[11px] font-mono text-zinc-500 truncate">{selected.inchikey}</div> : null}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3">
                      <div className="text-xs text-zinc-500">Formula</div>
                      <div className="font-mono">{selected.formula || "—"}</div>
                    </div>
                    <div className="rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3">
                      <div className="text-xs text-zinc-500">Fingerprint</div>
                      <div className="font-mono">{selected.fingerprint_score.toFixed(3)}</div>
                    </div>
                  </div>
                  {selected.descriptors ? (
                    <div className="mt-3 text-xs text-zinc-500 space-y-1">
                      <div>atoms {selected.descriptors.n_atoms} · rings {selected.descriptors.n_rings} · TPSA {selected.descriptors.tpsa}</div>
                      <div>HBD {selected.descriptors.n_hbd} · HBA {selected.descriptors.n_hba} · logP {selected.descriptors.logp}</div>
                    </div>
                  ) : null}
                  {selected.druglikeness ? (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {Boolean(selected.druglikeness.lipinski_pass) ? (
                        <span className="text-[11px] rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">Lipinski</span>
                      ) : null}
                      {Boolean(selected.druglikeness.metabolite_like) ? (
                        <span className="text-[11px] rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-2 py-0.5">biomarker-like</span>
                      ) : null}
                      <span className="text-[11px] rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5">
                        medicine {Number(selected.druglikeness.medicine_score || 0).toFixed(2)}
                      </span>
                    </div>
                  ) : null}
                </aside>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-8 text-zinc-500 text-sm">
              Run a naming to see ranked structures. Start with caffeine if you are unsure — it is already in the box.
            </div>
          )}

          {result?.rationale?.length ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Why this ranking</h3>
                <button
                  className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-teal-600"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "peakwise-prediction.json";
                    a.click();
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Export JSON
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400 list-disc pl-5">
                {result.rationale.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              {result.formula_candidates?.length ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {result.formula_candidates.map((f) => (
                    <span key={f.formula} className={`text-[11px] font-mono rounded-full px-2 py-0.5 border ${f.formula === result.best_formula ? "border-teal-500 text-teal-700 dark:text-ion-400" : "border-zinc-200 dark:border-zinc-700 text-zinc-500"}`}>
                      {f.formula} ({f.ppm} ppm)
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {result && selected?.library_peaks?.length ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5">
              <h3 className="font-semibold mb-3">Mirror plot · query vs {selected.name}</h3>
              <MirrorPlot peaksA={peaks} peaksB={selected.library_peaks} precursorMz={precursor ? Number(precursor) : undefined} />
            </div>
          ) : null}

          {result ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 font-semibold">Fragment annotations</div>
              <div className="overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 z-10 text-zinc-500">
                    <tr>
                      <th className="text-left px-4 py-2">m/z</th>
                      <th className="text-left px-4 py-2">Intensity</th>
                      <th className="text-left px-4 py-2">Annotation</th>
                      <th className="text-left px-4 py-2">Subformula</th>
                      <th className="text-left px-4 py-2">ppm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.peak_annotations.map((row) => (
                      <tr key={`${row.mz}-${row.annotation}`} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer" onClick={() => setHighlight(row.mz)}>
                        <td className="px-4 py-2 font-mono">{row.mz.toFixed(4)}</td>
                        <td className="px-4 py-2 font-mono">{row.intensity.toFixed(3)}</td>
                        <td className="px-4 py-2">{row.annotation}</td>
                        <td className="px-4 py-2 font-mono">{row.formula || "—"}</td>
                        <td className="px-4 py-2 font-mono">{row.error_ppm ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
