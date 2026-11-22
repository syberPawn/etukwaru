// The projects in the truck. To add one, add an entry. To remove one, delete
// its entry.
//
//   name, brief   shown on the salvage record
//   fields        extra lines on the record, as { Label: 'text' }
//   live          full URL of the running project, or null if it isn't out yet
//   code          full URL of its source, or null to leave that button off.
//                 Only link a public repository: a private one shows visitors a 404.
//   filed         when it was made, shown on the record and its file number
//   stamp         optional: the rubber stamp's word. By default it is
//                 'Released' with a live link and 'Awaiting release' without.
//
// The object that falls out of the truck is either your own picture:
//   image         path to a PNG with a transparent background, in this site's
//                 folder, e.g. 'assets/junk/briefcase.png'
//   width         how wide it appears (default 110; the truck is about 850)
//
// or one of the drawn objects:
//   junk          telephone | suitcase | tv | boombox | toaster
//
// If both are set, the image wins and junk is the backup if it fails to load.
export const PROJECTS = [
  {
    id: 'higher-lower',
    name: 'Higher or Lower: Nagaland',
    junk: 'tv',
    brief: 'A guessing game about Nagaland and the Naga people. You see two things and the number for one of them: is the other higher or lower? Keep a streak going, or race the clock.',
    fields: {
      'Built with': 'Vite, plain JavaScript, Cloudflare Pages',
      Remarks: 'Numbers checked. Arguments not settled.',
    },
    filed: 'November 2026',
    live: 'https://higherlower.etukwaru.online',
    code: null,
  },
  {
    id: 'scholarship-hunting',
    name: 'Scholarship Hunting',
    junk: 'suitcase',
    brief: 'A pixel-art game and work of political satire. Play the entirely fictional Hon. Minister Fundsworth: shoot zombie students, collect the scholarship money, and build a Multipurpose Community Hall that turns out to be a private residence.',
    fields: {
      'Built with': 'Vite, HTML canvas, hand-drawn pixel art',
      Remarks: 'Any resemblance to a real politician is purely coincidental.',
    },
    filed: 'November 2026',
    live: null,
    code: 'https://github.com/syberPawn/scholarship-hunting',
  },
];
