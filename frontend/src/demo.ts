import type { Candidate, Peak, PredictResponse } from "./api";
import { asset } from "./brand";

export type DemoExample = {
  name: string;
  smiles: string;
  formula: string;
  role: string;
  molecule_class: string;
  precursor_mz: number;
  adduct: string;
  collision_energy: number;
  peaks: Peak[];
};

let cache: DemoExample[] | null = null;

export async function loadDemoExamples(): Promise<DemoExample[]> {
  if (cache) return cache;
  const res = await fetch(asset("demo/examples.json"));
  cache = (await res.json()) as DemoExample[];
  return cache;
}

function bin(peaks: Peak[]): number[] {
  const n = 400;
  const vec = new Array(n).fill(0);
  const maxI = Math.max(...peaks.map((p) => p.intensity), 1e-9);
  for (const p of peaks) {
    const i = Math.min(n - 1, Math.max(0, Math.floor(p.mz / 2)));
    vec[i] = Math.max(vec[i], p.intensity / maxI);
  }
  return vec;
}

function cosine(a: Peak[], b: Peak[]): number {
  const va = bin(a);
  const vb = bin(b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < va.length; i++) {
    dot += va[i] * vb[i];
    na += va[i] * va[i];
    nb += vb[i] * vb[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d ? dot / d : 0;
}

export async function demoPredict(peaks: Peak[], precursor: number, adduct: string, energy: number): Promise<PredictResponse> {
  const examples = await loadDemoExamples();
  const ranked = examples
    .map((ex) => {
      const spec = cosine(peaks, ex.peaks);
      const massPen = Math.min(Math.abs(precursor - ex.precursor_mz) / Math.max(precursor, 1), 0.4);
      const hybrid = spec - 0.35 * massPen;
      return { ex, spec, hybrid };
    })
    .sort((a, b) => b.hybrid - a.hybrid);

  const candidates: Candidate[] = ranked.slice(0, 8).map(({ ex, spec, hybrid }) => ({
    name: ex.name,
    smiles: ex.smiles,
    formula: ex.formula,
    molecule_class: ex.molecule_class,
    role: ex.role,
    spectral_cosine: Number(spec.toFixed(4)),
    modified_cosine: Number((spec * 0.92).toFixed(4)),
    fingerprint_score: Number((spec * 0.8).toFixed(4)),
    hybrid_score: Number(hybrid.toFixed(4)),
    precursor_mz: ex.precursor_mz,
    adduct: ex.adduct,
    collision_energy: ex.collision_energy,
    library_peaks: ex.peaks,
    source: "demo-library",
  }));

  const top = candidates[0];
  const gap = candidates.length > 1 ? candidates[0].hybrid_score - candidates[1].hybrid_score : 0.1;
  const confidence = Math.min(1, Math.max(0, 0.4 * (top?.spectral_cosine || 0) + 0.4 * gap / 0.2));

  return {
    predicted_smiles: top?.smiles ?? null,
    predicted_name: top?.name ?? null,
    confidence: Number(confidence.toFixed(4)),
    confidence_label: confidence >= 0.7 ? "high" : confidence >= 0.4 ? "medium" : "low",
    precursor_mz: precursor,
    neutral_mass: precursor - 1.007,
    adduct,
    collision_energy: energy,
    formula_candidates: top?.formula ? [{ formula: top.formula, ppm: 0, score: 1, dbe: null, mass: precursor }] : [],
    best_formula: top?.formula ?? null,
    candidates,
    peak_annotations: peaks.slice(0, 12).map((p) => ({
      mz: p.mz,
      intensity: p.intensity,
      formula: null,
      annotation: Math.abs(p.mz - precursor) < 0.05 ? "likely precursor" : "unassigned (demo)",
      error_ppm: null,
    })),
    spectrum_stats: { n_peaks: peaks.length },
    top_peaks: [...peaks].sort((a, b) => b.intensity - a.intensity).slice(0, 8),
    isotope_pattern: [],
    query_svg: null,
    known_vs_novel: "known",
    model_loaded: false,
    library_size: examples.length,
    rationale: [
      "This browser is running Peakwise in demo mode (no Python API).",
      top ? `Closest bundled example is ${top.name} (cosine ${top.spectral_cosine.toFixed(2)}).` : "No demo spectra loaded.",
      "For the full fingerprint model, formula enumerator, and analog generator, run the local API.",
    ],
    spectrum_quality: {
      score: peaks.length >= 3 ? 0.8 : 0.4,
      label: peaks.length >= 3 ? "good" : "poor",
      flags: peaks.length < 3 ? ["too-few-peaks"] : [],
    },
  };
}

export const DEMO_METRICS = {
  hybrid: {
    n: 24,
    top1_accuracy: 0.6667,
    top10_accuracy: 1.0,
    top1_tanimoto: 0.7497,
    top10_tanimoto: 1.0,
    formula_accuracy: 0.5833,
  },
  cosine_retrieval_baseline: {
    n: 24,
    top1_accuracy: 0.7083,
    top10_accuracy: 1.0,
    top1_tanimoto: 0.8151,
    top10_tanimoto: 1.0,
    formula_accuracy: 0.0,
  },
  notes: "Held-out Murcko scaffolds on the bundled Peakwise library. Cosine can still match the same molecule at another collision energy.",
};

export const DEMO_STATS = {
  n_spectra: 966,
  n_molecules: 161,
  model_loaded: false,
};
