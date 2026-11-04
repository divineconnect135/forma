# Architecture decisions

- **Modular monolith:** easier to develop, deploy, and test solo than microservices.
- **Same-origin APIs:** Vite proxy in development; one HTTPS origin planned in production.
- **Server-owned commerce:** browser never decides payable totals or stock availability.
- **MongoDB replica set:** prepares for inventory/order transactions in Phase 5.
- **HttpOnly sessions (Phase 3):** avoids storing sensitive auth tokens in localStorage.
