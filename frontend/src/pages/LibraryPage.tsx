import { useEffect, useState } from "react";
import { fetchLibrary, fetchLibraryItem } from "../api";
import { MoleculeSvg } from "../components/MoleculeSvg";
import { SpectrumPlot } from "../components/SpectrumPlot";

export function LibraryPage() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [data, setData] = useState<{ items: Array<Record<string, unknown>>; roles: string[] }>({ items: [], roles: [] });
  const [active, setActive] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetchLibrary({ q: query || undefined, role: role || undefined, limit: 80 }).then(setData).catch(() => setData({ items: [], roles: [] }));
  }, [query, role]);

  async function openItem(name: string) {
    const item = await fetchLibraryItem(name);
    setActive(item);
  }

  const spectra = (active?.spectra as Array<Record<string, unknown>>) || [];
  const first = spectra[0];

  return (
    <div className={`flex gap-6 transition-all duration-300 ${active ? "" : ""}`}>
      <div className={active ? "w-2/3" : "w-full"}>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, SMILES, formula"
            className="flex-1 min-w-[220px] bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2 text-sm"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-white dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded-[8px] px-3 py-2 text-sm">
            <option value="">All roles</option>
            {data.roles.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.items.map((item) => (
            <button
              key={String(item.smiles)}
              onClick={() => openItem(String(item.name))}
              className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
            >
              <MoleculeSvg svg={item.svg as string} className="h-32" />
              <div className="mt-2 font-medium">{String(item.name)}</div>
              <div className="text-xs font-mono text-zinc-500">{String(item.formula)}</div>
              <div className="mt-2 text-xs text-zinc-500">{String(item.molecule_class)} · {String(item.role)} · {String(item.split)}</div>
            </button>
          ))}
        </div>
      </div>
      {active ? (
        <aside className="w-1/3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0c0c0f] p-5 h-fit sticky top-6">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">{String(active.name)}</h2>
            <button onClick={() => setActive(null)}>×</button>
          </div>
          <MoleculeSvg svg={active.svg as string} className="h-40 mt-3" />
          <div className="mt-3 text-xs font-mono break-all bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1">{String(active.smiles)}</div>
          {first ? (
            <div className="mt-4">
              <SpectrumPlot
                peaks={(first.peaks as Array<{ mz: number; intensity: number }>) || []}
                precursorMz={Number(first.precursor_mz)}
                height={180}
              />
              <div className="mt-2 text-xs text-zinc-500">
                {spectra.length} spectra · {String(first.adduct)} · {String(first.collision_energy)} eV
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}
