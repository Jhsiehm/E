# Legal data sources

Status of each source, how to switch it on, and how to check it works.
Nothing here is a statement that Casevex holds rights to any source; the
terms checklist below is a launch gate (05).

| Provider | What | Env | Terms |
| --- | --- | --- | --- |
| `courtlistener` | Opinions (NY state, 2d Cir., S/E/N/W.D.N.Y., SCOTUS), citation lookup | `COURTLISTENER_API_TOKEN` | https://www.courtlistener.com/terms/ |
| `ny_legislation` | NY consolidated laws (current text) | `NY_OPENLEG_API_KEY` | https://legislation.nysenate.gov/ |
| `govinfo` | U.S. Code, CFR (annual editions) | `GOVINFO_API_KEY` (api.data.gov) | https://www.govinfo.gov/about/policies |
| NY Official Reports | Not implemented: no API; needs rights review | — | https://www.nycourts.gov/reporter/ |

Enable with both the list and the key, in live data mode:

```bash
CASEVEX_DATA_MODE=live \
CASEVEX_LEGAL_PROVIDERS=courtlistener,ny_legislation,govinfo \
COURTLISTENER_API_TOKEN=... NY_OPENLEG_API_KEY=... GOVINFO_API_KEY=... \
npm run dev
```

In fixture mode (the default in dev and on the demo) only the synthetic
provider runs, whatever keys are set.

## Live smoke test

With the server above running:

```bash
curl -s localhost:3000/api/v1/legal-data/coverage | jq '.items[] | {provider, enabled, disabledReason, lastError}'
curl -s 'localhost:3000/api/v1/authorities?q=deceptive%20practices%20consumer-oriented&jurisdictionId=NY' | jq '.items[:3][] | .authority | {id, title, citations, court}'
curl -s -XPOST localhost:3000/api/v1/authority-resolutions -H 'content-type: application/json' \
  -d '{"citation":"N.Y. Gen. Bus. Law § 349"}' | jq '.data.status, .data.candidates[0].title'
curl -s -XPOST localhost:3000/api/v1/legal-research/preview -H 'content-type: application/json' \
  -d '{"question":"What must a plaintiff allege under GBL 349?","jurisdictionIds":["NY"]}' \
  | jq '.data | {mode, abstained, sources: [.sources[] | {title, pinpoint, url}], unresolvedCitations, providerErrors}'
```

Check: every source URL opens the same text on the provider site, pinpoints
match the reporter pages, unknown citations come back `unresolved`.

## Terms checklist before enabling a provider for a pilot (05)
Court/date coverage, API limits, redistribution and storage/indexing rights,
attribution, deletion policy, commercial use, cost, and whether it supplies any
treatment data (none of these do; Casevex reports `not_checked`).
