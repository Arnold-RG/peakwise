import { useEffect, useMemo, useState } from "react";
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
    .filter((peak) => Number.isFinite(peak.mz) && Number.isFinite(peak.intensity));
}

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function hitLabel(value: string) {
  if (value === "known") return "Known library hit";
  if (value === "novel" || value === "analog") return "Close cousin";
  return value;
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
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetchExamples()
      .then(setExamples)
      .catch(() => setExamples([]));
  }, []);

  const peaks = useMemo(() => peaksFromText(peakText), [peakText]);

  function loadExample(example: Record<string, unknown>) {
    const points = (example.peaks as Peak[]) || [];
    setPeakText(points.map((peak) => `${peak.mz} ${peak.intensity}`).join("\n"));
    setPrecursor(String(example.precursor_mz ?? ""));
    setAdduct(String(example.adduct ?? "[M+H]+"));
    setEnergy(String(example.collision_energy ?? 20));
    setFormula("");
    setResult(null);
    setSelected(null);
    setHighlight(undefined);
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
        setHistory((prev) =>
          [{ name: data.predicted_name || "unknown", smiles: data.predicted_smiles as string, confidence: data.confidence }, ...prev].slice(0, 8),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  async function copySmiles(smiles: string) {
    try {
      await navigator.clipboard.writeText(smiles);
      setCopied("Copied");
    } catch {
      setCopied("Select the line and copy it");
    }
  }

  function exportJson() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "peakwise-prediction.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const live = loading
    ? "Naming this spectrum."
    : result
      ? `${result.predicted_name ?? "No name"}, confidence ${result.confidence_label}. ${result.candidates.length} structures ranked.`
      : "";

  return (
    <div className="stack-lg">
      <header>
        <p className="kicker">Identify</p>
        <h1 style={{ marginTop: "0.55rem" }}>Name this spectrum</h1>
        <p className="lede" style={{ marginTop: "0.8rem" }}>
          Paste a peak list, or start from a bundled example. Peakwise ranks chemical structures and tells you why.
        </p>
      </header>

      <div className="sr-only" aria-live="polite">
        {live} {copied}
      </div>

      <div className="kpi-row">
        <KpiCard label="Peaks" value={peaks.length} hint="Normalized on submit" />
        <KpiCard label="Precursor m/z" value={precursor || "—"} hint={adduct} />
        <KpiCard label="Confidence" value={result ? result.confidence.toFixed(2) : "—"} hint={result ? titleCase(result.confidence_label) : undefined} />
        <KpiCard label="Spectrum QC" value={result?.spectrum_quality?.label ? titleCase(result.spectrum_quality.label) : "—"} hint={result?.best_formula || "Run a naming"} />
      </div>

      <div className="work-grid">
        <div className="stack">
          <form
            className="plate stack"
            onSubmit={(event) => {
              event.preventDefault();
              void runPredict();
            }}
          >
            <div>
              <h2>Paste the peak list</h2>
              <p id="peak-hint" className="hint" style={{ marginTop: "0.35rem" }}>
                Two numbers per line: mass, then height. Spaces, commas, or tabs. Ctrl+Enter names the spectrum.
              </p>
            </div>
            <div>
              <label className="lbl" htmlFor="peak-list">
                Peak list
              </label>
              <textarea
                id="peak-list"
                className="field"
                style={{ minHeight: "10rem" }}
                value={peakText}
                aria-describedby="peak-hint"
                spellCheck={false}
                onChange={(event) => setPeakText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                    event.preventDefault();
                    void runPredict();
                  }
                }}
              />
            </div>
            <div className="form-grid">
              <div>
                <label className="lbl" htmlFor="precursor">
                  Precursor m/z
                </label>
                <input id="precursor" className="field" inputMode="decimal" value={precursor} onChange={(event) => setPrecursor(event.target.value)} />
              </div>
              <div>
                <label className="lbl" htmlFor="energy">
                  Collision energy (eV)
                </label>
                <input id="energy" className="field" inputMode="decimal" value={energy} onChange={(event) => setEnergy(event.target.value)} />
              </div>
              <div>
                <label className="lbl" htmlFor="adduct">
                  Adduct
                </label>
                <select id="adduct" className="field" value={adduct} onChange={(event) => setAdduct(event.target.value)}>
                  {["[M+H]+", "[M+Na]+", "[M+NH4]+", "[M+K]+", "[M-H]-", "[M+H-H2O]+"].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="formula">
                  Formula, if you know it
                </label>
                <input id="formula" className="field" placeholder="C8H10N4O2" spellCheck={false} value={formula} onChange={(event) => setFormula(event.target.value)} />
              </div>
            </div>
            <label className="check" htmlFor="use-formula">
              <input id="use-formula" type="checkbox" checked={useFormula} onChange={(event) => setUseFormula(event.target.checked)} />
              <span>Enumerate formulae from the precursor mass</span>
            </label>
            <button type="submit" className="btn-primary" disabled={loading || peaks.length === 0}>
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Naming…
                </>
              ) : (
                "Name this spectrum"
              )}
            </button>
            {error ? (
              <div className="alert" role="alert">
                {error}
              </div>
            ) : null}
            {history.length ? (
              <div>
                <h3>Recent names</h3>
                <ul className="notes">
                  {history.map((item, index) => (
                    <li key={`${item.smiles}-${index}`} className="mono">
                      {item.confidence.toFixed(2)} · {item.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </form>

          <section className="plate stack">
            <h2>Demo spectra</h2>
            <div className="stack" style={{ maxHeight: "22rem", overflow: "auto" }}>
              {examples.map((example) => (
                <button key={String(example.name)} type="button" className="card" onClick={() => loadExample(example)}>
                  <span>{String(example.name)}</span>
                  <span className="mono quiet" style={{ fontSize: "0.8rem" }}>
                    {String(example.formula)} · {String(example.role)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="stack">
          <SpectrumPlot peaks={peaks} precursorMz={precursor ? Number(precursor) : undefined} highlightMz={highlight} height={280} />

          {result ? (
            <div className={selected ? "split" : "stack"}>
              <div className="table-wrap" tabIndex={0}>
                <table className="ledger">
                  <caption>Ranked structures</caption>
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Molecule</th>
                      <th scope="col">Hybrid</th>
                      <th scope="col">Cosine</th>
                      <th scope="col">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.candidates.map((candidate, index) => {
                      const on = selected?.smiles === candidate.smiles;
                      const width = `${Math.max(0, Math.min(100, candidate.hybrid_score * 100))}%`;
                      return (
                        <tr
                          key={candidate.smiles}
                          className={on ? "is-selected" : undefined}
                          tabIndex={0}
                          onClick={() => {
                            setSelected(candidate);
                            setCopied("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelected(candidate);
                              setCopied("");
                            }
                          }}
                        >
                          <td className="mono">
                            {index + 1}
                            {on ? <span className="sr-only">, selected</span> : null}
                          </td>
                          <td>
                            <div>{candidate.name}</div>
                            <div className="mono quiet break-all" style={{ fontSize: "0.78rem", maxWidth: "22rem" }}>
                              {candidate.smiles}
                            </div>
                          </td>
                          <td style={{ minWidth: "7rem" }}>
                            <span className="mono">{candidate.hybrid_score.toFixed(2)}</span>
                            <div className="meter" aria-hidden="true">
                              <span style={{ width }} />
                            </div>
                          </td>
                          <td className="mono">{candidate.spectral_cosine.toFixed(3)}</td>
                          <td>{candidate.source}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selected ? (
                <aside className="plate stack">
                  <div className="row-between">
                    <div>
                      <p className="kicker">Selected</p>
                      <h3 style={{ marginTop: "0.35rem" }}>{selected.name}</h3>
                    </div>
                    <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>
                      Close
                    </button>
                  </div>
                  <MoleculeSvg svg={selected.svg} smiles={selected.smiles} label={selected.name} />
                  <p className="mono break-all" style={{ fontSize: "0.82rem" }}>
                    {selected.smiles}
                  </p>
                  <button type="button" className="btn-ghost" onClick={() => void copySmiles(selected.smiles)}>
                    {copied || "Copy SMILES"}
                  </button>
                  {selected.inchikey ? (
                    <p className="mono quiet break-all" style={{ fontSize: "0.75rem" }} title={selected.inchikey}>
                      {selected.inchikey}
                    </p>
                  ) : null}
                  <dl className="spec">
                    <div>
                      <dt>Formula</dt>
                      <dd>{selected.formula || "—"}</dd>
                    </div>
                    <div>
                      <dt>Fingerprint</dt>
                      <dd>{selected.fingerprint_score.toFixed(3)}</dd>
                    </div>
                    {selected.descriptors ? (
                      <>
                        <div>
                          <dt>Atoms</dt>
                          <dd>{selected.descriptors.n_atoms}</dd>
                        </div>
                        <div>
                          <dt>Rings</dt>
                          <dd>{selected.descriptors.n_rings}</dd>
                        </div>
                        <div>
                          <dt>TPSA</dt>
                          <dd>{selected.descriptors.tpsa}</dd>
                        </div>
                        <div>
                          <dt>logP</dt>
                          <dd>{selected.descriptors.logp}</dd>
                        </div>
                        <div>
                          <dt>H-bond donors</dt>
                          <dd>{selected.descriptors.n_hbd}</dd>
                        </div>
                        <div>
                          <dt>H-bond acceptors</dt>
                          <dd>{selected.descriptors.n_hba}</dd>
                        </div>
                      </>
                    ) : null}
                  </dl>
                  {selected.druglikeness ? (
                    <div className="chip-row">
                      {selected.druglikeness.lipinski_pass ? <span className="chip chip-ok">Lipinski pass</span> : null}
                      {selected.druglikeness.metabolite_like ? <span className="chip">Biomarker-like</span> : null}
                      <span className="chip">Medicine {Number(selected.druglikeness.medicine_score || 0).toFixed(2)}</span>
                    </div>
                  ) : null}
                </aside>
              ) : null}
            </div>
          ) : (
            <div className="plate">
              <p className="quiet">Run a naming to see ranked structures. Caffeine is already in the box if you want a first try.</p>
            </div>
          )}

          {result?.rationale?.length ? (
            <section className="plate">
              <div className="row-between">
                <h2>Why this ranking</h2>
                <span className={result.known_vs_novel === "known" ? "chip chip-ok" : "chip chip-warn"}>{hitLabel(result.known_vs_novel)}</span>
              </div>
              <ul className="notes">
                {result.rationale.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              {result.formula_candidates?.length ? (
                <div className="chip-row" style={{ marginTop: "0.9rem" }}>
                  {result.formula_candidates.map((item) => (
                    <span key={item.formula} className={item.formula === result.best_formula ? "chip is-on" : "chip"}>
                      {item.formula} ({item.ppm} ppm)
                    </span>
                  ))}
                </div>
              ) : null}
              <div style={{ marginTop: "1rem" }}>
                <button type="button" className="btn-ghost" onClick={exportJson}>
                  Export JSON
                </button>
              </div>
            </section>
          ) : null}

          {result && selected?.library_peaks?.length ? (
            <section className="stack">
              <h2>
                Mirror plot · query vs {selected.name}
              </h2>
              <MirrorPlot peaksA={peaks} peaksB={selected.library_peaks} precursorMz={precursor ? Number(precursor) : undefined} labelB={selected.name} />
            </section>
          ) : null}

          {result ? (
            <div className="table-wrap" tabIndex={0}>
              <table className="ledger">
                <caption>Fragment annotations</caption>
                <thead>
                  <tr>
                    <th scope="col">m/z</th>
                    <th scope="col">Intensity</th>
                    <th scope="col">Annotation</th>
                    <th scope="col">Subformula</th>
                    <th scope="col">ppm</th>
                  </tr>
                </thead>
                <tbody>
                  {result.peak_annotations.map((row) => (
                    <tr
                      key={`${row.mz}-${row.annotation}`}
                      tabIndex={0}
                      onClick={() => setHighlight(row.mz)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setHighlight(row.mz);
                        }
                      }}
                    >
                      <td className="mono">{row.mz.toFixed(4)}</td>
                      <td className="mono">{row.intensity.toFixed(3)}</td>
                      <td>{row.annotation}</td>
                      <td className="mono">{row.formula || "—"}</td>
                      <td className="mono">{row.error_ppm == null ? "—" : row.error_ppm.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
