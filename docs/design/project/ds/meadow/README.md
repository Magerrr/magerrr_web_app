Meadow is a warm, editorial system: a cream paper canvas, near-black ink lines, one fresh green that ties everything together, and three small pops of colour used like stickers. A single typeface, Inter, does everything from 9px labels to 144px headlines.

## Principles

- **Paper, not screen.** The page is `cream-paper`, never white. White (`pure-white`) is reserved for things that float above the page.
- **Ink draws the structure.** Borders and hairlines do the work that shadows do elsewhere. Meadow has no shadow tokens: separate layers with a 1px `ink-black` or `fresh-grass` border and a step in surface.
- **One green, three pops.** `fresh-grass` is the brand. `sky-pop`, `coral-pop` and `sunshine-pop` are accents for illustration, tags and highlights. Use at most one pop per component.
- **Type carries the weight.** Hierarchy comes from size and tight tracking, not from extra families or bold weights.

## Voice

Plain, warm and direct. Sentence case everywhere ("Get started", not "Get Started"). Short verbs on buttons. Talk to the reader as "you". No emoji in UI copy — the colour pops already supply the playfulness.

## Colour

| Role | Token | Use |
| --- | --- | --- |
| Canvas | `cream-paper` (`surface-0`) | Page background, soft cards |
| Raised | `pure-white` (`surface-1`) | Floating nav, elevated cards |
| Recessed | `sandstone` (`surface-2`) | Inset panels, disabled fills |
| Text | `ink-black` | All body and UI text |
| Max contrast | `pure-ink` | Icon fills, critical text |
| Muted | `stone-gray` | Large secondary text (24px+) and secondary link borders only |
| Brand | `fresh-grass` | Nav strokes, card borders, the accent button |
| Pops | `sky-pop`, `coral-pop`, `sunshine-pop` | Illustration, tag outlines, footer highlight |
| Hairline | `hairline-mist` | Nav dividers, quiet rules |

Rules:

- Set text in `ink-black` on `cream-paper`, `pure-white` or `sandstone` (12.1, 13.7 and 9.9:1).
- Put `ink-black` text on every coloured fill: `fresh-grass` 7.7:1, `sunshine-pop` 10.3:1, `coral-pop` 5.1:1, `sky-pop` 5.0:1. Never white text on a pop.
- On an `ink-black` fill, set text in `cream-paper` (12.1:1).
- `stone-gray` reads 3.4:1 on cream — use it only for text at 24px and up, or for borders. Below that, muted text stays `ink-black`.
- `fresh-grass`, `sky-pop`, `coral-pop`, `sunshine-pop` and `hairline-mist` are decorative on light grounds. Never set text in them, and never let one of them be the only boundary of a control.
- `coral-pop` is an outline accent. Do not make it the main call-to-action colour.

## Typography

Inter only, loaded from Google Fonts (`family=Inter:wght@400;500`). Almost everything is weight 500; the 144px hero (`5xl-4`) is the only regular-weight step.

- Display: `5xl-4` (144) and `5xl-3` (140) for the hero, `5xl-2` (81) for section openers, `5xl` (53) for page titles. All tracked at -0.06em with line-height 0.95–1.15.
- Headings: `3xl` (30) for card headlines, `xl` (20) for subheads.
- Body: `lg-3` (18/1.5) for long reading, `lg` (17/1.5) for supporting copy, `lg-2` (18/1.25, -0.04em) for tight lead lines, `lg-4` for compact lists, `lg-5` (line-height 2) for stacked footer links.
- UI: `base` (15/1.25, -0.04em) for buttons, links, tags and labels.
- Micro: `xs` (9px) for fine print only.

Tighten tracking as the size grows: 0 at body sizes, -0.04em at UI and subhead sizes, -0.06em from 30px up.

## Spacing and layout

Build on `space-unit` (4px). The scale is deliberately gappy: small values are multiples of 4, then it jumps to `space-60` between blocks, `space-136` between sections and `space-216` above the hero. That contrast — tight inside, very open between — is what makes pages feel editorial.

- Card padding and gutters: `space-20`.
- Gap between blocks in a section: `space-60`.
- Section padding: `space-136`.

## Radii

- `radius-full` (50px) for pills: buttons and tags.
- `radius-full-2` (63.75px) for the floating nav.
- `radius-2xl` (20px) for cards; `radius-3xl` (25.5px) for large feature cards and illustration frames.
- `radius-lg` (10px) for inputs and thumbnails.

## Surfaces and borders

Stack in this order: `surface-0` page → `surface-1` raised → `surface-2` recessed. Mark a raised element with a 1px border: `ink-black` by default, `fresh-grass` for brand moments, `sky-pop` as an occasional accent. Use `hairline-mist` only for dividers inside a component.

Focus ring: 2px solid `ink-black`, offset 2px. It holds 12.1:1 on cream and 13.7:1 on white, and stays visible on the green accent button.

## Iconography and imagery

No icon set or logo ships with Meadow yet. Until one does: use simple line or solid icons filled `pure-ink` or `ink-black`, with an optional small `sky-pop` dot as punctuation. Set the product name in Inter `lg-2` in place of a logo. Illustrations may use the three pops freely on `cream-paper`.

## Components

Button, Tag, Card and NavBar are built from the token roles described above (cards with green borders, a floating white nav, coral-outlined tags, pill buttons). Each has guidelines and a live preview.
