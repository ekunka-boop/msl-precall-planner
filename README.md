# MSL Pre-Call Planner

A pre-call planning tool for Medical Science Liaisons. Type a physician's name and a therapy
area; it builds a guided engagement report from public scientific output.

## What it does

- **Recent publications** — live from PubMed (NCBI E-utilities).
- **Inferred topic & stance trajectory** — derived *only* from the physician's own publications,
  explicitly framed as inferred. There is no public dataset of an individual physician's sentiment,
  so this tool never pretends to know private opinions.
- **Influence map** — co-authorship network and institutional signals built from PubMed, plus
  registered trial roles from ClinicalTrials.gov. The 0–100 influence number is a transparent
  heuristic over public output, not a measure of the person's views.
- **Engagement report** — interest topics, opening talking points, and an open, non-promotional
  line of questioning for insight gathering. Generated at runtime by the Anthropic API.

## Stack

Next.js 14 (App Router, TypeScript). One API route (`/api/analyze`) orchestrates everything
server-side. No database. No stored personal data.

## Run locally

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes (for the report) | Generates the engagement report. The publication/influence data still works without it. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-6`. |
| `NCBI_API_KEY` | No | Raises PubMed rate limits from 3 to 10 req/sec. |

## Deploy on Vercel

1. Import the repo (or deploy directly).
2. Add `ANTHROPIC_API_KEY` under Project → Settings → Environment Variables.
3. Redeploy.

## Compliance note

This is an internal medical-affairs preparation aid for **non-promotional scientific exchange**.
It uses only public scientific output. It is not a CRM, it stores no HCP data, and it must not be
used for promotional targeting. Confirm physician identity and details before any engagement, and
follow your local medical/commercial separation and data-privacy (incl. GDPR) requirements.
