// /sitemap.xml, listing every page. lastmod is the build date.
import { WORK, workUrl } from '../data/work.js';
import { SITE } from '../data/person.js';

export function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const paths = ['/', '/about/', ...WORK.map(workUrl), '/truck/'];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map(p => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'content-type': 'application/xml' } });
}
