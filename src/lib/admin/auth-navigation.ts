// Auth transitions replace the document, discarding stale prefetched admin/login state.
let signingOut = false;
export const isSigningOut = () => signingOut;
export const setSigningOut = (value: boolean) => {
  signingOut = value;
};
export function replaceAuthPage(path: string) {
  window.location.replace(path);
}
