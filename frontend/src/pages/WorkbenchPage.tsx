import { useEffect, useMemo, useState } from "react";
import { fetchExamples, predictSpectrum, type Candidate, type Peak, type PredictResponse } from "../api";
import { KpiCard } from "../components/KpiCard";
import { MirrorPlot } from "../components/MirrorPlot";
import { MoleculeSvg } from "../components/MoleculeSvg";
import { SpectrumPlot } from "../components/SpectrumPlot";

const MAX_PEAK_CHARS = 200_000;
const MAX_PEAKS = 5_000;
const MAX_FORMULA = 64;

function peaksFromText(text: string): Peak[] {
  return text
    .slice(0, MAX_PEAK_CHARS)
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[\s,]+/))
    .filter((parts) => parts.length >= 2)
    .map((parts) => ({ mz: Number(parts[0]), intensity: Number(parts[1]) }))
    .filter((peak) => Number.isFinite(peak.mz) && Number.isFinite(peak.intensity) && peak.mz > 0 && peak.intensity >= 0)
    .slice(0, MAX_PEAKS);
}

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function hitLabel(value: string) {
  if (value === "known") return "Known library hit";
  if (value === "novel" || value === "analog") return "Close cousin";
  return value;
}

function sanitizeFormula(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").slice(0, MAX_FORMULA);
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
    setPeakText(points.map((peak) => `${peak.mz} ${peak.intensity}`).join("\n").slice(0, MAX_PEAK_CHARS));
    setPrecursor(String(example.precursor_mz ?? ""));
    setAdduct(String(example.adduct ?? "[M+H]+"));
    setEnergy(String(example.collision_energy ?? 20));
    setFormula("");
    setResult(null);
    setSelected(null);
    setHighlight(undefined);
  }

  async function runPredict() {
    if (peaks.length === 0) {
      setError("Add at least one valid peak line (m/z intensity).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await predictSpectrum({
        peaks,
        precursor_mz: precursor ? Number(precursor) : null,
        adduct,
        collision_energy: Number(energy),
        formula: formula ? sanitizeFormula(formula) : null,
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
          Input peaks, run analysis, then review ranked structures — the instrument workflow, on screen.
        </p>
      </header>

      <div className="sr-only" aria-live="polite">
        {live} {copied}
      </div>

      <div className="kpi-row">
        <KpiCard label="Peaks" value={peaks.length} hint="Normalized on submit" />
        <KpiCard label="Precursor m/z" value={precursor || "—"} hint={adduct} />
        <KpiCard label="Confidence" value={result ? result.confidence.toFixed(2) : "—"} hint={result ? titleCase(result.confidence_label) : undefined} />
        <KpiCard label="Spectrum QC" value={result?.spectrum_quality?.label ? titleCase(result.spectrum_quality.label) : "—"} hint={result?.best_formula || "Run analysis"} />
      </div>

      <div className="flow-sections">
        <section className="flow-section" aria-labelledby="flow-input">
          <div className="flow-head">
            <span className="flow-index">01 · Input</span>
            <h2 id="flow-input" className="flow-title">
              Peak list
            </h2>
            <span className="flow-rule" aria-hidden="true" />
          </div>
          <div className="work-grid">
            <form
              className="plate stack"
              onSubmit={(event) => {
                event.preventDefault();
                void runPredict();
              }}
            >
              <p id="peak-hint" className="hint">
                Two numbers per line: mass, then height. Spaces, commas, or tabs. Ctrl+Enter runs analysis.
              </p>
              <div>
                <label className="lbl" htmlFor="peak-list">
                  Peak list
                </label>
                <textarea
                  id="peak-list"
                  className="field"
                  style={{ minHeight: "10rem" }}
                  value={peakText}
                  maxLength={MAX_PEAK_CHARS}
                  aria-describedby="peak-hint"
                  spellCheck={false}
                  onChange={(event) => setPeakText(event.target.value.slice(0, MAX_PEAK_CHARS))}
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
                  <input id="precursor" className="field" inputMode="decimal" maxLength={32} value={precursor} onChange={(event) => setPrecursor(event.target.value)} />
                </div>
                <div>
                  <label className="lbl" htmlFor="energy">
                    Collision energy (eV)
                  </label>
                  <input id="energy" className="field" inputMode="decimal" maxLength={16} value={energy} onChange={(event) => setEnergy(event.target.value)} />
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
                  <input
                    id="formula"
                    className="field"
                    placeholder="C8H10N4O2"
                    spellCheck={false}
                    maxLength={MAX_FORMULA}
                    value={formula}
                    onChange={(event) => setFormula(sanitizeFormula(event.target.value))}
                  />
                </div>
              </div>
              <label className="check" htmlFor="use-formula">
                <input id="use-formula" type="checkbox" checked={useFormula} onChange={(event) => setUseFormula(event.target.checked)} />
                <span>Enumerate formulae from the precursor mass</span>
              </label>
              <button type="submit" className="btn-primary" disabled={loading || peaks.length === 0}>
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Analyzing…
                  </>
                ) : (
                  "Run analysis"
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
              <h3>Demo spectra</h3>
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
        </section>

        <section className="flow-section" aria-labelledby="flow-analysis">
          <div className="flow-head">
            <span className="flow-index">02 · Analysis</span>
            <h2 id="flow-analysis" className="flow-title">
              Spectrum view
            </h2>
            <span className="flow-rule" aria-hidden="true" />
          </div>
          <SpectrumPlot peaks={peaks} precursorMz={precursor ? Number(precursor) : undefined} highlightMz={highlight} height={280} />
          {result?.rationale?.length ? (
            <section className="plate" style={{ marginTop: "1rem" }}>
              <div className="row-between">
                <h3>Why this ranking</h3>
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
            <section className="stack" style={{ marginTop: "1rem" }}>
              <h3>
                Mirror plot · query vs {selected.name}
              </h3>
              <MirrorPlot peaksA={peaks} peaksB={selected.library_peaks} precursorMz={precursor ? Number(precursor) : undefined} labelB={selected.name} />
            </section>
          ) : null}
        </section>

        <section className="flow-section" aria-labelledby="flow-ranked">
          <div className="flow-head">
            <span className="flow-index">03 · Ranked structures</span>
            <h2 id="flow-ranked" className="flow-title">
              Candidates
            </h2>
            <span className="flow-rule" aria-hidden="true" />
          </div>

          {result ? (
            <div className="stack">
              <div className="rank-cards">
                {result.candidates.map((candidate, index) => {
                  const on = selected?.smiles === candidate.smiles;
                  return (
                    <button
                      key={candidate.smiles}
                      type="button"
                      className={`card result-card ${on ? "is-on" : ""}`}
                      onClick={() => {
                        setSelected(candidate);
                        setCopied("");
                      }}
                    >
                      <div className="row-between">
                        <span className="mono quiet">#{index + 1}</span>
                        <span className="mono" style={{ color: "var(--teal)" }}>
                          {candidate.hybrid_score.toFixed(2)}
                        </span>
                      </div>
                      <strong>{candidate.name}</strong>
                      <span className="mono quiet break-all" style={{ fontSize: "0.75rem" }}>
                        {candidate.smiles}
                      </span>
                      <div className="meter" aria-hidden="true">
                        <span style={{ width: `${Math.max(0, Math.min(100, candidate.hybrid_score * 100))}%` }} />
                      </div>
                      <span className="hint" style={{ fontSize: "0.8rem" }}>
                        cosine {candidate.spectral_cosine.toFixed(3)} · {candidate.source}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className={selected ? "split" : "stack"}>
                <div className="table-wrap" tabIndex={0}>
                  <table className="ledger">
                    <caption>Ranked table</caption>
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
                            key={`row-${candidate.smiles}`}
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
                  <aside className="plate stack detail">
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
            </div>
          ) : (
            <div className="plate">
              <p className="quiet">Run analysis to see ranked structures with subtle motion on each card. Caffeine is already in the input if you want a first try.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
