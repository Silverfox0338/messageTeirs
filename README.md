# MessageTiers (Vencord Userplugin)

Local message bookmarking for Discord with tiered saves and quick viewer actions.

- Author: `silverfox0338_`
- Author ID: `1235005349883412550`
- Plugin name: `MessageTiers`

## Core

- Save messages into tiers (1-9 supported in storage/viewer move actions)
- Hover and context-menu save/remove actions
- Searchable viewer modal with jump-to-message
- Local-only storage via Vencord plugin settings

## Viewer interactions

- Single click: jump to message
- Double click: insert into chat input (text, GIF, or stored message link)
- Triple click: opens inline context menu with:
  - Copy message content
  - Copy message link
  - Copy author tag
  - Move to preset (1-9)
  - Download attachment (media entries)
  - Delete entry

## Media behavior

- If an entry is media-only (photo/video) and cannot be inserted, viewer shows:
  - `Can't insert media — click to download`
- Download uses browser fetch/blob flow and supports multiple attachments sequentially.

## Data shape

`SavedMessage` now includes:
- `messageLink`
- optional `attachments` metadata

## Notes

- CSS is scoped with `data-vc-messagetiers-*` selectors for better custom-theme resilience.
- All Discord internals use silent fallbacks where possible.
