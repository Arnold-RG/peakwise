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
      setResult(await simulateMolecule({ smiles, adduct, collision_energy: Number(energy) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  const peaks = (result?.peaks as Array<{ mz: number; intensity: number }>) || [];
  const isotopes = (result?.isotope_pattern as Array<{ mz: number; intensity: number }>) || [];
  const precursor = result?.precursor_mz == null ? undefined : Number(result.precursor_mz);
  const note = result?.note ? String(result.note) : "";

  return (
    <div className="stack-lg">
      <header>
        <p className="kicker">From a structure</p>
        <h1 style={{ marginTop: "0.55rem" }}>Turn a structure into a spectrum</h1>
        <p className="lede" style={{ marginTop: "0.8rem" }}>
          MassSpecGym challenge 3, in miniature: a molecular graph becomes MS/MS peaks through neutral losses and diagnostic ions.
        </p>
      </header>

      <div className="split">
        <form
          className="plate stack"
          onSubmit={(event) => {
            event.preventDefault();
            void run();
          }}
        >
          <div>
            <label className="lbl" htmlFor="sim-smiles">
              SMILES
            </label>
            <textarea id="sim-smiles" className="field" style={{ minHeight: "8rem" }} spellCheck={false} autoCapitalize="off" value={smiles} onChange={(event) => setSmiles(event.target.value)} />
          </div>
          <div className="form-grid">
            <div>
              <label className="lbl" htmlFor="sim-adduct">
                Adduct
              </label>
              <select id="sim-adduct" className="field" value={adduct} onChange={(event) => setAdduct(event.target.value)}>
                {["[M+H]+", "[M+Na]+", "[M-H]-"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="sim-energy">
                Collision energy (eV)
              </label>
              <input id="sim-energy" className="field" inputMode="decimal" value={energy} onChange={(event) => setEnergy(event.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={loading || !smiles.trim()}>
            {loading ? "Drawing…" : "Draw a spectrum from this structure"}
          </button>
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          {note ? <p className="hint">{note}</p> : null}
        </form>

        <div className="stack">
          <SpectrumPlot peaks={peaks} precursorMz={Number.isFinite(precursor) ? precursor : undefined} />
          <div className="pair">
            <section className="plate stack">
              <h2>Predicted structure</h2>
              <MoleculeSvg svg={result?.svg as string} smiles={result ? String(result.smiles || smiles) : smiles} label="Predicted structure" />
              <p className="mono">
                {result?.formula ? String(result.formula) : "—"}
                {precursor != null && Number.isFinite(precursor) ? ` · ${precursor.toFixed(4)}` : ""}
              </p>
            </section>
            <section className="plate stack">
              <h2>MS1 isotope envelope</h2>
              <SpectrumPlot peaks={isotopes} height={180} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
