import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { updateMessage } from "@api/MessageUpdater";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { ChannelStore, Menu, Toasts, showToast } from "@webpack/common";

import { makeTierIcon } from "./components/TierButton";
import { openMessageTiersViewerModal } from "./components/ViewerModal";
import settings, { getTierLabel } from "./settings";
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

function quickOpenViewer() {
    openMessageTiersViewerModal();
}

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

    patches: [
        {
            // Replace the top-right Help button action with opening MessageTiers.
            // This places quick access in the same toolbar row as pin/threads/member list.
            find: 'navId:"staff-help-popout"',
            replacement: {
                match: /(isShown.+?)onClick:\i/,
                replace: (_, rest) => `${rest}onClick:()=>$self.openViewerFromHeader()`
            }
        }
    ],

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
    },

    openViewerFromHeader: quickOpenViewer
});
