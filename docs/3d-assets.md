# Forma — 3D Assets and Performance

## Overview

Forma uses React Three Fiber, Three.js, and Drei for
interactive 3D product previews.

Three products initially use original procedural geometry:

| Product           | Slug              | Built-in model |
| ----------------- | ----------------- | -------------- |
| Orbit Desk Lamp   | orbit-desk-lamp   | Lamp           |
| Arc Lounge Chair  | arc-lounge-chair  | Chair          |
| Modular Desk Tray | modular-desk-tray | Tray           |

These models are illustrative demonstrations, not
photorealistic representations of physical merchandise.

## Imported GLB assets

Store original or properly licensed models in:

apps/web/public/models/

Example:

apps/web/public/models/orbit-desk-lamp.glb

The publicly accessible URL will be:

/models/orbit-desk-lamp.glb

Associate the URL with the product's `modelUrl` field
in MongoDB through an authorized development script or,
later, the administration interface.

Only local /models/*.glb paths are accepted by the
current viewer.

## Color customization

The procedural demonstration models support the colors
mapped in modelRegistry.ts.

For imported GLB models, give a MeshStandardMaterial
the exact name `FormaColor` if its base color should
follow the selected product variant.

Other imported materials retain their original colors.

## Asset attribution

For every imported asset, record:

- Product and model filename
- Creator
- Source URL
- License
- Attribution requirements
- Modifications performed

Do not use models with unclear commercial or
redistribution rights.

## Performance targets

These are initial goals, not measured results.

- Lazy-load 3D code.
- Render only when requested.
- Prefer GLB files around 2 MB or less where practical.
- Prefer appropriately compressed textures.
- Use 1K textures as an initial target.
- Limit unnecessary draw calls and geometry complexity.
- Pause rendering when the viewer is offscreen.
- Cap device pixel ratio to reduce GPU load.
- Keep static image fallbacks available.

## Accessibility

- Preserve keyboard-accessible viewer buttons.
- Allow resetting the camera.
- Support mouse and touch interactions.
- Respect prefers-reduced-motion.
- Do not require 3D to complete shopping actions.
- Display meaningful fallback content if WebGL fails.

## Manual browser tests

Test each 3D-enabled product:

1. Open the details page.
2. Click View in 3D.
3. Rotate the model.
4. Zoom in and out.
5. Reset the camera.
6. Change an available color variant.
7. Return to the static image.
8. Add the product to the cart.
9. Confirm the cart remains functional.

Test on desktop and mobile.

Also test the page with reduced motion enabled and
with WebGL unavailable.

## Performance measurement

Use Lighthouse and browser performance tools.

Record actual measurements for:

- Largest Contentful Paint
- Total JavaScript transferred
- GLB transfer size
- Model loading time
- Mobile responsiveness
- Accessibility issues

Do not claim a performance target was met until
it has been measured on a documented device/profile.
