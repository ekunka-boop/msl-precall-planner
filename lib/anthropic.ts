import type {
  Publication,
  ClinicalTrial,
  TopicTrendPoint,
  InfluenceMap,
  EngagementReport,
} from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

interface ReportInput {
  name: string;
  therapyArea: string;
  publications: Publication[];
  topicTimeline: TopicTrendPoint[];
  influence: InfluenceMap;
  trials: ClinicalTrial[];
}

const SYSTEM_PROMPT = `You are a medical affairs analyst supporting a Medical Science Liaison (MSL) preparing for a non-promotional scientific exchange with a physician (an external healthcare professional, "HCP").

Hard rules you must follow:
- This is MEDICAL, not commercial. Everything you produce must support scientific dialogue and insight-gathering, never product promotion, never sales messaging, never off-label promotion.
- You are given ONLY the physician's own public scientific output (PubMed publications, MeSH topics, registered trial roles). You have NO access to their private opinions, prescribing behavior, or personal data.
- Any "sentiment" or "stance" you describe must be explicitly framed as INFERRED from their published scientific work, not as a known personal opinion. Hedge honestly. If the signal is weak, say so.
- Questions you suggest must be open, neutral, and designed to LEARN from the physician (insight gathering), not to lead them toward a product.
- Be specific and grounded in the supplied data. Reference real topics, papers, and trials. Do not invent facts not present in the input.

Return ONLY a single valid JSON object, no prose before or after, matching exactly this shape:
{
  "sentimentTrajectory": "2-4 sentence narrative of how the physician's scientific focus and apparent stance have shifted over time, inferred only from their publication record. Explicitly flagged as inferred.",
  "sentimentSignals": ["short bullet evidence point", "..."],
  "interestTopics": [{"topic": "...", "why": "why they likely care, grounded in their output", "evidence": "the paper/trial/topic it is based on"}],
  "talkingPoints": ["a scientifically credible discussion angle the MSL could open with", "..."],
  "lineOfQuestioning": ["an open, non-promotional question for insight gathering", "..."],
  "cautions": ["a compliance / relationship caution specific to this engagement", "..."]
}
Provide 3-5 items in each array.`;

function compactPublications(pubs: Publication[]): string {
  return pubs
    .slice(0, 25)
    .map((p) => {
      const pos = p.isLastAuthor ? "senior author" : p.isFirstAuthor ? "first author" : "co-author";
      const mesh = p.meshTerms.slice(0, 8).join(", ");
      const abs = p.abstract ? p.abstract.slice(0, 600) : "(no abstract)";
      return `- [${p.year ?? "n.d."}] ${p.title} (${p.journal}; ${pos})\n  MeSH: ${mesh}\n  Abstract: ${abs}`;
    })
    .join("\n");
}

function compactTrials(trials: ClinicalTrial[]): string {
  if (!trials.length) return "(no registered trial roles found)";
  return trials
    .map((t) => `- ${t.nctId} [${t.status}, ${t.phase}] ${t.title} — ${t.conditions.join(", ")} (sponsor: ${t.sponsor}; role: ${t.role})`)
    .join("\n");
}

function extractJson(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response");
  return JSON.parse(text.slice(start, end + 1));
}

export async function generateReport(input: ReportInput): Promise<EngagementReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  const timeline = input.topicTimeline
    .map((t) => `${t.period}: ${t.topics.join(", ")}`)
    .join("\n");
  const collaborators = input.influence.topCollaborators
    .map((c) => `${c.name} (${c.coPublications})`)
    .join(", ");

  const userContent = `Physician: ${input.name}
Therapy area focus: ${input.therapyArea || "(not specified)"}

PUBLICATION TOPIC TIMELINE (topics per year):
${timeline || "(insufficient dated topics)"}

TOP COLLABORATORS (co-publication count): ${collaborators || "(none found)"}
Influence signal (derived heuristic, 0-100): ${input.influence.influenceScore}. Basis: ${input.influence.scoreBasis}

REGISTERED TRIAL ROLES:
${compactTrials(input.trials)}

RECENT PUBLICATIONS (most recent first):
${compactPublications(input.publications)}

Produce the engagement report JSON now.`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data?.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");

  const parsed = extractJson(text);
  return {
    sentimentTrajectory: parsed.sentimentTrajectory ?? "",
    sentimentSignals: parsed.sentimentSignals ?? [],
    interestTopics: parsed.interestTopics ?? [],
    talkingPoints: parsed.talkingPoints ?? [],
    lineOfQuestioning: parsed.lineOfQuestioning ?? [],
    cautions: parsed.cautions ?? [],
  };
}
