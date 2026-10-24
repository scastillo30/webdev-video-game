# Webdev MMORPG · Version 4

> Architecture migration: the repository now contains an Angular application in `frontend/`, a Go + SQLite character API in `backend/`, and the preserved original game at the repository root. See `ARCHITECTURE.md` for the new development workflow.

Windows users can follow the complete installation and startup guide in [`WINDOWS_SETUP.md`](WINDOWS_SETUP.md).

## Run

For the current Angular + Go application, install dependencies once with `npm run frontend:install`, then start the API with `npm run local:backend:start` and the UI in a second terminal with `npm run local:frontend:start`. Open `http://localhost:4200`; Game View is available at `/game` and its persistent controls at `/settings/game`. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the complete workflow.

Operational readiness is available at `/operations`. Run the unattended television stability check at `/diagnostics/soak.html`; see [`TV_SOAK_RUNBOOK.md`](TV_SOAK_RUNBOOK.md) before using its result as release evidence.

The preserved original game can still be opened from `index.html` in a modern browser. Its art assets are in `assets/`. For a zero-setup standalone variant use `webdev_mmorpg_v4.html` (provided separately; all image assets embedded).

The scene works offline using HTML/CSS and Canvas. When internet is available it may optionally load Three.js from a CDN for GPU-driven overlay particles; visit with `?offline=1` to skip that request.

## Controls
- `Space`, `Enter` or dialogue arrow: continue story
- `1`–`8`: choose heroes
- `C`: cast currently selected character ability
- `O`: open the selected character overview
- `R`: cycle environment
- `F`: fullscreen
- Inspect Gate, Hero Overview, Cast Ability, and Journal are interactive
- Quest choices can deploy directly or verify first
- Ambient / Epic effects, Sound toggle (user-initiated tones), Pause

## Character overview and maintenance

Use **Hero Overview** or press `O` to inspect the selected hero's biography, ability, and traits. Browse heroes with the on-screen controls or Left/Right Arrow, then select or cast directly from the overview.

Selecting a hero also updates the Adventure Log with that hero's personal main quest. Stage characters reserve enough space above the dialogue panel to keep their complete body silhouette visible.

Open `index.html?maintenance=1` to expose the local **Characters** maintenance tool. It supports live preview, drafts, validated local overrides, reset, and JSON import/export. Changes are stored in this browser only; exporting and merging the data into the project source is required to publish it for every visitor. The URL flag is a development convenience, not authentication.

## Character rigs

Commander (key `1`) and Rogue (key `3`) are separate characters with separate animation assets. Commander uses the transparent eight-second smile and sword-grasp idle from `assets/characters/commander/sword-ready/v001/`. Rogue retains the transparent six-second pointing, breathing, and glasses-glow animation from `assets/rogue-pointing/`. Both run while the game is visible; Pause, reduced motion, hidden tabs, and modals use each character's own still image. `characters/registry.js` maps character IDs to animation assets. See `PROJECT_WORKFLOW.md` for ownership and versioning rules.

Healer (key `5`) uses the transparent eight-second crosier glow, fabric breeze, breathing, and victory wrist loop from `assets/characters/healer/crosier-victory/v002/web/`. Its game export is 384 × 576 at 24 fps, with its own paused poster and full-canvas portrait. The packed Blender source and original 1024 × 1536 RGBA PNG sequence remain in the parent production folder.

V4 uses layered **2.5D raster puppets**, not full skeletal rigs. The eight previous hero images have been divided into transparent head and torso layers with feathered joins for light nodding, breathing and casting motion. Independent arms, mouths, blinking and multi-angle turns will require separately drawn assets.

## JIRA activity presentation

The game now accepts normalized JIRA activity through a browser-safe adapter and presents it through the existing character stage, dialogue, party, and Hero Quest surfaces.

- Configuration lives in `jira/config.js`. Map a stable Atlassian account ID to one of the existing character IDs in `userCharacterMap`.
- The default poll interval is 60 seconds and each appearance lasts 15 seconds. Both are configurable.
- Activity is deduplicated by event ID, grouped by author, and scheduled round-robin between authors. The event author and ticket assignee remain separate fields.
- By default, only events dated today enter the large hero dialogue queue. Older events remain visible in that character's Hero Quest history. Set `announceOnlyToday` to `false` to narrate older queued events too.
- Pause/Resume affects presentation only; collection continues. Next advances the activity queue. Selecting a character pauses automatic presentation.
- Unmapped authors use the neutral JIRA Herald presentation and never borrow another user's character mapping.
- Ticket URLs open in a new tab. Only validated `http` and `https` URLs are rendered as links.

No live adapter or credentials are included. A server-side integration can expose a browser adapter before the game script runs:

```js
window.JIRA_ACTIVITY_ADAPTER = {
  async fetchActivities({ since }) {
    // Call your own authenticated backend; never put a JIRA token here.
    return { connection: 'live', events: [] };
  }
};
```

Each event may provide `eventId`, `authorId`, `authorName`, `assigneeId`, `assigneeName`, `ticketKey`, `ticketTitle`, `ticketUrl`, `action`, `previousStatus`, `newStatus`, `currentStatus`, and `timestamp`. Required normalization keys are event ID, author ID, ticket key, and a valid timestamp. If current status is absent, the UI displays `PENDING SYNC` instead of inferring a workflow status.

When no live adapter is installed, the game automatically reads the screenshot-derived examples from `jira/examples.json`; demo-only character mappings remain isolated in `JIRA_DEMO_CONFIG`. The interface is explicitly labeled **Demo fixture · not live**. The `?offline=1` option only disables the optional Three.js CDN request. When a browser blocks JSON requests from a `file://` page, serve the folder over localhost (for example, `python3 -m http.server`) and open it through `http://localhost`.

## Source structure
`index.html` contains a media placeholder `__ASSETS__`. This source distribution replaces that placeholder with a local `assets/` URL map; the standalone HTML embeds it as base64 data URIs. `make_assets.py` documents the layer extraction from prior source illustrations.

## Production considerations
Reduce-motion preference is respected for CSS animation; Canvas can be paused manually. Audio starts only on user interaction. Large visual interactions use modern browsers and are proof-of-concept only. There is no data persistence or backend integration.

The scene uses an adaptive rendering budget: active effects run at approximately 30 FPS, then fall to approximately 12 FPS after 12 seconds without input while costly CSS ambience pauses. Hidden tabs, open modals, and the Pause state skip Canvas and WebGL rendering. Any pointer or keyboard activity immediately restores the active presentation.
