// Template for src/environments/environment.ts and environment.prod.ts.
// The actual env files are generated at build time by scripts/inject-env.mjs
// using EMAILJS_PUBLIC_KEY / EMAILJS_SERVICE_ID / EMAILJS_TEMPLATE_ID
// (set as shell env vars locally, or as GitHub Actions repo secrets in CI).
// Both generated files are gitignored.
export const environment = {
  production: false,
  emailjs: {
    publicKey: '',  // EMAILJS_PUBLIC_KEY
    serviceId: '',  // EMAILJS_SERVICE_ID
    templateId: '' // EMAILJS_TEMPLATE_ID
  }
};
