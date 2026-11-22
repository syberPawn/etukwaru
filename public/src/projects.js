// Everything on the site. Each entry has a billboard along the road (in the
// order listed, projects first) and rides in the truck as a piece of junk.
// Both open the same record when clicked. The same text also makes up the
// plain-text version of the page that screen readers and search engines read.
//
// Only write what the project's own code, documents or links back up.
//
//   name, brief   shown on the record; brief may be a list of paragraphs.
//                 Any paragraph or field value can mix text and links:
//                 ['Text ', link('linked words', url), ' more text']
//   number        projects only: the project number on the record
//   form          non-projects: the form name at the top of the record
//   fields        extra lines on the record, as { Label: 'text' }
//   team          optional [{ name, linkedin }]; linkedin may be null
//   links         buttons on the record, as [{ label, url }], or
//                 { label, copy: 'text' } for a button that copies text
//   filed         projects only: when it was made
//   stamp         optional: the rubber stamp's word. By default it is
//                 'Released' when there is a 'Visit site' link.
//   board         its billboard: image (16:9 WebP in assets/boards) and
//                 optionally video (a short, silent MP4 loop that plays there),
//                 or a drawn face for the boards that aren't projects
//   junk          the object in the truck: telephone | suitcase | tv |
//                 boombox | toaster | helmet | football | envelope |
//                 register | instagram | linkedin | badge. Or your own picture:
//   image, width  a PNG with a transparent background, e.g.
//                 'assets/junk/briefcase.png', and how wide it appears
//                 (default 110; the truck is about 850). If both are set, the
//                 image wins and junk is the backup if it fails to load.

export const CONTACT = {
  email: 'sangamlunggangmei@gmail.com',
  instagram: 'https://www.instagram.com/s.gangmei/',
  linkedin: 'https://www.linkedin.com/in/sangamlung',
  github: 'https://github.com/syberPawn',
};

/** Linked words inside a paragraph or a field. */
const link = (text, url) => ({ text, url });

const PAPER = {
  title: 'Modular AI-Based Framework for Two-Wheeler Traffic Violation Detection Using Object Detection, Pose Estimation, and ALPR',
  doi: '10.1109/ICC-CNS70518.2026.11606049',
};
PAPER.url = `https://doi.org/${PAPER.doi}`;

const SITES = {
  higherLower: 'https://higherlower.etukwaru.online',
  scholarship: 'https://scholarship.etukwaru.online',
  makaam: 'https://makaamsports.com/',
  dgtal: 'https://www.dgtalregister.xyz/',
};

export const PROJECTS = [
  {
    id: 'higher-lower',
    number: 'EK-3093',
    name: 'Higher or Lower: Nagaland',
    junk: 'tv',
    brief: 'A free guessing game about Nagaland and the Naga people. You see two things and the number for one of them, and guess whether the other is higher or lower: YouTube views, Instagram followers, Google searches, tribes, mountain peaks and more. Classic runs until your first wrong answer; Beat the Clock adds a countdown that keeps getting shorter.',
    fields: {
      'Built with': 'Vite, JavaScript, Cloudflare Pages',
      'Behind it': 'A private admin dashboard to update the numbers and publish, with version history',
    },
    filed: 'November 2026',
    links: [{ label: 'Visit site', url: SITES.higherLower }],
    board: { image: 'assets/boards/higher-lower.webp' },
  },
  {
    id: 'traffic-vision',
    number: 'EK-7731',
    name: 'TrafficVision',
    junk: 'helmet',
    brief: 'My final-year research project, and the work I am proudest of. An AI system that watches roadside video, from a live camera or an upload, and catches two-wheeler offences: riding without a helmet and triple riding. It reads the number plate, finds the registered owner and emails them an e-challan.',
    fields: {
      Paper: link(PAPER.title, PAPER.url),
      Published: 'IEEE, ICC-CNS 2026',
      DOI: link(PAPER.doi, PAPER.url),
      Results: 'Two-wheeler detection 95% mAP; helmet detection 98.3% mAP; number plates 0.995 mAP@0.5',
      'Built with': 'YOLOv8, YOLOv8-pose, OpenCV, Python, Flask',
    },
    team: [
      { name: 'Dr. Bondita Paul', linkedin: 'https://www.linkedin.com/in/dr-bondita-paul-93a526149' },
      { name: 'Simanta Hazarika', linkedin: 'https://www.linkedin.com/in/simanta-hazarika-378121166' },
      { name: 'Deep Das', linkedin: 'https://www.linkedin.com/in/deep-das-845673282' },
      { name: 'Vikosalie Chusi', linkedin: 'https://www.linkedin.com/in/vikosaliechusi' },
      { name: 'Marcel Basumatary', linkedin: 'https://www.linkedin.com/in/marcel-basumatary' },
      { name: 'Chiranjeet Borah', linkedin: null },
    ],
    filed: 'April 2026',
    stamp: 'Peer reviewed',
    links: [
      { label: 'Read the paper on IEEE', url: PAPER.url },
      { label: 'GitHub', url: 'https://github.com/syberPawn/Traffic_VISION_demo' },
    ],
    board: { image: 'assets/boards/traffic-vision.webp' },
  },
  {
    id: 'scholarship-hunting',
    number: 'EK-1864',
    name: 'Scholarship Hunting',
    junk: 'suitcase',
    brief: 'A pixel-art browser game and a piece of political satire. You play the entirely fictional Hon. Minister Fundsworth of Greater Pocketpur: shoot zombie students, collect the scholarship money, and build a Multipurpose Community Hall that turns out to be a private residence.',
    fields: {
      'Plays on': 'Desktop, and phones held sideways',
      'Built with': 'Vite and HTML canvas, with the pixel art, font and sprites all drawn in code',
      Remarks: 'Any resemblance to a real politician is purely coincidental.',
    },
    filed: 'November 2026',
    stamp: 'Awaiting release',   // change to 'Released' once the link below is live
    links: [{ label: 'Visit site', url: SITES.scholarship }],
    board: { image: 'assets/boards/scholarship-hunting.webp' },
  },
  {
    id: 'makaam-sports',
    number: 'EK-5208',
    name: 'Makaam Sports Enterprises',
    junk: 'football',
    brief: 'ZenZen, an AI receptionist live on the website of a sports infrastructure company in Dimapur. It chats with visitors around the clock and is instructed to answer only from the company\'s own information. When a visitor is interested, it collects their details in the conversation, adds them to the lead sheet and emails the owner straight away with an AI-written summary of the chat. Visitors can ask for a meeting the same way.',
    fields: {
      Client: link('Makaam Sports Enterprises, Dimapur', SITES.makaam),
      'AI model': 'GPT-OSS 120B, served by Groq',
      'Built with': 'Netlify Functions, Google Sheets API, Resend, Netlify Blobs',
      Safeguards: 'Answers only from company information; message and rate limits per visitor; strict security policy',
      'Also built': 'The company website, with enquiries by email and WhatsApp',
    },
    filed: 'April 2026',
    stamp: 'In service',
    links: [
      { label: 'Visit site', url: SITES.makaam },
      { label: 'Workflow', url: 'https://youtu.be/pmMtWVXuPdE' },
    ],
    board: { image: 'assets/boards/makaam-sports.webp' },
  },
  {
    id: 'event-management',
    number: 'EK-6472',
    name: 'Event Management Software',
    junk: 'envelope',
    brief: 'An international event company was sending its invitations one by one on WhatsApp and keeping track of the replies in Excel. This automates it: every guest on the list gets a personalised invitation through the official WhatsApp Business Platform, with Confirm and Decline buttons, and the guest list updates itself as the replies come in. One mobile page runs several events at once, with live counts of who is coming.',
    fields: {
      Client: 'An international event company (freelance)',
      'Built with': 'WhatsApp Business Platform (Cloud API), Google Apps Script, Google Sheets',
      'Guest lists': 'Imported from Excel or CSV, exported back to Excel',
      Safeguards: 'Daily sending limits, no duplicate sends, automatic replies to typed messages',
    },
    filed: 'September 2026',
    stamp: 'In service',
    links: [{ label: 'Workflow', url: 'https://youtube.com/shorts/-yf6dUtXUEo' }],
    board: { image: 'assets/boards/event-management.webp', video: 'assets/boards/event-management.mp4' },
  },
  {
    id: 'dgtal-register',
    number: 'EK-2546',
    name: 'Dgtal Register',
    junk: 'register',
    brief: 'An attendance register for teachers that works offline on a phone and syncs when there is internet, made for schools in the hills of North-East India. Create classes, import students from a list, mark attendance with remarks, and export the history.',
    fields: {
      'Built with': 'React, TypeScript, Vite, Tailwind, IndexedDB, Supabase',
      'Works as': 'An installable app (PWA), with email or Google sign-in',
    },
    filed: 'May 2026',
    links: [{ label: 'Visit site', url: SITES.dgtal }],
    board: { image: 'assets/boards/dgtal-register.webp' },
  },
];

const CONTACT_LINKS = [
  { label: 'Email', url: `mailto:${CONTACT.email}` },
  { label: 'Copy email', copy: CONTACT.email },
  { label: 'LinkedIn', url: CONTACT.linkedin },
  { label: 'Instagram', url: CONTACT.instagram },
  { label: 'GitHub', url: CONTACT.github },
];

const CONTACT_FIELDS = {
  Email: link(CONTACT.email, `mailto:${CONTACT.email}`),
  Instagram: link('@s.gangmei', CONTACT.instagram),
  LinkedIn: link('linkedin.com/in/sangamlung', CONTACT.linkedin),
  GitHub: link('github.com/syberPawn', CONTACT.github),
};

/** Everything that isn't a project: no number, and its own form name. */
export const NOTICES = [
  {
    id: 'about',
    form: 'Personnel record · Form WD-01',
    name: 'Sangamlung Gangmei',
    junk: 'badge',
    brief: [
      'Sangamlung Gangmei is a computer science engineer, AI and automation expert and WhatsApp Cloud API expert based in Dimapur, Nagaland. Working freelance, Sangamlung builds AI integrations, workflow automation and web applications for businesses: chat assistants backed by large language models, messaging and RSVP flows on the WhatsApp Cloud API, Google Sheets and Apps Script pipelines, and offline-first progressive web apps.',
      ['With a team at The Assam Kaziranga University, Sangamlung published ', link(`"${PAPER.title}"`, PAPER.url), ' through IEEE, in the ICC-CNS 2026 proceedings. The framework, TrafficVision, began as their final-year project. It runs roadside video, live or uploaded, through a pipeline of YOLOv8 models: two-wheeler detection (95% mAP), helmet detection (98.3% mAP), YOLOv8-pose rider counting to catch triple riding, and licence-plate recognition with YOLOv8n (0.995 mAP@0.5, ahead of a YOLOv5 baseline on the same Indian licence-plate dataset). Each violation is matched to the registered owner, who is sent an e-challan by email.'],
      ['Client work includes ZenZen for ', link('Makaam Sports Enterprises', SITES.makaam), ' in Dimapur: an AI receptionist on the company website, running GPT-OSS 120B through Groq on Netlify Functions. It answers visitors from the company\'s own information, writes leads to Google Sheets and emails the owner an AI-written summary of each conversation through Resend. Sangamlung also built the company website. For an international event company, Sangamlung automated WhatsApp invitations and RSVP tracking with the WhatsApp Business Platform (Cloud API) and Google Apps Script.'],
      ['Sangamlung\'s own projects include ', link('Dgtal Register', SITES.dgtal), ', an offline-first attendance app built with React, TypeScript, IndexedDB and Supabase; ', link('Higher or Lower: Nagaland', SITES.higherLower), ', a browser guessing game about Nagaland and the Naga people; and ', link('Scholarship Hunting', SITES.scholarship), ', a satirical pixel-art arcade game drawn on HTML canvas.'],
    ],
    fields: {
      'Based in': 'Dimapur, Nagaland, India',
      Role: 'Computer science engineer; AI and automation expert; WhatsApp Cloud API expert',
      Works: 'Freelance: AI integration, workflow automation, web applications',
      Publication: link(`IEEE, ICC-CNS 2026 · DOI ${PAPER.doi}`, PAPER.url),
      ...CONTACT_FIELDS,
    },
    stamp: 'On file',
    links: CONTACT_LINKS,
    board: { face: 'about', title: 'Sangamlung Gangmei', line: 'Computer science engineer · Dimapur', cta: 'AI & AUTOMATION · WHATSAPP CLOUD API', caption: 'About me' },
  },
  {
    id: 'instagram',
    form: 'Public notice · Form WD-12',
    name: 'Instagram',
    junk: 'instagram',
    brief: 'Follow along on Instagram.',
    fields: { Handle: '@s.gangmei' },
    stamp: 'Follow',
    links: [{ label: 'Open Instagram', url: CONTACT.instagram }],
    board: { face: 'instagram', handle: '@s.gangmei', caption: 'Follow on Instagram' },
  },
  {
    id: 'linkedin',
    form: 'Public notice · Form WD-12',
    name: 'LinkedIn',
    junk: 'linkedin',
    brief: 'Connect on LinkedIn.',
    stamp: 'Connect',
    links: [{ label: 'Open LinkedIn', url: CONTACT.linkedin }],
    board: { face: 'linkedin', title: 'S.Gangmei', line: 'on LinkedIn', cta: "LET'S CONNECT", caption: 'Connect on LinkedIn' },
  },
  {
    id: 'contact',
    form: 'Request for services · Form WD-99',
    name: 'This space is available',
    junk: 'telephone',
    brief: 'Not for ads. For you. Got a business so boring that this dump looks exciting next to it? Hire me. I will make it interesting, then take it to clients across borders, planets and the occasional galaxy.',
    fields: CONTACT_FIELDS,
    stamp: 'Available',
    links: CONTACT_LINKS,
    board: { face: 'rent', title: 'THIS SPACE', line: 'IS AVAILABLE', cta: 'BORING BUSINESS? HIRE ME.', caption: 'Contact S.Gangmei' },
  },
];
