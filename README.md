# MessageTiers (Vencord Userplugin)

Local message bookmarking for Discord with renameable presets and quick viewer actions.

- Author: `silverfox0338_`
- Author ID: `1235005349883412550`
- Plugin name: `MessageTiers`

## Core

- Save messages into presets (1-9 supported in storage)
- Set active preset count (1-9); hidden presets act as archive
- Hover and context-menu save/remove actions
- Quick-open viewer button in the chat text bar
- Local-only storage via Vencord plugin settings

## Viewer

- Tabs: `All`, active preset tabs, and `Archived` when active count is below 9
- Search by message content, author, or server
- Single click to jump, double click to insert, triple click context menu

## Notes

- `SavedMessage` includes `messageLink` and optional `attachments`
- CSS is scoped with `data-vc-messagetiers-*` selectors for custom-theme resilience
- Discord internals use silent fallbacks where possible
