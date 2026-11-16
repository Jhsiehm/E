import { emptyProfile, type Profile } from "./profile";

/** Complete fictional persona for the public, no-registration walkthrough. */
export function prototypeProfile(): Profile {
  return {
    ...emptyProfile("demo@casevex.example"),
    fullName: "Jordan Wells",
    jobTitle: "Partner",
    firmName: "Wells & Associates",
    persona: "attorney",
    aiExperience: "some",
    practiceAreas: ["ny_civil_litigation"],
    primaryArea: "ny_civil_litigation",
    niches: ["Trade secrets", "Commercial disputes"],
    jurisdictions: ["S.D.N.Y.", "Second Circuit", "New York"],
    onboardedAt: "2026-11-12T00:00:00.000Z",
  };
}
