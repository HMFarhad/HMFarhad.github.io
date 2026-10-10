import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Run after both builds have been merged: main owns the canonical homepage.
const site = resolve(process.argv[2] ?? '_site');
const origin = 'https://hmfarhad.github.io';
const home = readFileSync(resolve(site, 'index.html'), 'utf8');
if (!home.includes('google-site-verification') || !/<h1[\s>]/.test(home)) {
  throw new Error('The homepage must include verification and prerendered content.');
}

const experiencePath = resolve(site, 'experience/index.html');
let experience = readFileSync(experiencePath, 'utf8');
experience = experience
  .replace(/<title>.*?<\/title>/s, '<title>Hossain Farhad | Interactive 3D Portfolio</title>')
  .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, '')
  .replace(/<meta\b(?=[^>]*(?:name|property)=["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'])[^>]*>/gi, '');
experience = experience.replace('</head>', `
  <meta name="description" content="Explore Hossain Farhad's interactive 3D portfolio, an optional immersive tour of his software engineering work, projects, and experience.">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${origin}/experience/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Hossain Farhad">
  <meta property="og:title" content="Hossain Farhad | Interactive 3D Portfolio">
  <meta property="og:description" content="An immersive tour of Hossain Farhad's software engineering work, projects, and experience.">
  <meta property="og:url" content="${origin}/experience/">
  <meta property="og:image" content="${origin}/assets/images/profile.jpg">
  <meta property="og:image:alt" content="Hossain Farhad">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Hossain Farhad | Interactive 3D Portfolio">
  <meta name="twitter:description" content="An immersive tour of Hossain Farhad's software engineering work, projects, and experience.">
  <meta name="twitter:image" content="${origin}/assets/images/profile.jpg">
</head>`);
writeFileSync(experiencePath, experience);

// Unknown URLs must not present the full homepage as an indexable duplicate.
writeFileSync(resolve(site, '404.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found | Hossain Farhad</title><meta name="robots" content="noindex, follow"></head>
<body><main><h1>Page not found</h1><p>The requested page could not be found.</p>
<p><a href="/">Visit Hossain Farhad's portfolio</a></p><p><a href="/experience/">Explore the 3D portfolio</a></p></main></body></html>`);
writeFileSync(resolve(site, 'experience/404.html'), experience.replace('content="index, follow, max-image-preview:large"', 'content="noindex, follow"'));
console.log('Prepared homepage, 3D metadata, and noindex error pages.');
