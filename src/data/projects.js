// Every project and notice, shared by the portfolio (built by Astro from
// src/) and the truck game (public/truck/, which receives a copy of this file
// at /truck/src/projects.js). Keep it plain JavaScript with no imports.
//
// In the truck game, each entry has a billboard along the road (in the order
// listed, projects first) and rides in the truck as a piece of junk; both open
// the same record when clicked.
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
//   work          projects only, for the portfolio:
//                   category  'automation' | 'research' | 'apps' (see CATEGORIES)
//                   file      a real file from the project's code, shown as its tab
//                   alt       what the board picture shows, for screen readers
//                   artifact  the figure (src/data/art) its preview gathers out of
//                   result    the outcome, in one line
//                   kind, for what it is, and who it is for
//                   story     two or three sentences: what it does, plainly
//                   points    what it does, in detail (its own page)
//                   build     how it is built (its own page)
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
  email: 'ssangamlung@gmail.com',
  instagram: 'https://www.instagram.com/s.gangmei/',
  linkedin: 'https://www.linkedin.com/in/sangamlung',
  github: 'https://github.com/syberPawn',
};

/** Linked words inside a paragraph or a field. */
const link = (text, url) => ({ text, url });

export const PAPER = {
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

/** How the portfolio groups the projects, in this order. */
export const CATEGORIES = [
  { id: 'automation', name: 'AI & automation', line: 'Assistants and messaging that take repetitive work off a business.' },
  { id: 'research', name: 'AI research', line: 'Computer vision, tested and published.' },
  { id: 'apps', name: 'Apps & games', line: 'Web apps and browser games, built to load fast and work on a phone.' },
];

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
    work: {
      category: 'apps',
      file: 'game.js',
      artifact: 'basket',
      alt: 'The Higher or Lower home screen, with the Classic and Beat the Clock modes',
      result: '120 Naga numbers, one guess at a time',
      kind: 'Browser game',
      for: 'Players who know Nagaland',
      story: 'Two things, one number shown: is the other higher or lower? 120 comparisons across seven categories, from Naga YouTubers and Instagram accounts to tribes, districts and mountain peaks, each with its source. Classic ends at your first miss. Beat the Clock cuts the timer from 10 seconds to 5 as your streak grows.',
      type: 'Browser game',
      stack: 'Vite, JavaScript, Cloudflare Pages',
      points: [
        'Seven categories: Naga YouTubers, Naga Instagram, all-time Google searches, Naga tribes, district population, mountain heights and a Naga timeline.',
        'Every category names its source at the end of a game: YouTube, Instagram, Google Trends, the Census of India 2011 and Wikipedia.',
        'Comparisons get closer as your streak grows. In Beat the Clock the timer drops through four levels, from 10 seconds to 5.',
        'Your best score is kept per mode and per category on your own device.',
      ],
      build: [
        'A static site with no server online: Vite builds it and Cloudflare Pages serves it, with a strict security policy and no inline scripts.',
        'A private admin dashboard that runs only on my computer: password sign-in, content checks before every publish, and the last 50 versions kept to roll back to.',
        'Automated tests build the real site and check that no admin code or private notes reach it.',
      ],
    },
  },
  {
    id: 'traffic-vision',
    number: 'EK-7731',
    name: 'TrafficVision',
    junk: 'helmet',
    brief: 'My final-year research project, and the work I am proudest of. An AI system that takes roadside video and catches two-wheeler offences: riding without a helmet and triple riding. It reads the number plate of the offending vehicle and writes an e-challan with photo evidence.',
    fields: {
      Paper: link(PAPER.title, PAPER.url),
      Published: 'IEEE, ICC-CNS 2026',
      DOI: link(PAPER.doi, PAPER.url),
      Results: 'Two-wheeler detection 95% mAP; helmet detection 98.3% mAP; number plates 0.995 mAP@0.5',
      'Built with': 'YOLOv8, YOLOv8-pose, EasyOCR, OpenCV, Python, Streamlit',
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
    work: {
      category: 'research',
      file: 'app.py',
      artifact: 'shield',
      alt: 'Roadside video with boxes drawn around two-wheelers and their riders',
      result: 'No helmet, three riders: caught on video, challan written',
      kind: 'Computer vision research',
      for: 'Published by IEEE',
      story: 'My final-year project at The Assam Kaziranga University, published in the ICC-CNS 2026 proceedings. Separate YOLOv8 models find each two-wheeler, check for helmets, count riders by pose and read the number plate. Every offence becomes a challan with photo evidence.',
      type: 'Research and working demo',
      stack: 'YOLOv8, YOLOv8-pose, EasyOCR, Python',
      points: [
        'Detects motorcycles and scooters in each frame of an uploaded video.',
        'Widens each detection upward to take in the rider, then checks for helmets on that crop.',
        'Counts riders with YOLOv8-pose to catch triple riding.',
        'Follows an offending vehicle across frames and picks its clearest number-plate image for reading.',
        'Writes one challan per vehicle, as a PDF with the offence, time, fine and an evidence image.',
      ],
      build: [
        'A modular pipeline: two-wheeler detection, helmet detection, pose estimation and plate recognition are separate models, so any one can be retrained or replaced alone.',
        'Plates are found with a YOLOv8 model and read with EasyOCR.',
        'The demo runs in Streamlit, on a CPU or an NVIDIA GPU, and shows the processed video, frame rate, a violation table and the challans.',
      ],
    },
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
    work: {
      category: 'apps',
      file: 'battle.js',
      artifact: 'dao',
      alt: 'The Scholarship Hunting title screen: the minister between two zombie students',
      result: 'Political satire, 320 by 180 pixels',
      kind: 'Pixel-art browser game',
      for: 'Satire',
      story: 'You play the entirely fictional Hon. Minister Fundsworth of Greater Pocketpur. Shoot zombie students, collect the scholarship money, then build a Multipurpose Community Hall that turns out to be a private residence. Every sprite, background and letter of the font is drawn in code.',
      type: 'Browser game',
      stack: 'Vite, HTML canvas, JavaScript',
      points: [
        'Three scenes: the battlefield, a 30-second construction site, and the ending.',
        'Power-ups called NARRATIVE++ and DEMOCRACY++, and a minister who lectures you the whole time.',
        'The students thin out as the funds fill up, but never stop, so a round can always be finished.',
        'Plays on a desktop with keys and mouse, or on a phone held sideways with a thumb joystick.',
      ],
      build: [
        'Drawn on a 320 by 180 canvas, scaled up sharp to fit the screen.',
        'No image files: the pixel font, characters and backgrounds are all drawn in code.',
        'An automated playthrough in a headless browser, and a simulator that plays whole rounds to check how long they take.',
      ],
    },
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
    work: {
      category: 'automation',
      file: 'chat.js',
      artifact: 'warrior-profile',
      alt: 'The Makaam Sports website with the ZenZen chat window open',
      result: 'An interested visitor becomes a lead, with a briefing for the owner',
      kind: 'AI receptionist',
      for: 'Makaam Sports Enterprises, Dimapur',
      story: 'ZenZen answers visitors on the website of a sports infrastructure company, any hour, using only the company\'s own information, and says so when it doesn\'t know. When someone is interested, it takes their details, adds them to the lead sheet and emails the owner a short briefing on the chat.',
      type: 'AI assistant and company website',
      stack: 'GPT-OSS 120B on Groq, Netlify Functions',
      points: [
        'Answers questions about the company\'s turfs, courts and pools from its public information only, and never claims to do something it can\'t.',
        'Collects a visitor\'s name, phone, email and project in the conversation, once.',
        'Adds each lead to a Google Sheet and emails the owner a summary of the chat in 70 to 150 words.',
        'Takes meeting requests with a preferred time and passes them on the same way.',
      ],
      build: [
        'GPT-OSS 120B served by Groq, called from a Netlify Function, so the keys never reach the browser.',
        'Google Sheets API for the lead sheet, and Resend for the emails.',
        'Limits per visitor: 15 messages every 3 hours, tracked in Netlify Blobs, and 500 characters a message. Only the company\'s own site can call it.',
        'I also built the company website, with enquiries by email and WhatsApp.',
      ],
    },
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
      Safeguards: 'No duplicate sends; a guest list locks once invitations go out; automatic replies to typed messages',
    },
    filed: 'September 2026',
    stamp: 'In service',
    links: [{ label: 'Workflow', url: 'https://youtube.com/shorts/-yf6dUtXUEo' }],
    board: { image: 'assets/boards/event-management.webp', video: 'assets/boards/event-management.mp4' },
    work: {
      category: 'automation',
      file: 'whatsapp_invite_system_v3.gs',
      artifact: 'hornbill',
      alt: 'A guest list imported from a spreadsheet, ready to send',
      result: 'Personal WhatsApp invitations, and the RSVPs count themselves',
      kind: 'WhatsApp Cloud API automation',
      for: 'An international client, freelance',
      story: 'The client was inviting wedding guests one WhatsApp message at a time and keeping the replies in Excel. Now they import the guest list on a phone page and press send. Every guest gets a personal invitation with Confirm and Decline buttons, and the list updates itself as the answers come in.',
      type: 'Messaging automation',
      stack: 'WhatsApp Cloud API, Google Apps Script',
      points: [
        'Runs several weddings at once, each with its own guest list, invitation image and live counts of sent, confirmed and declined.',
        'Imports guest lists from Excel, CSV or typed rows, and exports them back to Excel.',
        'Sends the approved invitation template, with the guest\'s name, to everyone not yet invited.',
        'Records each answer from the Confirm and Decline buttons, and answers typed messages with an automatic reply the client can edit.',
        'Locks a guest list once invitations go out, so nobody is invited, or billed for, twice.',
      ],
      build: [
        'The official WhatsApp Business Platform (Cloud API), so sending isn\'t restricted the way an ordinary WhatsApp number is.',
        'A Google Apps Script web app the client uses from their phone, with Google Sheets as the database behind it.',
        'Sends in batches that pick up where they left off, past Apps Script\'s six-minute limit on a single run.',
        'Re-uploads the invitation image before Meta\'s 30-day expiry, so a late send never fails on it.',
      ],
    },
  },
  {
    id: 'dgtal-register',
    number: 'EK-2546',
    name: 'Dgtal Register',
    junk: 'register',
    brief: 'An attendance register for teachers that works offline on a phone and syncs when there is internet. Create classes, import students from a list, mark attendance with remarks, and export the history.',
    fields: {
      'Built with': 'React, TypeScript, Vite, Tailwind, IndexedDB, Supabase',
      'Works as': 'An installable app (PWA), with email or Google sign-in',
    },
    filed: 'May 2026',
    links: [{ label: 'Visit site', url: SITES.dgtal }],
    board: { image: 'assets/boards/dgtal-register.webp' },
    work: {
      category: 'apps',
      file: 'SyncController.tsx',
      artifact: 'warrior-full',
      alt: 'Dgtal Register on a phone: students marked present, with a remark being typed',
      result: 'Attendance taken offline, synced when the signal comes back',
      kind: 'Offline-first web app',
      for: 'Teachers',
      story: 'Teachers mark attendance on their phone, with or without internet. Every change is saved on the phone first and queued, then synced to the database when a connection returns. Classes come in from a CSV file or a pasted list, and the history goes out as a CSV.',
      type: 'Web app (PWA)',
      stack: 'React, TypeScript, IndexedDB, Supabase',
      points: [
        'Create classes and import students from CSV, TXT or a pasted list.',
        'Mark daily attendance, with remarks for individual students, online or offline.',
        'See the attendance history and export it as a CSV.',
        'Sign in with email or Google, and install it on a phone like an app.',
      ],
      build: [
        'Classes, attendance and a queue of unsynced changes are stored on the phone in IndexedDB.',
        'Syncs to Supabase, where row-level security keeps each teacher\'s records to themselves.',
        'React, TypeScript, Vite and Tailwind, installable as a progressive web app.',
      ],
    },
  },
];

const CONTACT_LINKS = [
  { label: 'Email', url: `mailto:${CONTACT.email}` },
  // For people with no mail app set up: mailto: does nothing for them.
  { label: 'Gmail', url: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONTACT.email)}` },
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
      'Sangamlung Gangmei is a freelance software engineer based in Dimapur, Nagaland, working with a modern stack. Sangamlung builds AI integrations, workflow automation and web applications for businesses: chat assistants backed by large language models, messaging and RSVP flows on the WhatsApp Cloud API, Google Sheets and Apps Script pipelines, and offline-first progressive web apps.',
      ['With a team at The Assam Kaziranga University, Sangamlung published ', link(`"${PAPER.title}"`, PAPER.url), ' through IEEE, in the ICC-CNS 2026 proceedings. The framework, TrafficVision, began as their final-year project. It runs roadside video through a pipeline of YOLOv8 models: two-wheeler detection (95% mAP), helmet detection (98.3% mAP), YOLOv8-pose rider counting to catch triple riding, and licence-plate recognition with YOLOv8n (0.995 mAP@0.5, ahead of a YOLOv5 baseline on the same Indian licence-plate dataset). Each offending vehicle is tracked across frames, its plate read with EasyOCR, and an e-challan written with photo evidence.'],
      ['Client work includes ZenZen for ', link('Makaam Sports Enterprises', SITES.makaam), ' in Dimapur: an AI receptionist on the company website, running GPT-OSS 120B through Groq on Netlify Functions. It answers visitors from the company\'s own information, writes leads to Google Sheets and emails the owner an AI-written summary of each conversation through Resend. Sangamlung also built the company website. For an international event company, Sangamlung automated WhatsApp invitations and RSVP tracking with the WhatsApp Business Platform (Cloud API) and Google Apps Script.'],
      ['Sangamlung\'s own projects include ', link('Dgtal Register', SITES.dgtal), ', an offline-first attendance app built with React, TypeScript, IndexedDB and Supabase; ', link('Higher or Lower: Nagaland', SITES.higherLower), ', a browser guessing game about Nagaland and the Naga people; and ', link('Scholarship Hunting', SITES.scholarship), ', a satirical pixel-art arcade game drawn on HTML canvas.'],
    ],
    fields: {
      'Based in': 'Dimapur, Nagaland, India',
      Role: 'Freelance software engineer',
      Works: 'AI integration, workflow automation, web applications',
      Stack: 'TypeScript, React, Python, LLM APIs, WhatsApp Cloud API, Supabase, Cloudflare',
      Publication: link(`IEEE, ICC-CNS 2026 · DOI ${PAPER.doi}`, PAPER.url),
      ...CONTACT_FIELDS,
    },
    stamp: 'On file',
    links: CONTACT_LINKS,
    board: { face: 'about', title: 'Sangamlung Gangmei', line: 'Software engineer · Dimapur', cta: 'AI · AUTOMATION · WEB APPS', caption: 'About me' },
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
