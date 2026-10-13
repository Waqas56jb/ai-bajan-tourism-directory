import { describe, expect, it } from 'vitest';
import { fetchPageText, htmlToText } from '../../src/knowledge/urlImport.js';

describe('website import', () => {
  it('extracts readable text with headings and drops boilerplate', () => {
    const html = `<html><head><title>Fish cakes &amp; bakes</title><script>alert(1)</script></head>
      <body><nav>Home | About</nav><main><h1>Bajan fish cakes</h1><p>Fish cakes are made with salt fish.</p>
      <ul><li>Salt fish</li><li>Flour</li></ul><footer>© site</footer></main></body></html>`;
    const { title, text } = htmlToText(html);
    expect(title).toBe('Fish cakes & bakes');
    expect(text).toContain('# Bajan fish cakes');
    expect(text).toContain('Fish cakes are made with salt fish.');
    expect(text).toContain('- Salt fish');
    expect(text).not.toMatch(/alert|Home \| About|© site/);
  });

  it.each(['http://localhost/admin', 'http://127.0.0.1/', 'http://10.0.0.5/', 'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data', 'ftp://example.com/x', 'https://user:pw@example.com/', 'http://example.com:8080/'])(
    'refuses non-public or unsafe URL %s (SSRF protection)',
    async (url) => {
      await expect(fetchPageText(url)).rejects.toMatchObject({ status: 400 });
    },
  );
});
