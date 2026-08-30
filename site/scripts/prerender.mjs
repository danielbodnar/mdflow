import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { LazyMotion } from 'framer-motion';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const siteRoot = fileURLToPath(new URL('../', import.meta.url));
const outputPath = path.join(siteRoot, 'dist/index.html');
const [template, packageSource] = await Promise.all([
  readFile(outputPath, 'utf8'),
  readFile(new URL('../../package.json', import.meta.url), 'utf8'),
]);
const pkg = JSON.parse(packageSource);
const canonical = 'https://mdflow.dev/';
const repository = pkg.repository.url.replace(/\.git$/, '');
const npm = `https://www.npmjs.com/package/${encodeURIComponent(pkg.name)}`;
const description = template.match(/<meta\s+name="description"\s+content="([^"]+)"\s*\/?\s*>/)?.[1];
if (!description) throw new Error('The homepage must declare its product description.');

function fillSlot(html, name, content) {
  const start = `<!-- mdflow:${name}:start -->`;
  const end = `<!-- mdflow:${name}:end -->`;
  const from = html.indexOf(start);
  const to = html.indexOf(end, from + start.length);
  if (from === -1 || to === -1) {
    throw new Error(`Missing ${name} prerender slot in dist/index.html; run Vite build first.`);
  }
  return html.slice(0, from + start.length) + content + html.slice(to);
}

// Vite transforms the same TSX components as the client build. Middleware
// mode is a module loader here: no HTTP listener, browser, or DOM emulation.
// The ordinary client entry and all emitted asset URLs remain untouched.
const server = await createServer({
  root: siteRoot,
  configFile: false,
  appType: 'custom',
  plugins: [react()],
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const [{ default: App }, { default: motionFeatures }] = await Promise.all([
    server.ssrLoadModule('/App.tsx'),
    server.ssrLoadModule('/motionFeatures.ts'),
  ]);
  const homepage = renderToString(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(
        LazyMotion,
        { features: motionFeatures, strict: true },
        React.createElement(App),
      ),
    ),
  );
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
    '@id': `${canonical}#software`,
    name: pkg.name,
    description,
    url: canonical,
    applicationCategory: 'DeveloperApplication',
    softwareVersion: pkg.version,
    license: `https://spdx.org/licenses/${encodeURIComponent(pkg.license)}.html`,
    codeRepository: repository,
    downloadUrl: npm,
    programmingLanguage: 'TypeScript',
    isAccessibleForFree: true,
    author: {
      '@type': 'Person',
      name: 'John Lindquist',
      url: 'https://github.com/johnlindquist',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'The mdflow CLI is free, MIT-licensed software. External engines and model providers may charge separately.',
      url: npm,
    },
    sameAs: [repository, npm],
  };
  const json = JSON.stringify(structuredData).replaceAll('<', '\\u003c');
  let html = fillSlot(template, 'homepage', `<div id="root" data-prerendered="true">${homepage}</div>`);
  html = fillSlot(html, 'structured-data', `<script type="application/ld+json">${json}</script>`);
  await writeFile(outputPath, html);
  console.log('Prerendered the homepage from React components into dist/index.html');
} finally {
  await server.close();
}
