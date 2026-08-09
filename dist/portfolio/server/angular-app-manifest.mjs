
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: undefined,
  entryPointToBrowserMapping: {
  "src/app/components/entry/entry.component.ts": [
    "chunk-QJ3LT4KO.js"
  ],
  "src/app/three/forest-scene.ts": [
    "chunk-4BLJIDE5.js",
    "chunk-6ZMH7O7J.js",
    "chunk-BA6JTYTV.js"
  ],
  "src/app/components/experience/experience.component.ts": [
    "chunk-SYNF76M5.js",
    "chunk-6ZMH7O7J.js",
    "chunk-BA6JTYTV.js"
  ],
  "src/app/components/page/page.component.ts": [
    "chunk-TJ2PDY66.js",
    "chunk-BA6JTYTV.js"
  ]
},
  assets: {
    'index.csr.html': {size: 5026, hash: '7809189dfc9cd7a75294f7425b5bb5532ef449344bcf127397a5beb1c79d726b', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 5200, hash: '95e80c683df1407bf213d01058089b2c7fd24c0c688cce5257121b3842bee01c', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-B7MS4UWR.css': {size: 214, hash: 'o6aeU1+1sI8', text: () => import('./assets-chunks/styles-B7MS4UWR_css.mjs').then(m => m.default)}
  },
};
