// The morung border pattern, redrawn as vector shapes from the original strip
// (sangamlungGangmei/public/assets/patterns/border-strip-morung.png).
//
// Measured in the original's pixels, laid horizontally: the band is 214 units
// tall (stripes at the top) and one tile is three motifs, 528 units long:
// bars, oval, bars. Each motif sits in a dashed white box.

export const BAND = 214;
export const CELL = 176;
export const TILE = CELL * 3;

const C = {
  black: '#0b0a09', green: '#1f7a3a', yellow: '#f2c230', red: '#b3121c', white: '#f4efe7',
};

/** Stripes across the band, top to bottom: [from, to, colour]. */
const STRIPES = [
  [0, 18, C.black], [18, 29, C.green], [29, 41, C.yellow], [41, 58, C.red],
  [58, 62, C.black], [62, 195, C.red], [195, 199, C.black], [199, 214, C.red],
];

// The motif box, across the band and along it (from the start of its cell).
const BOX = { top: 84, bottom: 172, start: 6, length: 164 };
// The two columns of blocks, across the band.
const COLS = [[113, 124], [132, 143]];

/** Blocks along the box (from the box start): [from, to, colour]. */
const ENDS = {
  head: [[18, 34, C.white], [38, 50, C.black]],
  foot: [[114, 126, C.black], [127, 136, C.white], [137, 150, C.black]],
};

function blocks(start, list) {
  return list.flatMap(([from, to, fill]) => COLS.map(([a, b]) =>
    `<rect x="${start + from}" y="${a}" width="${to - from}" height="${b - a}" fill="${fill}"/>`));
}

function motif(index, kind) {
  const s = index * CELL + BOX.start;
  const parts = [
    `<rect x="${s}" y="${BOX.top}" width="${BOX.length}" height="${BOX.bottom - BOX.top}" fill="none" stroke="${C.white}" stroke-width="2.4" stroke-dasharray="7 4.5"/>`,
    ...blocks(s, ENDS.head),
    ...blocks(s, ENDS.foot),
  ];
  if (kind === 'bars') parts.push(...blocks(s, [[58, 106, C.black]]));
  else parts.push(`<ellipse cx="${s + 82}" cy="128" rx="30" ry="23" fill="${C.black}"/>`);
  return parts.join('');
}

/** One horizontal tile as an SVG document; it repeats seamlessly. */
export function tileSvg() {
  const stripes = STRIPES.map(([a, b, fill]) => `<rect x="0" y="${a}" width="${TILE}" height="${b - a}" fill="${fill}"/>`).join('');
  const motifs = [motif(0, 'bars'), motif(1, 'oval'), motif(2, 'bars')].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE} ${BAND}" width="${TILE}" height="${BAND}" shape-rendering="crispEdges">${stripes}${motifs}</svg>`;
}

// The same pattern as a grid of square "threads", for the woven band. One
// tile is 72 cells along (three motifs of 24) by 30 cells across, keeping the
// original's proportions: stripes, then the red field with each motif in a
// dotted white box, its blocks two cells thick either side of the centre line.
export const WEAVE = { rows: 30, motif: 24, tile: 72, colors: C };

/** Stripe colour by row, top to bottom. */
const WEAVE_STRIPES = [
  ...Array(2).fill(C.black), ...Array(2).fill(C.green), ...Array(2).fill(C.yellow), ...Array(2).fill(C.red),
  C.black, ...Array(18).fill(C.red), C.black, ...Array(2).fill(C.red),
];
const WBOX = { top: 11, bottom: 23, start: 1, end: 22 };  // the dotted box, inclusive
const LANES = [15, 16, 18, 19];                             // rows the blocks sit on
/** Blocks along a motif (cells from its start), for both kinds. */
const HEAD = [[3, 4, C.white], [5, 6, C.black]];
const FOOT = [[16, 17, C.black], [18, 18, C.white], [19, 20, C.black]];

/** Colour of a woven cell: col counts along the band (any number), row 0..29 across. */
export function weaveColor(col, row) {
  const m = ((col % WEAVE.tile) + WEAVE.tile) % WEAVE.tile;
  const kind = Math.floor(m / WEAVE.motif) === 1 ? 'oval' : 'bars';
  const x = m % WEAVE.motif;
  const inBoxRows = row >= WBOX.top && row <= WBOX.bottom, inBoxCols = x >= WBOX.start && x <= WBOX.end;
  if (inBoxRows && inBoxCols) {
    const edgeRow = row === WBOX.top || row === WBOX.bottom, edgeCol = x === WBOX.start || x === WBOX.end;
    if (edgeRow || edgeCol) {
      const i = edgeRow ? x - WBOX.start : row - WBOX.top;
      return i % 3 === 2 ? WEAVE_STRIPES[row] : C.white;   // dash, dash, gap
    }
    if (LANES.includes(row)) {
      for (const [a, b, fill] of [...HEAD, ...FOOT]) if (x >= a && x <= b) return fill;
      if (kind === 'bars' && x >= 8 && x <= 14) return C.black;
    }
    if (kind === 'oval') {
      const dx = (x - 11) / 3.6, dy = (row - 17) / 3.3;
      if (dx * dx + dy * dy <= 1) return C.black;
    }
  }
  return WEAVE_STRIPES[row];
}
