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

const SVG_ALLOWED = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "rect",
  "text",
  "tspan",
  "defs",
  "clippath",
  "title",
  "desc",
  "use",
]);

const ATTR_BLOCK = /^(on|xmlns:xlink$)/i;

/** Strip scripts/handlers from server SVG before any DOM insert. */
export function sanitizeSvgMarkup(raw: string): string | null {
  if (!raw || !raw.includes("<")) return null;
  try {
    const parsed = new DOMParser().parseFromString(raw, "image/svg+xml");
    if (parsed.querySelector("parsererror")) return null;
    const root = parsed.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg") return null;

    const walk = (el: Element) => {
      const tag = el.tagName.toLowerCase();
      if (!SVG_ALLOWED.has(tag) || tag === "foreignobject" || tag === "script") {
        el.remove();
        return;
      }
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase();
        const value = attr.value;
        if (ATTR_BLOCK.test(name) || name.startsWith("on")) {
          el.removeAttribute(attr.name);
          continue;
        }
        if ((name === "href" || name === "xlink:href") && /^\s*javascript:/i.test(value)) {
          el.removeAttribute(attr.name);
        }
      }
      for (const child of [...el.children]) walk(child);
    };

    walk(root);
    root.setAttribute("class", "mol-svg");
    return new XMLSerializer().serializeToString(root);
  } catch {
    return null;
  }
}

function palette() {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string) => style.getPropertyValue(name).trim();
  const ink = pick("--ink") || "#e8eef7";
  const sheet = pick("--sheet") || "#151f33";
  const oxygen = pick("--teal") || "#2ee6d6";
  const nitrogen = pick("--teal-deep") || "#14b8a6";
  const muted = pick("--muted") || "#8b9bb4";
  const base = {
    FOREGROUND: ink,
    BACKGROUND: sheet,
    C: ink,
    O: oxygen,
    N: nitrogen,
    F: nitrogen,
    CL: nitrogen,
    BR: oxygen,
    I: muted,
    P: oxygen,
    S: muted,
    B: oxygen,
    SI: ink,
    H: muted,
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
  // Prefer client-side SMILES drawing when available (avoids injecting remote markup).
  const useClient = Boolean(smiles);
  const safeSvg = !useClient && svg ? sanitizeSvgMarkup(svg) : null;
  const server = Boolean(safeSvg);

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

  if (server && safeSvg) {
    return (
      <div
        className={`mol mol-server ${dark ? "is-inverted" : ""} ${className}`}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : label}
        aria-hidden={hidden}
        dangerouslySetInnerHTML={{ __html: safeSvg }}
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
