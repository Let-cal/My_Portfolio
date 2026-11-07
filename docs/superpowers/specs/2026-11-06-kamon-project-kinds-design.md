# Kamon project kinds and the role legend (design)

Date: 2026-11-06. Status: approved by the owner (mockup approved in chat, package B, role option a).

## Why

On `/projects` some rows carry a blue bar on the left and some do not. The bar marks rows whose roles include the
role chosen on the home page's role wheel, but nothing on the page says so, and its colour reads like a project
category. Recruiters scan the archive by where the work was done (client work, university, personal), and the three
kinds are only told apart by a thin badge outline (the personal one is grey).

## Goals

1. The left strip of a row means one thing: the kind. Each kind has a traditional colour, a crest (家紋) and a
   kanji name:
   | Kind | Colour | Crest | Kanji |
   |---|---|---|---|
   | work | 朱 vermilion (the existing koi orange) | 波 seigaiha waves | 仕事 |
   | university | 藍 indigo | 桜 sakura | 学び |
   | personal | 若竹 young bamboo green | 鯉 koi | 個人 |
2. The crest always sits next to the kind's text (filter chips, row badge, the case study panel's "Where" line), so
   meaning never depends on colour alone.
3. The role highlight gets a legend (option a): "Marking projects where I worked as [Full-stack | Tech Lead |
   Project Manager] · N of M projects · Hide marks". Matching rows show a small diamond in the role colour before
   their role line. The role buttons change the site role (same as the home wheel, `?role=`); "Hide marks" turns
   the marks off for this visit.
4. Motion, only with `data-motion="full"` (the site's motion switch, which already starts from the reduced-motion
   preference) and a hover-capable pointer:
   - choosing a filter chip stamps its crest like a hanko (scale and rotate in, about 420 ms);
   - hovering a row widens its strip, tints the ink bleed with the kind colour and turns the crest slightly;
   - one ambient effect per kind on hover: a wave line slides under work rows, petals drift over university rows,
     a ripple spreads behind personal rows.

## Non-goals

- No change to the home page bento or the experience tree (neither shows the kind today; adding it there would
  touch the home bundle, which has 1.5 KB of headroom). The tokens are shared so they can follow later.
- No new data: the kind is the existing `projects.kind`.
- No change to filtering, ordering, deep links or the case study panel's behaviour.

## Decisions

- Tokens `--kind-work|university|personal` (strip and crest) and `--kind-*-ink` (text) live in one CSS file shared
  by the archive and the panel, with light-theme values; every text colour keeps 4.5:1 on its background in both
  themes.
- Crests are CSS masks (inline SVG data URLs) on a `<span class="kamon" data-kind>`: no JavaScript bytes, the colour
  comes from `currentColor`.
- The kanji subtitle is decorative (`aria-hidden`, `lang="ja"`) and is not shown in the Japanese locale, whose kind
  labels are already Japanese.
- "Hide marks" is component state for the visit (not stored); `data-highlight` stays the attribute for matching rows.
- Screen readers get the role match as text: the legend's count is a polite status and matching rows carry a
  visually hidden "(matches Full-stack)" after the role.

## Left to the builder

Exact crest drawings (legible at 16 px), keyframe timings within the ranges above, and the legend's wrapping on
small screens.
