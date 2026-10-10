# Farhad — forest portfolio

Angular 21 and Three.js portfolio on `codex/modern-3d`. The original forest route and its seven stops are preserved, now as a misty-morning forest with a natural landmark at each stop and a zone map to jump between them. The separate `main` branch is not part of this design change.

## Local development

```sh
npm ci
npm start
```

During local development, both `/` and `/experience` open the forest. The former `/page` route redirects to the standard portfolio. In production, the complete blue portfolio remains at `https://hmfarhad.github.io/` and the forest is available only at `https://hmfarhad.github.io/experience/`.

## Content and implementation

- All authored career, project, education and writing records remain in `src/app/core/content/zones.ts`.
- Forest interface (header, trail rail, guided journey, input routing): `src/app/components/experience/`.
- Station cards (the field-journal pages shown at each stop, including the contact form): `src/app/components/experience/station-card/`.
- Ambient forest sound (procedural Web Audio, no audio files): `src/app/core/audio/ambience.ts`.
- Camera, route and scene lifecycle: `src/app/three/forest-scene.ts`.
- Misty forest, terrain, lighting and the natural landmarks at each stop: `src/app/three/world/`.
- Downloadable resume: `public/assets/documents/Hossain_MD_Farhad_Resume.pdf`.
- Fonts are hosted locally with their licenses.

The current role remains Software Engineer at Nexetic Oy, September 2026–present. Prime Tech ends December 2022. This visual refinement does not edit profile content or the resume.

## Interaction

Walk a narrow path through a misty morning forest by scrolling, dragging or using the arrow keys. Each of the seven stops is marked by a natural landmark beside the path: an ancient lantern tree, a bamboo grove, a fallen log, a stream crossing, mossy boulders, a ring of glowing mushrooms and a campfire. Click or tap a landmark, or use the trail dots, to walk straight to it.

When you arrive, a pale field-journal card slides in beside the path with that stop's content as real, selectable text. It is a bottom sheet on phones; drag its handle or use the expand button to read more. Experience, Projects and Blogs are paged inside the card with previous/next buttons, left/right arrow keys or a sideways swipe. Scrolling at one of these stops turns the pages first and walks on only after the last page; scrolling inside a long card reads it before the trail moves. "Continue the trail" walks to the next stop, and the last stop offers a walk back to the start. Focus moves to the card title only after a deliberate jump, never while scrolling freely.

The guided journey visits every stop and every card page with a visible reading timer, and can be paused, stepped or exited at any time. The menu in the top corner holds ambient sound (off by default, remembered per browser, started only after a click or key press), the reduced-motion switch, which follows the system preference, and the link back to the standard portfolio. Sound and rendering pause while the tab is hidden or the journey is paused. Escape closes the menu, then a raised sheet, then the contact form. The forest includes loading and failure states with an always-available text route. Contact links and the message form live in the final card and do not intercept editing keys. EmailJS remains optional; without configuration the form opens an email draft.

## Validation

```sh
npm test -- --watch=false
npm run build
```

Tests cover the original stops, profile data, trail-rail navigation and announcements, motion preference, station cards opening only on arrival, in-card paging from buttons, keys, swipes and the wheel (including handing leftover scroll back to the trail), the guided journey paging through every card, the Continue action, focus handling, gesture-gated and remembered sound, the settings menu, the phone bottom sheet, wheel normalization, loading failure, lifecycle cleanup and form error handling. Production builds prerender three routes. Desktop and mobile browser checks supplement these tests; a physical touch-device performance review is still useful before release.

## Publishing

The workflow publishes `main` at the root address and places the `Redesign` build under `/experience/`. These changes remain local on `codex/modern-3d`; nothing has been deployed.
