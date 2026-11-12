/**
 * FIXTURE PROVIDER. Synthetic authorities under example.invalid for dev, demo
 * and tests. Nothing here is real law; titles say so and citations use the
 * fictional "Synth." reporter so they can never collide with a real cite.
 */
import { sha256 } from "../http";
import { segment } from "../text";
import {
  ProviderError,
  type Authority,
  type AuthorityText,
  type CitationResolution,
  type LegalProviderAdapter,
  type ProviderCoverage,
  type SearchHit,
  type SearchQuery,
} from "../types";

interface FixtureDoc {
  key: string;
  kind: Authority["kind"];
  title: string;
  cite: { volume: string; reporter: string; page: string } | null;
  court: { id: string; name: string } | null;
  jurisdictionId: string;
  date: string;
  text: string;
}

export const FIXTURE_DOCS: FixtureDoc[] = [
  {
    key: "op-1",
    kind: "opinion",
    title: "Example Buyer v. Example Retailer (synthetic)",
    cite: { volume: "1", reporter: "Synth.", page: "100" },
    court: {
      id: "example-appellate",
      name: "Example Appellate Court (synthetic)",
    },
    jurisdictionId: "NY",
    date: "2024-03-01",
    text: `The plaintiff purchased a product labeled as made with natural ingredients and alleges the label was materially misleading to a reasonable consumer.

*101 To state a claim under the example consumer protection statute, a plaintiff must allege that the defendant engaged in consumer-oriented conduct, that the conduct was materially misleading, and that the plaintiff suffered injury as a result of the conduct.

The reasonable consumer standard is objective. A statement is materially misleading when it is likely to mislead a reasonable consumer acting reasonably under the circumstances. Whether a label is misleading is ordinarily a question of fact.

*102 The plaintiff need not prove justifiable reliance. The statute does not require reliance, but the plaintiff must show that the deceptive act caused actual injury, although not necessarily pecuniary harm.

We therefore reverse the order dismissing the complaint and remand for further proceedings.`,
  },
  {
    key: "op-2",
    kind: "opinion",
    title: "Example Tenant Association v. Example Landlord LLC (synthetic)",
    cite: { volume: "2", reporter: "Synth.", page: "200" },
    court: { id: "example-trial", name: "Example Trial Court (synthetic)" },
    jurisdictionId: "NY",
    date: "2023-09-15",
    text: `The proposed class consists of all tenants who received the standard renewal notice during the class period.

*201 Class certification requires numerosity, commonality, typicality and adequacy of representation, and the court must find that common questions predominate over individual questions and that a class action is superior to other available methods.

Commonality is satisfied where the claims arise from a uniform written notice sent to every class member. Individual damages calculations do not by themselves defeat predominance.

*202 An arbitration clause in a subset of leases does not defeat certification at this stage, but the court may create a subclass if the defendant later moves to compel arbitration.`,
  },
  {
    key: "op-3",
    kind: "opinion",
    title: "Example Insurer v. Example Policyholder (synthetic)",
    cite: { volume: "3", reporter: "Synth.", page: "300" },
    court: { id: "example-federal", name: "Example Federal Court (synthetic)" },
    jurisdictionId: "2d-cir",
    date: "2022-06-30",
    text: `This dispute concerns whether a private contract dispute between sophisticated parties is consumer-oriented.

*301 Private contract disputes unique to the parties do not fall within the example consumer protection statute. The conduct must have a broader impact on consumers at large.

Because the policy at issue was individually negotiated, the claim under the statute fails, and the remaining breach of contract claim proceeds.`,
  },
  {
    key: "st-1",
    kind: "statute",
    title:
      "Example Consumer Protection Act § 1 — Deceptive practices unlawful (synthetic)",
    cite: null,
    court: null,
    jurisdictionId: "NY",
    date: "2020-01-01",
    text: `1. Deceptive acts or practices in the conduct of any business, trade or commerce or in the furnishing of any service in this example state are hereby declared unlawful.

2. Any person who has been injured by reason of any violation of this section may bring an action to enjoin such unlawful act or practice, an action to recover actual damages or fifty dollars, whichever is greater, or both.`,
  },
];

const citeOf = (d: FixtureDoc) =>
  d.cite ? `${d.cite.volume} ${d.cite.reporter} ${d.cite.page}` : null;

export class FixtureAdapter implements LegalProviderAdapter {
  readonly id = "fixture" as const;

  constructor(private readonly now: () => Date = () => new Date()) {}

  getCoverage(): ProviderCoverage {
    return {
      provider: this.id,
      displayName: "Synthetic fixtures (not real law)",
      enabled: true,
      disabledReason: null,
      kinds: ["opinion", "statute"],
      jurisdictionIds: ["NY", "2d-cir"],
      scope:
        "Four synthetic records for development and tests. Never real authority.",
      treatmentCoverage: "none",
      lastSucceededAt: null,
      lastError: null,
      stale: false,
      termsUrl: "https://example.invalid/terms",
    };
  }

  private doc(id: string): FixtureDoc {
    const d = FIXTURE_DOCS.find((x) => x.key === id);
    if (!d) throw new ProviderError(this.id, "not_found", `No fixture ${id}`);
    return d;
  }

  private async toAuthority(d: FixtureDoc): Promise<Authority> {
    const checksum = await sha256(d.text);
    const cite = citeOf(d);
    return {
      id: `fixture:${d.key}`,
      kind: d.kind,
      title: d.title,
      citations: d.cite && cite ? [{ ...d.cite, cite }] : [],
      court: d.court,
      jurisdictionId: d.jurisdictionId,
      decisionDate: d.date,
      docketNumber: null,
      textAvailability: "full_text",
      provenance: {
        provider: this.id,
        providerRecordId: d.key,
        canonicalUrl: `https://example.invalid/authorities/${d.key}`,
        sourceTimestamp: null,
        fetchedAt: this.now().toISOString(),
        checksum,
        versionId: checksum.slice(0, 16),
        publicationStatus: "published",
        licenseStatus: "synthetic",
        attribution: "Casevex synthetic fixture",
      },
    };
  }

  async search(q: SearchQuery): Promise<SearchHit[]> {
    const terms = q.q.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
    const scored = FIXTURE_DOCS.filter(
      (d) =>
        (!q.kinds || q.kinds.includes(d.kind)) &&
        (!q.jurisdictionIds?.length ||
          q.jurisdictionIds.includes(d.jurisdictionId)),
    )
      .map((d) => {
        const hay = `${d.title} ${d.text}`.toLowerCase();
        return { d, score: terms.filter((t) => hay.includes(t)).length };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, q.limit ?? 20);
    return Promise.all(
      scored.map(async ({ d }, i) => ({
        authority: await this.toAuthority(d),
        snippet: d.text.slice(0, 160),
        providerRank: i + 1,
      })),
    );
  }

  async resolveCitations(text: string): Promise<CitationResolution[]> {
    const out: CitationResolution[] = [];
    for (const m of text.matchAll(/\b(\d+)\s+Synth\.\s+(\d+)\b/g)) {
      const d = FIXTURE_DOCS.find(
        (x) => x.cite?.volume === m[1] && x.cite.page === m[2],
      );
      out.push({
        citation: m[0],
        normalized: `${m[1]} Synth. ${m[2]}`,
        status: d ? "resolved" : "unresolved",
        candidates: d ? [await this.toAuthority(d)] : [],
        provider: this.id,
      });
    }
    return out;
  }

  fetchAuthority(id: string): Promise<Authority> {
    return this.toAuthority(this.doc(id));
  }

  async fetchFullText(id: string): Promise<AuthorityText> {
    const d = this.doc(id);
    const authority = await this.toAuthority(d);
    const passages = segment(
      authority.id,
      authority.provenance.versionId,
      markStars(d.text),
      {
        reporter: d.cite ?? undefined,
        minChars: 1,
      },
    );
    return { authority, passages };
  }
}

/** Fixture text uses "*101" star pages on their own paragraph start. */
function markStars(text: string): string {
  return text.replace(/(^|\n)\*(\d+) /g, "$1\u0000PAGE:$2\u0000 ");
}
