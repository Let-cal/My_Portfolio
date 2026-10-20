"use client";

import { useEffect, useRef } from "react";
import { creatureLive } from "./creature/live";
import { veilOpacity } from "./environment/legibility";
import { sceneLive } from "./environment/live";
import { sceneStore } from "./store";

/** Solid margin around a block of text (px); the soft edge, in globals.css, starts there. */
const PAD = 24;
/** Share of the veil kept on a dark, empty night pond (nothing bright behind the text). */
const FLOOR = 0.22;
/** A panel that moves, or changes size, by more than this (px, summed) has been handed to a different block of text. */
const JUMP = 160;
/** The veil comes up when the creature is this close to a block of text (px): covers the glow it casts on the water. */
const NEAR = 220;

/**
 * Keeps text readable over the 3D pond: a soft-edged panel of the pond's calm colour behind every block of text on
 * screen (`avoid` in the scene store: marked blocks, glass cards, the page's own text). Whatever swims, glows or
 * blooms behind the page, light text at night sits on near-black and dark text by day on near-white.
 *
 * It is a DOM layer, not a shader: it works on display colours (no HDR highlight can punch through), is the same
 * for every tier, and the day/night colour change is a CSS transition that runs in step with the pond's. The panels
 * are pooled and only moved (a transform) when the page scrolls. How strongly each is drawn follows what is behind
 * it (see `veilOpacity`): on the calm night pond they all but vanish, so the water stays vivid between the lines;
 * they come up as the creature approaches, where scenery is on screen, and by day. Opacity is only written when it
 * changes (CSS eases it). The store and the live scene data drive it directly: no React state, no re-render.
 */
export function TextVeil() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const pool: HTMLElement[] = [];
    // The opacity last written to each panel, so a frame that changes nothing writes nothing.
    const shown: number[] = [];
    // A panel handed to a different block of text (or just shown) takes its opacity at once: easing from what the
    // other block needed would leave this block's text on the wrong backdrop for a third of a second.
    const snap: boolean[] = [];
    const last: { x: number; y: number; w: number; h: number }[] = [];
    const eased: HTMLElement[] = [];
    let source = sceneStore.getState().avoid;
    let rects = source.filter((rect) => rect.veil !== false);

    const place = () => {
      while (pool.length < rects.length) {
        const panel = document.createElement("i");
        el.appendChild(panel);
        pool.push(panel);
        shown.push(1);
        snap.push(true);
        last.push({ x: 0, y: 0, w: 0, h: 0 });
      }
      // Area ranking changes as a block crosses the viewport. Match geometry before assigning
      // pooled nodes so an unchanged card never inherits another card's position/opacity.
      const candidates: { next: number; old: number; cost: number }[] = [];
      for (let next = 0; next < rects.length; next++) {
        const r = rects[next];
        for (let old = 0; old < pool.length; old++) {
          if (pool[old].style.display !== "block") continue;
          const p = last[old];
          const cost =
            Math.abs(r.x0 - PAD - p.x) +
            Math.abs(r.y0 - PAD - p.y) +
            Math.abs(r.x1 - r.x0 + PAD * 2 - p.w) +
            Math.abs(r.y1 - r.y0 + PAD * 2 - p.h);
          if (cost < JUMP) candidates.push({ next, old, cost });
        }
      }
      candidates.sort((a, b) => a.cost - b.cost);
      const order = new Array<number>(pool.length).fill(-1);
      const used = new Set<number>();
      for (const c of candidates) {
        if (order[c.next] === -1 && !used.has(c.old)) {
          order[c.next] = c.old;
          used.add(c.old);
        }
      }
      let spare = 0;
      for (let i = 0; i < order.length; i++) {
        if (order[i] !== -1) continue;
        while (used.has(spare)) spare++;
        order[i] = spare;
        used.add(spare);
      }
      const reorder = <T,>(values: T[]) => {
        const copy = values.slice();
        for (let i = 0; i < order.length; i++) values[i] = copy[order[i]];
      };
      reorder(pool);
      reorder(shown);
      reorder(snap);
      reorder(last);
      for (let i = 0; i < pool.length; i++) {
        const panel = pool[i];
        const r = rects[i];
        if (!r) {
          if (panel.style.display !== "none") {
            panel.style.display = "none";
            snap[i] = true;
          }
          continue;
        }
        const x = Math.round(r.x0 - PAD);
        const y = Math.round(r.y0 - PAD);
        const w = Math.round(r.x1 - r.x0 + PAD * 2);
        const h = Math.round(r.y1 - r.y0 + PAD * 2);
        const was = last[i];
        if (
          Math.abs(x - was.x) +
            Math.abs(y - was.y) +
            Math.abs(w - was.w) +
            Math.abs(h - was.h) >
          JUMP
        )
          snap[i] = true;
        was.x = x;
        was.y = y;
        was.w = w;
        was.h = h;
        if (panel.style.display !== "block") {
          panel.style.display = "block";
          snap[i] = true;
        }
        const wPx = `${w}px`;
        const hPx = `${h}px`;
        if (panel.style.width !== wPx) panel.style.width = wPx;
        if (panel.style.height !== hPx) panel.style.height = hPx;
        panel.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    };

    // Reused every frame: nothing is allocated while the pond runs.
    const opts = { day: 0, props: 0, floor: FLOOR, margin: NEAR };
    const fade = () => {
      const creature = creatureLive.screen.valid ? creatureLive.screen : null;
      opts.day = sceneLive.day;
      opts.props = sceneLive.props;
      // Panels that snapped last frame ease again from now on.
      for (let i = 0; i < eased.length; i++) eased[i].style.transition = "";
      eased.length = 0;
      for (let i = 0; i < rects.length; i++) {
        // Quantised, so a slow day/night fade is not a write per frame.
        const o = Math.round(veilOpacity(rects[i], creature, opts) * 20) / 20;
        if (o === shown[i] && !snap[i]) continue;
        if (snap[i]) {
          pool[i].style.transition = "none";
          eased.push(pool[i]);
          snap[i] = false;
        }
        shown[i] = o;
        pool[i].style.opacity = String(o);
      }
    };

    place();
    fade();
    const unsubscribe = sceneStore.subscribe(() => {
      const next = sceneStore.getState().avoid;
      if (next === source) return;
      source = next;
      rects = next.filter((rect) => rect.veil !== false);
      place();
    });
    let frame = requestAnimationFrame(function tick() {
      fade();
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      el.replaceChildren();
    };
  }, []);

  return <div ref={host} data-koi-veil="" aria-hidden="true" />;
}
