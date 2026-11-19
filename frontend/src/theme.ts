import { useEffect, useState } from "react";

export function useDark() {
  const [dark, setDark] = useState(() => !document.documentElement.classList.contains("light"));

  useEffect(() => {
    const list = document.documentElement.classList;
    const sync = () => setDark(!list.contains("light"));
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return dark;
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
