# Forma — Full-Stack 3D E-Commerce Platform

**A modern, responsive full-stack e-commerce application with interactive 3D product visualization, secure authentication, Stripe test payments, inventory management, and an administrative dashboard.**

Forma combines a design-focused shopping experience with backend functionality for managing products, customers, orders, and inventory. The application was built to demonstrate full-stack engineering, database design, API security, payment integration, testing, and cloud deployment.

**[Live Demo](https://forma-psi-lemon.vercel.app/)** · **[GitHub Repository](https://github.com/divineconnect135/forma)**

> **Demo Notice:** Forma is a portfolio project using Stripe Test Mode. No real payments are processed. It is not configured as a live commercial store.

---

## Features

### Storefront and Product Discovery

- Responsive homepage with a modern e-commerce design
- Product catalog with search, filtering, sorting, and pagination
- Individual product detail pages
- Product categories, variants, prices, and availability
- Interactive 3D product visualization using Three.js
- GSAP animations and motion-enhanced interfaces
- Loading, empty, and error states
- Mobile-responsive layouts
- Lazy-loaded route components for improved performance

### Authentication and Customer Accounts

- Customer registration and login
- Secure session-based authentication
- Password hashing
- HTTP-only session cookies
- CSRF protection for state-changing requests
- Protected account and checkout routes
- Role-based authorization for administrators
- Logout and session management

### Shopping Cart

- Add products and variants to the cart
- Update item quantities
- Remove items
- Persistent server-side carts for authenticated users
- Guest cart support and merging on authentication
- Server-side price and stock validation
- Cart updates after confirmed purchases

### Stripe Checkout and Orders

- Stripe-hosted Checkout in test mode
- Server-calculated product totals
- Persistent order records
- Order item snapshots that preserve purchase details
- Stripe webhook signature verification
- Idempotent checkout initiation
- Transactional inventory reservations
- Payment confirmation and order settlement
- Checkout expiration and reservation release
- Checkout session recovery
- Customer order history and order details
- Reconciliation utilities for pending payments

**Payment consistency:** Order and inventory changes use MongoDB transactions, helping prevent duplicate stock deductions and inconsistent reservations during payment processing.

### Administration Dashboard

Forma includes a protected administration interface for managing store operations.

- Dashboard overview and business metrics
- Product creation, editing, and archiving
- Product variant management
- Inventory adjustments and availability tracking
- Customer listing
- Order management
- Fulfillment workflow
- Administrative audit logs
- Role-based API access controls

The fulfillment workflow supports:

`Unfulfilled → Processing → Shipped → Delivered`

Administrative functionality is protected by server-side authorization, not only frontend route guards.

### Security and Reliability

- Input validation using Zod
- Secure session authentication
- CSRF protection
- Role-based access control
- Rate limiting for sensitive API operations
- Helmet security headers
- Request body size limits
- Centralized error handling
- No-store caching headers for private API responses
- Stripe webhook signature verification
- Transactional inventory updates
- Checkout idempotency and recovery safeguards
- Structured request logging
- API health endpoints

---

## Technology Stack

| Layer                | Technologies                             |
| -------------------- | ---------------------------------------- |
| Frontend             | React, TypeScript, Vite                  |
| Styling              | Tailwind CSS                             |
| Routing              | React Router                             |
| Data Fetching        | TanStack Query                           |
| 3D Visualization     | Three.js, React Three Fiber, Drei        |
| Animation            | GSAP                                     |
| Forms and Validation | React Hook Form, Zod                     |
| Backend              | Node.js, Express, TypeScript             |
| Database             | MongoDB, Mongoose                        |
| Authentication       | Server-side sessions, cookies, CSRF      |
| Payments             | Stripe Checkout and Webhooks             |
| Testing              | Vitest, Supertest, React Testing Library |
| Database Testing     | MongoDB Memory Server                    |
| Frontend Hosting     | Vercel                                   |
| Backend Hosting      | Render                                   |
| Cloud Database       | MongoDB Atlas                            |
| Version Control      | Git, GitHub                              |

---

## System Architecture

Forma uses an npm-workspaces monorepo with separate frontend and backend applications.

**Request flow:**

1. A customer accesses the React storefront hosted on Vercel.
2. The frontend makes requests to relative `/api` endpoints.
3. Vercel proxies those requests to the Express API hosted on Render.
4. Express handles authentication, validation, and business logic.
5. Mongoose communicates with MongoDB Atlas.
6. Stripe handles test payment collection through hosted Checkout.
7. Verified Stripe webhooks notify the backend about payment events.
8. The backend updates order and inventory state in MongoDB.

**Deployment architecture:**

- **Vercel:** React storefront and administrative interface
- **Render:** Express API and server-side business logic
- **MongoDB Atlas:** Products, users, carts, orders, and audit data
- **Stripe:** Hosted Checkout and webhook delivery in test mode

The frontend and backend remain independently deployable.

---

## Project Structure

The main repository structure is:

```text
forma/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── middleware/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── validators/
│   │   │   ├── scripts/
│   │   │   ├── tests/
│   │   │   ├── app.ts
│   │   │   └── server.ts
│   │   ├── package.json
│   │   └── tsconfig.build.json
│   │
│   └── web/
│       ├── public/
│       ├── src/
│       │   ├── components/
│       │   ├── features/
│       │   ├── hooks/
│       │   ├── layouts/
│       │   ├── lib/
│       │   ├── pages/
│       │   ├── routes/
│       │   ├── styles/
│       │   └── main.tsx
│       ├── index.html
│       └── package.json
│
├── docs/
├── scripts/
├── .gitignore
├── package.json
├── package-lock.json
├── render.yaml
├── vercel.json
└── README.md
```

The monorepo structure keeps the customer-facing application separate from server-side services and database operations.

---

## Getting Started

### Prerequisites

To run Forma locally, you'll need:

- Node.js compatible with the repository's package configuration
- npm
- MongoDB, configured as a replica set
- Stripe account in test mode
- Stripe CLI for local webhook testing
- Git

A MongoDB replica set is required for the order and inventory transactions used by checkout.

### 1. Clone the Repository

```bash
git clone https://github.com/divineconnect135/forma.git
cd forma
```

### 2. Install Dependencies

Install all workspace dependencies from the repository root:

```bash
npm ci
```

### 3. Configure Backend Environment Variables

Create the local API environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and configure the variables required by the existing API environment schema.

Key configuration includes:

| Variable                | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| `MONGODB_URI`           | MongoDB connection string                 |
| `SESSION_SECRET`        | Server-side session signing secret        |
| `STRIPE_SECRET_KEY`     | Stripe test-mode secret key               |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret             |
| `NODE_ENV`              | Application environment                   |
| `PORT`                  | Express HTTP port                         |
| `TRUST_PROXY`           | Reverse-proxy configuration when deployed |

Additional frontend-origin or Stripe return-URL settings must match the variable names defined in the API's configuration files.

**Never commit `.env` files, MongoDB passwords, or Stripe secret keys to GitHub.**

### 4. Start MongoDB

Ensure your local MongoDB replica set is available.

You can also connect to a MongoDB Atlas development database using a suitable `MONGODB_URI`.

For checkout transactions to work, the connected MongoDB deployment must support transactions.

### 5. Seed Demo Products

Forma includes product and variant seed scripts:

```bash
npm run seed:products -w @forma/api
npm run seed:variants -w @forma/api
```

Review the seed scripts and confirm the target database before executing them. Seeding a remote database should be an intentional operation.

### 6. Start the Development Servers

From the repository root:

```bash
npm run dev
```

The Vite frontend is typically available at:

`http://localhost:5173`

The Express API uses the port configured in the backend environment.

### 7. Configure Local Stripe Webhooks

Install and authenticate the Stripe CLI, then forward events to your locally running API:

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

Replace port `4000` if your API is configured to use another port.

Copy the webhook signing secret printed by Stripe CLI into your local `STRIPE_WEBHOOK_SECRET` configuration.

Stripe Checkout requires the appropriate test API credentials and return URLs.

---

## Testing

Forma includes unit and integration tests for frontend and backend functionality.

### Backend Tests

```bash
npm run test -w @forma/api -- --no-file-parallelism
```

Backend integration tests use MongoDB Memory Server, including replica-set testing for transactional operations.

### Frontend Tests

```bash
npm run test -w @forma/web
```

### TypeScript Validation

```bash
npm run typecheck -w @forma/api
npm run typecheck -w @forma/web
```

### Linting

```bash
npm run lint
```

### Production Build

```bash
npm run build
```

### Full Verification

The project includes a verification script:

```bash
node scripts/phase7-check.mjs
```

This runs TypeScript checks, tests, linting, and production build verification.

Test coverage includes authentication, API authorization, cart operations, checkout preparation, payment recovery, inventory updates, administrative operations, and related regression scenarios.

---

## API Overview

Forma exposes a REST API under `/api`.

### Authentication

| Method | Endpoint             | Description                 |
| ------ | -------------------- | --------------------------- |
| GET    | `/api/auth/csrf`     | Obtain CSRF protection data |
| POST   | `/api/auth/register` | Register a customer         |
| POST   | `/api/auth/login`    | Authenticate a customer     |

Additional authenticated session and logout operations are implemented in the authentication routes.

### Products

| Method | Endpoint              | Description                |
| ------ | --------------------- | -------------------------- |
| GET    | `/api/products`       | Paginated product catalog  |
| GET    | `/api/products/:slug` | Individual product details |

### Cart

| Method | Endpoint              | Description                |
| ------ | --------------------- | -------------------------- |
| GET    | `/api/cart`           | Retrieve the shopping cart |
| POST   | `/api/cart/items`     | Add an item                |
| PATCH  | `/api/cart/items/:id` | Update a cart item         |
| DELETE | `/api/cart/items/:id` | Remove a cart item         |

### Checkout

| Method | Endpoint                          | Description                      |
| ------ | --------------------------------- | -------------------------------- |
| GET    | `/api/checkout/preview`           | Preview order details            |
| GET    | `/api/checkout/active`            | Find an active checkout          |
| POST   | `/api/checkout/session`           | Create a Stripe Checkout Session |
| POST   | `/api/checkout/resume`            | Resume an existing checkout      |
| GET    | `/api/checkout/status/:sessionId` | Retrieve checkout order status   |

### Orders

| Method | Endpoint          | Description                     |
| ------ | ----------------- | ------------------------------- |
| GET    | `/api/orders`     | Retrieve customer order history |
| GET    | `/api/orders/:id` | Retrieve an individual order    |

### Administration

Administrative endpoints under `/api/admin` provide protected operations for managing products, variants, inventory, orders, customers, and audit history.

### Health and Webhooks

| Method | Endpoint               | Description                      |
| ------ | ---------------------- | -------------------------------- |
| GET    | `/api/health/live`     | API liveness                     |
| GET    | `/api/health`          | API and database health          |
| POST   | `/api/webhooks/stripe` | Verified Stripe event processing |

Protected endpoints require authentication and, where applicable, a valid CSRF token and administrator privileges.

---

## Stripe Test Payments

Forma integrates Stripe Checkout in test mode.

To test a successful payment, use:

| Field        | Test Value            |
| ------------ | --------------------- |
| Card number  | `4242 4242 4242 4242` |
| Expiration   | Any valid future date |
| CVC          | Any three digits      |
| Payment mode | Test                  |

The checkout process creates a pending order and reserves stock before redirecting to Stripe.

After a confirmed payment, the webhook handler settles the order, updates inventory, and reconciles purchased cart items.

If a Checkout Session expires without payment, inventory reservations can be released after verifying the session state.

**A browser redirect alone is not sufficient proof of payment.** Payment status must be established through trusted Stripe events or server-side reconciliation.

---

## Deployment

Forma uses separate cloud services for the frontend, API, and database.

### Frontend — Vercel

The React/Vite application is deployed to Vercel.

The deployment builds the `@forma/web` workspace and serves the compiled frontend.

Vercel rewrites forward `/api` requests to the Render backend, allowing the browser to use relative API URLs.

### Backend — Render

The Express application is deployed as a Node.js web service on Render.

The backend:

- Builds TypeScript into JavaScript
- Starts the compiled Express server
- Connects to MongoDB Atlas
- Exposes health-check endpoints
- Handles authentication, orders, and Stripe webhooks

### Database — MongoDB Atlas

MongoDB Atlas stores application data, including:

- Users
- Products and variants
- Shopping carts
- Orders
- Inventory reservations
- Administrative audit logs

### Payment Provider — Stripe

The deployed application uses Stripe Test Mode.

Hosted Stripe webhook destinations send events to the Render API.

Secrets are configured through hosting environment variables and are not stored in the repository.

---

## Current Scope and Limitations

Forma was built as an engineering portfolio demonstration, not a production payment business.

The current implementation includes important safeguards, but it does not claim to provide:

- Real-money Stripe payment support
- Production tax calculations
- Production shipping rate calculation or carrier integration
- Complete refunds and dispute handling
- Guaranteed unattended payment reconciliation
- Automated manual-review resolution for ambiguous Stripe transactions
- Distributed rate limiting across multiple API instances
- A fully audited production accessibility experience
- Server-rendered or prerendered product SEO

Free hosting may also introduce cold starts that affect API response times and webhook reliability.

These areas would require additional engineering and operational verification before commercial use.

---

## Engineering Highlights

### Transactional Inventory Management

Checkout reserves stock using MongoDB transactions and conditional updates. Payment confirmation commits the reservation, while verified expiration releases it.

### Idempotent Payment Processing

Checkout requests use idempotency identifiers and saved order records to reduce duplicate orders and reservations. Existing Stripe Sessions can be recovered and reused when safe.

### Authentication and Authorization

Sessions, CSRF checks, server-side user roles, and admin middleware help protect customer data and sensitive operations.

### Separation of Responsibilities

Route handlers process HTTP concerns, services implement business rules, Mongoose models handle persistence, and frontend components focus on user interaction.

### Deployment and Testing

The project demonstrates integration testing, production TypeScript builds, a cloud-hosted database, and separate frontend/backend deployment pipelines.

---

## Future Improvements

Planned enhancements for a production-oriented version include:

- Automated deployment verification and CI/CD improvements
- Scheduled payment reconciliation and alerting
- Refund and dispute workflows
- Real shipping and tax integration
- Product image optimization and CDN improvements
- Additional end-to-end browser tests
- Enhanced accessibility for animated and 3D content
- Product-level SEO prerendering
- Operational monitoring and error tracking

---

## Project Purpose

Forma was developed to strengthen practical skills in:

- Full-stack TypeScript development
- Modern React application architecture
- REST API design
- Authentication and authorization
- MongoDB schema design and transactions
- Payment integration and event-driven workflows
- 3D web interfaces and animation
- Automated testing
- Cloud deployment and debugging

The project brings these technologies together in a realistic e-commerce workflow, from product discovery through test checkout and administrative order management.

---

## Author

Developed as a full-stack portfolio project.

**GitHub:** [divineconnect135](https://github.com/divineconnect135)

**Repository:** [divineconnect135/forma](https://github.com/divineconnect135/forma)

---

**Forma — A design-focused shopping experience built with modern full-stack technologies.**
