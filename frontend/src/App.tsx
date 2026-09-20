import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchHealth } from "./api";
import { BRAND, asset } from "./brand";
import { BatchPage } from "./pages/BatchPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { EvaluatePage } from "./pages/EvaluatePage";
import { HelpPage } from "./pages/HelpPage";
import { LibraryPage } from "./pages/LibraryPage";
import { MethodsPage } from "./pages/MethodsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SimulatePage } from "./pages/SimulatePage";
import { WorkbenchPage } from "./pages/WorkbenchPage";

const NAV = [
  { id: "overview", label: "Home" },
  { id: "workbench", label: "Identify" },
  { id: "library", label: "Library" },
  { id: "simulate", label: "From a structure" },
  { id: "discover", label: "Nearby molecules" },
  { id: "batch", label: "Many spectra" },
  { id: "evaluate", label: "How well it works" },
  { id: "help", label: "Plain English" },
  { id: "methods", label: "How it works" },
] as const;

type PageId = (typeof NAV)[number]["id"];

export default function App() {
  const [page, setPage] = useState<PageId>("overview");
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth({ demo: true }));
  }, []);

  const demo = Boolean(health?.demo) || !health || health.status === "demo";

  function go(id: PageId) {
    setPage(id);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen paper-sheet text-ink dark:text-paper-100">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="border-b border-[#d7cbb8] dark:border-[#3a322a] bg-[#f4efe4]/90 dark:bg-[#1c1814]/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button type="button" onClick={() => go("overview")} className="flex items-center gap-3 text-left min-h-11">
            <img src={asset("logo.png")} alt="" width={48} height={48} className="h-12 w-12 object-cover border border-[#d7cbb8]" />
            <span>
              <span className="block font-serif text-2xl leading-none">{BRAND.name}</span>
              <span className="block text-sm quiet mt-0.5">{BRAND.tagline}</span>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs quiet">
              {demo ? "Browser demo" : `${health?.library_size ?? "—"} spectra · live`}
            </span>
            <button
              type="button"
              onClick={() => setDark((v) => !v)}
              className="min-h-11 min-w-11 px-2 border border-[#d7cbb8] dark:border-[#3a322a]"
              aria-label={dark ? "Switch to light paper theme" : "Switch to dark ink theme"}
            >
              {dark ? <Sun className="h-4 w-4 mx-auto" /> : <Moon className="h-4 w-4 mx-auto" />}
            </button>
            <button
              type="button"
              className="md:hidden min-h-11 min-w-11 border border-[#d7cbb8]"
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              aria-controls="site-nav"
              aria-label="Menu"
            >
              {menu ? <X className="h-5 w-5 mx-auto" /> : <Menu className="h-5 w-5 mx-auto" />}
            </button>
          </div>
        </div>
        <nav
          id="site-nav"
          aria-label="Main"
          className={`${menu ? "block" : "hidden"} md:block border-t border-[#d7cbb8] dark:border-[#3a322a]`}
        >
          <div className="max-w-6xl mx-auto px-2 sm:px-4 flex flex-col md:flex-row md:flex-wrap">
            {NAV.map((item) => {
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`text-left min-h-11 px-3 py-2 text-sm border-b-2 ${
                    active
                      ? "border-brick text-brick font-bold"
                      : "border-transparent quiet hover:text-ink dark:hover:text-paper-100 hover:border-[#d7cbb8]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>
      {demo ? (
        <div className="bg-brick-100 text-ink text-sm px-4 py-2 text-center">
          You are on the public demo. It runs in any browser, including GitHub Pages. For the trained model, start the local API.
        </div>
      ) : null}
      <main id="main" className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {page === "overview" ? <OverviewPage onOpen={(id) => go(id as PageId)} demo={demo} /> : null}
        {page === "workbench" ? <WorkbenchPage /> : null}
        {page === "library" ? <LibraryPage /> : null}
        {page === "simulate" ? <SimulatePage /> : null}
        {page === "discover" ? <DiscoverPage /> : null}
        {page === "batch" ? <BatchPage /> : null}
        {page === "evaluate" ? <EvaluatePage /> : null}
        {page === "help" ? <HelpPage onOpen={(id) => go(id as PageId)} /> : null}
        {page === "methods" ? <MethodsPage /> : null}
      </main>
      <footer className="border-t border-[#d7cbb8] dark:border-[#3a322a] px-4 py-8 text-sm quiet">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p>
            {BRAND.name} is a small lab tool: peaks in, a named molecule out. Not a medical device.
          </p>
          <p>
            <a className="underline decoration-brick/60 underline-offset-4" href="https://github.com/Arnold-RG/peakwise" rel="noreferrer">
              Source on GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
