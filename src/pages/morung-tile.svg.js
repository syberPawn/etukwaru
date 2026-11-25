// Built once into /morung-tile.svg.
import { tileSvg } from '../data/morung.js';

export function GET() {
  return new Response(tileSvg(), { headers: { 'content-type': 'image/svg+xml' } });
}
