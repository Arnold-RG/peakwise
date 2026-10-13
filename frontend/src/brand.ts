export const BRAND = {
  name: "Peakwise",
  tagline: "Name the molecule in your mass spectrum",
  sentence: "You paste LC-MS/MS peaks. Peakwise suggests the chemical structure behind them.",
  url: "https://arnold-rg.github.io/peakwise/",
};

export const NAV = [
  { id: "overview", label: "Home", group: "Open", title: "Peakwise — name the molecule in your mass spectrum" },
  { id: "workbench", label: "Identify", group: "Work", title: "Identify a spectrum — Peakwise" },
  { id: "library", label: "Library", group: "Work", title: "Library — Peakwise" },
  { id: "simulate", label: "From a structure", group: "Work", title: "From a structure — Peakwise" },
  { id: "discover", label: "Nearby molecules", group: "Work", title: "Nearby molecules — Peakwise" },
  { id: "batch", label: "Many spectra", group: "Work", title: "Many spectra — Peakwise" },
  { id: "evaluate", label: "How well it works", group: "Read", title: "How well it works — Peakwise" },
  { id: "help", label: "Plain English", group: "Read", title: "Plain English — Peakwise" },
  { id: "methods", label: "How it works", group: "Read", title: "How it works — Peakwise" },
] as const;

export type PageId = (typeof NAV)[number]["id"];

export function asset(path: string): string {
  const clean = path.replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${clean}`;
}
