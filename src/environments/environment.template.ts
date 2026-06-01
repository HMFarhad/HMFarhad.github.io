// Template for src/environments/environment.ts and environment.prod.ts.
// The actual env files are generated at build time by scripts/inject-env.mjs
// using the following env vars (set them locally in your shell, or as
// GitHub Actions repository secrets in CI):
//   EMAILJS_PUBLIC_KEY
//   EMAILJS_SERVICE_ID
//   EMAILJS_TEMPLATE_ID            -> notification email to site owner
//   EMAILJS_AUTOREPLY_TEMPLATE_ID  -> optional confirmation to the sender
// Both generated files are gitignored.
export const environment = {
  production: false,
  emailjs: {
    publicKey: '',           // EMAILJS_PUBLIC_KEY
    serviceId: '',           // EMAILJS_SERVICE_ID
    templateId: '',          // EMAILJS_TEMPLATE_ID (notify owner)
    autoReplyTemplateId: ''  // EMAILJS_AUTOREPLY_TEMPLATE_ID (reply to sender)
  }
};
