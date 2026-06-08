interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * eLife MCP — keyless open-access life-sciences & biomedical journal articles.
 *
 * Wraps the public eLife API (https://api.elifesciences.org). No API key required.
 *
 * NOTE on Accept headers: the eLife API rejects `Accept: application/json` with a
 * 406 ("could not negotiate an acceptable response type") and only accepts
 * versioned vendor media types (e.g. `application/vnd.elife.search+json; version=2`).
 * However, sending NO Accept header works for every endpoint we use (list, search,
 * single article) and returns the latest representation as JSON. We therefore omit
 * the Accept header by default and never need a fallback. We keep handling defensive.
 */


const BASE = 'https://api.elifesciences.org';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_articles',
    description:
      'Search eLife — the open-access journal for life sciences & biomedicine — for articles by keyword (gene, disease, method, organism, author, etc.). Returns matching articles with id, title, type, DOI, publication date, authors, and subjects. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords, e.g. "crispr base editing".' },
        limit: { type: 'number', description: 'Max results (default 15, max 100).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_article',
    description:
      'Get the full metadata and abstract for a single eLife article by its id (e.g. "107545"). Returns title, DOI, type, publication date, authors, abstract, and subjects. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'eLife article id, e.g. "107545".' },
      },
      required: ['id'],
    },
  },
  {
    name: 'latest_articles',
    description:
      'List the most recently published eLife articles (newest first). eLife is the open-access journal for life sciences & biomedicine. Returns id, title, type, DOI, publication date, and authors. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 15, max 100).' },
      },
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_articles':
        return await searchArticles(args);
      case 'get_article':
        return await getArticle(args);
      case 'latest_articles':
        return await latestArticles(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: errMsg(err) };
  }
}

async function searchArticles(args: Record<string, unknown>): Promise<unknown> {
  const query = reqStr(args, 'query');
  const limit = clampLimit(args.limit);
  const url = `${BASE}/search?for=${encodeURIComponent(query)}&per-page=${limit}`;
  const data = (await getJson(url)) as ElifeListResponse;
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    count: items.length,
    total: typeof data?.total === 'number' ? data.total : items.length,
    articles: items.map((a) => ({
      id: a?.id,
      title: a?.title,
      type: a?.type,
      doi: a?.doi,
      published: a?.published,
      authors: a?.authorLine,
      subjects: subjectNames(a?.subjects),
    })),
  };
}

async function getArticle(args: Record<string, unknown>): Promise<unknown> {
  const id = reqStr(args, 'id');
  const url = `${BASE}/articles/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 404) return { error: 'article not found', id };
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    return { error: `eLife: ${res.status} ${body}` };
  }
  const a = (await res.json()) as ElifeArticle;
  return {
    id: a?.id,
    title: a?.title,
    doi: a?.doi,
    type: a?.type,
    published: a?.published,
    authors: a?.authorLine,
    abstract: abstractText(a?.abstract),
    subjects: subjectNames(a?.subjects),
  };
}

async function latestArticles(args: Record<string, unknown>): Promise<unknown> {
  const limit = clampLimit(args.limit);
  const url = `${BASE}/articles?per-page=${limit}&order=desc`;
  const data = (await getJson(url)) as ElifeListResponse;
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    count: items.length,
    total: typeof data?.total === 'number' ? data.total : items.length,
    articles: items.map((a) => ({
      id: a?.id,
      title: a?.title,
      type: a?.type,
      doi: a?.doi,
      published: a?.published,
      authors: a?.authorLine,
    })),
  };
}

// --- helpers ---

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    throw new Error(`eLife: ${res.status} ${body}`);
  }
  return res.json();
}

function subjectNames(subjects: ElifeSubject[] | undefined): string[] {
  if (!Array.isArray(subjects)) return [];
  return subjects
    .map((s) => s?.name)
    .filter((n): n is string => typeof n === 'string');
}

function abstractText(abstract: ElifeArticle['abstract']): string {
  const content = abstract?.content;
  if (!Array.isArray(content)) return '';
  const text = content
    .map((c) => (typeof c?.text === 'string' ? c.text : ''))
    .filter(Boolean)
    .join(' ')
    .trim();
  return text.length > 800 ? `${text.slice(0, 800).trimEnd()}…` : text;
}

function clampLimit(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 15;
  return Math.min(Math.floor(n), 100);
}

function reqStr(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing.`);
  return v.trim();
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// --- minimal response shapes ---

interface ElifeSubject {
  id?: string;
  name?: string;
}

interface ElifeArticleSummary {
  id?: string;
  type?: string;
  doi?: string;
  title?: string;
  published?: string;
  authorLine?: string;
  subjects?: ElifeSubject[];
}

interface ElifeListResponse {
  total?: number;
  items?: ElifeArticleSummary[];
}

interface ElifeArticle extends ElifeArticleSummary {
  abstract?: { content?: Array<{ text?: string }> };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
