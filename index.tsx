import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { updateMessage } from "@api/MessageUpdater";
import { IS_MAC } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { ChannelStore, Menu, Toasts, showToast } from "@webpack/common";

import { makeTierIcon } from "./components/TierButton";
import { openMessageTiersViewerModal } from "./components/ViewerModal";
import settings, { DEFAULT_QUICK_OPEN_HOTKEY, getTierLabel } from "./settings";
import {
    createSaveMessageInput,
    cycleTier,
    getAll,
    getByMessageId,
    remove,
    upsertWithTier
} from "./store/messageStore";
import type { Tier, TierState } from "./types";

import hardStyle from "./styles.css?managed";

type ParsedHotkey = {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
    key: string;
};

function showLimitToast() {
    showToast("MessageTiers: oldest saved message was removed to respect your max limit.", Toasts.Type.MESSAGE);
}

function rerenderMessage(message: Message) {
    try {
        updateMessage(message.channel_id, message.id);
    } catch {
        // Silent fallback for missing internals.
    }
}

function showTierToast(action: "saved" | "updated" | "removed", tier?: Tier) {
    if (action === "removed") {
        showToast("Removed from MessageTiers.", Toasts.Type.SUCCESS);
        return;
    }

    if (!tier) {
        showToast("MessageTiers updated.", Toasts.Type.SUCCESS);
        return;
    }

    const label = getTierLabel(tier);
    if (action === "saved") {
        showToast(`Saved to ${label}.`, Toasts.Type.SUCCESS);
        return;
    }

    showToast(`Moved to ${label}.`, Toasts.Type.SUCCESS);
}

function saveMessageToTier(message: Message, tier: Tier) {
    const input = createSaveMessageInput(message);
    const existing = getByMessageId(message.id);
    const result = upsertWithTier(input, tier);

    rerenderMessage(message);
    showTierToast(existing ? "updated" : "saved", tier);

    if (result.evicted) showLimitToast();
}

function cycleMessageTier(message: Message) {
    const input = createSaveMessageInput(message);
    const result = cycleTier(input);

    rerenderMessage(message);
    showTierToast(result.action, result.tier);

    if (result.evicted) showLimitToast();
}

function removeMessageTier(message: Message) {
    const removed = remove(message.id);
    if (!removed) return;

    rerenderMessage(message);
    showTierToast("removed");
}

function getPopoverLabel(currentTier: TierState) {
    if (currentTier === 0) return `Save to ${getTierLabel(1)}`;
    if (currentTier === 1) return `Move to ${getTierLabel(2)}`;
    if (currentTier === 2) return `Move to ${getTierLabel(3)}`;
    return "Clear MessageTiers entry";
}

function normalizeHotkeyKey(raw: string) {
    const key = raw.trim().toLowerCase();
    if (!key) return "";

    if (key === "space") return " ";
    if (key === "esc") return "escape";

    return key;
}

function parseHotkey(value: string): ParsedHotkey | null {
    const segments = value
        .split("+")
        .map(segment => segment.trim().toLowerCase())
        .filter(Boolean);

    if (!segments.length) return null;

    const hotkey: ParsedHotkey = {
        ctrl: false,
        shift: false,
        alt: false,
        meta: false,
        key: ""
    };

    for (const segment of segments) {
        if (segment === "ctrl" || segment === "control") {
            hotkey.ctrl = true;
            continue;
        }

        if (segment === "shift") {
            hotkey.shift = true;
            continue;
        }

        if (segment === "alt" || segment === "option") {
            hotkey.alt = true;
            continue;
        }

        if (segment === "meta" || segment === "cmd" || segment === "command" || segment === "super") {
            hotkey.meta = true;
            continue;
        }

        hotkey.key = normalizeHotkeyKey(segment);
    }

    if (!hotkey.key) return null;
    return hotkey;
}

function getResolvedHotkey() {
    return parseHotkey(settings.store.quickOpenHotkey || "")
        ?? parseHotkey(DEFAULT_QUICK_OPEN_HOTKEY);
}

function isEditingElement(target: EventTarget | null) {
    const element = target as HTMLElement | null;
    if (!element) return false;

    if (element.isContentEditable) return true;

    const tagName = element.tagName.toLowerCase();
    return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function matchesHotkey(event: KeyboardEvent, hotkey: ParsedHotkey) {
    const primaryCtrlPressed = IS_MAC ? event.metaKey : event.ctrlKey;

    if (primaryCtrlPressed !== hotkey.ctrl) return false;
    if (event.shiftKey !== hotkey.shift) return false;
    if (event.altKey !== hotkey.alt) return false;

    const secondaryMetaPressed = IS_MAC ? event.ctrlKey : event.metaKey;
    if (secondaryMetaPressed !== hotkey.meta) return false;

    const pressedKey = normalizeHotkeyKey(event.key);
    return pressedKey === hotkey.key;
}

function quickOpenViewer() {
    openMessageTiersViewerModal();
}

const quickOpenHotkeyListener = (event: KeyboardEvent) => {
    if (!settings.store.enableQuickOpenHotkey) return;
    if (event.repeat) return;
    if (isEditingElement(event.target)) return;

    const hotkey = getResolvedHotkey();
    if (!hotkey) return;

    if (matchesHotkey(event, hotkey)) {
        event.preventDefault();
        event.stopPropagation();
        quickOpenViewer();
    }
};

const messageContextPatch: NavContextMenuPatchCallback = (children, { message }: { message?: Message; }) => {
    if (!message) return;

    const targetGroup = findGroupChildrenByChildId(["copy-link", "mark-unread"], children) ?? children;
    const isSaved = Boolean(getByMessageId(message.id));

    targetGroup.push(
        <Menu.MenuItem id="vc-messagetiers-save-root" label="Save to MessageTiers">
            <Menu.MenuItem
                id="vc-messagetiers-tier-1"
                label={`Tier 1 - ${getTierLabel(1)}`}
                action={() => saveMessageToTier(message, 1)}
                icon={makeTierIcon(1)}
            />
            <Menu.MenuItem
                id="vc-messagetiers-tier-2"
                label={`Tier 2 - ${getTierLabel(2)}`}
                action={() => saveMessageToTier(message, 2)}
                icon={makeTierIcon(2)}
            />
            <Menu.MenuItem
                id="vc-messagetiers-tier-3"
                label={`Tier 3 - ${getTierLabel(3)}`}
                action={() => saveMessageToTier(message, 3)}
                icon={makeTierIcon(3)}
            />
        </Menu.MenuItem>
    );

    if (isSaved) {
        targetGroup.push(
            <Menu.MenuItem
                id="vc-messagetiers-remove"
                label="Remove from MessageTiers"
                color="danger"
                action={() => removeMessageTier(message)}
            />
        );
    }
};

const appNavContextPatch: NavContextMenuPatchCallback = children => {
    children.push(
        <Menu.MenuItem
            id="vc-messagetiers-open-viewer"
            label="Open MessageTiers"
            action={quickOpenViewer}
        />
    );
};

export default definePlugin({
    name: "MessageTiers",
    description: "Tiered local message bookmarking with hover button, context actions, and a searchable viewer.",
    authors: [{ name: "silverfox0338_", id: 1235005349883412550n }],
    dependencies: ["ContextMenuAPI", "MessagePopoverAPI", "MessageUpdaterAPI"],
    managedStyle: hardStyle,
    settings,

    contextMenus: {
        message: messageContextPatch,
        "message-actions": messageContextPatch,
        "guild-context": appNavContextPatch,
        "gdm-context": appNavContextPatch,
        "user-settings-cog": appNavContextPatch
    },

    toolboxActions: {
        "Open MessageTiers": quickOpenViewer
    },

    messagePopoverButton: {
        icon: makeTierIcon(0),
        render(message) {
            if (!settings.store.showHoverButton) return null;

            const channel = ChannelStore?.getChannel?.(message.channel_id);
            if (!channel) return null;

            const tierState: TierState = getByMessageId(message.id)?.tier ?? 0;

            return {
                label: getPopoverLabel(tierState),
                icon: makeTierIcon(tierState),
                message,
                channel,
                onClick: () => cycleMessageTier(message)
            };
        }
    },

    start() {
        // Access once to validate and sanitize persisted store structure.
        getAll();

        window.addEventListener("keydown", quickOpenHotkeyListener, true);
    },

    stop() {
        window.removeEventListener("keydown", quickOpenHotkeyListener, true);
    }
});
