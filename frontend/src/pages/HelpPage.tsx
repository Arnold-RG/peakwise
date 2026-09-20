export function HelpPage({ onOpen }: { onOpen: (page: string) => void }) {
  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h2 className="font-serif text-4xl">In plain English</h2>
        <p className="mt-3 text-lg">
          Mass spectrometry is a weighing machine for molecules. It does not print a chemical name. Peakwise is the naming step.
        </p>
      </header>

      <section className="paper-card p-5 sm:p-6 space-y-3">
        <h3 className="font-serif text-2xl">What should I paste?</h3>
        <p>
          A list of peaks. Each line is <span className="font-mono">mass height</span>, like <span className="font-mono">195.0877 1.00</span>.
          Spaces, commas, or tabs are fine. If you know the parent ion mass (precursor m/z), put that in the box above the list.
        </p>
        <button type="button" className="btn-primary" onClick={() => onOpen("workbench")}>
          Open Identify with caffeine already loaded
        </button>
      </section>

      <dl className="space-y-5">
        {[
          ["SMILES", "A line of text that is a 2-D chemical structure. Computers can draw it; chemists can read it."],
          ["Precursor m/z", "The mass of the intact ion before it was smashed. Think of it as the whole-molecule weight, plus a proton."],
          ["Adduct", "What extra bit is stuck to the molecule in the instrument, usually [M+H]+ meaning “plus a hydrogen”."],
          ["Collision energy", "How hard the instrument smashed the ion, in electron volts. Harder smash, smaller pieces."],
          ["Cosine score", "How similar two peak patterns are. 1 is identical; 0 is unrelated."],
          ["Confidence", "A blunt honesty score. High means the top name beat the runner-up clearly. Medium or low means look at the next names too."],
          ["Known vs analog", "Known is a molecule we already keep in the library. Analog is a close cousin Peakwise invented as a guess."],
          ["Formula", "Atom counts, like C8H10N4O2 for caffeine. It is a useful filter, not a full identification."],
        ].map(([term, def]) => (
          <div key={term} className="border-b border-[#d7cbb8] dark:border-[#3a322a] pb-4">
            <dt className="font-serif text-xl">{term}</dt>
            <dd className="mt-1">{def}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
