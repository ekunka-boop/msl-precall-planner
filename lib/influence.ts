import type { Publication, InfluenceMap, TopicTrendPoint } from "./types";
import { lastName } from "./pubmed";

const STOP_AFFIL_WORDS = new Set([
  "department", "departments", "division", "school", "faculty", "center",
  "centre", "institute", "unit", "laboratory", "lab", "and", "of", "the",
]);

/** Pull a short institution name out of a messy affiliation string. */
function shortenAffiliation(aff: string): string | null {
  // Affiliations look like: "Department of Neurology, University of X, City, Country."
  const segments = aff.split(",").map((s) => s.trim()).filter(Boolean);
  // Prefer a segment that looks like a university / hospital / institute.
  const preferred = segments.find((s) =>
    /(universit|hospital|institut|college|clinic|medical center|medical centre|school of medicine)/i.test(s)
  );
  const pick = preferred || segments[0];
  if (!pick) return null;
  // Drop trailing email / postal noise.
  return pick.replace(/\b[\w.-]+@[\w.-]+\b/g, "").replace(/\.$/, "").trim() || null;
}

export function buildInfluenceMap(
  name: string,
  publications: Publication[],
  affiliationsByPaper: string[][],
  trialInvolvement: number
): InfluenceMap {
  const ln = lastName(name).toLowerCase();

  const coAuthorCounts = new Map<string, number>();
  for (const p of publications) {
    const seen = new Set<string>();
    for (const a of p.authors) {
      if (a.toLowerCase().includes(ln)) continue; // skip the doctor
      const key = a.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      coAuthorCounts.set(key, (coAuthorCounts.get(key) ?? 0) + 1);
    }
  }

  const topCollaborators = [...coAuthorCounts.entries()]
    .map(([name, coPublications]) => ({ name, coPublications }))
    .sort((a, b) => b.coPublications - a.coPublications)
    .slice(0, 12);

  const instCounts = new Map<string, number>();
  for (const affs of affiliationsByPaper) {
    const seen = new Set<string>();
    for (const aff of affs) {
      const short = shortenAffiliation(aff);
      if (!short) continue;
      const key = short;
      if (seen.has(key)) continue;
      seen.add(key);
      instCounts.set(key, (instCounts.get(key) ?? 0) + 1);
    }
  }

  const institutions = [...instCounts.entries()]
    .map(([name, mentions]) => ({ name, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 8);

  // Heuristic influence score (0-100). Clearly a derived signal, not a ground truth.
  const pubScore = Math.min(publications.length / 30, 1) * 45;
  const collabScore = Math.min(coAuthorCounts.size / 60, 1) * 30;
  const trialScore = Math.min(trialInvolvement / 6, 1) * 15;
  const seniority =
    publications.filter((p) => p.isLastAuthor || p.isFirstAuthor).length /
    Math.max(publications.length, 1);
  const seniorityScore = seniority * 10;
  const influenceScore = Math.round(pubScore + collabScore + trialScore + seniorityScore);

  return {
    totalPublications: publications.length,
    distinctCollaborators: coAuthorCounts.size,
    topCollaborators,
    institutions,
    trialInvolvement,
    influenceScore,
    scoreBasis:
      "Derived heuristic from public output only: publication volume, distinct co-authors, " +
      "first/last-author share, and registered trial roles. Not a measure of the person's opinions.",
  };
}

export function buildTopicTimeline(publications: Publication[]): TopicTrendPoint[] {
  const byYear = new Map<number, Map<string, number>>();

  for (const p of publications) {
    if (!p.year) continue;
    if (!byYear.has(p.year)) byYear.set(p.year, new Map());
    const bucket = byYear.get(p.year)!;
    const topics = p.meshTerms.length ? p.meshTerms : keywordsFromTitle(p.title);
    for (const t of topics) {
      bucket.set(t, (bucket.get(t) ?? 0) + 1);
    }
  }

  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, counts]) => ({
      period: String(year),
      topics: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([t]) => t),
    }));
}

function keywordsFromTitle(title: string): string[] {
  return title
    .split(/[\s,:;()]+/)
    .filter((w) => w.length > 6)
    .slice(0, 4);
}
