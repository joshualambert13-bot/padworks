# Writing standard for records

Read this before drafting or reviewing any record. The AI drafts to it; the reviewer checks against it.

## Voice and language

- American English. Present tense. Plain sentences. No em dashes. No marketing language.
- The record name is the generic, vendor-neutral name. OEM names and trademarked field terms appear only in `aliases` or in `oem_examples`.
- Say what the item does and where it sits in the flow path or the string before saying how it is built.
- Numbers carry units (US customary first; SI stored in `si_value`). Ranges use "to", never a dash.

## Tabs

- overview: what it is, what it looks like, how it works. Two to four paragraphs at equipment level; one paragraph at component level.
- engineering: materials, ratings, standards that govern it, how it is sized or selected.
- connections: what it connects to, upstream and downstream, connection type and rating.
- safety: the hazards specific to this item and the controls, written as practice, not procedure. Never write step-by-step procedures for explosives or pressure operations beyond what public standards state.
- specs: a sentence on typical values, plus the structured `specs` array.
- evidence: which sources support which claims.
- operations: where it appears in the job sequence (see Section 4.2 of the framework), rig-up and rig-down notes.
- failure_modes: typical failure mechanisms and their field indicators.

## Evidence

- Every record lists `sources` (S-numbers from `content/sources.json`).
- Every numeric spec carries a `tier` and a `source`. E1 only when a personally held copy of the standard has been checked by the reviewer. E4 for anything without a source, and say so in the text with "pending confirmation".
- Standards are paraphrased by number, edition, and clause. No reproduced tables or figures. No quotation longer than a short phrase.

## Employer property rule

Nothing from an employer's CAD, drawings, procedures, quality records, quote data, training decks, or premises photographs enters this repository. Product knowledge expressed in the author's own words from public dimensions is acceptable.

## Status

- draft: AI-drafted, not read by the reviewer.
- proposed: read once, obvious errors fixed.
- reviewed: every tab and every citation checked; reviewer entry added.
- verified: every numeric value confirmed against two independent public sources.
- deprecated: superseded; keep the file with a note.
