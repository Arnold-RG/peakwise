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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setResult(await discoverAnalogs({ smiles, goal, limit: 10 }));
      setCompare(null);
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
      dl.lipinski_pass ? "Lipinski pass" : "Lipinski fail",
      dl.metabolite_like ? "metabolite-like" : null,
      dl.lipid_like ? "lipid-like" : null,
      dl.sugar_like ? "sugar-like" : null,
      typeof dl.pains_alerts === "number" ? `${dl.pains_alerts} PAINS alerts` : null,
    ].filter(Boolean) as string[];
  }, [dl]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5 space-y-3">
        <h2 className="font-serif text-2xl">Nearby molecules</h2>
        <p className="text-sm quiet mt-1">
          Start from a known structure. Peakwise lists close cousins and scores them as drug-like or biomarker-like.
        </p>
        <div className="flex flex-wrap gap-2">
          {SEEDS.map((seed) => (
            <button
              key={seed.name}
              onClick={() => setSmiles(seed.smiles)}
              className="text-xs rounded-full border border-zinc-200 dark:border-zinc-700 px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {seed.name}
            </button>
          ))}
        </div>
        <textarea
          className="w-full h-20 font-mono text-sm bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2"
          value={smiles}
          onChange={(e) => setSmiles(e.target.value)}
        />
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value as "medicine" | "biomarker")}
            className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2 text-sm"
          >
            <option value="medicine">Rank for medicines</option>
            <option value="biomarker">Rank for biomarkers</option>
          </select>
          <button onClick={run} disabled={loading} className="btn-primary">
            {loading ? "Working…" : "List nearby molecules"}
          </button>
        </div>
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-900/20 text-rose-300 p-3 text-sm">{error}</div> : null}
      </div>

      {result ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <aside className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Query</div>
            <MoleculeSvg svg={result.query_svg as string} className="h-44 mt-2" />
            <div className="mt-2 font-mono text-xs break-all">{String(result.query_smiles)}</div>
            <div className="mt-3 flex flex-wrap gap-1">
              {chips.map((c) => (
                <span key={c} className="text-[11px] rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 px-2 py-0.5">
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-xs text-zinc-500">Medicine</div>
                <div className="font-mono">{Number(dl.medicine_score || 0).toFixed(2)}</div>
              </div>
              <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-xs text-zinc-500">Biomarker</div>
                <div className="font-mono">{Number(dl.biomarker_score || 0).toFixed(2)}</div>
              </div>
            </div>
          </aside>
          <section className="xl:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {analogs.map((row) => {
                const inner = (row.druglikeness as Record<string, number>) || {};
                return (
                  <button
                    key={String(row.smiles)}
                    onClick={async () => setCompare(await compareMolecules(String(result.query_smiles), String(row.smiles)))}
                    className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <MoleculeSvg svg={row.svg as string} className="h-32" />
                    <div className="mt-2 text-xs font-mono truncate">{String(row.smiles)}</div>
                    <div className="mt-1 text-sm">
                      {goal} score <span className="font-mono">{Number(inner[scoreKey] ?? row.score).toFixed(2)}</span>
                      {row.is_query ? <span className="ml-2 text-xs text-teal-600">query</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
            {neighbors.length ? (
              <div>
                <h3 className="font-semibold mb-2">Nearest library molecules</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {neighbors.map((n) => (
                    <div key={String(n.smiles)} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
                      <div className="text-sm font-medium">{String(n.name)}</div>
                      <div className="text-xs text-zinc-500">{String(n.role)} · Tanimoto {Number(n.tanimoto).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {compare ? (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 text-sm">
                Pairwise vs query: Tanimoto {Number(compare.tanimoto).toFixed(3)} · MCES {String(compare.mces)} · exact {String(compare.exact)}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
