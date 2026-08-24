export const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Materials &amp; Interfaces</title>
    <link>https://journal.example.org/?utm_source=feed</link>
    <language>en-US</language>
    <item>
      <guid isPermaLink="false">doi:10.1234/THIN.FILM.42</guid>
      <title><![CDATA[Thin-film <em>growth</em> study]]></title>
      <link>https://journal.example.org/articles/42?utm_medium=rss&amp;b=2&amp;a=1#abstract</link>
      <dc:creator>Ada Researcher</dc:creator>
      <description><![CDATA[<p>A source-backed abstract.</p>]]></description>
      <pubDate>Mon, 24 Aug 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

export const RSS_DUPLICATE_FIXTURE = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Institute announcements</title>
    <link>https://institute.example.edu/</link>
    <item>
      <guid>https://doi.org/10.1234/thin.film.42</guid>
      <title>Thin-film growth study — extended title</title>
      <link>https://doi.org/10.1234/thin.film.42</link>
      <author>Ada Researcher</author>
      <description>A longer source description for the same research output.</description>
      <pubDate>Mon, 24 Aug 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;
