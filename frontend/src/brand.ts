export const BRAND = {
  name: "Peakwise",
  tagline: "Name the molecule in your mass spectrum",
  sentence: "You paste LC-MS/MS peaks. Peakwise suggests the chemical structure behind them.",
};

export function asset(path: string): string {
  const clean = path.replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${clean}`;
}
