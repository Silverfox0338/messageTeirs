# MessageTiers (Vencord Userplugin)

A local, tiered message bookmarking plugin for Vencord.

- Author: `silverfox0338_`
- Author ID: `1235005349883412550n`
- Plugin name: `MessageTiers`
- Folder name: `messageTeirs` (kept for compatibility with your current path)

## What It Does

MessageTiers lets you save messages into three bookmark tiers and quickly get back to them later.

Tier cycle on click:

1. Unset -> Tier 1
2. Tier 1 -> Tier 2
3. Tier 2 -> Tier 3
4. Tier 3 -> Unset (removed)

Default tier labels:

- Tier 1: `Important`
- Tier 2: `Quote`
- Tier 3: `Favorite`

All labels are renameable in plugin settings.

## Quick Access (Bookmark Viewer)

You can open the MessageTiers viewer from multiple fast entry points:

- Global hotkey (default): `Ctrl+Shift+B` (configurable)
- Plugin settings button: `Open MessageTiers Viewer`
- App-level context menus:
  - Guild context menu
  - Group DM context menu
  - Settings cog context menu
- Vencord toolbox action: `Open MessageTiers`

## Core Features

- Message hover button that cycles tiers.
- Message context menu actions:
  - `Save to MessageTiers` with direct Tier 1/2/3 submenu
  - `Remove from MessageTiers` for saved entries
- Viewer modal with:
  - `All`, `Tier 1`, `Tier 2`, `Tier 3` tabs
  - Search by message content, author tag, and server name
  - One-click jump to the original message
  - Per-entry delete action
- Toast feedback for save/update/remove actions.
- Automatic oldest-entry eviction when save limit is reached.

## Data Model

```ts
type SavedMessage = {
    messageId: string;
    channelId: string;
    guildId?: string;
    content: string;
    authorId: string;
    authorTag: string;
    timestamp: number;
    savedAt: number;
    tier: 1 | 2 | 3;
};
```

## Storage and Privacy

- Uses Vencord `definePluginSettings` + `withPrivateSettings`.
- Uses `OptionType.CUSTOM` for local saved message storage.
- No external API calls.
- No data is stored that is not already visible in Discord UI.

## Settings

- `tier1Label` (string)
- `tier2Label` (string)
- `tier3Label` (string)
- `maxSavedMessages` (number, default `500`)
- `showHoverButton` (boolean, default `true`)
- `blurViewerContent` (boolean, default `false`)
- `enableQuickOpenHotkey` (boolean, default `true`)
- `quickOpenHotkey` (string, default `Ctrl+Shift+B`)

## CSS Hardening Against Custom Themes

This plugin includes a managed stylesheet (`styles.css?managed`) to reduce interference from user custom CSS.

Hardening strategy:

- Dedicated scoped selectors with `data-vc-messagetiers-*` attributes
- Reset and normalization on the viewer root (`all: initial` + explicit defaults)
- Strong override priority with `!important` where needed
- Isolated icon and viewer containers (`isolation: isolate`)

Note: no client-side UI can be made 100% untouchable against deliberate high-specificity/`!important` CSS targeting the same selectors, but this significantly improves resilience against normal theme overrides.

## File Layout

```text
messageTeirs/
  index.tsx
  settings.tsx
  types.ts
  styles.css
  store/
    messageStore.ts
  components/
    TierButton.tsx
    ViewerModal.tsx
```

## Install in Vencord Source

Place this folder under:

```text
src/userplugins/messageTeirs
```

Then rebuild/reload Vencord.

## Development Notes

- All injected React surfaces are wrapped with `ErrorBoundary.wrap`.
- Store access goes through typed accessor functions in `store/messageStore.ts`.
- Internal Discord calls use silent fallbacks where appropriate.

## Planned Enhancements

- Export/import bookmarks
- Optional per-tier sort modes
- Richer filtering (date ranges, per-server toggles)
- Optional pinning of specific saved entries
