# Webdev MMORPG — Continuation Specification

**Document status:** Working product and engineering specification  
**Based on:** Version 4 Alpha source currently in this folder  
**Primary entry point:** `index.html`  
**Last analyzed:** 2026-10-15

## 1. Product vision

Webdev MMORPG is a browser-based, cinematic interactive story presented as a fantasy MMORPG scene. Software-development roles are represented as a party of eight heroes who must inspect, verify, and activate a portal called the Production Gate.

The experience should feel like a polished game scene rather than a conventional website: animated layered heroes, environmental effects, dialogue, meaningful choices, quest progression, sound, and responsive keyboard/mouse/touch interaction. It must remain easy to run locally and deploy as a static site.

## 2. Product goals

1. Deliver a complete 5–10 minute playable chapter with a clear beginning, decision point, outcome, and replay path.
2. Make all eight heroes selectable and give each hero a distinct role, line, and cast ability.
3. Make quest state and story branches consistent: the UI must always reflect what the player has actually completed.
4. Preserve the current high-fantasy visual identity and 2.5D character presentation.
5. Work well on desktop and remain playable on tablet and mobile.
6. Run as a static web game with no required backend.
7. Keep the code maintainable enough to add later chapters, heroes, dialogue, and realms without editing UI logic throughout the file.

## 3. Non-goals for the next milestone

- Real-time multiplayer or accounts
- Server-authoritative game state
- Combat, inventory, leveling, or an open world
- Full skeletal animation or lip synchronization
- A content-management system
- Monetization or payments
- Native mobile applications

These may be revisited after the first complete chapter is stable.

## 4. Current project inventory

### Files

| Path | Purpose | Current state |
| --- | --- | --- |
| `index.html` | Entire game UI, styling, content data, and runtime logic | Working V4 alpha; approximately 40 KB |
| `README.md` | Run instructions, controls, and production notes | Accurate but brief |
| `make_assets.py` | Generates feathered head/body layers from full hero illustrations | Development utility; requires Pillow and NumPy |
| `assets/*.webp` | Three 1600×900 realm backgrounds and 24 hero images | About 1.9 MB total |

### Available content

- **Realms:** Skyforge, Twilight Realm (`dusk`), Crimson Rift (`rift`)
- **Heroes:** Commander, Guardian, Rogue, Tech Mage, Healer, Moon Courier, Swordsman, Shadow Bard
- **Hero art per character:** full portrait, head layer, body layer
- **Story:** 11 dialogue entries with one three-option decision point
- **Quest:** five displayed objectives around deployment

### Technology currently used

- Semantic HTML plus a single large inline stylesheet
- Vanilla JavaScript with direct DOM updates
- Canvas 2D for motes, rings, glow, and spell flashes
- Optional Three.js `0.160.1` loaded from jsDelivr for an additional particle layer
- Google Fonts loaded through CSS (`Cinzel` and `Manrope`)
- Web Audio API for synthesized UI tones
- WebP raster assets

No build system, package manager, test suite, persistence layer, service worker, or backend is present.

## 5. Current playable behavior

- Dialogue advances with the arrow button, dialogue panel, Space, or Enter.
- Dialogue text appears with a typewriter effect and can be completed immediately.
- Players can choose any hero through the roster, number keys 1–8, or visible actors.
- Three actors are staged at once; the selected hero occupies the center.
- A hero can cast an animated named ability with the Cast button or `C`.
- Realms can be changed with the selector or `R`.
- Players can inspect the gate, open a placeholder journal notification, pause motion, toggle sound, toggle epic particles, and enter fullscreen.
- A hero-specific quest panel follows the selected character and updates its objectives from chapter progress.
- Stage composition preserves each displayed hero's full-body silhouette above the dialogue panel.
- Desktop pointer movement creates subtle parallax.
- Reduced-motion preference is detected.

## 6. UX and visual direction

### Design pillars

- **Cinematic:** the primary experience is the stage, characters, and dialogue.
- **Readable:** fantasy styling must never reduce text clarity or obscure controls.
- **Responsive:** all required actions remain available without hover.
- **Alive but calm:** ambient animation supports the scene; it must not overwhelm dialogue.
- **Clear state:** selections, completed objectives, choices, audio, and pause state must be unambiguous.

### Existing visual language to preserve

- Dark navy environment with cyan magical light and warm gold borders
- Cinzel-style display typography paired with a clean sans-serif UI face
- Layered fantasy character illustrations
- Glassy, framed HUD panels
- Gold for narrative focus and cyan for system/magic feedback
- 16:9 desktop stage with a compact toolbar and footer

### Responsive targets

The game must be verified at these minimum layouts:

| Layout | Target viewport | Expected behavior |
| --- | --- | --- |
| Desktop | 1440×900 and larger | Full HUD, three actors, quest, minimap, skills, roster |
| Laptop | 1024×768 | No overlap between dialogue, skills, actors, and roster |
| Tablet | 768×1024 portrait and landscape | Touch-sized controls; nonessential HUD may collapse |
| Mobile | 390×844 | Playable dialogue, choices, roster, realm control, and cast action |

Minimum interactive target size should be 44×44 CSS pixels on touch layouts.

## 7. Core gameplay specification

### 7.1 Game states

The runtime should have explicit states instead of deriving behavior primarily from `storyIndex`:

1. `intro` — party approaches the Skyforge.
2. `investigation` — architecture and service dialogue is presented.
3. `decision` — player chooses deploy, verify, or inspect.
4. `verification` — verification dialogue/objectives run, then the player returns to the deployment decision.
5. `inspection` — the gate clue is revealed, then the player returns to deploy or verify.
6. `deployment` — activation sequence and cast animation run.
7. `completed` — epilogue, completed quest, and replay/continue actions appear.

Story advancement must never silently perform a state-changing action. In particular, verification must not imply deployment unless the player explicitly authorizes it.

### 7.2 Main story flow

1. Commander introduces the Production Gate.
2. Mage confirms gateway/service energy.
3. Healer confirms interface readiness.
4. Guardian confirms environment synchronization.
5. Swordsman reports tests and requests a decision.
6. Player chooses:
   - **Deploy to Production:** proceed to deployment.
   - **Verify all systems again:** run verification dialogue, mark verification complete, and return to the decision with that choice shown as completed.
   - **Inspect the mysterious gate:** reveal the inscription/clue and return to the decision.
7. Deployment includes the Bard ritual, Courier launch confirmation, and Commander epilogue.
8. Completion presents:
   - `Replay Chapter`
   - `Explore Realms` (free-exploration mode using the existing realm selector)
   - A disabled or clearly labeled teaser for the next chapter, if desired

### 7.3 Quest model

Use named objective IDs and explicit completion flags:

| Objective ID | Label | Completion trigger |
| --- | --- | --- |
| `review_architecture` | Review architecture | Intro dialogue completed |
| `sync_services` | Synchronize services | Mage/Guardian readiness dialogue completed |
| `verify_tests` | Verify acceptance tests | Initial QA report or optional verification completed |
| `authorize_deployment` | Authorize deployment | Player selects Deploy |
| `activate_realm` | Activate the realm | Deployment sequence completes |

The progress bar equals completed objectives divided by total objectives. The current objective is the first incomplete required objective. Optional investigation should be tracked separately and may unlock alternate dialogue or an achievement, but must not corrupt main progress.

### 7.4 Hero selection

- Selecting a hero moves that hero to center stage.
- The previous center hero moves to a side position without duplicating any hero.
- The roster visually and accessibly exposes selection using both styling and `aria-pressed`.
- Manual selection speaks that hero’s ambient line but does not alter the main story state.
- Returning to story dialogue automatically selects its speaker.
- Number shortcuts work only when focus is not in an editable/form control.

### 7.5 Abilities

For the next milestone, every ability uses the same base cast animation but has unique color, icon, name, sound profile, and one-line result. No cooldown is required unless it is visibly communicated.

| Hero | Role | Ability |
| --- | --- | --- |
| Commander | Architect | Leadership Aura |
| Guardian | DevOps | Shield of Uptime |
| Rogue | Frontend | Portal Dash |
| Tech Mage | Backend | API Arcana |
| Healer | UX/UI | Restoration |
| Moon Courier | Support | Message Flight |
| Swordsman | QA | Precision Strike |
| Shadow Bard | Automation | Night Script |

### 7.6 Character overview window

Selecting a hero and requesting **Overview** opens a modal character codex inspired by the supplied dark, engraved fantasy panel. The reference image is visual direction only; its text and game-specific concepts are not requirements for this project.

#### Entry points

- Add a clearly labeled `OVERVIEW` button near `CAST ABILITY` when a hero is selected.
- Clicking or tapping the selected hero’s roster card a second time opens the overview. A first click continues to select the hero.
- Pressing `O` opens the selected hero’s overview when focus is not inside a form field.
- The Journal party list may also open an overview for any hero.

#### Desktop layout

- Centered modal over the stage, approximately 760–900 px wide and no taller than 85% of the viewport.
- Dim and lightly blur the game behind it; ambient game animation pauses while the modal is open.
- Use an ornate dark stone/metal frame with restrained gold/cyan accents matching the existing HUD.
- Place the hero crest or role icon centered above or integrated into the top frame.
- Header row: hero name, role, and short fantasy-style role title.
- Left column (approximately 35%): full hero art, current selection marker, and compact metadata.
- Right column (approximately 65%): biography followed by ability/trait rows.
- Each ability row contains a unique icon, name, and short plain-language description, separated by subtle engraved dividers.
- Footer actions:
  - `SELECT` — selects this hero and closes the modal.
  - `CAST ABILITY` — selects the hero, closes the modal, and casts after focus is restored.
  - `CLOSE` — closes without changing the selected hero.
- If the overview belongs to the already-selected hero, `SELECT` becomes `SELECTED` and is disabled.

#### Content shown

Every hero overview must support:

| Field | Required | Display rule |
| --- | --- | --- |
| Name | Yes | Main modal title |
| Role | Yes | Short label below the name |
| Epithet | Yes | Fantasy-flavored title, maximum 60 characters |
| Biography | Yes | 1–2 short paragraphs, target 240 characters |
| Full image | Yes | Existing transparent hero art |
| Primary ability | Yes | Icon, name, and 1–2 sentence description |
| Traits | Yes | Two or three icon/name/description rows |
| Accent color | Yes | Applied to crest, focus, and dividers |
| Ambient line | Yes | Optional playback button; text is also visible |

The first release does not need combat statistics. If stats are added later, their meaning and effect must be real and documented rather than decorative numbers.

#### Navigation and behavior

- Left/Right Arrow or `[`/`]` browses previous/next hero without closing the modal.
- The visible previous/next controls include hero names, not arrow icons alone.
- Escape, `CLOSE`, or the top-right close button closes the modal.
- Clicking the backdrop may close it on desktop, but not while there are unsaved maintenance edits.
- Opening stores the triggering element; closing restores focus to it.
- Only one modal may be open at a time. Opening Overview closes Journal and vice versa.
- Story position, quest state, selected realm, and dialogue text do not change while browsing.
- Character content must render from the same data model used by the roster, dialogue, and maintenance editor.

#### Mobile layout

- Use a full-screen scrollable sheet rather than a small centered dialog.
- Keep the title and close control sticky at the top and the action bar sticky at the bottom.
- Show hero art above content; trait rows stack vertically.
- Respect safe-area insets and keep all targets at least 44×44 CSS pixels.

### 7.7 Character maintenance window

The maintenance window is a separate authoring interface used to update the content displayed in character overviews. It is not ordinary player UI and must be clearly marked **MAINTENANCE MODE**.

Because V5 has no backend or accounts, maintenance is local to the current browser. It is a content-editing convenience, not secure administration. Production-grade shared editing would require authentication, authorization, server persistence, and an audit log.

#### Access

- Enable local maintenance mode with the explicit URL parameter `?maintenance=1`.
- When enabled, add a small gear button labeled `CHARACTERS` to the toolbar.
- Do not show maintenance controls during normal play.
- Entering maintenance pauses the game and closes Journal/Overview.
- `Escape` may close maintenance only when there are no unsaved edits; otherwise show the discard confirmation.

#### Layout

- Desktop: wide modal/workbench up to 1100 px, with hero list on the left, edit form in the center, and live overview preview on the right.
- Tablet/mobile: full-screen view with three tabs: `CHARACTERS`, `EDIT`, and `PREVIEW`.
- Header: `CHARACTER MAINTENANCE`, unsaved-change indicator, schema/data version, and close button.
- Footer: `RESET CHARACTER`, `DISCARD`, `SAVE DRAFT`, `APPLY`, `EXPORT JSON`, and `IMPORT JSON` as appropriate.
- Destructive actions use restrained red styling and require confirmation.

#### Editable fields

- Display name
- Role
- Epithet
- Biography
- Ambient line
- Primary ability name, icon, and description
- Two or three trait names, icons, and descriptions
- Accent color chosen from an approved accessible palette
- Full/head/body asset paths selected from known local assets; arbitrary remote URLs are not allowed

Hero IDs are stable and read-only. The initial V5 maintenance interface does not add/delete heroes or edit story nodes.

#### Editing behavior

- Selecting another hero with unsaved edits prompts: `Apply`, `Discard`, or `Cancel`.
- Form changes update the preview immediately but do not affect the live game until `APPLY`.
- `SAVE DRAFT` stores an unpublished local draft for that hero.
- `APPLY` validates, writes the local override, refreshes roster/overview content, and shows a success toast.
- `RESET CHARACTER` removes the override and restores bundled defaults for that hero.
- `DISCARD` restores the last applied values.
- All text inputs display character counts and field-specific error messages.
- Empty required fields, duplicate/empty trait names, invalid colors, or unknown asset paths prevent Apply.
- Maintenance keyboard shortcuts must not trigger gameplay shortcuts.

#### Persistence and portability

- Bundled character definitions remain the immutable defaults in `data.js` or `characters.json`.
- Applied local overrides are stored in `localStorage` under a versioned key such as `webdev-mmorpg.character-overrides.v1`.
- Drafts use a separate versioned key and never appear in normal player UI until applied.
- `EXPORT JSON` downloads only validated character overrides plus `schemaVersion` and `exportedAt` metadata.
- `IMPORT JSON` shows a validation summary and preview before replacing or merging local overrides.
- Import must reject unknown fields, unsafe URLs/markup, invalid hero IDs, incompatible schema versions, and oversized text.
- Provide `Reset all overrides` behind a two-step confirmation.
- To publish changes for every visitor, export the validated JSON and deliberately merge it into the bundled project data during development. Local maintenance changes alone are not a deployment mechanism.

#### Security and content safety

- Render maintenance text using `textContent`; never inject authored text with `innerHTML`.
- Treat imported JSON as untrusted data and validate it against the character schema.
- Accept icons from an allowlist or known local paths, not raw SVG/HTML entered by the user.
- The `?maintenance=1` flag is discoverability control only and must never be described as authentication.

### 7.8 Realm switching

- Realm selection changes background art, minimap label, particle palette, stage accent, and ambient sound palette when sound is enabled.
- Rapid realm changes must not allow an older transition timer to overwrite the latest selection.
- Realm switching is exploratory and does not change main story completion unless a later chapter explicitly defines that behavior.

### 7.9 Journal

Replace the current toast-only placeholder with a modal or drawer containing:

- Chapter title and current objective
- Completed and incomplete objectives
- Discovered gate inscription/clue
- Party roster with roles and abilities
- Controls/help
- Reset/replay action with confirmation

The journal must trap focus while open, close with Escape, restore focus to its trigger, and be usable on mobile.

### 7.10 Pause, sound, and motion

- **Pause:** freezes story typing, Canvas/Three effects, CSS ambient animation, and active cast animation.
- **Reduced motion:** defaults to a low-motion presentation; it should not be presented as though the player manually paused the game.
- **Sound:** remains opt-in and starts only after a user gesture.
- **Epic effects:** increases particle density/brightness without reducing dialogue readability or causing severe frame drops.
- Store sound, reduced-effects preference, and last selected realm in local storage. Do not auto-enable sound on a future visit.

## 8. Content and data architecture

Move content and state out of ad hoc DOM logic. The implementation may remain dependency-free, but it should be split into focused files:

```text
index.html
styles/
  game.css
scripts/
  data.js          # realms, quests, and story nodes
  characters.js    # immutable default character definitions and schema
  state.js         # game state and transitions
  ui.js            # DOM rendering and event bindings
  overview.js      # character overview dialog
  maintenance.js   # local character editor, validation, import/export
  storage.js       # versioned preferences, drafts, and overrides
  effects.js       # Canvas and optional Three.js effects
  audio.js         # Web Audio behavior
  main.js           # initialization
assets/
  characters/
  realms/
  audio/           # optional future ambient clips
```

Recommended story-node shape:

```js
{
  id: 'decision.production',
  speaker: 'commander',
  text: 'We have reached the final gate. What is your command?',
  choices: [
    { label: 'Deploy to Production', event: 'DEPLOY_AUTHORIZED' },
    { label: 'Verify all systems again', event: 'VERIFY_REQUESTED' },
    { label: 'Inspect the mysterious gate', event: 'INSPECT_REQUESTED' }
  ]
}
```

Requirements:

- Every story node has a stable unique ID.
- Choices dispatch named events rather than directly assigning story indexes.
- State transitions are centralized and validate allowed transitions.
- Timers used by dialogue, choices, realm transitions, and casting are tracked and cancellable.
- UI render functions are deterministic from current state where practical.
- Roster, overview, dialogue, and maintenance preview consume a single resolved character model: immutable defaults merged with validated applied overrides.

Recommended character shape:

```js
{
  id: 'guardian',
  name: 'Guardian',
  role: 'DevOps',
  epithet: 'Warden of the Unbroken Realm',
  biography: 'The Guardian keeps every passage stable and every release protected.',
  ambientLine: 'Every shard is stable. Infrastructure is ready.',
  accent: '#69d5ff',
  assets: {
    full: 'assets/guardian_full.webp',
    head: 'assets/guardian_head.webp',
    body: 'assets/guardian_body.webp'
  },
  ability: {
    icon: 'shield',
    name: 'Shield of Uptime',
    description: 'Stabilizes the realm and protects the party during deployment.'
  },
  traits: [
    { icon: 'tower', name: 'Reliability', description: 'Keeps critical paths available.' },
    { icon: 'rune', name: 'Observability', description: 'Reveals failures before they spread.' }
  ]
}
```

## 9. Accessibility requirements

- Preserve visible keyboard focus for every control.
- Add a “Skip to game dialogue” link before the toolbar.
- Use true buttons for actionable HUD navigation; do not present nonfunctional navigation as interactive text.
- Provide accessible names for icons and decorative-image empty alt text.
- Announce important quest changes through a polite live region without announcing every typewriter character.
- Do not place `aria-live` on the element while characters are appended one at a time. Announce the completed line in a separate visually hidden live region.
- Choice buttons must receive focus when opened.
- Escape closes journal/help overlays and, where appropriate, dismisses open choices only if doing so cannot strand story progress.
- Overview and maintenance windows use `role="dialog"`, `aria-modal="true"`, an accessible title and description, focus trapping, and reliable focus restoration.
- Overview hero navigation and maintenance validation are announced without moving focus unexpectedly.
- Support keyboard-only completion of the chapter.
- Maintain at least WCAG 2.2 AA color contrast for text and controls.
- Do not rely only on color to communicate selected, completed, current, muted, or paused states.
- Respect `prefers-reduced-motion` and avoid flashes that could exceed safe thresholds.

## 10. Performance and compatibility

### Targets

- Initial local asset transfer under 3 MB for the current chapter.
- First usable scene within 2 seconds on a typical broadband laptop and within 4 seconds on a mid-range mobile connection.
- Target 60 FPS on desktop; remain usable at 30 FPS on supported mobile devices.
- Avoid layout shift when fonts or images load.

### Browser support

Latest two major versions of Chrome, Edge, Firefox, and Safari, including current iOS Safari. The core game must remain playable if WebGL, dynamic CDN import, audio, or fullscreen is unavailable.

### Offline behavior

The current page is only partially offline-capable because Google Fonts and optional Three.js are remote. For a truly offline release:

- Self-host fonts or use a system-font fallback without a network request.
- Vendor the approved Three.js module locally, or make Canvas the complete default experience.
- Ensure all runtime assets use local relative URLs.
- Optionally add a service worker only after cache versioning and update behavior are specified.

## 11. Known issues found in V4

These should be treated as baseline bugs, not future enhancements:

1. The portrait talking animation does not activate: CSS expects `.portrait-frame.talk`, while JavaScript adds/removes `talking`.
2. The verification branch advances into the deployment ritual without an explicit deployment choice, while the `deployed` flag remains false. Story, quest, and narrative state can disagree.
3. The story loops to the beginning after the epilogue without resetting quest flags or giving the player a replay decision.
4. The inspect branch opens choices with an unmanaged delayed timer; another action taken before the timer finishes can cause stale choices to appear.
5. Pause freezes some ambient animation but does not comprehensively freeze transitions, delayed actions, or every active effect.
6. Reduced-motion preference is represented internally as `paused`, which conflates accessibility preference with game pause state.
7. `aria-live="polite"` is attached to the typewriter text, which may create excessive screen-reader announcements.
8. The Journal button is only a toast and does not provide journal content.
9. The World/Heroes/Quests/Guilds/Journal HUD labels look navigable but are static spans.
10. Google Fonts and Three.js require internet access despite the general offline positioning. `?offline=1` skips Three.js but not Google Fonts.
11. There is no automated check for broken media paths, duplicate hero placement, invalid state transitions, or branch completion.
12. All presentation, content, and logic live in one HTML file, which increases regression risk as the chapter grows.

## 12. Testing and acceptance criteria

### Required functional tests

- The main path reaches completion and displays 100% quest progress.
- Verify returns to the decision; Deploy remains a separate explicit action.
- Inspect reveals its clue once and returns to valid choices without stale delayed UI.
- Each of the eight heroes can be selected by mouse/touch and keyboard.
- Each hero can cast and reports the correct ability name.
- Rapidly switching realms ends on the latest chosen realm with the correct label and palette.
- Pausing freezes all intended animation/state progression and resuming continues safely.
- Story replay resets story, quest, timers, choices, and completion flags.
- Missing Three.js/network access does not prevent play.
- Sound never starts before user consent.
- Overview opens from the roster, Overview button, Journal, and `O`; it displays the correct resolved hero content.
- Previous/next overview navigation wraps through all eight heroes without changing story state.
- Select and Cast actions operate on the hero currently shown in Overview.
- Maintenance draft edits appear in preview but not normal play; Apply updates all character surfaces.
- Invalid maintenance data cannot be applied or imported.
- Reset restores bundled defaults, and export/import round-trips valid overrides.
- Unsaved-change guards prevent accidental loss when changing heroes or closing maintenance.

### Required accessibility tests

- Complete the full chapter using keyboard only.
- Verify logical focus order at desktop and mobile widths.
- Verify choice and journal focus management.
- Verify completed dialogue is announced once, not character by character.
- Test with reduced-motion enabled.
- Run an automated accessibility scan with no critical violations.

### Required visual tests

- No overlapping essential UI at the four target layouts in Section 6.
- Dialogue and choices remain readable over all three realm backgrounds.
- All 24 character image layers load and align.
- Fullscreen enter/exit preserves state and layout.
- Long hero names, ability names, and translated-length text do not break controls.
- Overview and maintenance layouts remain usable at every target viewport, including content scrolling and sticky mobile actions.

## 13. Definition of done for the next milestone

The next milestone, **V5 Playable Chapter**, is done when:

- The explicit state model and corrected branch flow are implemented.
- A player can complete and replay the chapter without refreshing.
- The journal is functional.
- Character Overview is complete for all eight heroes and meets the interaction/accessibility requirements in Section 7.6.
- Local Character Maintenance supports validated draft, apply, reset, import, and export flows defined in Section 7.7.
- Known issues 1–10 are resolved or intentionally deferred with an explanation.
- Core code is separated into maintainable modules.
- The experience passes the functional, accessibility, and visual checks above.
- The README documents local serving, controls, offline behavior, and file structure.
- No console errors occur during a complete playthrough in supported browsers.

## 14. Recommended implementation order

### Phase 1 — Stabilize the current game

- Fix portrait animation class mismatch.
- Introduce explicit game state and cancellable timers.
- Correct Verify, Inspect, Deploy, completion, and replay flows.
- Separate reduced-motion and pause state.
- Fix live-region behavior and focus management.

### Phase 2 — Modularize and complete UX

- Split CSS and JavaScript into the structure in Section 8.
- Build the journal/help overlay.
- Build Character Overview and populate overview content for all eight heroes.
- Build the local Character Maintenance editor and versioned override storage.
- Make HUD navigation either functional or visibly noninteractive.
- Add local preference persistence.
- Improve touch layout and control sizes.

### Phase 3 — Harden and ship V5

- Make the runtime fully local/offline-capable.
- Add smoke tests for story branches and assets.
- Test target browsers and viewports.
- Optimize imagery and effects where profiling shows a need.
- Update README and release notes.

## 15. Future backlog

- Additional chapters represented as separate story data files
- Unlockable realm lore and optional objectives
- Hero-specific visual spell effects
- Ambient music and richer sound design with independent volume controls
- Save-slot or chapter-progress persistence
- Localization-ready content keys and layout testing
- More granular character layers or authored sprite/skeletal rigs
- Achievement cards for inspection, verification, and all-hero casting

## 16. Product decisions still open

These do not block V5 stabilization, but should be decided before expanding content:

- Whether realm switching is purely cosmetic or becomes chapter navigation
- Whether verification is required or an optional branch with a reward
- Whether the game should prioritize a single-file distributable build in addition to modular source
- Whether later chapters require persistent progress across browser sessions
- Whether new character animation should continue with raster puppets or move to a purpose-built rigging format
