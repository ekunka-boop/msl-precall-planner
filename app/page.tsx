"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types";

export default function Home() {
  const [name, setName] = useState("");
  const [therapyArea, setTherapyArea] = useState("Myasthenia Gravis");
  const [npi, setNpi] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, therapyArea, npi }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Something went wrong.");
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err?.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="masthead">
        <p className="eyebrow">Medical Affairs · Pre-Call Intelligence</p>
        <h1>MSL Pre-Call Planner</h1>
        <p>
          Type a physician&apos;s name and get a guided engagement report built from their public
          scientific output: recent publications, an inferred topic-and-stance trajectory, an
          influence map, and an insight-gathering line of questioning.
        </p>
      </header>

      <div className="panel">
        <form className="lookup" onSubmit={run}>
          <div className="field">
            <label htmlFor="name">Physician name</label>
            <input
              id="name"
              placeholder="e.g. James F. Howard"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ta">Therapy area</label>
            <input
              id="ta"
              placeholder="e.g. Myasthenia Gravis"
              value={therapyArea}
              onChange={(e) => setTherapyArea(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="npi">NPI number <span className="opt">(optional)</span></label>
            <input
              id="npi"
              inputMode="numeric"
              placeholder="e.g. 1234567890"
              value={npi}
              onChange={(e) => setNpi(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </div>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Analyzing…" : "Generate report"}
          </button>
        </form>
        <p className="hint">
          Tip: use the name as it appears on papers. Last name plus initials works best
          (e.g. &ldquo;Howard JF&rdquo;).
        </p>
      </div>

      {loading && (
        <div className="panel">
          <span className="spinner" /> &nbsp;Pulling PubMed, ClinicalTrials.gov, and building the report…
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {result && <Report result={result} />}
    </main>
  );
}

function Report({ result }: { result: AnalysisResult }) {
  const { report, influence, publications, trials, topicTimeline, dataCoverage, query } = result;

  return (
    <>
      <div className="report-actions">
        <div className="stat-row">
          <div className="stat">
            <div className="num">{dataCoverage.publicationsFound}</div>
            <div className="lbl">Publications</div>
          </div>
          <div className="stat">
            <div className="num">{dataCoverage.trialsFound}</div>
            <div className="lbl">Trial roles</div>
          </div>
          <div className="stat">
            <div className="num">{influence.distinctCollaborators}</div>
            <div className="lbl">Collaborators</div>
          </div>
          <div className="stat">
            <div className="num score">{influence.influenceScore}</div>
            <div className="lbl">Influence signal</div>
          </div>
          <div className="stat">
            <div className="num">
              {dataCoverage.earliestYear ?? "—"}–{dataCoverage.latestYear ?? "—"}
            </div>
            <div className="lbl">Active span</div>
          </div>
        </div>
        <button className="ghost" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      {result.notes.map((n, i) => (
        <div className="notice" key={i}>{n}</div>
      ))}

      {result.npiProfile && (
        <div className="npi-verify">
          <span className="npi-tag">NPI verified</span>
          <span className="npi-bits">
            <strong>{result.npiProfile.name}</strong>
            {result.npiProfile.credential ? `, ${result.npiProfile.credential}` : ""}
            {result.npiProfile.specialty ? ` · ${result.npiProfile.specialty}` : ""}
            {(result.npiProfile.city || result.npiProfile.state)
              ? ` · ${[result.npiProfile.city, result.npiProfile.state].filter(Boolean).join(", ")}`
              : ""}
            {` · NPI ${result.npiProfile.npi}`}
          </span>
        </div>
      )}
      {result.reportError && <div className="error">{result.reportError}</div>}

      {report && (
        <>
          <div className="panel">
            <h3 className="section-title"><span className="dot" />Inferred topic &amp; stance trajectory</h3>
            <p style={{ marginTop: 0 }}>{report.sentimentTrajectory}</p>
            {report.sentimentSignals.length > 0 && (
              <ul className="clean">
                {report.sentimentSignals.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>

          <div className="panel">
            <h3 className="section-title"><span className="dot" />Topics they care about</h3>
            {report.interestTopics.map((t, i) => (
              <div className="topic" key={i}>
                <h4>{t.topic}</h4>
                <p className="why">{t.why}</p>
                <p className="ev">Based on: {t.evidence}</p>
              </div>
            ))}
          </div>

          <div className="panel">
            <h3 className="section-title"><span className="dot" />Opening talking points</h3>
            <ul className="clean">
              {report.talkingPoints.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>

          <div className="panel">
            <h3 className="section-title"><span className="dot" />Line of questioning (insight gathering)</h3>
            <ol className="questions">
              {report.lineOfQuestioning.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          </div>

          {report.cautions.length > 0 && (
            <div className="panel cautions">
              <h3 className="section-title"><span className="dot" />Cautions</h3>
              <ul className="clean">
                {report.cautions.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="panel">
        <h3 className="section-title"><span className="dot" />Influence map</h3>
        {influence.topCollaborators.length > 0 ? (
          <>
            <div className="chips" style={{ marginBottom: 16 }}>
              {influence.topCollaborators.map((c) => (
                <span className="chip" key={c.name}>
                  {c.name}<span className="n">{c.coPublications}</span>
                </span>
              ))}
            </div>
            {influence.institutions.length > 0 && (
              <>
                <div className="lbl" style={{ marginBottom: 8 }}>Institutional signals</div>
                <div className="chips">
                  {influence.institutions.map((inst) => (
                    <span className="chip" key={inst.name}>
                      {inst.name}<span className="n">{inst.mentions}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <p style={{ margin: 0 }}>No co-authorship network found for this query.</p>
        )}
        <p className="disclaimer">{influence.scoreBasis}</p>
      </div>

      {topicTimeline.length > 0 && (
        <div className="panel">
          <h3 className="section-title"><span className="dot" />Topic timeline</h3>
          <div className="timeline">
            {topicTimeline.slice().reverse().map((row) => (
              <div className="tl-row" key={row.period}>
                <div className="tl-year">{row.period}</div>
                <div className="chips">
                  {row.topics.map((t) => <span className="chip" key={t}>{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {trials.length > 0 && (
        <div className="panel">
          <h3 className="section-title"><span className="dot" />Registered trial roles</h3>
          <ul className="clean">
            {trials.map((t) => (
              <li key={t.nctId}>
                <a href={t.url} target="_blank" rel="noreferrer">{t.title}</a>
                <span className="tag">{t.status}</span>
                <div className="meta">
                  {t.nctId} · {t.phase} · {t.conditions.join(", ")} · {t.sponsor} · role: {t.role}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel">
        <h3 className="section-title"><span className="dot" />Recent publications</h3>
        <div>
          {publications.slice(0, 15).map((p) => (
            <div className="pub" key={p.pmid}>
              <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
              {p.isLastAuthor && <span className="tag">Senior author</span>}
              {p.isFirstAuthor && <span className="tag">First author</span>}
              <div className="meta">
                {p.journal}{p.year ? ` · ${p.year}` : ""}
                {p.meshTerms.length ? ` · ${p.meshTerms.slice(0, 4).join(", ")}` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="disclaimer">
        For internal medical / scientific-exchange preparation only. Every &ldquo;sentiment&rdquo; or
        stance signal here is inferred from the physician&apos;s own published work, not from their
        private opinions, prescribing behavior, or any personal data. Not for promotional use.
        Verify identity and details before any engagement. Generated {new Date(result.generatedAt).toLocaleString()} for query &ldquo;{query.name}&rdquo;.
      </p>
    </>
  );
}
