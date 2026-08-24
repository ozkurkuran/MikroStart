# Bundled reference data notes

This module performs no runtime fetch. Values are bundled with the extension so
the search experience remains usable offline and does not create browsing
telemetry.

## Sources and versions

- Physical constants: NIST Web Version 9.0, containing the 2022 CODATA
  recommended values, released 9 May 2024. Only a practical core subset is
  bundled. NIST's displayed significant digits and uncertainty text are kept
  separately from JavaScript numeric values.
- Element names and symbols: IUPAC Periodic Table, 4 May 2022.
- Standard atomic weights: CIAAW Abridged Standard Atomic Weights 2024. The
  table is based on the Atomic Weights 2021 report and includes the 2024
  revisions for gadolinium, lutetium, and zirconium. `null` means that CIAAW
  assigns no standard atomic weight; this module does not substitute a mass
  number.
- Preferred values: the E6, E12, and E24 numerical series associated with IEC
  60063:2015, Edition 3.0. The standard's prose and presentation are not copied.

The element `category` field is a deliberately broad product taxonomy for
filtering and colour treatment. It is not asserted to be an IUPAC normative
classification, especially for elements whose chemical behaviour is uncertain.

## Licensing assumptions

Scientific facts and numerical values are represented with source attribution.
No source artwork, logo, or substantial standards prose is included. NIST data
are treated as United States government works. IUPAC/CIAAW and IEC source pages
remain linked and identified, but maintainers should confirm redistribution
terms before importing larger tables or upstream text. This note is an
engineering assumption, not legal advice.

For safety-critical or publication-grade work, users should verify values at the
linked primary source and record the dataset version in their methods.
