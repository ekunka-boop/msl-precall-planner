# Deploy guide

The app is built and the production build passes. Two ways to get it live. Both end with you
adding one secret (`ANTHROPIC_API_KEY`) so the engagement report can generate.

Everything below runs from the project folder:

```
cd "~/Documents/Claude Cowork/OUTPUTS/msl-precall-planner"
```

## Fastest path: Vercel CLI (live URL in ~3 minutes, GitHub optional)

No GitHub needed for this. From the project folder:

```
npx vercel            # first run asks you to log in, then deploys a preview
npx vercel --prod     # promotes to a production URL
```

Then add your key so reports work:

```
npx vercel env add ANTHROPIC_API_KEY production
# paste your key from https://console.anthropic.com/ when prompted
npx vercel --prod     # redeploy so the key takes effect
```

That's it. The preview URL works immediately for the publication and influence data; the
engagement report turns on once the key is set.

## GitHub + Vercel (what you asked for: both connected)

A clean git repo first. I started one, but my sandbox couldn't delete git's temp lock files, so
reset it fresh on your machine (this is instant and clean):

```
rm -rf .git
git init
git add -A
git commit -m "MSL Pre-Call Planner: initial commit"
```

Create the GitHub repo and push (needs the GitHub CLI `gh`, or do it in the GitHub web UI):

```
gh repo create msl-precall-planner --private --source=. --push
```

No `gh`? Create an empty repo at github.com/new, then:

```
git remote add origin https://github.com/<you>/msl-precall-planner.git
git push -u origin main
```

Connect Vercel:

1. Go to https://vercel.com/new
2. Import the `msl-precall-planner` repo. Vercel auto-detects Next.js, no config needed.
3. Before the first deploy, open **Environment Variables** and add `ANTHROPIC_API_KEY` with your key.
4. Deploy. Every future `git push` now auto-deploys.

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `ANTHROPIC_API_KEY` | Yes, for the report | Publication + influence data work without it. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-4-6`. |
| `NCBI_API_KEY` | No | Lifts PubMed rate limit 3 → 10 req/sec. |

## A note on function timeout

The `/api/analyze` route makes several external calls plus one LLM call, so it can take 15–30s.
It's set to `maxDuration = 60`. If reports occasionally time out on the Vercel Hobby plan, that
limit is the reason; Pro raises it.
