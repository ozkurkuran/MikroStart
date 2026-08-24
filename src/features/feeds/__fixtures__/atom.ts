export const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
  <title>Preprint updates</title>
  <link rel="self" href="https://export.arxiv.org/api/query" />
  <link rel="alternate" href="https://arxiv.org/" />
  <entry>
    <id>http://arxiv.org/abs/2608.12345v2</id>
    <updated>2026-08-24T10:30:00Z</updated>
    <published>2026-08-23T08:00:00Z</published>
    <title>Measurement uncertainty in thin films</title>
    <summary>  A reproducible uncertainty budget.  </summary>
    <author><name>Deniz Scientist</name></author>
    <author><name>Elif Engineer</name></author>
    <link rel="alternate" href="https://arxiv.org/abs/2608.12345v2?utm_campaign=test" />
  </entry>
</feed>`;

export const MALICIOUS_ATOM_FIXTURE = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Untrusted feed</title>
  <entry>
    <id>malicious-1</id>
    <title><![CDATA[<img src=x onerror=alert(1)>Safe title]]></title>
    <summary><![CDATA[<script>alert(document.cookie)</script><b>Useful text</b>]]></summary>
    <link rel="alternate" href="javascript:alert(1)" />
    <author><name><![CDATA[<svg onload=alert(1)>Researcher]]></name></author>
  </entry>
</feed>`;
