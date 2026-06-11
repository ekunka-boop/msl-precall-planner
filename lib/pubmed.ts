import { XMLParser } from "fast-xml-parser";
import type { Publication } from "./types";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function ncbiKeyParam(): string {
  const key = process.env.NCBI_API_KEY;
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

/**
 * Turn "James F Howard" into the PubMed author form "Howard JF".
 * Falls back to the raw string if it can't parse two tokens.
 */
export function normalizeAuthor(name: string): string {
  const tokens = name.trim().replace(/\./g, "").split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return name.trim();
  const last = tokens[tokens.length - 1];
  const initials = tokens
    .slice(0, tokens.length - 1)
    .map((t) => t[0].toUpperCase())
    .join("");
  return `${last} ${initials}`;
}

export function lastName(name: string): string {
  const tokens = name.trim().replace(/\./g, "").split(/\s+/).filter(Boolean);
  return tokens.length ? tokens[tokens.length - 1] : name.trim();
}

async function esearch(name: string, therapyArea: string): Promise<string[]> {
  const author = normalizeAuthor(name);
  const parts = [`${author}[Author]`];
  if (therapyArea && therapyArea.trim()) {
    parts.push(`(${therapyArea.trim()})`);
  }
  const term = parts.join(" AND ");
  const url =
    `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=40&sort=date` +
    `&term=${encodeURIComponent(term)}${ncbiKeyParam()}`;
  const res = await fetch(url, { headers: { "User-Agent": "msl-precall-planner" } });
  if (!res.ok) throw new Error(`PubMed esearch failed: ${res.status}`);
  const json = await res.json();
  return json?.esearchresult?.idlist ?? [];
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(node: any): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  // fast-xml-parser puts text content in #text when attributes exist
  if (typeof node === "object") {
    if ("#text" in node) return String(node["#text"]);
    if (Array.isArray(node)) return node.map(textOf).join(" ");
  }
  return "";
}

function parsePubDate(article: any): { year: number | null; date: string | null } {
  const articleDate = article?.ArticleDate;
  if (articleDate) {
    const d = asArray(articleDate)[0];
    const y = parseInt(textOf(d?.Year), 10);
    const m = textOf(d?.Month) || "01";
    const day = textOf(d?.Day) || "01";
    if (!isNaN(y)) return { year: y, date: `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}` };
  }
  const pubDate = article?.Journal?.JournalIssue?.PubDate;
  if (pubDate) {
    const y = parseInt(textOf(pubDate.Year), 10);
    if (!isNaN(y)) return { year: y, date: `${y}` };
    // MedlineDate like "2021 Jan-Feb"
    const md = textOf(pubDate.MedlineDate);
    const match = md.match(/\d{4}/);
    if (match) return { year: parseInt(match[0], 10), date: md };
  }
  return { year: null, date: null };
}

async function efetch(pmids: string[]): Promise<Publication[]> {
  if (!pmids.length) return [];
  const url =
    `${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&id=${pmids.join(",")}${ncbiKeyParam()}`;
  const res = await fetch(url, { headers: { "User-Agent": "msl-precall-planner" } });
  if (!res.ok) throw new Error(`PubMed efetch failed: ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(xml);

  const articles = asArray(doc?.PubmedArticleSet?.PubmedArticle);
  const out: Publication[] = [];

  for (const pa of articles) {
    const citation = pa?.MedlineCitation;
    const article = citation?.Article;
    if (!article) continue;

    const pmid = textOf(citation?.PMID);
    const title = textOf(article?.ArticleTitle).replace(/\s+/g, " ").trim();
    const journal = textOf(article?.Journal?.Title) || textOf(article?.Journal?.ISOAbbreviation);

    const abstractNode = article?.Abstract?.AbstractText;
    const abstract = asArray(abstractNode)
      .map((seg) => {
        const label = typeof seg === "object" && seg?.["@_Label"] ? `${seg["@_Label"]}: ` : "";
        return label + textOf(seg);
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const authorNodes = asArray(article?.AuthorList?.Author);
    const authors: string[] = [];
    const affiliations: string[] = [];
    for (const a of authorNodes) {
      const ln = textOf(a?.LastName);
      const fore = textOf(a?.ForeName) || textOf(a?.Initials);
      if (ln) authors.push(`${fore ? fore + " " : ""}${ln}`.trim());
      for (const aff of asArray(a?.AffiliationInfo)) {
        const t = textOf(aff?.Affiliation);
        if (t) affiliations.push(t);
      }
    }

    const mesh = asArray(citation?.MeshHeadingList?.MeshHeading)
      .map((m) => textOf(m?.DescriptorName))
      .filter(Boolean);

    const { year, date } = parsePubDate(article);

    out.push({
      pmid,
      title,
      journal,
      year,
      date,
      authors,
      isFirstAuthor: false,
      isLastAuthor: false,
      meshTerms: mesh,
      abstract,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      // affiliations carried via a side channel below
      ...( { _affiliations: affiliations } as any ),
    });
  }
  return out;
}

export interface PubMedResult {
  publications: Publication[];
  affiliationsByPaper: string[][];
}

export async function fetchPublications(
  name: string,
  therapyArea: string
): Promise<PubMedResult> {
  const pmids = await esearch(name, therapyArea);
  const pubs = await efetch(pmids);

  const ln = lastName(name).toLowerCase();
  const affiliationsByPaper: string[][] = [];

  for (const p of pubs) {
    const affs = ((p as any)._affiliations as string[]) || [];
    affiliationsByPaper.push(affs);
    delete (p as any)._affiliations;

    // Determine first/last author position by last-name match.
    if (p.authors.length) {
      const first = p.authors[0].toLowerCase();
      const last = p.authors[p.authors.length - 1].toLowerCase();
      p.isFirstAuthor = first.includes(ln);
      p.isLastAuthor = last.includes(ln);
    }
  }

  return { publications: pubs, affiliationsByPaper };
}
