import { useMemo, useState } from "react";
import { compareMolecules, discoverAnalogs } from "../api";
import { MoleculeSvg } from "../components/MoleculeSvg";

const SEEDS = [
  { name: "Caffeine", smiles: "Cn1cnc2c1c(=O)n(C)c(=O)n2C" },
  { name: "Dopamine", smiles: "NCCc1ccc(O)c(O)c1" },
  { name: "Imatinib", smiles: "Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1" },
  { name: "Serotonin", smiles: "NCCc1c[nH]c2ccc(O)cc12" },
  { name: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
];

export function DiscoverPage() {
  const [smiles, setSmiles] = useState(SEEDS[0].smiles);
  const [goal, setGoal] = useState<"medicine" | "biomarker">("medicine");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [compare, setCompare] = useState<Record<string, unknown> | null>(null);
  const [pair, setPair] = useState<{ query: string; other: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setResult(await discoverAnalogs({ smiles, goal, limit: 10 }));
      setCompare(null);
      setPair(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }

  const analogs = (result?.analogs as Array<Record<string, unknown>>) || [];
  const neighbors = (result?.library_neighbors as Array<Record<string, unknown>>) || [];
  const dl = (result?.query_druglikeness as Record<string, unknown>) || {};
  const scoreKey = goal === "medicine" ? "medicine_score" : "biomarker_score";

  const chips = useMemo(() => {
    return [
      dl.lipinski_pass ? "Lipinski pass" : dl.lipinski_pass === false ? "Lipinski fail" : null,
      dl.metabolite_like ? "Metabolite-like" : null,
      dl.lipid_like ? "Lipid-like" : null,
      dl.sugar_like ? "Sugar-like" : null,
      typeof dl.pains_alerts === "number" ? `${dl.pains_alerts} PAINS alerts` : null,
    ].filter(Boolean) as string[];
  }, [dl]);

  return (
    <div className="stack-lg">
      <header>
        <p className="kicker">Nearby molecules</p>
        <h1 style={{ marginTop: "0.55rem" }}>Close cousins of a known structure</h1>
        <p className="lede" style={{ marginTop: "0.8rem" }}>
          Start from a known structure. Peakwise lists close cousins and scores them as drug-like or biomarker-like.
        </p>
      </header>

      <form
        className="plate stack"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <div className="seeds" role="group" aria-label="Example structures">
          {SEEDS.map((seed) => (
            <button key={seed.name} type="button" className={smiles === seed.smiles ? "seed is-on" : "seed"} aria-pressed={smiles === seed.smiles} onClick={() => setSmiles(seed.smiles)}>
              {seed.name}
            </button>
          ))}
        </div>
        <div>
          <label className="lbl" htmlFor="near-smiles">
            SMILES
          </label>
          <textarea id="near-smiles" className="field" style={{ minHeight: "6rem" }} spellCheck={false} autoCapitalize="off" value={smiles} onChange={(event) => setSmiles(event.target.value)} />
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <div>
            <label className="lbl" htmlFor="near-goal">
              Rank them for
            </label>
            <select id="near-goal" className="field" value={goal} onChange={(event) => setGoal(event.target.value as "medicine" | "biomarker")}>
              <option value="medicine">Medicines</option>
              <option value="biomarker">Biomarkers</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={loading || !smiles.trim()} style={{ alignSelf: "end" }}>
            {loading ? "Listing…" : "List nearby molecules"}
          </button>
        </div>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {result ? (
        <div className="split">
          <aside className="plate stack">
            <p className="kicker">Starting structure</p>
            <MoleculeSvg svg={result.query_svg as string} smiles={String(result.query_smiles || smiles)} label="Starting structure" />
            <p className="mono break-all" style={{ fontSize: "0.82rem" }}>
              {String(result.query_smiles)}
            </p>
            {chips.length ? (
              <div className="chip-row">
                {chips.map((chip) => (
                  <span key={chip} className="chip">
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
            <dl className="spec">
              <div>
                <dt>Medicine</dt>
                <dd>{Number(dl.medicine_score || 0).toFixed(2)}</dd>
              </div>
              <div>
                <dt>Biomarker</dt>
                <dd>{Number(dl.biomarker_score || 0).toFixed(2)}</dd>
              </div>
            </dl>
            {result.notes ? <p className="hint">{String(result.notes)}</p> : null}
          </aside>

          <div className="stack">
            <div className="mol-grid">
              {analogs.map((row) => {
                const inner = (row.druglikeness as Record<string, number>) || {};
                return (
                  <button
                    key={String(row.smiles)}
                    type="button"
                    className="card"
                    onClick={() => {
                      const other = String(row.smiles);
                      const query = String(result.query_smiles);
                      setPair({ query, other });
                      compareMolecules(query, other)
                        .then(setCompare)
                        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not compare those structures"));
                    }}
                  >
                    <MoleculeSvg svg={row.svg as string} smiles={String(row.smiles)} className="mol-compact" decorative />
                    <span className="mono break-all" style={{ fontSize: "0.78rem" }}>
                      {String(row.smiles)}
                    </span>
                    <span>
                      {goal === "medicine" ? "Medicine" : "Biomarker"} score <span className="mono">{Number(inner[scoreKey] ?? row.score).toFixed(2)}</span>
                      {row.is_query ? <span className="quiet"> · starting structure</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            {neighbors.length ? (
              <section className="stack">
                <h2>Nearest library molecules</h2>
                <div className="mol-grid">
                  {neighbors.map((neighbor) => (
                    <div key={String(neighbor.smiles)} className="plate">
                      <p>{String(neighbor.name)}</p>
                      <p className="hint">
                        {String(neighbor.role)} · Tanimoto {Number(neighbor.tanimoto).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {compare && pair ? (
              <section className="plate stack">
                <h2>Compared with the start</h2>
                <div className="pair">
                  <MoleculeSvg smiles={pair.query} label="Starting structure" className="mol-compact" />
                  <MoleculeSvg smiles={pair.other} label="Compared structure" className="mol-compact" />
                </div>
                <p>
                  Fingerprint similarity (Tanimoto) {Number(compare.tanimoto).toFixed(3)} · bond-edit distance (MCES) {String(compare.mces)} · {compare.exact ? "identical structures" : "not the same structure"}
                </p>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
