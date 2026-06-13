# pegasus

## Branching model

```
main (protected — NEVER push directly)
 └── dev (integration branch — PRs only)
      ├── feat/rishith-ml      → /ml/*
      ├── feat/wesley-ui       → /frontend/*
      ├── feat/jason-api       → /backend/*, /shared/*
      └── feat/dhruva-sig      → /signals/*
```

## Ownership

| Branch            | Owner   | Scope                  |
| ----------------- | ------- | ---------------------- |
| `feat/rishith-ml` | Rishith | `ml/`                  |
| `feat/wesley-ui`  | Wesley  | `frontend/`            |
| `feat/jason-api`  | Jason   | `backend/`, `shared/`  |
| `feat/dhruva-sig` | Dhruva  | `signals/`             |

## Rules

- `main` is protected. No direct pushes. Releases only via PR from `dev`.
- `dev` is the integration branch. Feature branches PR into `dev`.
- Stay in your lane: only touch the directories listed for your branch.
- Rebase or merge `dev` into your feature branch regularly to stay current.
