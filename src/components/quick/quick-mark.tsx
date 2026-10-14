/** Set on <html> while the 60-second view is shown; globals.css hides the site chrome with it. */
export const QUICK_HTML_ATTR = "data-quick";

/** Runs while the server HTML is parsed, before the first paint, so the chrome never flashes on a full page load. */
const QUICK_MARK_SCRIPT = `document.documentElement.setAttribute("${QUICK_HTML_ATTR}","")`;

/**
 * Without JavaScript the attribute is never set, so this (more expensive) `:has()` rule hides the chrome instead.
 * It sits in a <noscript>, so it only exists for visitors without scripts.
 */
const QUICK_NOSCRIPT_CSS =
  "body:has([data-quick-view])>:not([data-site-shell]){display:none!important}" +
  "body:has([data-quick-view]) [data-site-shell]{display:block;padding:0}" +
  "body:has([data-quick-view]) [data-site-shell] :is(aside,footer):not([data-quick-view] *){display:none}";

/**
 * Server markup that hides the site chrome before the first paint: an inline script marks <html data-quick>
 * (React does not run it again on hydration; client-side navigations are covered by QuickViewMarker) and a
 * <noscript> style covers visitors without JavaScript. Render it first inside the quick view's <main>.
 */
export function QuickMarkScript() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: QUICK_MARK_SCRIPT }} />
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: QUICK_NOSCRIPT_CSS }} />
      </noscript>
    </>
  );
}
