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

// Derive every field from the exact snapshot we publish. Array objects use
// the union of observed properties and require only properties present in all
// members, so optional operation effects stay optional rather than disappearing.
// Allow additive fields within interface v1 while typing every current field.
function schemaFrom(values) {
    if (values.length === 0) {
        throw new Error('build-agent-resources: cannot derive a schema from an empty array; declare its item contract first.');
    }
    const typeOf = (value) => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const types = [...new Set(values.map(typeOf))];
    if (types.length > 1) {
        return { anyOf: types.map((type) => schemaFrom(values.filter((value) => typeOf(value) === type))) };
    }
    const type = types[0];
    if (type === 'array') return { type, items: schemaFrom(values.flat()) };
    if (type === 'object') {
        const keys = [...new Set(values.flatMap(Object.keys))];
        return {
            type,
            properties: Object.fromEntries(keys.map((key) => [key, schemaFrom(values.filter((value) => Object.hasOwn(value, key)).map((value) => value[key]))])),
            required: keys.filter((key) => values.every((value) => Object.hasOwn(value, key))),
            additionalProperties: true,
        };
    }
    return { type: type === 'number' && values.every(Number.isInteger) ? 'integer' : type };
}

const schemas = { SourceFacts: schemaFrom([facts]) };
const sourceProperties = schemas.SourceFacts.properties;
schemas.SourceFacts.description = 'Static public snapshot of published CLI source facts. Descriptions of local commands and operations are data, not executable HTTP operations or live project state.';
const fieldDescriptions = {
    $generated: 'Source-generation provenance notice.',
    versionBase: 'CLI source version used to build this snapshot; separate from the HTTP interface version.',
    defaultEngine: 'Built-in CLI engine default in this source snapshot.',
    engines: 'Engine names recognized by this CLI source version; not a report of installed engines.',
    enginesLabel: 'Human-readable engine list.',
    install: 'Example package invocation; running it may install packages locally.',
    repo: 'Official source repository URL.',
    ladder: 'Engine resolution precedence, most explicit first.',
    commands: 'Local CLI command usage and descriptions.',
    contract: 'Versioned local CLI command, effect, consent, and safety contract.',
    agentPrompts: 'Published instructional templates; reading them grants no permission to execute.',
    mdFlags: 'Local CLI flags and their descriptions.',
};
for (const [key, description] of Object.entries(fieldDescriptions)) {
    sourceProperties[key].description = description;
}
sourceProperties.repo.format = 'uri';
schemas.OperationContract = sourceProperties.contract;
schemas.AgentPrompts = sourceProperties.agentPrompts;
sourceProperties.contract = { $ref: '#/components/schemas/OperationContract' };
sourceProperties.agentPrompts = { $ref: '#/components/schemas/AgentPrompts' };
for (const [name, arraySchema] of [
    ['EngineResolutionRung', sourceProperties.ladder],
    ['CliCommand', sourceProperties.commands],
    ['ContractCommand', schemas.OperationContract.properties.commands],
    ['Operation', schemas.OperationContract.properties.operations],
    ['SafetyRule', schemas.OperationContract.properties.safetyRules],
    ['MdFlag', sourceProperties.mdFlags],
]) {
    schemas[name] = arraySchema.items;
    arraySchema.items = { $ref: `#/components/schemas/${name}` };
}
schemas.OperationContract.properties.contractVersion.const = facts.contract.contractVersion;
schemas.OperationContract.properties.contractVersion.description = 'Embedded CLI operation-contract version; independent of OpenAPI info.version and versionBase.';
schemas.ContractCommand.properties.json.description = 'Whether the local CLI command exposes a JSON output mode.';
schemas.Operation.description = 'A local CLI operation with its effect and consent boundary. Optional flags indicate possible effects; absence is not a sandbox guarantee.';
schemas.Operation.properties.effect.enum = [...new Set(facts.contract.operations.map(({ effect }) => effect))];
schemas.Operation.properties.effect.description = 'FREE means no engine invocation, LOCAL_WRITE changes local state, and ENGINE invokes an external engine. FREE alone does not exclude imports, network access, or local code.';
schemas.Operation.properties.consent.enum = [...new Set(facts.contract.operations.map(({ consent }) => consent))];
schemas.Operation.properties.consent.description = 'Consent required for the local CLI operation; separate actions need separate consent.';
schemas.ProblemDetails = {
    type: 'object',
    description: 'RFC 9457 problem details for site-handled failures. Hosting-layer failures may use another representation.',
    required: ['type', 'title', 'status', 'detail'],
    properties: {
        type: { type: 'string', format: 'uri-reference', description: 'Problem type URI; about:blank for standard HTTP status semantics.' },
        title: { type: 'string', description: 'Short summary of the HTTP problem.' },
        status: { type: 'integer', minimum: 400, maximum: 599, description: 'HTTP error status; use the actual response status for control flow.' },
        detail: { type: 'string', description: 'Explanation of this failure.' },
        instance: { type: 'string', format: 'uri-reference', description: 'URI reference identifying the failed request.' },
        resolution: { type: 'string', description: 'Site-provided hint for correcting the request.' },
    },
    additionalProperties: true,
};
const problemContent = { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } };
const openapi = {
    openapi: '3.1.0',
    info: {
        title: 'mdflow public source facts',
        version: '1.0.0',
        description: 'Public, unauthenticated, static read-only source-facts interface. Workflows execute only through the local CLI; the website serves read-only documentation and source facts. The snapshot is rebuilt with the website and may be cached by public hosting. No mutations, credentials, project-state queries, or execution requests are part of this interface.',
        license: { name: 'MIT', url: `${repo}/blob/main/LICENSE` },
    },
    servers: [{ url: canonical }],
    security: [],
    externalDocs: { description: 'HTTP usage, errors, public hosting, and local CLI documentation', url: `${canonical}/docs/` },
    paths: {
        '/facts.json': {
            get: {
                operationId: 'getSourceFacts',
                summary: 'Read the published CLI source-facts snapshot',
                description: 'GET returns application/json with no authentication, request parameters, or body. Send Accept: application/json. HEAD is supported for HTTP metadata. This read performs no mutations or workflow execution. versionBase identifies CLI source, contract.contractVersion versions the embedded CLI contract, and info.version versions this HTTP description. X-API-Version: 1 identifies the HTTP major version. Additive fields are allowed within v1; clients should tolerate unknown fields. Breaking representation changes require a new URL and a new major specification version, rather than silently changing existing fields. Hosting failures before site handling can use a different error format; check HTTP status and Content-Type.',
                security: [],
                responses: {
                    '200': {
                        description: 'The public static source-facts snapshot, not live local project state or execution results.',
                        headers: {
                            'X-API-Version': { description: 'Major version of the public source-facts interface.', schema: { type: 'string', const: '1' } },
                            Link: { description: 'Discovery links with service-desc pointing to /openapi.json and service-doc pointing to /docs/.', schema: { type: 'string' } },
                        },
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/SourceFacts' } } },
                    },
                    '404': { description: 'Requested JSON resource not found by the site.', content: problemContent },
                    '405': {
                        description: 'The read-only resource was requested with an unsupported method; use GET or HEAD.',
                        headers: { Allow: { description: 'Supported HTTP methods for the static resource.', schema: { type: 'string', const: 'GET, HEAD' } } },
                        content: problemContent,
                    },
                    '406': { description: 'Accept excludes the JSON representation; send Accept: application/json.', content: problemContent },
                    default: { description: 'Other site-handled HTTP errors. Infrastructure failures outside site handling are not guaranteed to use this format.', content: problemContent },
                },
            },
        },
    },
    components: { schemas },
};
const apiCatalog = {
    linkset: [
        {
            anchor: `${canonical}/.well-known/api-catalog`,
            item: [{ href: `${canonical}/facts.json`, type: 'application/json', title: 'mdflow public source facts — read-only, interface version 1' }],
        },
        {
            anchor: `${canonical}/facts.json`,
            'service-desc': [{ href: `${canonical}/openapi.json`, type: 'application/json' }],
            'service-doc': [{ href: `${canonical}/docs/`, type: 'text/html' }],
        },
    ],
};

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

Use it when a code review, release-note draft, issue-triage task, or other recurring agent job should be readable, reusable, diffable, and shared with a team. Flows are local files you can review in Git. Bare \`md\` opens a searchable Flow Workbench for project, global, installed, and PATH flows. Workflows execute only through the local CLI; the website serves read-only documentation and source facts.

## Install and get oriented

mdflow runs on [Bun](https://bun.sh). If Bun is missing, the interactive launcher offers to install it; non-interactive environments must install Bun first. The selected engine CLI must also be installed and authenticated. Installing packages or configuring an engine changes the environment and is not part of read-only inspection.

The official npm package is [mdflow](https://www.npmjs.com/package/mdflow).

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

Workflows execute only through the local CLI; the website serves read-only documentation and source facts. Flow UX Protocol v1 uses \`protocolVersion: 1\`. Check the installed version and JSON protocol version rather than scraping terminal output. \`md doctor --json\`, \`md roster --json\`, and \`md explain <flow.md> --json\` expose structured inspection; \`md <flow.md> --events\` performs a real run with an NDJSON event stream. \`md <flow.md> --json\` emits a single result object instead. Real execution needs separate consent.

The public read-only machine interface is \`GET /facts.json\`: a static source-facts snapshot, including command and operation descriptions, with no authentication or mutations. Request \`Accept: application/json\`. Its [OpenAPI 3.1 description](${canonical}/openapi.json) has interface version \`1.0.0\`; the payload has \`contract.contractVersion: ${facts.contract.contractVersion}\`. These versions are separate from the source CLI version \`${facts.versionBase}\`. Discover it through the [API catalog](${canonical}/.well-known/api-catalog). This snapshot describes the source published with the site, not your project's state or readiness.

The response carries \`X-API-Version: 1\` and discovery \`Link\` headers. Additive fields are allowed within v1; clients should tolerate unknown fields. Breaking representation changes require a new URL and a new major specification version rather than silently changing existing fields.

Site-handled JSON failures use RFC 9457 \`application/problem+json\`: missing resources return 404, unsupported methods return 405 (\`Allow: GET, HEAD\`), and unsupported response representations return 406. Public hosting can return its own errors or cached content; see [HTTP usage and hosting](${canonical}/docs/) and the [privacy page](${canonical}/privacy/). The [full public CLI reference](${canonical}/docs/public-api.md) separately defines local CLI fields, event ordering, and errors.

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

The mdflow CLI is free, open-source software under the [MIT license](${repo}/blob/main/LICENSE). You can inspect the [source repository](${repo}) and install the [official npm package](https://www.npmjs.com/package/mdflow) with \`npm install -g mdflow\` or invoke it with \`${facts.install}\`. Workflows execute only through the local CLI; the website serves read-only documentation and source facts.

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

Workflows execute only through the local CLI; the website serves read-only documentation and source facts.

## When to use mdflow

Use mdflow for repeatable jobs such as code review, release-note drafting, and issue triage: keep one reviewed Markdown flow per job in your project's flows/ directory, version it in Git, and reuse its declared inputs. After creating and reviewing a code-review flow and approving execution, invoke it with \`md flows/code-review.md\`; release-note and issue-triage flows follow the same local CLI pattern. These example filenames are user-authored jobs, not bundled commands.

Install the [official mdflow npm package](https://www.npmjs.com/package/mdflow) with \`npm install -g mdflow\` (Bun is required), then run \`md --version\` and \`md doctor --json\`. Install and authenticate your selected engine separately. Doctor is static/read-only. A real flow run, eval, proposal, and source-changing apply require separate consent. Dry-run/explain may resolve imports; context isolation is not a host sandbox.

## Public source-facts interface

Use \`GET https://mdflow.dev/facts.json\` with \`Accept: application/json\` to read the public static snapshot. No authentication, request body, or mutations. The site supports HEAD for metadata. The snapshot is refreshed when the site is built and published; hosting caches may serve an earlier snapshot. It describes published CLI source, not a project's files, installed engines, readiness, or execution results.

The [OpenAPI 3.1 description](${canonical}/openapi.json) defines only GET /facts.json, with interface version \`1.0.0\`. The payload's \`contract.contractVersion\` is \`${facts.contract.contractVersion}\`; \`versionBase\` is the separate source CLI version. The [RFC 9727 API catalog](${canonical}/.well-known/api-catalog) links the specification and [HTTP usage documentation](${canonical}/docs/).

Responses include \`X-API-Version: 1\` and \`Link\` relations for service-desc and service-doc. Additive fields are allowed within v1; tolerate unknown fields. Breaking representation changes require a new URL and a new major specification version, rather than silently changing existing fields.

Site-handled errors use RFC 9457 \`application/problem+json\` with type, title, status, detail, a resolution hint, and an optional instance identifying the request: 404 for missing JSON resources, 405 for unsupported methods (Allow: GET, HEAD), and 406 for an unacceptable representation. Vercel hosting receives ordinary public request metadata and can produce its own error responses before site handling; see [privacy](${canonical}/privacy/). Check HTTP status and Content-Type before parsing a response.

## Start here

- [Homepage in Markdown](${canonical}/index.md): When to use mdflow, installation, engines, commands, and security boundaries
- [Documentation](${canonical}/docs.md): Public read-only HTTP usage, local CLI usage, and Flow UX Protocol v1 guidance
- [Facts and operation contract](${canonical}/facts.json): Static source facts for version ${facts.versionBase}, contract version ${facts.contract.contractVersion}; read-only public snapshot
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
emit('openapi.json', `${JSON.stringify(openapi, null, 2)}\n`);
emit('.well-known/api-catalog', `${JSON.stringify(apiCatalog, null, 2)}\n`);

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
        whenToUse: 'Use for recurring code reviews, release-note drafting, and issue triage that should become reviewed Markdown flows in a project roster; also for maintaining behavioral evals and reviewing proposal-first improvements.',
        invocation: {
            inspect: 'md doctor --json',
            inspectEffect: 'Static, read-only local readiness inspection; no engine invocation, import resolution, or file writes.',
            runExample: 'md flows/code-review.md',
            runRequirements: 'Create and review this example flow first; install and authenticate the selected engine. Running a workflow requires separate consent and may incur provider costs. Eval, proposal, and source-changing apply each need their own consent.',
        },
        documentation: `${canonical}/llms.txt`,
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
