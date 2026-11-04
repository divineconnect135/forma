# Forma — Phase 7 Release Checklist

## Project

Forma is a full-stack e-commerce application featuring:

- React, TypeScript, Vite and Tailwind CSS
- Express and MongoDB
- Session-based authentication and CSRF protection
- Customer shopping cart and product catalog
- Stripe Checkout in test mode
- Transactional inventory reservations
- Three.js product visualization
- GSAP animations
- Administrative product and order management

## 1. Automated verification

Run from the repository root:

```bash
node scripts/phase7-check.mjs
```

Required results:

- [ ] Backend TypeScript passes
- [ ] Frontend TypeScript passes
- [ ] All backend tests pass
- [ ] All frontend tests pass
- [ ] ESLint passes
- [ ] Production build succeeds

Do not mark Phase 7 verified while tests are failing.

## 2. Authentication and authorization

- [ ] Registration creates customer accounts only
- [ ] Login works with valid credentials
- [ ] Invalid credentials are rejected
- [ ] Logout invalidates the session
- [ ] Customer order data is private
- [ ] Customers cannot access admin APIs
- [ ] Administrators can access admin APIs
- [ ] Revoking admin role removes API access
- [ ] CSRF protection rejects invalid tokens
- [ ] Passwords and session secrets do not appear in API responses

## 3. Customer experience

- [ ] Homepage loads
- [ ] Product listing loads
- [ ] Search and filters work
- [ ] Product details load
- [ ] Three.js viewer displays the configured product
- [ ] Product variants can be selected
- [ ] Cart quantities update correctly
- [ ] Cart persists after refresh
- [ ] Checkout preview displays correct prices
- [ ] My Orders shows the signed-in customer's orders
- [ ] Order details show saved purchase prices

## 4. Stripe and inventory

- [ ] Checkout opens Stripe test mode
- [ ] A valid test payment is processed
- [ ] Webhook signature is verified
- [ ] Paid order status is recorded
- [ ] Inventory is committed exactly once
- [ ] Duplicate webhook does not deduct stock twice
- [ ] Expired checkout releases reservations
- [ ] Uncertain payments remain pending for investigation
- [ ] Existing checkout can be resumed
- [ ] Checkout retry does not duplicate reservations
- [ ] Purchased cart items are reconciled
- [ ] Unrelated cart items remain unchanged
- [ ] Reconciliation command reports unresolved orders

## 5. Admin dashboard

- [ ] Overview statistics load
- [ ] Products can be created
- [ ] Products can be edited and archived
- [ ] Variants can be created and edited
- [ ] Stock adjustments preserve reservations
- [ ] Stock changes have audit reasons
- [ ] Pending payments cannot be fulfilled
- [ ] Paid orders can progress through fulfillment
- [ ] Customer overview does not expose passwords
- [ ] Admin audit logs show completed changes

## 6. Accessibility

- [ ] Keyboard focus is visible
- [ ] Main content can be reached using keyboard navigation
- [ ] Interactive elements have accessible labels
- [ ] Forms display validation errors
- [ ] Page headings follow a logical hierarchy
- [ ] Color contrast is checked
- [ ] Mobile layout works at 320px and 375px widths
- [ ] Reduced-motion mode is manually tested
- [ ] GSAP animations respect reduced-motion preferences
- [ ] Three.js viewer has a usable non-animated fallback

## 7. SEO

- [ ] Homepage title and description are correct
- [ ] Product listing metadata is correct
- [ ] Product pages show the intended metadata
- [ ] Admin routes have noindex metadata
- [ ] Customer routes have noindex metadata
- [ ] Canonical URLs use the deployed domain
- [ ] Unknown routes are not indexed
- [ ] Page metadata is verified after client navigation

## 8. Performance

- [ ] Production build completes
- [ ] Public pages load without the full admin UI bundle
- [ ] Three.js code is loaded only where necessary
- [ ] Images are appropriately compressed
- [ ] Product images have correct dimensions
- [ ] No major browser console errors occur
- [ ] Mobile performance is measured with Lighthouse
- [ ] Bundle sizes are compared with the previous build
- [ ] Slow network behavior is tested
- [ ] Page navigation works after refreshing deep links

## 9. Security review

- [ ] No secrets are committed to Git
- [ ] No .env file is publicly accessible
- [ ] MongoDB connection credentials are protected
- [ ] Rate limits work on sensitive endpoints
- [ ] Private API responses are not cached
- [ ] Invalid JSON returns structured errors
- [ ] Oversized payloads are rejected
- [ ] Stripe webhooks require valid signatures
- [ ] Server errors do not expose stack traces
- [ ] Dependencies are reviewed for vulnerabilities

## 10. Known limitations before production

These must not be treated as implemented:

- Production tax and shipping calculations
- Live Stripe payment activation
- Refund and dispute management
- Scheduled and monitored payment reconciliation
- Manual-review resolution for ambiguous Stripe Sessions
- Distributed rate-limit storage for multiple API instances
- Full customer cart revision tracking
- Complete accessibility audit of GSAP and Three.js
- Product-specific prerendered SEO and search indexing
- Production monitoring, backup and recovery configuration

## 11. Release decision

Phase 7 is accepted only after:

1. All automated checks pass.
2. Customer checkout is verified in Stripe test mode.
3. Admin permissions and protected routes are verified.
4. Browser, accessibility and performance checks are completed.
5. Remaining risks are documented.

Phase 8 covers production deployment configuration and
additional operational readiness work.
