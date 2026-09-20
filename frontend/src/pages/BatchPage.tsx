import { useState } from "react";
import { uploadBatch } from "../api";

const SAMPLE_MGF = `BEGIN IONS
TITLE=Caffeine
PEPMASS=195.0877
ADDUCT=[M+H]+
COLLISION_ENERGY=20
138.0662 82
110.0713 41
195.0877 100
83.0604 22
END IONS

BEGIN IONS
TITLE=Ibuprofen
PEPMASS=207.1380
ADDUCT=[M+H]+
COLLISION_ENERGY=20
161.1325 90
119.0855 55
207.1380 100
END IONS
`;

export function BatchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await uploadBatch(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch failed");
    } finally {
      setLoading(false);
    }
  }

  function useSample() {
    const blob = new File([SAMPLE_MGF], "demo.mgf", { type: "text/plain" });
    setFile(blob);
  }

  const rows = (result?.results as Array<Record<string, unknown>>) || [];

  function exportCsv() {
    const header = "name,predicted_name,predicted_smiles,formula,confidence\n";
    const body = rows.map((r) => [r.name, r.predicted_name, r.predicted_smiles, r.best_formula, r.confidence].join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "peakwise-batch.csv";
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5">
        <h2 className="font-serif text-2xl">Name many spectra at once</h2>
        <p className="text-sm text-zinc-500 mt-1">Upload MGF, MSP, JSON, or a peak-list text file. Up to 40 spectra per request.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          <button onClick={useSample} className="bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-700 rounded-[8px] px-4 py-2 text-sm">Use sample MGF</button>
          <button onClick={run} disabled={!file || loading} className="btn-primary">{loading ? "Working…" : "Name the file"}</button>
          {rows.length ? <button onClick={exportCsv} className="bg-white dark:bg-[#262626] border border-zinc-200 dark:border-zinc-700 rounded-[8px] px-4 py-2 text-sm">Export CSV</button> : null}
        </div>
        {file ? <div className="mt-2 text-xs text-zinc-500 font-mono">{file.name} · {(file.size / 1024).toFixed(1)} KB</div> : null}
        {error ? <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800/30 text-rose-800 dark:text-rose-300 p-3 text-sm">{error}</div> : null}
      </div>
      <div className="rounded-[12px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900 z-10 text-zinc-500">
            <tr>
              <th className="text-left px-4 py-2">Query</th>
              <th className="text-left px-4 py-2">Predicted</th>
              <th className="text-left px-4 py-2">SMILES</th>
              <th className="text-left px-4 py-2">Formula</th>
              <th className="text-left px-4 py-2">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-3">{String(row.name)}</td>
                <td className="px-4 py-3">{String(row.predicted_name || row.error || "—")}</td>
                <td className="px-4 py-3 font-mono text-xs truncate max-w-xs">{String(row.predicted_smiles || "")}</td>
                <td className="px-4 py-3 font-mono">{String(row.best_formula || "")}</td>
                <td className="px-4 py-3 font-mono">{row.confidence != null ? Number(row.confidence).toFixed(2) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <div className="p-8 text-sm text-zinc-500">No batch results yet.</div> : null}
      </div>
    </div>
  );
}
