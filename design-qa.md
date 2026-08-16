# Design QA

## Evidence

- Source visual truth: `design/selected-option-1.png`
- Normalized source: `design/qa/reference-390x844.png`
- Implementation state: solo placing screen after drawing the first event with `?seed=17`
- Implementation screenshot: `design/qa/implementation-placing-final.png`
- Full-view combined comparison: `design/qa/comparison-final.png`
- Result-state screenshot: `design/qa/implementation-result-final.png`
- Viewport: `390 x 844` CSS px
- Source pixels: `853 x 1844`, normalized to `390 x 844`
- Implementation pixels: `390 x 844`
- Device scale factor: `1`
- Density normalization: source downsampled to the exact implementation viewport; implementation captured at DPR 1.

## Full-view comparison

The combined comparison preserves the selected direction's core hierarchy: compact brand and counters, pale-lilac tabletop, one central anchor card with two insertion choices, and a large illustrated current event card in the thumb zone. The implementation intentionally uses a landscape current card to fit the complete live gameplay state into a single 390 x 844 viewport without scrolling. This is an acceptable product constraint rather than fidelity drift because the card remains the dominant object and keeps the same two-part illustrated card construction.

## Focused evidence

No additional crop was required because both the anchor-card typography and the current-card copy are readable at the normalized full-view size. The result state received a separate browser capture because it is not represented in the source mock and must still be usable.

## Required fidelity surfaces

- Fonts and typography: local variable Manrope renders Ukrainian and Latin text without network dependencies. Heading weight, compact labels, tabular score figures, and card hierarchy match the friendly bold sans-serif direction. Long event titles use bounded wrapping rather than horizontal clipping.
- Spacing and layout rhythm: 18 px side margins, compact 76 px header, 214 px timeline objects, and a 318 px current card form one continuous mobile composition. There is no document-level horizontal overflow at 390 px.
- Colors and visual tokens: pale lilac, deep navy, cream, coral, teal, mustard, green, and blue are mapped to CSS tokens and category metadata. No glow, glass, archive-paper, or museum styling remains.
- Image quality and asset fidelity: five original generated category illustrations are used as real raster assets. They share flat geometric composition and card-game palette. No emoji, CSS drawings, inline SVG illustrations, or placeholders replace the visible art.
- Copy and content: Ukrainian game copy is preserved; year remains hidden while placing; feedback names the correct placement behavior; result copy matches success and loss states.
- Icons: local Phosphor assets cover hearts, plus, arrows, feedback, trophy, and restart. No external CDN is required.
- States and interactions: ready, placing, correct, correction, finished, restart, hover, active, focus-visible, disabled, and reduced-motion states are implemented.
- Accessibility and resilience: semantic buttons and dialog, ARIA labels for gaps, keyboard activation, visible focus, 42–50 px primary touch controls, pinch zoom, and reduced-motion support are present.

## Comparison history

### Iteration 1

- P2: The current event card initially used too little illustration area compared with the selected mock.
  - Fix: increased the image/content row balance and preserved the complete event copy inside the viewport.
- P2: The first insertion choice lacked a strong keyboard/selection indication in the static placing capture.
  - Fix: added a nested solid focus treatment while retaining the dashed card silhouette.
- P2: The result dialog was offset and clipped in the captured mobile viewport.
  - Fix: explicitly centered the native dialog with a viewport-bounded maximum height and internal overflow.

### Post-fix evidence

- `design/qa/implementation-placing-final.png` shows both insertion choices, illustrated anchor/current cards, and no horizontal overflow.
- `design/qa/implementation-result-final.png` shows the entire result dialog and restart action inside the viewport.

## Findings

No actionable P0, P1, or P2 differences remain. The implementation is a faithful responsive translation of the selected visual direction while preserving the existing solo-game constraints.

## Browser verification

- Primary interaction tested: draw event, choose a legal gap, repeat through all nine decisions, open result, inspect restart control.
- Engine acceptance also covers incorrect placement, life loss, automatic chronological correction, completion, and restart.
- Console errors checked: none in the placing-state browser pass.
- Failed local asset requests: none in automated E2E.
- Horizontal document overflow at 390 px: none (`scrollWidth = 390`).

## Follow-up polish

- P3: A future content-production pass could create event-specific illustrations instead of reusing one coherent illustration per category.

final result: passed
