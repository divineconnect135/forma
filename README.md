# Forma — Interactive 3D E-Commerce Platform

Phase 1 starter for a portfolio MERN application. Product catalog, 3D viewer, customer sessions, cart, Stripe test payments, and admin dashboard arrive in subsequent phases.

## Requirements

- Node.js 24 LTS and npm
- Docker Desktop with Docker Compose **or** a MongoDB Atlas database
- Git

## Quick start

```bash
npm install
cp apps/api/.env.example apps/api/.env
# Option A: Local MongoDB replica set:
docker compose up -d
docker compose exec mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
# Check replica set is primary before proceeding:
docker compose exec mongo mongosh --quiet --eval 'rs.status().myState'
npm run dev
```

For Atlas, replace `MONGODB_URI` in `apps/api/.env` with your own MongoDB Atlas connection string. Keep the URI secret.

The init command is a one-time action. If the replica set is already initialized, do not run it again. The local instance is for development only and does not enable database authentication; the host port is restricted to `127.0.0.1`.

Open http://localhost:5173 and verify `API connected · Database connected`. You can also check http://localhost:5000/api/health.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start React + API together |
| `npm run lint` | ESLint |
| `npm run format` | Apply Prettier formatting |
| `npm run format:check` | Check formatting |
| `npm run typecheck` | TypeScript checking |
| `npm test` | Run API + web tests |
| `npm run build` | Build API + frontend |

Run `npm run format` once after `npm install`, then check in formatting changes. Commit the generated root `package-lock.json` to enable reproducible `npm ci` in GitHub Actions.

## Known limits

- Phase 1 is a foundation only; no products, sessions, carts or Stripe integration yet.
- Automated tests cover baseline endpoints and a price utility; MongoDB integration tests start when the models exist.
- Local Docker MongoDB has no authentication: development use only.
- No live deployment or live payment readiness is implied.
