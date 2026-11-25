// /llms.txt: a plain-text summary of the site for AI assistants and crawlers,
// built from the same data as the pages, so it never disagrees with them.
import { CONTACT, PAPER } from '../data/projects.js';
import { WORK, CATEGORIES, workUrl, inCategory } from '../data/work.js';
import { SITE, NAME, IDENTITY, WHAT, STACK } from '../data/person.js';

export function GET() {
  const tv = WORK.find(p => p.id === 'traffic-vision');
  const visit = p => p.links.find(l => l.label === 'Visit site')?.url;
  const line = p => `- [${p.name}](${SITE}${workUrl(p)}): ${p.work.kind}. ${p.work.story}${visit(p) ? ` Live at ${visit(p)}` : ''}`;
  const text = [
    `# ${NAME}`,
    '',
    `> ${NAME} is a ${IDENTITY}, India. Builds ${WHAT} with ${STACK}, and has published peer-reviewed IEEE research on AI traffic-violation detection.`,
    '',
    `The portfolio at ${SITE}/ has a page for each project. An interactive version, a garbage truck driving past a billboard for each project, is at ${SITE}/truck/.`,
    '',
    '## Research',
    '',
    `- [${PAPER.title}](${PAPER.url}): IEEE, ICC-CNS 2026, DOI ${PAPER.doi}. ${tv.work.story.replace(/^My /, `${NAME}'s `)} Two-wheeler detection 95% mAP, helmet detection 98.3% mAP, number-plate detection 0.995 mAP@0.5. With ${tv.team.map(m => m.name).join(', ')}. Case study: ${SITE}${workUrl(tv)}`,
    '',
    ...CATEGORIES.filter(c => c.id !== 'research').flatMap(c => [`## ${c.name}`, '', ...inCategory(c.id).map(line), '']),
    '## Contact',
    '',
    `- Email: ${CONTACT.email}`,
    `- [LinkedIn](${CONTACT.linkedin})`,
    `- [GitHub](${CONTACT.github})`,
    `- [Instagram](${CONTACT.instagram})`,
    `- [About](${SITE}/about/)`,
    '',
  ].join('\n');
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
