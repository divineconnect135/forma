# Architecture

Forma is an npm-workspaces modular monolith.

- `apps/web`: React storefront, Vite, Tailwind, React Router, TanStack Query.
- `apps/api`: Express REST API, MongoDB via Mongoose.
- `packages/shared`: shared public TypeScript types, no secrets.

## Local request flow

`React (/api/health) -> Vite proxy (5173) -> Express (5000) -> Mongoose connection state -> JSON response`

The web and API can be deployed under one origin in a later phase.
