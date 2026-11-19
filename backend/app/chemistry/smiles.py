"""SMILES helpers, validity, and lightweight analog generation."""

from __future__ import annotations

from functools import lru_cache

from rdkit import Chem
from rdkit.Chem import AllChem, Draw, rdMolDescriptors


def canonical_smiles(smiles: str) -> str | None:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    return Chem.MolToSmiles(mol, canonical=True)


def is_valid_smiles(smiles: str) -> bool:
    return Chem.MolFromSmiles(smiles) is not None


def mol_from_smiles(smiles: str):
    return Chem.MolFromSmiles(smiles)


def inchikey(smiles: str) -> str | None:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    return Chem.MolToInchiKey(mol)


def murcko_scaffold(smiles: str) -> str | None:
    from rdkit.Chem.Scaffolds import MurckoScaffold

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    try:
        return MurckoScaffold.MurckoScaffoldSmiles(mol=mol)
    except Exception:
        return None


@lru_cache(maxsize=2048)
def molecule_svg(smiles: str, width: int = 320, height: int = 220) -> str | None:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    try:
        AllChem.Compute2DCoords(mol)
        drawer = Draw.MolDraw2DSVG(width, height)
        opts = drawer.drawOptions()
        opts.clearBackground = False
        drawer.DrawMolecule(mol)
        drawer.FinishDrawing()
        return drawer.GetDrawingText()
    except Exception:
        return None


@lru_cache(maxsize=4096)
def descriptors(smiles: str) -> dict:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return {}
    return {
        "n_atoms": mol.GetNumHeavyAtoms(),
        "n_rings": rdMolDescriptors.CalcNumRings(mol),
        "n_aromatic_rings": rdMolDescriptors.CalcNumAromaticRings(mol),
        "n_hbd": rdMolDescriptors.CalcNumHBD(mol),
        "n_hba": rdMolDescriptors.CalcNumHBA(mol),
        "tpsa": round(rdMolDescriptors.CalcTPSA(mol), 2),
        "molwt": round(rdMolDescriptors.CalcExactMolWt(mol), 4),
        "logp": round(rdMolDescriptors.CalcCrippenDescriptors(mol)[0], 3),
        "n_rotatable": rdMolDescriptors.CalcNumRotatableBonds(mol),
    }


def analog_smiles(smiles: str, limit: int = 6) -> list[str]:
    """Cheap analog enumeration: methylate, hydroxylate, demethylate, halogen swap, fluorinate."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return []
    reactions = [
        AllChem.ReactionFromSmarts("[cH:1]>>[c:1]C"),
        AllChem.ReactionFromSmarts("[cH:1]>>[c:1]O"),
        AllChem.ReactionFromSmarts("[cH:1]>>[c:1]F"),
        AllChem.ReactionFromSmarts("[CH3:1]>>[H:1]"),
        AllChem.ReactionFromSmarts("[F:1]>>[Cl:1]"),
        AllChem.ReactionFromSmarts("[Cl:1]>>[F:1]"),
        AllChem.ReactionFromSmarts("[OH:1]>>[H:1]"),
        AllChem.ReactionFromSmarts("[OH:1]>>[O:1]C"),
        AllChem.ReactionFromSmarts("[NH2:1]>>[NH:1]C"),
        AllChem.ReactionFromSmarts("[NH:1]>>[N:1]C"),
        AllChem.ReactionFromSmarts("[C:1](=O)[OH]>>[C:1](=O)OC"),
    ]
    seen = {Chem.MolToSmiles(mol, canonical=True)}
    analogs: list[str] = []
    for rxn in reactions:
        try:
            products = rxn.RunReactants((mol,))
        except Exception:
            continue
        for product_tuple in products:
            product = product_tuple[0]
            try:
                Chem.SanitizeMol(product)
            except Exception:
                continue
            smi = Chem.MolToSmiles(product, canonical=True)
            if smi in seen:
                continue
            seen.add(smi)
            analogs.append(smi)
            if len(analogs) >= limit:
                return analogs
    return analogs
