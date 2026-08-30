// Publishes static agent documentation after Vite, prerendering, and build-content.
// Source documents and the installable skill are copied, not synthesized.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArticles } from './build-content.mjs';

const siteRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(siteRoot);
const distDir = path.join(siteRoot, 'dist');
const canonical = 'https://mdflow.dev';
const factsPath = path.join(siteRoot, 'src/facts.json');
const factsBytes = readFileSync(factsPath);
const facts = JSON.parse(factsBytes.toString('utf8'));
const repo = facts.repo;
const articles = loadArticles();

if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('build-agent-resources: dist/index.html not found — run Vite and homepage prerendering first.');
}
for (const { slug } of articles) {
    if (!existsSync(path.join(distDir, `${slug}.md`))) {
        throw new Error(`build-agent-resources: dist/${slug}.md not found — run build-content.mjs first.`);
    }
}

function emit(relativePath, content) {
    const destination = path.join(distDir, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, content);
    console.log(`build-agent-resources: dist/${relativePath}`);
}

const references = [
    { file: 'README.md', title: 'Project README', description: 'Installation, flow syntax, engine setup, and workflow examples' },
    { file: 'docs/public-api.md', title: 'Public CLI reference', description: 'Command and flag contracts, configuration, Flow UX Protocol v1, and errors' },
    { file: 'docs/evolve.md', title: 'Evolution specification', description: 'Proposal-first changes, feedback, proof, consent, apply, and rollback' },
    { file: 'GUIDE-NEW-FEATURES.md', title: 'Workflow feature guide', description: 'Steps, structured output, context providers, registry, and output modes' },
    { file: 'SECURITY.md', title: 'Security policy', description: 'Execution boundaries and private vulnerability reporting' },
    { file: 'CONTRIBUTING.md', title: 'Contribution guide', description: 'How to contribute to the project' },
    { file: 'skills/mdflow/SKILL.md', title: 'mdflow agent skill', description: 'The repository’s installable instructions for creating and maintaining flows' },
];

const indexMarkdown = `---
title: mdflow — repeatable agent work
url: ${canonical}/
description: A Git-native control plane for repeatable local agent work, using Markdown flows, behavioral evals, and proposal-first evolution.
---

# mdflow

A Git-native control plane for repeatable agent work. Define each job as Markdown, run it on the CLI engine you already use, inspect its inputs, and gate prompt revisions with behavioral evals. Keep one flow per repeatable job in a project's \`flows/\` roster, with frontmatter for configuration and a Markdown body for the prompt.

## When to use mdflow

Use it when a code review, release-note draft, issue-triage task, or other recurring agent job should be readable, reusable, diffable, and shared with a team. Flows are local files you can review in Git. Bare \`md\` opens a searchable Flow Workbench for project, global, installed, and PATH flows. mdflow is not a hosted execution service; mdflow.dev is its public documentation site.

## Install and get oriented

mdflow runs on [Bun](https://bun.sh). If Bun is missing, the interactive launcher offers to install it; non-interactive environments must install Bun first. The selected engine CLI must also be installed and authenticated. Installing packages or configuring an engine changes the environment and is not part of read-only inspection.

\`\`\`bash
npm install -g mdflow
md --version
md doctor --json
md roster --json
\`\`\`

For one-off package invocation, use \`${facts.install}\`. After approving local setup, \`npx mdflow init --yes\` creates a deterministic starter roster without an engine invocation. \`md init --guided\` instead launches engine-guided setup; do not treat those two commands as having the same cost or consent. Install the companion agent skill with \`npx skills add johnlindquist/mdflow\`.

The source facts describe mdflow **${facts.versionBase}**, not necessarily the version installed on your machine. Run \`md --version\` and inspect the installed CLI's help when making compatibility decisions.

## Engines and resolution

The built-in default is **${facts.defaultEngine}**. Supported engine names from the current source facts: ${facts.engines.map((engine) => `\`${engine}\``).join(', ')}.

Resolution, most explicit first:

${facts.ladder.map(({ rung, note }, index) => `${index + 1}. ${rung}${note ? ` — ${note}` : ''}`).join('\n')}

## Inspect before execution

- \`md doctor --json\` provides static diagnostics, installed-engine readiness, and effect-labelled next actions without fetching imports, running code, or writing files.
- \`md explain <flow.md> --json\` resolves a prompt and invocation without launching the engine. File, URL, and context-provider imports may still resolve.
- \`md eval <flow.md> --plan\` reports the planned eval invocation count before consent. Executing the suite is a separate operation.
- \`md evolve plan <flow.md>\` previews evolution readiness, cost, capabilities, and writes. A proposal does not apply itself.

## Permissions, security, and costs

The operation contract distinguishes \`FREE\` (no engine invocation), \`LOCAL_WRITE\` (local changes), and \`ENGINE\` (provider-backed work). \`FREE\` is not a universal promise of zero side effects or network access: dry-run and explanation can resolve imports. Use doctor for strictly static inspection.

${facts.contract.safetyRules.map(({ text }) => `- ${text}`).join('\n')}

Review a flow like executable code. Use least-privilege credentials and, for untrusted flows, a disposable environment with restricted access. The CLI is free under the MIT license; external engines and providers may charge. See [pricing and costs](${canonical}/pricing.md) and [the security policy](${canonical}/SECURITY.md).

## Agent interfaces

The supported execution interface is the local CLI, not an mdflow.dev HTTP API or MCP server. Flow UX Protocol v1 uses \`protocolVersion: 1\`. Check the installed version and JSON protocol version rather than scraping terminal output. \`md doctor --json\`, \`md roster --json\`, and \`md explain <flow.md> --json\` expose structured inspection; \`md <flow.md> --events\` performs a real run with an NDJSON event stream. \`md <flow.md> --json\` emits a single result object instead. Real execution needs separate consent.

[facts.json](${canonical}/facts.json) exposes the site's generated command/operation contract (contract version ${facts.contract.contractVersion}); it is not a live project-readiness response. The [full public CLI reference](${canonical}/docs/public-api.md) defines fields, event ordering, and error behavior.

## Commands

${facts.commands.map(({ usage, description }) => `- \`md ${usage}\` — ${description}.`).join('\n')}

## Keep improvements reviewable

Record a problem with \`md feedback <flow.md> "<message>"\`, review an eval that can expose it, and inspect \`md evolve plan <flow.md>\` before approving a proposal. Evolution works off-path. A reviewed proposal changes source only through a separate \`md evolve apply <run-id>\` decision. Eval-suite presence alone does not prove correctness; proof must be current and bound to the relevant content.

Read [the deep dive](${canonical}/evolve-deep-dive/) and [the normative evolution specification](${canonical}/docs/evolve.md).

## Documentation and project information

${articles.map(({ slug, meta }) => `- [${meta.title || slug}](${canonical}/${slug}/) — [Markdown](${canonical}/${slug}.md)`).join('\n')}
- [Agent skill](${canonical}/skills/mdflow/SKILL.md) and [skill SHA-256 index](${canonical}/.well-known/agent-skills/index.json)
- [Concise resource index](${canonical}/llms.txt) and [full source documentation](${canonical}/llms-full.txt)
- [GitHub repository](${repo}), [issues](${repo}/issues), and [MIT license](${repo}/blob/main/LICENSE)
`;

const pricingMarkdown = `---
title: mdflow pricing and costs
url: ${canonical}/pricing.md
---

# Pricing and costs

The mdflow CLI is free, open-source software under the [MIT license](${repo}/blob/main/LICENSE). You can inspect the [source repository](${repo}) and install the package with \`npm install -g mdflow\` or invoke it with \`${facts.install}\`. This documentation site does not sell a hosted execution plan or provide a usage-billing API.

## External engines may charge

mdflow launches the engine CLI you select. That engine may require a subscription, provider account, API credentials, or usage-based payment. Provider turns, tokens, tool calls, and currency costs vary by engine and task; check your selected provider's current terms. A free mdflow license does not include free provider usage, and this page does not quote external providers' prices.

## Know the operation before approving it

- \`FREE\`: no engine invocation. Static \`md doctor --json\` and eval/evolution planning help inspect readiness and likely work. Other free inspection commands may resolve imports, including URLs or local context providers.
- \`LOCAL_WRITE\`: changes local files or private state without an engine turn. Deterministic init, recording feedback, and applying a reviewed proposal are examples.
- \`ENGINE\`: launches one or more provider-backed invocations. A real flow run, engine-guided setup, real eval suite, and proposal generation can incur external costs.

Eval plans include repetitions and print the planned invocation count before consent. Preview with \`md eval <flow.md> --plan\`; preview proposal work with \`md evolve plan <flow.md>\`. Invocation count is not a guaranteed currency quote. Approval for a flow run does not approve an eval, a proposal, or a source-changing apply.

See [the operation contract](${canonical}/facts.json), [documentation](${canonical}/docs/), [privacy](${canonical}/privacy/), and [security policy](${canonical}/SECURITY.md) before running unfamiliar flows or connecting credentials.
`;

const llms = `# mdflow

> A Git-native control plane for repeatable local agent work: Markdown flows, behavioral evals, and proposal-first evolution. Free MIT CLI; external engines may charge.

Use mdflow for recurring agent jobs that should be versioned, inspected, and reused. The execution surface is the installed md/mdflow CLI. This website publishes static documentation, not a remote execution API or MCP service.

Install with npm install -g mdflow (Bun is required), then run md --version and md doctor --json. Doctor is static/read-only. A real flow run, eval, proposal, and source-changing apply require separate consent. Dry-run/explain may resolve imports; context isolation is not a host sandbox.

## Start here

- [Homepage in Markdown](${canonical}/index.md): When to use mdflow, installation, engines, commands, and security boundaries
- [Documentation](${canonical}/docs.md): CLI usage and versioned Flow UX Protocol v1 guidance
- [Facts and operation contract](${canonical}/facts.json): Static source facts for version ${facts.versionBase}, contract version ${facts.contract.contractVersion}; not live project state
- [Pricing and costs](${canonical}/pricing.md): Free MIT license and external-engine costs

## Source references

${references.map(({ file, title, description }) => `- [${title}](${canonical}/${file}): ${description}`).join('\n')}
- [Skill digest index](${canonical}/.well-known/agent-skills/index.json): SHA-256 and source URL for the exact published skill bytes
- [Full documentation](${canonical}/llms-full.txt): Combined source documentation with source URLs

## Articles and trust

${articles.filter(({ slug }) => slug !== 'docs').map(({ slug, meta }) => `- [${meta.title || slug}](${canonical}/${slug}.md): ${meta.description || 'Project documentation'}`).join('\n')}
- [GitHub repository](${repo}): Source, releases, and contributions
- [Issue tracker](${repo}/issues): Public bugs and questions
- [Private vulnerability reporting](${repo}/security/advisories/new): Security reports; do not post exploit details publicly
`;

emit('index.md', indexMarkdown);
emit('pricing.md', pricingMarkdown);
emit('llms.txt', llms);
emit('facts.json', factsBytes);

const fullSections = [llms, indexMarkdown, pricingMarkdown];
for (const { slug, meta } of articles) {
    fullSections.push(`# ${meta.title || slug}\n\nCanonical page: ${canonical}/${slug}/\n\n${readFileSync(path.join(distDir, `${slug}.md`), 'utf8')}`);
}
for (const { file, title } of references) {
    const bytes = readFileSync(path.join(repoRoot, file));
    // Preserve upstream text and the real skill byte-for-byte. Relative links
    // within source documents retain their repository context (linked below).
    emit(file, bytes);
    fullSections.push(`# Source: ${title}\n\nOriginal: ${repo}/blob/main/${file}\nPublished copy: ${canonical}/${file}\nRelative links in this source use the original repository location.\n\n${bytes.toString('utf8')}`);
}
emit('llms-full.txt', `${fullSections.join('\n\n---\n\n')}\n`);

const skillFile = 'skills/mdflow/SKILL.md';
const skillBytes = readFileSync(path.join(repoRoot, skillFile));
emit('.well-known/agent-skills/index.json', `${JSON.stringify({
    schemaVersion: 1,
    description: 'Index of the actual repository skill. Digests identify bytes, not an independent signature or permission to execute.',
    skills: [{
        name: 'mdflow',
        description: 'Build and maintain a project flow roster with behavioral evals and proposal-first evolution.',
        url: `${canonical}/${skillFile}`,
        source: `${repo}/blob/main/${skillFile}`,
        mdflowVersion: facts.versionBase,
        bytes: skillBytes.length,
        sha256: createHash('sha256').update(skillBytes).digest('hex'),
        install: 'npx skills add johnlindquist/mdflow',
    }],
}, null, 2)}\n`);

function escapeXml(value) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function lastModified(sources) {
    // Use source-file modification dates, never the build clock or a claimed
    // verification date. Generated outputs are deliberately excluded.
    const latest = Math.max(...sources.map((source) => statSync(source).mtimeMs));
    return new Date(latest).toISOString().slice(0, 10);
}

const pages = [
    {
        url: `${canonical}/`,
        sources: [factsPath, path.join(repoRoot, 'README.md'), path.join(siteRoot, 'App.tsx'), path.join(siteRoot, 'index.html')],
    },
    ...articles.map(({ slug, sources }) => ({ url: `${canonical}/${slug}/`, sources })),
];
emit('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(({ url, sources }) => `  <url><loc>${escapeXml(url)}</loc><lastmod>${lastModified(sources)}</lastmod></url>`).join('\n')}\n</urlset>\n`);
emit('robots.txt', `# Public documentation is available to search and AI crawlers.\nUser-agent: *\nAllow: /\n\nSitemap: ${canonical}/sitemap.xml\n\n# Agent documentation: ${canonical}/llms.txt\n# Full source reference: ${canonical}/llms-full.txt\n# Installable skill index: ${canonical}/.well-known/agent-skills/index.json\n`);
