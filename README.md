# Farhad — forest portfolio

Angular 21 and Three.js portfolio on `codex/modern-3d`. The original forest route, seven holographic stops, projector rings and zone map are preserved. The separate `main` branch is not part of this design change.

## Local development

```sh
npm ci
npm start
```

During local development, both `/` and `/experience` open the forest, while `/page` provides its accessible text fallback. In production, the standard portfolio remains at `https://hmfarhad.github.io/` and the forest is available only at `https://hmfarhad.github.io/experience/`.

## Content and implementation

- All authored career, project, education and writing records remain in `src/app/core/content/zones.ts`.
- Forest interface: `src/app/components/experience/`.
- Camera, route and scene lifecycle: `src/app/three/forest-scene.ts`.
- Original forest, lighting and holograms: `src/app/three/world/`.
- Downloadable resume: `public/assets/documents/Hossain_MD_Farhad_Resume.pdf`.
- Fonts are hosted locally with their licenses.

The current role remains Software Engineer at Nexetic Oy, September 2026–present. Prime Tech ends December 2022. This visual refinement does not edit profile content or the resume.

## Interaction

Scroll or drag along the original route; use the zone map or arrow keys to select a stop. Map navigation eases through the route with smooth acceleration and deceleration, stable eye height and damped camera rotation. Holograms fade as visitors pass through them. The original binary rain reveal is faster and lighter; card transitions ease in and out.

Experience, Projects and Blogs retain their in-world carousels, with direct previous/next buttons and an item counter. “Read panel” enlarges the current content in an accessible dialog without losing the visitor's place. The renderer pauses while the reader is open or the browser tab is hidden.

Reduced motion follows the system preference and can be changed from the existing HUD. The forest includes loading and failure states with an always-available text route. Contact controls appear on arrival, and the form does not intercept editing keys. EmailJS remains optional; without configuration the form opens an email draft.

## Validation

```sh
npm test -- --watch=false
npm run build
```

Tests cover the original stops, profile data, navigation, motion preference, carousel controls, text reader, wheel normalization, loading failure, lifecycle cleanup and form error handling. Production builds prerender three routes. Desktop and mobile browser checks supplement these tests; a physical touch-device performance review is still useful before release.

## Publishing

The workflow publishes `main` at the root address and places the `Redesign` build under `/experience/`. These changes remain local on `codex/modern-3d`; nothing has been deployed.
