import { useEffect, useId, useRef, useState } from "react";
import { useDark } from "../theme";

type DrawerModule = {
  default: {
    parse: (smiles: string, ok: (tree: unknown) => void, err?: (error: unknown) => void) => void;
    SvgDrawer: new (options: Record<string, unknown>) => {
      draw: (tree: unknown, target: SVGSVGElement, theme?: string) => void;
    };
  };
};

function palette() {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string) => style.getPropertyValue(name).trim();
  const ink = pick("--ink") || "#1a1410";
  const sheet = pick("--sheet") || "#fbf8f3";
  const oxygen = pick("--garnet") || "#7a2e38";
  const nitrogen = pick("--forest") || "#1e4a38";
  const gold = pick("--gold") || "#8c7349";
  const base = {
    FOREGROUND: ink,
    BACKGROUND: sheet,
    C: ink,
    O: oxygen,
    N: nitrogen,
    F: nitrogen,
    CL: nitrogen,
    BR: oxygen,
    I: gold,
    P: oxygen,
    S: gold,
    B: oxygen,
    SI: ink,
    H: gold,
  };
  return { light: base, dark: base };
}

export function MoleculeSvg({
  svg,
  smiles,
  className = "",
  label = "Chemical structure",
  decorative = false,
}: {
  svg?: string | null;
  smiles?: string | null;
  className?: string;
  label?: string;
  decorative?: boolean;
}) {
  const dark = useDark();
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const reactId = useId();
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const server = Boolean(svg) && (!dark || !smiles);

  useEffect(() => {
    setFailed(false);
  }, [smiles, svg, dark]);

  useEffect(() => {
    if (server || !smiles) return;
    const node = boxRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [server, smiles]);

  useEffect(() => {
    if (server || !smiles || !visible || failed) return;
    const target = svgRef.current;
    if (!target) return;
    let cancel = false;
    target.replaceChildren();

    import("smiles-drawer")
      .then((mod: DrawerModule) => {
        if (cancel || !svgRef.current) return;
        const SmilesDrawer = mod.default;
        const drawer = new SmilesDrawer.SvgDrawer({
          width: 520,
          height: 300,
          bondThickness: 1.15,
          bondLength: 26,
          padding: 18,
          themes: palette(),
        });
        SmilesDrawer.parse(
          smiles,
          (tree) => {
            if (cancel || !svgRef.current) return;
            drawer.draw(tree, svgRef.current, dark ? "dark" : "light");
            svgRef.current.classList.add("mol-svg");
          },
          () => {
            if (!cancel) setFailed(true);
          },
        );
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });

    return () => {
      cancel = true;
    };
  }, [server, smiles, visible, dark, failed, reactId]);

  const hidden = decorative ? true : undefined;

  if (server && svg) {
    const html = svg.includes("<svg") ? svg.replace("<svg", '<svg class="mol-svg"') : svg;
    return (
      <div
        className={`mol mol-server ${dark ? "is-inverted" : ""} ${className}`}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : label}
        aria-hidden={hidden}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div
      ref={boxRef}
      className={`mol ${className}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={hidden}
    >
      {smiles && !failed ? <svg ref={svgRef} role="presentation" /> : <p className="mol-empty">No structure drawn</p>}
    </div>
  );
}
