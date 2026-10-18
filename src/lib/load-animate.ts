/** Share the imperative spring dispatcher without making it a startup dependency. */
let pending: Promise<typeof import("motion")["animate"]> | undefined;

export function loadAnimate() {
  return pending ??= import("motion").then((module) => module.animate).catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
}
