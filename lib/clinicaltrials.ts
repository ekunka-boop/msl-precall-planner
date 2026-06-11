import type { ClinicalTrial } from "./types";
import { lastName } from "./pubmed";

const CTGOV = "https://clinicaltrials.gov/api/v2/studies";

/**
 * Find trials where the named person appears as an overall official / investigator.
 * ClinicalTrials.gov v2 has no dedicated investigator filter, so we query broadly
 * and keep studies whose officials match the doctor's last name.
 */
export async function fetchTrials(
  name: string,
  therapyArea: string
): Promise<ClinicalTrial[]> {
  const term = therapyArea && therapyArea.trim() ? `${name} ${therapyArea}` : name;
  const url =
    `${CTGOV}?query.term=${encodeURIComponent(term)}` +
    `&pageSize=30&format=json`;

  let json: any;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "msl-precall-planner" } });
    if (!res.ok) return [];
    json = await res.json();
  } catch {
    return [];
  }

  const ln = lastName(name).toLowerCase();
  const studies = Array.isArray(json?.studies) ? json.studies : [];
  const out: ClinicalTrial[] = [];

  for (const s of studies) {
    const ps = s?.protocolSection;
    if (!ps) continue;

    const officials = ps?.contactsLocationsModule?.overallOfficials ?? [];
    const officialNames: string[] = officials.map((o: any) => String(o?.name || ""));
    const match = officialNames.find((n) => n.toLowerCase().includes(ln));
    if (!match) continue; // only keep trials where the doctor is actually an official

    out.push({
      nctId: ps?.identificationModule?.nctId ?? "",
      title:
        ps?.identificationModule?.briefTitle ??
        ps?.identificationModule?.officialTitle ??
        "Untitled study",
      status: ps?.statusModule?.overallStatus ?? "Unknown",
      phase: (ps?.designModule?.phases ?? []).join(", ") || "N/A",
      conditions: ps?.conditionsModule?.conditions ?? [],
      sponsor: ps?.sponsorCollaboratorsModule?.leadSponsor?.name ?? "Unknown sponsor",
      role:
        officials.find((o: any) => String(o?.name || "").toLowerCase().includes(ln))?.role ??
        "Investigator",
      url: `https://clinicaltrials.gov/study/${ps?.identificationModule?.nctId ?? ""}`,
    });
  }

  return out;
}
