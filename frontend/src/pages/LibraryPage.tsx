import { useEffect, useState } from "react";
import { fetchLibrary, fetchLibraryItem } from "../api";
import { MoleculeSvg } from "../components/MoleculeSvg";
import { SpectrumPlot } from "../components/SpectrumPlot";

export function LibraryPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState("");
  const [data, setData] = useState<{ items: Array<Record<string, unknown>>; roles: string[] }>({ items: [], roles: [] });
  const [active, setActive] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchLibrary({ q: debounced || undefined, role: role || undefined, limit: 80 })
      .then((next) => {
        if (!cancel) setData(next);
      })
      .catch(() => {
        if (!cancel) setData({ items: [], roles: [] });
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [debounced, role]);

  async function openItem(name: string) {
    setError(null);
    try {
      setActive(await fetchLibraryItem(name));
    } catch (err) {
      setActive(null);
      setError(err instanceof Error ? err.message : "That molecule is not in this library.");
    }
  }

  const spectra = (active?.spectra as Array<Record<string, unknown>>) || [];
  const first = spectra[0];

  return (
    <div className="stack-lg">
      <header>
        <p className="kicker">Library</p>
        <h1 style={{ marginTop: "0.55rem" }}>Molecules on file</h1>
        <p className="lede" style={{ marginTop: "0.8rem" }}>
          Browse the bundled drugs, metabolites, and markers. Open one to see a spectrum beside the structure.
        </p>
      </header>

      <div className={`lib-layout ${active ? "is-open" : ""}`}>
        <div className="list-hide stack">
          <form className="form-grid" role="search" onSubmit={(event) => event.preventDefault()}>
            <div className="span-2">
              <label className="lbl" htmlFor="lib-q">
                Search name, SMILES, or formula
              </label>
              <input id="lib-q" className="field" value={query} autoComplete="off" spellCheck={false} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div>
              <label className="lbl" htmlFor="lib-role">
                Role
              </label>
              <select id="lib-role" className="field" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="">All roles</option>
                {data.roles.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
          </form>
          {error ? (
            <p className="alert" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? <p className="quiet">Looking through the library…</p> : null}
          {!loading && data.items.length === 0 ? <p className="quiet">Nothing in the library matches that.</p> : null}
          <div className={`mol-grid ${active ? "" : "roomy"}`}>
            {data.items.map((item) => (
              <button key={String(item.smiles)} type="button" className="card" onClick={() => void openItem(String(item.name))}>
                <MoleculeSvg svg={item.svg as string} smiles={String(item.smiles)} className="mol-compact" decorative />
                <span>{String(item.name)}</span>
                <span className="mono quiet" style={{ fontSize: "0.8rem" }}>
                  {String(item.formula)}
                </span>
                <span className="quiet" style={{ fontSize: "0.85rem" }}>
                  {String(item.molecule_class)} · {String(item.role)} · {String(item.split)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {active ? (
          <aside className="plate stack detail">
            <div className="row-between">
              <h2>{String(active.name)}</h2>
              <button type="button" className="btn-ghost" onClick={() => setActive(null)}>
                Close
              </button>
            </div>
            <MoleculeSvg svg={active.svg as string} smiles={String(active.smiles)} label={String(active.name)} />
            <p className="mono break-all" style={{ fontSize: "0.82rem" }}>
              {String(active.smiles)}
            </p>
            <p className="quiet">
              {String(active.formula)} · {String(active.role)}
            </p>
            {first ? (
              <div className="stack">
                <SpectrumPlot peaks={(first.peaks as Array<{ mz: number; intensity: number }>) || []} precursorMz={Number(first.precursor_mz)} height={180} />
                <p className="hint">
                  {spectra.length} spectra · {String(first.adduct)} · {String(first.collision_energy)} eV
                </p>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
