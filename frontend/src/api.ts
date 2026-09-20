import axios from "axios";
import { DEMO_METRICS, DEMO_STATS, demoPredict, loadDemoExamples } from "./demo";

export const api = axios.create({
  baseURL: "/api",
  timeout: 8000,
});

export type Peak = { mz: number; intensity: number };

export type Candidate = {
  name: string;
  smiles: string;
  formula: string | null;
  molecule_class?: string;
  role?: string;
  split?: string;
  is_novel?: boolean;
  precursor_mz?: number;
  adduct?: string;
  collision_energy?: number;
  spectral_cosine: number;
  modified_cosine: number;
  fingerprint_score: number;
  hybrid_score: number;
  ppm_precursor?: number | null;
  svg?: string | null;
  descriptors?: Record<string, number>;
  druglikeness?: Record<string, unknown>;
  inchikey?: string | null;
  library_peaks?: Peak[];
  source?: string;
  formula_consistent?: boolean;
};

export type PredictResponse = {
  predicted_smiles: string | null;
  predicted_name: string | null;
  confidence: number;
  confidence_label: string;
  precursor_mz: number;
  neutral_mass: number;
  adduct: string;
  collision_energy: number;
  formula_candidates: Array<{ formula: string; ppm: number; score: number; dbe: number | null; mass: number }>;
  best_formula: string | null;
  candidates: Candidate[];
  peak_annotations: Array<{ mz: number; intensity: number; formula: string | null; annotation: string; error_ppm: number | null }>;
  spectrum_stats: Record<string, number>;
  top_peaks: Peak[];
  isotope_pattern: Array<{ mz: number; intensity: number; offset: number }>;
  query_svg: string | null;
  known_vs_novel: string;
  model_loaded: boolean;
  library_size: number;
  rationale?: string[];
  spectrum_quality?: { score: number; label: string; flags: string[]; entropy?: number };
  suggested_adducts?: Array<{ adduct: string; theoretical_mz: number | null; ppm: number | null }>;
};

let live: boolean | null = null;

export async function isLive(): Promise<boolean> {
  if (live !== null) return live;
  try {
    await api.get("/ping", { timeout: 4000 });
    live = true;
  } catch {
    try {
      await api.get("/health", { timeout: 12000 });
      live = true;
    } catch {
      live = false;
    }
  }
  return live;
}

export async function fetchHealth() {
  if (await isLive()) {
    const { data } = await api.get("/health");
    return { ...data, demo: false };
  }
  const examples = await loadDemoExamples();
  return { status: "demo", library_size: examples.length, model_loaded: false, project: "Peakwise", demo: true };
}

export async function predictSpectrum(payload: Record<string, unknown>) {
  if (await isLive()) {
    const { data } = await api.post<PredictResponse>("/predict", payload, { timeout: 60000 });
    return data;
  }
  const peaks = (payload.peaks as Peak[]) || [];
  return demoPredict(peaks, Number(payload.precursor_mz) || 0, String(payload.adduct || "[M+H]+"), Number(payload.collision_energy) || 20);
}

export async function simulateMolecule(payload: Record<string, unknown>) {
  if (await isLive()) {
    const { data } = await api.post("/simulate", payload, { timeout: 60000 });
    return data;
  }
  const examples = await loadDemoExamples();
  const hit = examples.find((e) => e.smiles === payload.smiles) || examples[0];
  return {
    ...hit,
    exact_mass: hit.precursor_mz - 1.007,
    svg: null,
    descriptors: {},
    isotope_pattern: [],
    annotations: [],
    demo: true,
  };
}

export async function fetchExamples() {
  if (await isLive()) {
    try {
      const { data } = await api.get("/examples", { timeout: 15000 });
      return data as Array<Record<string, unknown>>;
    } catch {
      /* fall through */
    }
  }
  return loadDemoExamples() as unknown as Array<Record<string, unknown>>;
}

export async function fetchLibrary(params: Record<string, string | number | undefined> = {}) {
  if (await isLive()) {
    const { data } = await api.get("/library", { params, timeout: 20000 });
    return data;
  }
  const examples = await loadDemoExamples();
  const q = String(params.q || "").toLowerCase();
  const role = String(params.role || "");
  let items = examples.filter((e) => !q || e.name.toLowerCase().includes(q) || e.formula.toLowerCase().includes(q) || e.smiles.toLowerCase().includes(q));
  if (role) items = items.filter((e) => e.role === role);
  return {
    count: items.length,
    roles: [...new Set(examples.map((e) => e.role))],
    classes: [...new Set(examples.map((e) => e.molecule_class))],
    items,
  };
}

export async function fetchLibraryItem(name: string) {
  if (await isLive()) {
    const { data } = await api.get(`/library/${encodeURIComponent(name)}`, { timeout: 20000 });
    return data;
  }
  const examples = await loadDemoExamples();
  const rec = examples.find((e) => e.name.toLowerCase() === name.toLowerCase());
  if (!rec) throw new Error("Molecule not found");
  return { ...rec, svg: null, descriptors: {}, isotope_pattern: [], spectra: [rec] };
}

export async function fetchMetrics() {
  if (await isLive()) {
    try {
      const { data } = await api.get("/metrics", { timeout: 15000 });
      return data;
    } catch {
      /* demo */
    }
  }
  return DEMO_METRICS;
}

export async function fetchStats() {
  if (await isLive()) {
    try {
      const { data } = await api.get("/stats", { timeout: 15000 });
      return data;
    } catch {
      /* demo */
    }
  }
  return DEMO_STATS;
}

export async function compareMolecules(smiles_a: string, smiles_b: string) {
  if (await isLive()) {
    const { data } = await api.post("/compare", { smiles_a, smiles_b }, { timeout: 30000 });
    return data;
  }
  return {
    tanimoto: smiles_a === smiles_b ? 1 : 0.42,
    exact: smiles_a === smiles_b,
    mces: smiles_a === smiles_b ? 0 : 6,
    svg_a: null,
    svg_b: null,
  };
}

export async function uploadBatch(file: File) {
  if (!(await isLive())) {
    throw new Error("Batch upload needs the local Peakwise API. On GitHub Pages, try a single spectrum in the Identify tab.");
  }
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/batch", form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
  return data;
}

export async function discoverAnalogs(payload: Record<string, unknown>) {
  if (await isLive()) {
    const { data } = await api.post("/discover", payload, { timeout: 60000 });
    return data;
  }
  const examples = await loadDemoExamples();
  return {
    query_smiles: payload.smiles,
    query_svg: null,
    query_formula: null,
    query_druglikeness: { medicine_score: 0.6, biomarker_score: 0.5, lipinski_pass: true },
    goal: payload.goal,
    analogs: examples.slice(0, 6).map((e) => ({ ...e, score: 0.5, svg: null, is_query: e.smiles === payload.smiles, druglikeness: { medicine_score: 0.55, biomarker_score: 0.5 } })),
    library_neighbors: examples.slice(0, 4).map((e) => ({ ...e, tanimoto: 0.4 })),
    notes: "Demo mode lists nearby bundled molecules. Run the API for true analog enumeration.",
  };
}
