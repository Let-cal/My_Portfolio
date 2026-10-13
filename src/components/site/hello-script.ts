export const HELLO_STORAGE_KEY = "hello";

/**
 * Inline head script: when this session already saw the greeting it marks <html data-hello-seen>, and
 * globals.css hides the (server-rendered) overlay straight away, so a returning visitor never sees it flash.
 */
export const HELLO_SEEN_SCRIPT = `try{if(sessionStorage.getItem("${HELLO_STORAGE_KEY}")==="1")document.documentElement.setAttribute("data-hello-seen","")}catch(e){}`;
