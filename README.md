# Farhad — portfolio

Angular 21 portfolio with a progressively enhanced Three.js sculpture, accessible HTML content, and a text-only route.

## Local development

```sh
npm ci
npm start
```

Open http://localhost:4200. Both `/` and `/experience` show the redesigned portfolio. `/page` offers the text version. The deployment workflow also assembles the separate `main` branch under `/legacy/`.

## Content

- Career, project, education and writing records: `src/app/core/content/zones.ts`.
- Main experience: `src/app/components/experience/`.
- Procedural 3D sculpture: `src/app/three/sculpture-scene.ts`.
- Downloadable resume: `public/assets/documents/Hossain_MD_Farhad_Resume.pdf`.
- Resume builder: `python3 scripts/build-resume.py` (requires ReportLab).
- Fonts are hosted locally; their OFL licenses are included alongside them.

The current role is Software Engineer at Nexetic Oy, September 2026–present. Prime Tech ends December 2022, as confirmed by the owner.

## Behavior

The hero offers three sculptures, pointer interaction, and a pause control. Reduced motion is honored, and animation stops when the hero is outside the viewport or the tab is hidden. Written content is prerendered and does not require WebGL. If rendering is unavailable, a static composition takes its place.

The project archive preserves all 16 projects with category filtering. Career details expand independently. The contact form uses the existing EmailJS configuration when available and otherwise prepares a draft in the visitor’s email app; it never reports an unsent draft as delivered.

## Validation

```sh
npm test -- --watch=false
npm run build
```

Unit checks cover navigation, project filtering, reduced motion controls, fallback content, and form submission states. Build checks prerender `/`, `/experience`, and `/page`. Browser visual review remains necessary before release; automated browser access was blocked by an unavailable browser security check during this update.

The whole-page component stylesheet has a 20 kB warning / 24 kB error budget; the production stylesheet is about 18 kB before transfer compression. The sculpture engine is loaded separately from the initial application.

## Publishing

The existing GitHub Pages workflow combines the `Redesign` branch with `main`. Apply the modern UI changes to `Redesign` and the companion profile/resume changes to `main` before deploying. The work is currently local and has not been published.
