// Renders site/content/*.md and the supporting site pages below into static
// HTML at dist/<slug>/index.html and Markdown at dist/<slug>.md.
// Runs after Vite and homepage prerendering. Frontmatter supplies the same
// title, description, and optional original source URL for both formats.

import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const contentDir = path.join(root, 'content');
const distDir = path.join(root, 'dist');

const repoRoot = path.dirname(root);
const facts = JSON.parse(readFileSync(path.join(root, 'src/facts.json'), 'utf8'));
const repo = facts.repo;

// Kept beside the renderer so these small pages use the existing article
// design and metadata convention without a second content system.
const supportingPages = [
    {
        slug: 'about',
        sources: ['README.md', 'package.json', 'LICENSE'],
        raw: `---
title: About mdflow
description: A Git-native, open-source CLI for repeatable agent work, with inspectable inputs, behavioral evals, and proposal-first evolution.
---

# About mdflow

mdflow is a Git-native control plane for repeatable agent work. Define a job as a Markdown file, keep it in a project's \`flows/\` directory, and run it on an installed agent CLI. Frontmatter supplies configuration; the body supplies the prompt. The flow stays readable, reviewable in a pull request, and reusable by a teammate or coding agent.

## When to use it

Use mdflow for work you expect to repeat: code review, release notes, issue triage, and other jobs that benefit from shared instructions and declared inputs. It is not a hosted agent service. Your local environment supplies the engine, credentials, files, and permissions. The default engine is **${facts.defaultEngine}**; supported engine names are ${facts.engines.map((engine) => `\`${engine}\``).join(', ')}. An engine must be installed and configured before it can run a flow.

## Inspect, evaluate, then improve

Start with \`md doctor --json\` for a static readiness report. Inspect an individual flow with \`md explain <flow.md> --json\`, noting that imports may resolve. Colocated behavioral evals can check a flow's declared behavior, but a suite's presence is not proof that it passes. Evolution records feedback and creates private proposals; changing the source requires a separate, explicit apply decision.

## Open source and project ownership

The project lives at [johnlindquist/mdflow](${repo}) and is distributed under the [MIT license](${repo}/blob/main/LICENSE). The CLI is free; engine subscriptions or provider usage can cost money. See [pricing and costs](https://mdflow.dev/pricing.md), [the documentation](https://mdflow.dev/docs/), and [contact and security reporting](https://mdflow.dev/contact/). The repository is the authoritative place to inspect the implementation, release history, license, and contribution guidance.
`,
    },
    {
        slug: 'contact',
        sources: ['SECURITY.md', 'CONTRIBUTING.md', 'package.json'],
        raw: `---
title: Contact and security — mdflow
description: Report mdflow bugs through GitHub issues and security vulnerabilities privately through GitHub Security Advisories.
---

# Contact and security

mdflow's public project contact is its [GitHub repository](${repo}). Use the channels below so a reproducible bug, documentation correction, or security report reaches the appropriate place. This site does not offer a support inbox, contact form, or hosted account dashboard.

## Bugs, questions, and documentation

Search [existing GitHub issues](${repo}/issues) before [opening an issue](${repo}/issues/new). For a CLI problem, include the output of \`md --version\`, your operating system, the engine and its version, the command you ran, the observed result, and a minimal flow that reproduces the issue. Explain what you expected instead. Read the [contribution guide](${repo}/blob/main/CONTRIBUTING.md) before proposing a change.

Issues are public. Remove credentials, private prompts, repository contents, and personal information before posting logs or diagnostics. \`md explain\` can include the resolved prompt and arguments; do not paste that output without reviewing it. You can also use issues to report an inaccurate page or ask a question about the website's privacy behavior without including sensitive data.

## Private vulnerability reports

Report vulnerabilities through [GitHub Security Advisories](${repo}/security/advisories/new), not a public issue with exploit details. Include the affected version, reproduction steps, impact, and any suggested mitigation. The [security policy](${repo}/blob/main/SECURITY.md) describes the acknowledgement target and supported-release policy; consult it for the current terms.

Treat downloaded flows and executable eval or hook sidecars as code. For permission boundaries and provider processing, see [the docs](https://mdflow.dev/docs/) and [privacy](https://mdflow.dev/privacy/). These GitHub channels are project-maintenance channels, not a promise of a commercial support service.
`,
    },
    {
        slug: 'privacy',
        sources: ['SECURITY.md', 'site/package.json', 'site/index.html', 'site/components/EasterEggs.tsx', 'site/components/EggoInteractive.tsx'],
        raw: `---
title: Privacy — mdflow
description: How the static documentation site differs from local CLI execution, browser storage, hosting requests, and external engine processing.
---

# Privacy

## This public documentation site

mdflow.dev serves public documentation and a client-side interactive demonstration. Reading a page is not a request to run mdflow on your machine, and the demonstration is not a hosted AI execution service. The site's checked-in application code does not integrate an analytics SDK or an advertising tracker. That statement does not establish what infrastructure logs or platform-level services a hosting provider may operate.

The site is hosted on Vercel. Like other web hosts, the hosting infrastructure receives request information such as an IP address, requested URL, and browser headers to deliver pages and operate the service. Retention and processing at that layer are governed by the provider's configuration and [Vercel's privacy policy](https://vercel.com/legal/privacy-policy); this repository does not establish a retention period or a guarantee that requests are never logged.

## Browser storage and external requests

The homepage's optional interactive easter eggs store progress in your browser's local storage under \`mdflow-eggs\`, \`mdflow-puzzle\`, and \`mdflow-golden\`. A \`mdflow-nudge\` session-storage flag remembers whether a hint has been shown. This is local interface state, not a website account. Clear this site's browser storage to remove it; doing so resets that progress.

The homepage serves its font files locally. Article pages request fonts from Google Fonts, which exposes the usual web-request information to Google; see [Google's privacy policy](https://policies.google.com/privacy). Following a GitHub, npm, or other external link sends you to that service under its own policies. No claim is made that those third parties share this site's practices.

## Running the local CLI

The mdflow CLI is a separate local program. Flows may read files, resolve remote imports, run commands, invoke context providers, and launch the engine you configured. That engine may send prompts, selected context, and outputs to its provider according to your credentials, settings, and the provider's terms. A free CLI license does not make provider processing offline or private.

Local flow logs, feedback, eval receipts, and evolution artifacts can contain sensitive project information. Review them before sharing; private local state is not the same thing as encrypted storage. Review untrusted flows and executable sidecars, limit credentials, and use a disposable environment when appropriate. Engine context isolation is not a host filesystem, network, environment, process, or credential sandbox. See the [security policy](${repo}/blob/main/SECURITY.md) and [contact page](https://mdflow.dev/contact/) for reporting concerns.
`,
    },
    {
        slug: 'docs',
        sources: ['README.md', 'docs/public-api.md', 'docs/evolve.md', 'SECURITY.md', 'site/src/facts.json', 'skills/mdflow/SKILL.md'],
        raw: `---
title: Documentation and agent interfaces — mdflow
description: Install mdflow, inspect the local CLI, understand the versioned Flow UX protocol, and respect operation effects and separate consent.
---

# Documentation and agent interfaces

mdflow turns Markdown flows into repeatable local agent commands. This site publishes documentation and static machine-readable resources, not an HTTP execution API or a remote MCP server. The interface for running work is the installed \`md\` / \`mdflow\` CLI.

## Install and inspect first

Use \`npm install -g mdflow\` for the CLI, or \`npx mdflow\` to invoke the package. Install and authenticate the engine you intend to use separately. The current source facts identify mdflow **${facts.versionBase}**, with **${facts.defaultEngine}** as the default engine; always ask your installed CLI for its version before assuming that it matches this documentation.

mdflow runs on [Bun](https://bun.sh). The interactive launcher offers to install Bun if it is missing; in a non-interactive environment, install Bun first. Package installation and engine authentication are environment changes, not part of the read-only doctor query.

\`\`\`bash
md --version
md doctor --json
md roster --json
\`\`\`

\`md doctor --json\` is a static, read-only readiness check: it does not execute a flow, load executable sidecars, expand imports, fetch URLs, or write files. Once local setup is approved, \`npx mdflow init --yes\` creates a deterministic starter roster without an engine invocation. Bare \`md\` opens the searchable Flow Workbench. \`md init --guided\` is different: it launches an engine-guided setup and needs separate approval.

## Versioned machine interfaces

The [public CLI reference](https://mdflow.dev/docs/public-api.md) defines **Flow UX Protocol v1** (\`protocolVersion: 1\`). Check \`md --version\` and the protocol version in JSON responses. \`md doctor --json\` reports diagnostics and effect-labelled next actions; \`md roster --json\` enumerates flows; \`md explain <flow.md> --json\` resolves one invocation; and \`md <flow.md> --events\` executes a real run and streams NDJSON events. Event streaming is not a free preview. \`md <flow.md> --json\` is the separate single-result output mode, not the event stream.

Use stable diagnostic codes, operation effects, and consent requirements rather than parsing terminal styling. [facts.json](https://mdflow.dev/facts.json) is a static snapshot of this site's CLI facts and operation contract, not a live query of your project's installed engines or readiness.

## Costs, permissions, and proof

Operations distinguish \`FREE\` (no engine invocation), \`LOCAL_WRITE\` (changes local state), and \`ENGINE\` (provider-backed work). \`FREE\` does not mean every operation is a sandbox: explanation and dry-run may resolve file, URL, or context-provider imports. Use doctor when you require strictly static inspection. Review flows and executable \`.eval.ts\` / \`.hooks.ts\` sidecars before allowing execution.

A real flow run, eval run, evolution proposal, and source-changing apply each require separate consent. Preview eval cost with \`md eval <flow.md> --plan\`; preview evolution with \`md evolve plan <flow.md>\`. Proposals remain private and off-path until an explicit \`md evolve apply <run-id>\`. Context isolation strips supported engine context, not host access or credentials.

## Reference library

- [Complete CLI reference](https://mdflow.dev/docs/public-api.md): flags, configuration, JSON objects, event ordering, and error contracts.
- [Project README](https://mdflow.dev/README.md): installation and workflow examples.
- [Evolution specification](https://mdflow.dev/docs/evolve.md) and [illustrated deep dive](https://mdflow.dev/evolve-deep-dive/): feedback, proof, review, apply, and rollback.
- [Security policy](https://mdflow.dev/SECURITY.md): execution boundaries and private reporting.
- [Agent skill](https://mdflow.dev/skills/mdflow/SKILL.md): the repository's actual flow-authoring instructions. Install with \`npx skills add johnlindquist/mdflow\`; inspect the [SHA-256 index](https://mdflow.dev/.well-known/agent-skills/index.json) when comparing downloaded bytes.
- [llms.txt](https://mdflow.dev/llms.txt) is the concise resource map; [llms-full.txt](https://mdflow.dev/llms-full.txt) includes the source documentation for offline reading.

## Command inventory

This list is generated from the same facts used by the homepage. Use \`md help <command>\` for the installed version's command-specific help.

${facts.commands.map(({ usage, description }) => `- \`md ${usage}\` — ${description}.`).join('\n')}
`,
    },
];

export function loadArticles() {
    const articles = readdirSync(contentDir).filter((file) => file.endsWith('.md')).sort().map((file) => ({
        slug: file.replace(/\.md$/, ''),
        sources: [path.join(contentDir, file)],
        raw: readFileSync(path.join(contentDir, file), 'utf8'),
    }));
    for (const article of supportingPages) {
        if (articles.some(({ slug }) => slug === article.slug)) {
            throw new Error(`build-content: duplicate article slug: ${article.slug}`);
        }
        articles.push({
            ...article,
            sources: [fileURLToPath(import.meta.url), ...article.sources.map((source) => path.join(repoRoot, source))],
        });
    }
    return articles.map(({ raw, ...article }) => ({ ...article, ...parseFrontmatter(raw) }));
}

function escapeHtml(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function parseFrontmatter(raw) {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) return { meta: {}, body: raw };
    const meta = {};
    for (const line of match[1].split('\n')) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return { meta, body: raw.slice(match[0].length) };
}

function page({ title, description, canonical, markdown, source, html }) {
    title = escapeHtml(title);
    description = escapeHtml(description);
    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="icon" href="/eggo.svg" type="image/svg+xml" />
<link rel="canonical" href="${canonical}" />
<link rel="alternate" type="text/markdown" href="${markdown}" title="Markdown" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonical}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="https://mdflow.dev/og-image.png" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600&family=Inter:wght@300;400;600;800&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #050505;
    --panel: rgba(255, 255, 255, 0.03);
    --border: rgba(255, 255, 255, 0.1);
    --text: #e4e4e7;
    --muted: #a1a1aa;
    --dim: #71717a;
    --accent: #34d399;
    --accent-dim: #10b981;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0;
    background:
      radial-gradient(900px 500px at 85% -10%, rgba(16, 185, 129, 0.07), transparent 60%),
      var(--bg);
    color: var(--text);
    font-family: Inter, -apple-system, sans-serif;
    font-weight: 300;
    line-height: 1.7;
    font-size: 16.5px;
  }
  .wrap { max-width: 860px; margin: 0 auto; padding: 0 22px 90px; }
  .top {
    display: flex; justify-content: space-between; align-items: center;
    padding: 26px 0; font-family: var(--mono); font-size: 13px;
  }
  .top a { color: var(--muted); }
  .top a:hover { color: var(--accent); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  h1, h2, h3 {
    font-family: "Space Grotesk", Inter, sans-serif;
    color: #fff; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15;
  }
  h1 { font-size: clamp(30px, 6vw, 46px); margin: 30px 0 18px; }
  h2 {
    font-size: 25px; margin: 64px 0 14px;
    padding-top: 34px; border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  h3 { font-size: 18px; margin: 30px 0 8px; }
  p, li { color: var(--muted); }
  strong { color: var(--text); font-weight: 600; }
  code {
    font-family: var(--mono); font-size: 0.86em; color: #6ee7b7;
    background: rgba(255, 255, 255, 0.06);
    padding: 2px 6px; border-radius: 5px;
  }
  pre {
    background: #0b0c0e; border: 1px solid var(--border); border-radius: 12px;
    padding: 18px 20px; overflow-x: auto;
    font-size: 13.5px; line-height: 1.65;
  }
  pre code { background: none; padding: 0; color: #d4d4d8; font-size: inherit; }
  blockquote {
    margin: 22px 0; padding: 14px 20px;
    border-left: 3px solid var(--accent-dim);
    background: var(--panel); border-radius: 0 10px 10px 0;
  }
  blockquote p { margin: 0; color: var(--text); font-style: italic; }
  .tablewrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; margin: 20px 0; font-size: 14.5px; }
  th, td { text-align: left; padding: 10px 14px; border: 1px solid var(--border); }
  th {
    font-family: var(--mono); font-size: 12px; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--dim); background: var(--panel);
  }
  td { color: var(--muted); }
  hr { border: 0; border-top: 1px solid var(--border); margin: 50px 0 30px; }
  em { color: var(--text); }
  .src {
    font-family: var(--mono); font-size: 12px; color: var(--dim);
    margin-top: 60px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
</style>
</head>
<body>
<div class="wrap">
  <nav class="top">
    <a href="/">← mdflow.dev</a>
    <a href="https://github.com/johnlindquist/mdflow">github</a>
  </nav>
  <main>
${html}
  </main>
  <p class="src">${source ? `Originally published at <a href="${escapeHtml(source)}">${escapeHtml(source)}</a>. ` : ''}<a href="${markdown}">Read as Markdown</a> · <a href="/docs/">Docs</a> · <a href="/about/">About</a> · <a href="/contact/">Contact</a> · <a href="/privacy/">Privacy</a> · <a href="/llms.txt">For agents</a></p>
</div>
</body>
</html>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (!existsSync(distDir)) {
        console.error('build-content: dist/ not found — run `vite build` first.');
        process.exit(1);
    }
    for (const { slug, meta, body } of loadArticles()) {
        const canonical = `https://mdflow.dev/${slug}/`;
        const markdown = `https://mdflow.dev/${slug}.md`;
        const html = marked.parse(body, { gfm: true })
            // Tables need their own scroll container so wide rows never widen the page
            .replaceAll('<table>', '<div class="tablewrap"><table>')
            .replaceAll('</table>', '</table></div>');
        const outDir = path.join(distDir, slug);
        mkdirSync(outDir, { recursive: true });
        writeFileSync(
            path.join(outDir, 'index.html'),
            page({
                title: meta.title || slug,
                description: meta.description || '',
                canonical,
                markdown,
                source: meta.source,
                html,
            }),
        );
        writeFileSync(path.join(distDir, `${slug}.md`), `---\ntitle: ${meta.title || slug}\ndescription: ${meta.description || ''}\nurl: ${canonical}\n${meta.source ? `source: ${meta.source}\n` : ''}---\n${body.trim()}\n`);
        console.log(`build-content: dist/${slug}/index.html + dist/${slug}.md`);
    }
}
