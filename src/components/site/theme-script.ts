export const THEME_STORAGE_KEY = "theme";

/**
 * Inline script that runs before first paint so the saved theme is on <html> before React hydrates
 * (no dark -> light flash). The server always renders `dark`, which is also the fallback here.
 */
export const THEME_INIT_SCRIPT = `(function(){var c=document.documentElement.classList;var t="dark";try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light")t="light"}catch(e){}c.remove("dark","light");c.add(t)})()`;
