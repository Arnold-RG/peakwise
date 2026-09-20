export function MethodsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="font-serif text-4xl">How Peakwise decides</h2>
      <p className="text-lg">
        The public site can match a peak list against bundled examples in your browser. The full local copy adds a trained fingerprint model, formula guessing, and analog drawing.
      </p>
      <section className="paper-card p-5 sm:p-6">
        <h3 className="font-serif text-2xl">The problem</h3>
        <p className="mt-3">
          An LC-MS/MS run can see thousands of molecules in blood or an extract. Most of those traces stay unnamed. Peakwise maps a tandem spectrum to a 2-D structure (SMILES), for library compounds and for close novel cousins.
        </p>
      </section>
      <section className="paper-card p-5 sm:p-6">
        <h3 className="font-serif text-2xl">The local model</h3>
        <ol className="mt-3 list-decimal pl-5 space-y-2">
          <li>Peaks are binned. Precursor mass, adduct, collision energy, and a simple entropy score are attached. The scaler is fit on training molecules only.</li>
          <li>A small neural net predicts a 256-bit chemical fingerprint from that vector.</li>
          <li>Library spectra are ranked by ordinary cosine, a GNPS-style modified cosine, fingerprint similarity, and a mass penalty.</li>
          <li>Possible formulae are listed from the precursor (Seven Golden Rules). Hits that match the top formula get a small boost.</li>
          <li>If the hit is weak, Peakwise edits the top structures (methylate, hydroxylate, swap a halogen) and offers those as novel guesses.</li>
        </ol>
      </section>
      <section className="paper-card p-5 sm:p-6">
        <h3 className="font-serif text-2xl">How we score ourselves</h3>
        <p className="mt-3">
          Exact name (canonical SMILES), fingerprint similarity (Tanimoto), a bond-edit distance (MCES), and formula accuracy. Test molecules sit on unseen Murcko scaffolds, so they are not just copies of the training set.
        </p>
      </section>
    </div>
  );
}
