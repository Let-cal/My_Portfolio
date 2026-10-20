let requested = false;
let ready: Promise<void> | undefined;
let resolveReady: (() => void) | undefined;
const listeners = new Set<() => void>();

export const toasterRequested = () => requested;
export const toasterServerSnapshot = () => false;
export function subscribeToaster(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** Retains the first notification until the mounted toast outlet has subscribed. */
export function ensureToaster(): Promise<void> {
  ready ??= new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  if (!requested) {
    requested = true;
    for (const listener of listeners) listener();
  }
  return ready;
}
export function markToasterReady() {
  resolveReady?.();
}
