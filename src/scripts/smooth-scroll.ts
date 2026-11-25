// Smooth, eased scrolling for mouse wheels and trackpads (Lenis). Touch
// screens keep their own native scrolling, and nothing changes for people who
// ask their device for reduced motion. In-page links (#work, #contact) glide
// to their section and stop clear of the sticky header. Scrolling inside an
// open window (Versions, the email menu, a full-size still) stays there.
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const lenis = new Lenis({
    autoRaf: true,
    lerp: 0.1,
    wheelMultiplier: 1,
    // Lenis respects the page's scroll-padding-top (global.css), which keeps
    // sections clear of the sticky header.
    anchors: true,
    prevent: node => !!node.closest('dialog, [role="menu"], [data-lenis-prevent]'),
  });
  // While a window is open over the page, the page itself stays put.
  const sync = () => (document.querySelector('dialog[open]') ? lenis.stop() : lenis.start());
  new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
}
