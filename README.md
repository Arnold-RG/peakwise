# Peakwise — Research & Machine Learning

**Scientific ML and API platform** · [GitHub repository](https://github.com/Arnold-RG/peakwise)

## What this project does

Research-oriented Python machine-learning workspace with an API backend, frontend, experimental notebooks, model assets and scientific dependencies. Workflows and model claims must be validated against data and tests.

**Primary stack:** Python, FastAPI, scikit-learn, RDKit, pandas, NumPy, SciPy; frontend assets.

> **Project verification:** This README describes observed source structure and release expectations. Not every feature, dependency or target device has been certified. Consult actual CI results and source before making public claims.

## Repository architecture

| File or directory | Purpose |
| --- | --- |
| `backend/` | API/backend services |
| `frontend/` | Client interface |
| `models/` | Model code/artifacts |
| `notebooks/` | Research and experiments |
| `scripts/` | Development tooling |
| `requirements.txt` | Pinned Python dependencies |
| `pytest.ini` | Test configuration |

## Local development

Install Git and the required language runtime. Use a clean environment and review configuration files for secrets before starting network services.

```sh
python -m venv .venv
# Activate .venv
python -m pip install -r requirements.txt
python -m pytest
```

**Environment note:** Inspect backend and frontend instructions before starting services; dependencies such as RDKit can require platform-specific installation.

## User experience and core requirements

- Validate model inputs, dataset provenance, feature and preprocessing assumptions.
- Record dataset splits, evaluation metrics, model versions and known limitations.
- Treat predictions as research output until domain validation and deployment review.

Build for real customer journeys: clear navigation, accessible controls, responsive layouts, truthful claims, human-readable errors and meaningful loading/empty states.

## Security, data and privacy

- Protect prediction endpoints with rate limits, strong input validation and appropriate authentication.
- Never unpickle untrusted model files or execute untrusted notebooks.
- Avoid exposing proprietary training data, private inputs or service tokens.

Review secrets, trust boundaries, external services and permission handling. Use scoped credentials, a private disclosure channel (see `SECURITY.md` if present), and secure dependency updates.

## Quality and operations

| Area | Release acceptance criterion |
| --- | --- |
| Implementation | Maintainable code, clear ownership, documented configuration |
| Testing | Actual unit/integration checks or a documented repeatable smoke test |
| Security | Input and dependency checks, least privilege and no exposed credentials |
| Accessibility | Keyboard, contrast, touch and responsive testing for user-facing screens |
| CI/CD | Reproducible builds, protected release jobs, owner-approved publication |
| Reliability | Error monitoring; backups/recovery for persisted data; rollback plan |

**These are intended gates, not an assertion of passing tests.** Kubernetes is unnecessary for purely static pages; reassess it only where multi-service infrastructure warrants the complexity.

## Contributions and release policy

Use reviewable branches and pull requests. Don't add unlicensed visual assets, mock client testimonials, private customer data or unverified integrations. Owners approve public releases; note remaining limitations in the release report.
