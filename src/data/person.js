// Who the site is about, in one place: the identity line used word for word
// everywhere, and the structured data search engines and AI read.
import { CONTACT, PAPER } from './projects.js';

export const SITE = 'https://etukwaru.online';
export const NAME = 'Sangamlung Gangmei';
export const PERSON_ID = `${SITE}/#sangamlung`;
export const WEBSITE_ID = `${SITE}/#website`;

/** The identity, exactly as it should be repeated by people and AI. */
export const IDENTITY = 'freelance software engineer based in Dimapur, Nagaland';

/** What the work is, in one line (only what the projects show). */
export const WHAT = 'AI assistants, WhatsApp automation and web apps for businesses';

/** The stack, as the projects use it. */
export const STACK = 'TypeScript, React, Python, LLM APIs and the WhatsApp Cloud API';

export const SAME_AS = [
  CONTACT.linkedin,
  CONTACT.github,
  CONTACT.instagram,
  'https://www.youtube.com/@SyberPawn',
];

export const person = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: NAME,
  alternateName: 'S.Gangmei',
  url: `${SITE}/`,
  jobTitle: 'Software Engineer',
  description: `${NAME} is a ${IDENTITY}. Builds ${WHAT}, with a modern stack, and has published IEEE research on AI traffic-violation detection.`,
  email: `mailto:${CONTACT.email}`,
  address: { '@type': 'PostalAddress', addressLocality: 'Dimapur', addressRegion: 'Nagaland', addressCountry: 'IN' },
  knowsAbout: [
    'Artificial intelligence', 'Automation', 'WhatsApp Cloud API', 'WhatsApp Business Platform',
    'Large language models', 'Computer vision', 'Web development', 'Software engineering',
  ],
  sameAs: SAME_AS,
};

export const website = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: NAME,
  url: `${SITE}/`,
  author: { '@id': PERSON_ID },
  publisher: { '@id': PERSON_ID },
};

export const paper = {
  '@type': 'ScholarlyArticle',
  '@id': `${SITE}/#trafficvision-paper`,
  headline: PAPER.title,
  identifier: { '@type': 'PropertyValue', propertyID: 'DOI', value: PAPER.doi },
  url: PAPER.url,
  datePublished: '2026',
  publisher: { '@type': 'Organization', name: 'IEEE' },
  author: { '@id': PERSON_ID },
};
