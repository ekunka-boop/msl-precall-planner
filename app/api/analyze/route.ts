import { NextRequest, NextResponse } from "next/server";
import { fetchPublications } from "@/lib/pubmed";
import { fetchTrials } from "@/lib/clinicaltrials";
import { buildInfluenceMap, buildTopicTimeline } from "@/lib/influence";
import { generateReport } from "@/lib/anthropic";
import { lookupNpi, isValidNpi } from "@/lib/npi";
import type { AnalysisResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body?.name || "").toString().trim();
  const therapyArea = (body?.therapyArea || "").toString().trim();
  const npi = (body?.npi || "").toString().replace(/\D/g, "");

  if (!name) {
    return NextResponse.json({ error: "A physician name is required." }, { status: 400 });
  }

  if (npi && !isValidNpi(npi)) {
    return NextResponse.json({ error: "That NPI is not valid. It must be a 10-digit number with a correct check digit." }, { status: 400 });
  }

  const notes: string[] = [];

  try {
    const npiPromise = npi
      ? lookupNpi(npi).catch(() => null)
      : Promise.resolve(null);

    const [{ publications, affiliationsByPaper }, trials, npiProfile] = await Promise.all([
      fetchPublications(name, therapyArea),
      fetchTrials(name, therapyArea),
      npiPromise,
    ]);

    if (npi && !npiProfile) {
      notes.push("The NPI was a valid format but no matching provider was found in the CMS NPPES registry. The report below is based on the name and therapy area.");
    }

    if (!publications.length) {
      notes.push(
        "No PubMed publications matched this name and therapy area. Try the name as it appears on papers (e.g. last name plus initials), or widen the therapy area."
      );
    }

    const influence = buildInfluenceMap(name, publications, affiliationsByPaper, trials.length);
    const topicTimeline = buildTopicTimeline(publications);

    const years = publications.map((p) => p.year).filter((y): y is number => y !== null);

    let report = null;
    let reportError: string | null = null;
    if (publications.length || trials.length) {
      try {
        report = await generateReport({ name, therapyArea, publications, topicTimeline, influence, trials });
      } catch (e: any) {
        const msg = e?.message || "Report generation failed.";
        reportError = /ANTHROPIC_API_KEY/.test(msg)
          ? "The engagement report needs an ANTHROPIC_API_KEY. The raw data below is still live."
          : msg;
      }
    } else {
      reportError = "Not enough public data to generate a report.";
    }

    const result: AnalysisResult = {
      query: { name, therapyArea, npi: npi || undefined },
      generatedAt: new Date().toISOString(),
      dataCoverage: {
        publicationsFound: publications.length,
        earliestYear: years.length ? Math.min(...years) : null,
        latestYear: years.length ? Math.max(...years) : null,
        trialsFound: trials.length,
      },
      publications,
      topicTimeline,
      influence,
      trials,
      report,
      reportError,
      notes,
      npiProfile,
    };

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Analysis failed unexpectedly." },
      { status: 500 }
    );
  }
}
