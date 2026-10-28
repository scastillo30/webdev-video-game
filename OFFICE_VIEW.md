# Office View guide

Office View is the Angular root route (`/`) and preserves the original cinematic HTML game. Angular hosts it in a same-origin iframe from `/legacy-game/index.html?offline=1&parentJira=1`; the current Game View at `/game` is a different implementation.

## What is preserved

- Eight-character party and canonical IDs.
- Full-size character art, approved animated WebP loops, posters, and portraits.
- Character overview and story/dialogue presentation.
- Hero Quest activity/history panel and Jira-driven dialogue.
- Realm backgrounds, environmental ambience, audio/effects controls, pause, and fullscreen behavior.
- Keyboard and pointer controls implemented in the legacy runtime.

The root `index.html`, `styles.css`, `game.js`, `characters/registry.js`, `jira/`, and root `assets/` are the legacy runtime source. The Go server exposes those files under `/legacy-game/` for the Angular wrapper.

## Shared Jira bridge

The Angular Office component combines the root Jira store with the saved Game configuration and sends normalized events, current issues, and stable Jira-account-to-character mappings through a versioned same-origin `postMessage` contract. `parentJira=1` tells the legacy runtime that the parent owns Jira collection, preventing duplicate polling.

When the shared stream is live, the displayed Office character keeps a Jira work card in the lower conversation panel. The card prefers that character's newest authored event; when a newer assigned issue exists, it shows that current work instead. Narration, relative time, ticket link, action, and semantic status color use the same presentation rules as Game View. The Hero Quest panel continues to show the mapped author's recent activity history. A new queued event temporarily takes priority, then the panel returns to the displayed character's latest work. Disconnected or stale data is not presented as live work.

Standalone legacy development can still use `jira/examples.json` or a browser adapter, but fixture data must be visibly marked demo. Production credentials never belong in Office JavaScript.

## Character asset mapping

`characters/registry.js` maps only explicitly integrated animated Office characters. A missing registry entry does not remove that character from the roster; it uses its preserved still/layered presentation.

Before changing a character:

1. Read [AGENTS.md](AGENTS.md), [PROJECT_WORKFLOW.md](PROJECT_WORKFLOW.md), and its manifest.
2. Confirm the canonical ID and ownership from files.
3. Add a version rather than overwriting approved assets.
4. Change only the intended registry entry during authorized integration.
5. Verify the target, Commander, Rogue, pause/resume, switching, and reduced motion.

Game View board assets are independent. Changing `board-character-assets.ts` must not change Office View mappings.

## Main legacy controls

- `Space` or `Enter`: advance dialogue.
- `1`–`8`: select a roster character.
- `C`: cast the selected ability.
- `O`: open the selected character overview.
- `R`: cycle realm/environment.
- `F`: request fullscreen.
- Pause, sound, effects, Next, journal, overview, and Jira presentation controls are available in the interface.

Manual character selection pauses automatic Jira presentation until resumed; it does not stop shared event collection.

## Performance behavior

The legacy renderer uses an adaptive frame budget, suspends expensive rendering for hidden tabs/open modals/pause, and restores active presentation after interaction. `?offline=1` disables the optional external Three.js load. Reduced-motion preferences replace continuous character animation with that same character's approved still fallback.

## Maintenance surfaces

The supported Angular character metadata maintenance route is `/characters`. The older `?maintenance=1` browser-local editor remains part of the standalone legacy history but is not the shared SQLite administration path.

Use `/settings/game` for Game View profiles, Jira account mappings, status behaviors, and display settings. Neither maintenance surface authorizes overwriting character-owned source assets.

## Regression checklist

- `/` loads the iframe from `/legacy-game/`, not `/game`.
- All eight roster characters remain selectable.
- Commander and Rogue retain distinct animation/poster/portrait ownership.
- Parent Jira state and Office dialogue/history agree.
- Demo data is labeled and live data is never guessed.
- Pause, Next, manual selection, overview, sound, effects, fullscreen, and reduced motion remain coherent.
- Route changes do not leave duplicate timers or Jira collection active inside the iframe.
