# Return an index with reduced confidence when a factor is missing

## Context

The index sums eight factors out of 100, and the product refuses to publish one when any factor is missing. The provider intermittently omits air quality, so one missing factor suppresses the index for every location. The interface has no way to present a partial result.

## Decision

The product computes an index from the factors present, normalizes it over the maximum of those factors, and reports the missing factors with a confidence level. A missing factor never suppresses an index.

## Rationale

A missing input should not remove the product's primary function, and normalizing over the present maximum keeps the 0 to 100 scale meaningful. Keeping the complete-factors-only rule reproduces the observed outage. Treating a missing factor as zero points misstates the weather as the worst case. Presenting the value only as a reference hides it from the main judgement, which the confidence label already qualifies.

## Consequences

- Indices with different coverage are not directly comparable, so the interface always shows the missing factors and the confidence.
- The meaning of a score depends on its reported coverage.
