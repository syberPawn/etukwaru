// The character-art figures (src/data/art/*.json), numbered once so a figure
// has the same number wherever it appears. fray: edges that were cut by the
// framing and should fray instead; drift: room on the right for the scatter.
export const FIGURES = {
  warrior: { art: 'warrior', caption: 'fig. 01 · naga warrior', fray: 'left top', drift: 14 },
  gaze: { art: 'warrior-profile', caption: 'fig. 02 · the gaze', fray: 'left top' },
  hornbill: { art: 'hornbill', caption: 'fig. 03 · hornbill', dissolve: 0.9 },
  standing: { art: 'warrior-full', caption: 'fig. 04 · naga warrior' },
};
