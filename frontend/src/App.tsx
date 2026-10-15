import { lazy, Suspense, useEffect, useState } from "react";
import { fetchHealth } from "./api";
import { asset, BRAND, NAV, type PageId } from "./brand";
import { BatchPage } from "./pages/BatchPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { HelpPage } from "./pages/HelpPage";
import { LibraryPage } from "./pages/LibraryPage";
import { MethodsPage } from "./pages/MethodsPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SimulatePage } from "./pages/SimulatePage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import { prefersReducedMotion } from "./theme";

const EvaluatePage = lazy(() => import("./pages/EvaluatePage").then((mod) => ({ default: mod.EvaluatePage })));

const GROUPS = ["Open", "Work", "Read"] as const;

function pageFromHash(): PageId {
  const id = window.location.hash.replace(/^#/, "");
  const match = NAV.find((item) => item.id === id);
  return match ? match.id : "overview";
}

function storedLight(): boolean {
  try {
    const stored = localStorage.getItem("peakwise-theme");
    if (stored === "light") return true;
    if (stored === "dark") return false;
  } catch {
    /* storage can be blocked */
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

export default function App() {
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [light, setLight] = useState(storedLight);
  const [themeChosen, setThemeChosen] = useState(() => {
    try {
      const stored = localStorage.getItem("peakwise-theme");
      return stored === "dark" || stored === "light";
    } catch {
      return false;
    }
  });
  const [menu, setMenu] = useState(false);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [healthKnown, setHealthKnown] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
    document.documentElement.classList.toggle("dark", !light);
    document.documentElement.style.colorScheme = light ? "light" : "dark";
    document.getElementById("theme-color")?.setAttribute("content", light ? "#eef3f9" : "#0f172a");
    if (!themeChosen) return;
    try {
      localStorage.setItem("peakwise-theme", light ? "light" : "dark");
    } catch {
      /* ignore */
    }
  }, [light, themeChosen]);

  useEffect(() => {
    if (themeChosen) return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setLight(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [themeChosen]);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth({ demo: true }))
      .finally(() => setHealthKnown(true));
  }, []);

  useEffect(() => {
    const sync = () => setPage(pageFromHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    const title = NAV.find((item) => item.id === page)?.title ?? BRAND.name;
    document.title = title;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [page]);

  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const demo = healthKnown && (Boolean(health?.demo) || !health || health?.status === "demo");

  function go(id: PageId) {
    const next = `#${id}`;
    if (window.location.hash !== next) window.location.hash = next;
    else setPage(id);
    setMenu(false);
  }

  return (
    <div className="sheet">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={() => go("overview")}>
            <img src={asset("logo.png")} alt="" width={48} height={48} className="mark" />
            <span className="brand-text">
              <span className="brand-name">{BRAND.name}</span>
              <span className="brand-tag">{BRAND.tagline}</span>
            </span>
          </button>
          <div className="top-actions">
            <span className="status">{healthKnown ? (demo ? "Browser demo" : `${health?.library_size ?? "—"} spectra · live`) : ""}</span>
            <button
              type="button"
              className="btn-ghost"
              style={{ minHeight: "2.5rem", paddingInline: "0.85rem" }}
              aria-pressed={!light}
              onClick={() => {
                setThemeChosen(true);
                setLight((value) => !value);
              }}
            >
              {light ? "Dark" : "Light"}
            </button>
            <button
              type="button"
              className="btn-ghost menu-toggle"
              style={{ minHeight: "2.5rem", paddingInline: "0.85rem" }}
              aria-expanded={menu}
              aria-controls="site-nav"
              onClick={() => setMenu((value) => !value)}
            >
              {menu ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>
      <div className="frame">
        <nav id="site-nav" className={menu ? "rail open" : "rail"} aria-label="Main">
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="nav-group">{group}</p>
              {NAV.filter((item) => item.group === group).map((item) => (
                <button key={item.id} type="button" className="nav-link" aria-current={page === item.id ? "page" : undefined} onClick={() => go(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="main-wrap">
          {demo ? (
            <p className="notice" role="status">
              You are on the public demo. It runs in any browser, including GitHub Pages. For the trained model, start the local API.
            </p>
          ) : null}
          <main id="main" tabIndex={-1}>
            <div key={page} className="page-in">
              {page === "overview" ? <OverviewPage onOpen={(id) => go(id as PageId)} demo={demo} /> : null}
              {page === "workbench" ? <WorkbenchPage /> : null}
              {page === "library" ? <LibraryPage /> : null}
              {page === "simulate" ? <SimulatePage /> : null}
              {page === "discover" ? <DiscoverPage /> : null}
              {page === "batch" ? <BatchPage demo={demo} /> : null}
              {page === "evaluate" ? (
                <Suspense fallback={<p className="quiet">Opening the figures…</p>}>
                  <EvaluatePage />
                </Suspense>
              ) : null}
              {page === "help" ? <HelpPage onOpen={(id) => go(id as PageId)} /> : null}
              {page === "methods" ? <MethodsPage /> : null}
            </div>
          </main>
          <footer className="footer">
            <div className="footer-inner">
              <p>Peakwise is a lab instrument for naming spectra: peaks in, ranked SMILES out. Not a medical device. Treat every name as a hypothesis.</p>
              <p>
                <a href="https://github.com/Arnold-RG/peakwise" target="_blank" rel="noopener noreferrer">
                  Source on GitHub
                </a>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
