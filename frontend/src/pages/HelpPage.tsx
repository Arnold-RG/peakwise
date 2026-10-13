const TERMS: Array<[string, string]> = [
  ["SMILES", "A line of text that is a 2-D chemical structure. Computers can draw it; chemists can read it."],
  ["Precursor m/z", "The mass of the intact ion before it was smashed. Think of it as the whole-molecule weight, plus a proton."],
  ["Adduct", "What extra bit is stuck to the molecule in the instrument, usually [M+H]+ meaning “plus a hydrogen”."],
  ["Collision energy", "How hard the instrument smashed the ion, in electron volts. Harder smash, smaller pieces."],
  ["Cosine score", "How similar two peak patterns are. 1 is identical; 0 is unrelated."],
  ["Confidence", "A blunt honesty score. High means the top name beat the runner-up clearly. Medium or low means look at the next names too."],
  ["Known vs analog", "Known is a molecule we already keep in the library. Analog is a close cousin Peakwise invented as a guess."],
  ["Formula", "Atom counts, like C8H10N4O2 for caffeine. It is a useful filter, not a full identification."],
];

export function HelpPage({ onOpen }: { onOpen: (page: string) => void }) {
  return (
    <article className="prose stack-lg">
      <header>
        <p className="kicker">Glossary</p>
        <h1 style={{ marginTop: "0.6rem" }}>In plain English</h1>
        <p className="lede" style={{ marginTop: "1rem" }}>
          Mass spectrometry is a weighing machine for molecules. It does not print a chemical name. Peakwise is the naming step.
        </p>
      </header>

      <section className="plate stack">
        <h2>What should I paste?</h2>
        <p>
          A list of peaks. Each line is <span className="mono">mass height</span>, like <span className="mono">195.0877 1.00</span>. Spaces, commas, or tabs are fine. If you know the parent ion mass (precursor m/z), put that in the box above the list.
        </p>
        <div>
          <button type="button" className="btn-primary" onClick={() => onOpen("workbench")}>
            Open Identify with caffeine already loaded
          </button>
        </div>
      </section>

      <dl className="glossary">
        {TERMS.map(([term, definition]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{definition}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
