// The projects in the truck. To add one, add an entry. To remove one, delete
// its entry.
//
//   name, brief   shown on the salvage tag
//   fields        whatever jokes belong on the tag
//   link          full URL, or null while there's nothing to visit yet
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
//
// These are all placeholders for now.
export const PROJECTS = [
  {
    id: 'telephone',
    name: 'Placeholder Telephone',
    junk: 'telephone',
    brief: 'Stand-in for a real project. Still rings when nobody is calling.',
    fields: { Condition: 'dial tone only', Abandoned: 'at 80%' },
    link: null,
  },
  {
    id: 'suitcase',
    name: 'Placeholder Suitcase',
    junk: 'suitcase',
    brief: 'Stand-in for a real project. Packed for a launch that never left.',
    fields: { Condition: 'zip jammed', Abandoned: 'at the airport' },
    link: null,
  },
  {
    id: 'tv',
    name: 'Placeholder TV',
    junk: 'tv',
    brief: 'Stand-in for a real project. Shows one channel, and it is static.',
    fields: { Condition: 'runs, somehow', Abandoned: 'mid-season' },
    link: null,
  },
  {
    id: 'boombox',
    name: 'Placeholder Boombox',
    junk: 'boombox',
    brief: 'Stand-in for a real project. Plays the first eight seconds very well.',
    fields: { Condition: 'left speaker only', Abandoned: 'after the demo' },
    link: null,
  },
  {
    id: 'toaster',
    name: 'Placeholder Toaster',
    junk: 'toaster',
    brief: 'Stand-in for a real project. Over-engineered, and still burns everything.',
    fields: { Condition: 'smells of bugs', Abandoned: 'Sunday, 3am' },
    link: null,
  },
];
