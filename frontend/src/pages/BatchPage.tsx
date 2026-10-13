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

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function BatchPage({ demo = false }: { demo?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!file) return;
    if (demo) {
      setError("Naming a whole file needs the local Peakwise API. On the public site, use Identify for one spectrum.");
      return;
    }
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
    setFile(new File([SAMPLE_MGF], "demo.mgf", { type: "text/plain" }));
    setError(null);
  }

  const rows = (result?.results as Array<Record<string, unknown>>) || [];

  function exportCsv() {
    const header = ["name", "predicted_name", "predicted_smiles", "formula", "confidence"];
    const body = rows.map((row) => [row.name, row.predicted_name, row.predicted_smiles, row.best_formula, row.confidence].map(csvCell).join(","));
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "peakwise-batch.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack-lg">
      <header>
        <p className="kicker">Many spectra</p>
        <h1 style={{ marginTop: "0.55rem" }}>Name a file of spectra</h1>
        <p className="lede" style={{ marginTop: "0.8rem" }}>
          Upload MGF, MSP, JSON, or a peak-list text file. Up to 40 spectra per request. The public site names one spectrum at a time; a whole file needs the local API.
        </p>
      </header>

      <form
        className="plate stack"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <div className="actions" style={{ marginTop: 0 }}>
          <label className="btn-ghost file">
            Choose a file
            <input
              type="file"
              accept=".mgf,.msp,.json,.txt,text/plain,application/json"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button type="button" className="btn-ghost" onClick={useSample}>
            Use sample MGF
          </button>
          <button type="submit" className="btn-primary" disabled={!file || loading}>
            {loading ? "Naming…" : "Name the file"}
          </button>
          {rows.length ? (
            <button type="button" className="btn-ghost" onClick={exportCsv}>
              Export CSV
            </button>
          ) : null}
        </div>
        {file ? (
          <p className="mono hint">
            {file.name} · {(file.size / 1024).toFixed(1)} KB
          </p>
        ) : (
          <p className="hint">The sample file holds caffeine and ibuprofen, so you can see the shape of an MGF before you upload your own.</p>
        )}
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      <div className="table-wrap" tabIndex={0}>
        <table className="ledger">
          <caption>Named spectra</caption>
          <thead>
            <tr>
              <th scope="col">Query</th>
              <th scope="col">Predicted</th>
              <th scope="col">SMILES</th>
              <th scope="col">Formula</th>
              <th scope="col">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${String(row.name)}-${index}`}>
                <td>{String(row.name)}</td>
                <td>{String(row.predicted_name || row.error || "—")}</td>
                <td className="mono break-all" style={{ fontSize: "0.78rem", maxWidth: "18rem" }}>
                  {String(row.predicted_smiles || "")}
                </td>
                <td className="mono">{String(row.best_formula || "")}</td>
                <td className="mono">{row.confidence != null ? Number(row.confidence).toFixed(2) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p style={{ padding: "1.2rem 0.9rem" }} className="quiet">No file has been named yet.</p> : null}
      </div>
    </div>
  );
}
