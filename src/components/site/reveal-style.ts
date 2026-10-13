/**
 * Shows every `<Reveal>` block at once. <Reveal> is server-rendered hidden (opacity 0, shifted) and shown by its
 * whileInView animation, so this rule is the fallback wherever that animation will not run: it goes into a
 * `<noscript>` in the locale layout's head (no JavaScript). globals.css has the same rule for printing.
 */
export const REVEAL_SHOW_CSS = "[data-reveal]{opacity:1!important;transform:none!important}";
