export function MethodsPage() {
  return (
    <article className="prose stack-lg">
      <header>
        <p className="kicker">Method</p>
        <h1 style={{ marginTop: "0.6rem" }}>How Peakwise decides</h1>
        <p className="lede" style={{ marginTop: "1rem" }}>
          The public site can match a peak list against bundled examples in your browser. The full local copy adds a trained fingerprint model, formula guessing, and analog drawing.
        </p>
      </header>
      <section className="plate">
        <h2>The problem</h2>
        <p style={{ marginTop: "0.75rem" }}>
          An LC-MS/MS run can see thousands of molecules in blood or an extract. Most of those traces stay unnamed. Peakwise maps a tandem spectrum to a 2-D structure (SMILES), for library compounds and for close novel cousins.
        </p>
      </section>
      <section className="plate">
        <h2>The local model</h2>
        <ol className="method-list">
          <li>Peaks are binned. Precursor mass, adduct, collision energy, and a simple entropy score are attached. The scaler is fit on training molecules only.</li>
          <li>A small neural net predicts a 256-bit chemical fingerprint from that vector.</li>
          <li>Library spectra are ranked by ordinary cosine, a GNPS-style modified cosine, fingerprint similarity, and a mass penalty.</li>
          <li>Possible formulae are listed from the precursor (Seven Golden Rules). Hits that match the top formula get a small boost.</li>
          <li>If the hit is weak, Peakwise edits the top structures (methylate, hydroxylate, swap a halogen) and offers those as novel guesses.</li>
        </ol>
      </section>
      <section className="plate">
        <h2>How we score ourselves</h2>
        <p style={{ marginTop: "0.75rem" }}>
          Exact name (canonical SMILES), fingerprint similarity (Tanimoto), a bond-edit distance (MCES), and formula accuracy. Test molecules sit on unseen Murcko scaffolds, so they are not just copies of the training set.
        </p>
      </section>
    </article>
  );
}
