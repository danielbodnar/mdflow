import { next, rewrite } from '@vercel/functions';

// Only human-readable pages have an alternate representation. Static assets,
// discovery files and nonexistent routes retain their own HTTP semantics.
export const config = {
    matcher: ['/', '/index.html', '/about', '/about/', '/contact', '/contact/', '/privacy', '/privacy/', '/docs', '/docs/', '/evolve-deep-dive', '/evolve-deep-dive/'],
};

function quality(accept: string, type: string): number {
    let specificity = -1;
    let quality = 0;
    for (const range of accept.toLowerCase().split(',')) {
        const [media, ...parameters] = range.trim().split(';');
        const candidate = media.trim();
        const match = candidate === type ? 2 : candidate === 'text/*' ? 1 : candidate === '*/*' ? 0 : -1;
        if (match < 0) continue;
        const q = parameters.map((value) => value.trim()).find((value) => value.startsWith('q='));
        const value = q === undefined ? 1 : Number(q.slice(2));
        const weight = Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
        if (match > specificity) {
            specificity = match;
            quality = weight;
        } else if (match === specificity) {
            quality = Math.max(quality, weight);
        }
    }
    return quality;
}

export default function middleware(request: Request): Response {
    const headers = { Vary: 'Accept, Accept-Encoding' };
    const accept = request.headers.get('Accept') ?? '*/*';
    const html = quality(accept, 'text/html');
    const markdown = quality(accept, 'text/markdown');
    if (html === 0 && markdown === 0) {
        return new Response(request.method === 'HEAD' ? null : 'Not acceptable. Request text/html or text/markdown.\n', {
            status: 406,
            headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
    // HTML wins a wildcard tie; explicitly requested Markdown wins a tie.
    const explicitMarkdown = accept.toLowerCase().split(',').some((range) => range.split(';')[0].trim() === 'text/markdown');
    if (markdown > 0 && (markdown > html || (markdown === html && explicitMarkdown))) {
        const url = new URL(request.url);
        const slug = url.pathname.replace(/^\//, '').replace(/\/$/, '');
        url.pathname = slug === '' || slug === 'index.html' ? '/index.md' : `/${slug}.md`;
        return rewrite(url, { headers: { ...headers, 'Content-Type': 'text/markdown; charset=utf-8' } });
    }
    return next({ headers });
}
