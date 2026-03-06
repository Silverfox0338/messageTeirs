import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { updateMessage } from "@api/MessageUpdater";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { ChannelStore, Menu, Toasts, showToast } from "@webpack/common";

import { makeTierIcon, TierButton } from "./components/TierButton";
import { openMessageTiersViewerModal } from "./components/ViewerModal";
import settings, { getActivePresetCount, getActivePresetIds, getTierLabel, migratePresetSettings } from "./settings";
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

function showPresetToast(action: "saved" | "updated" | "removed", preset?: Tier) {
    if (action === "removed") {
        showToast("Removed from MessageTiers.", Toasts.Type.SUCCESS);
        return;
    }

    if (!preset) {
        showToast("MessageTiers updated.", Toasts.Type.SUCCESS);
        return;
    }

    const label = getTierLabel(preset);
    if (action === "saved") {
        showToast(`Saved to ${label}.`, Toasts.Type.SUCCESS);
        return;
    }

    showToast(`Moved to ${label}.`, Toasts.Type.SUCCESS);
}

function saveMessageToPreset(message: Message, preset: Tier) {
    const input = createSaveMessageInput(message);
    const existing = getByMessageId(message.id);
    const result = upsertWithTier(input, preset);

    rerenderMessage(message);
    showPresetToast(existing ? "updated" : "saved", preset);

    if (result.evicted) showLimitToast();
}

function cycleMessagePreset(message: Message) {
    const input = createSaveMessageInput(message);
    const result = cycleTier(input);

    rerenderMessage(message);
    showPresetToast(result.action, result.tier);

    if (result.evicted) showLimitToast();
}

function removeMessagePreset(message: Message) {
    const removed = remove(message.id);
    if (!removed) return;

    rerenderMessage(message);
    showPresetToast("removed");
}

function getPopoverLabel(currentPreset: TierState) {
    const activePresetCount = getActivePresetCount();

    if (currentPreset === 0) {
        return `Save to ${getTierLabel(1)}`;
    }

    if (currentPreset > activePresetCount) {
        return `Move to ${getTierLabel(1)}`;
    }

    if (currentPreset < activePresetCount) {
        return `Move to ${getTierLabel((currentPreset + 1) as Tier)}`;
    }

    return "Clear MessageTiers entry";
}

function quickOpenViewer() {
    openMessageTiersViewerModal();
}

const OpenViewerChatBarButton: ChatBarButtonFactory = ({ isAnyChat }) => {
    if (!isAnyChat) return null;

    return (
        <ChatBarButton
            tooltip="Open MessageTiers"
            onClick={quickOpenViewer}
            buttonProps={{ "aria-label": "Open MessageTiers" }}
        >
            <TierButton tier={0} width={20} height={20} />
        </ChatBarButton>
    );
};

const messageContextPatch: NavContextMenuPatchCallback = (children, { message }: { message?: Message; }) => {
    if (!message) return;

    const targetGroup = findGroupChildrenByChildId(["copy-link", "mark-unread"], children) ?? children;
    const isSaved = Boolean(getByMessageId(message.id));
    const activePresets = getActivePresetIds();

    targetGroup.push(
        <Menu.MenuItem id="vc-messagetiers-save-root" label="Save to MessageTiers">
            {activePresets.map(preset => (
                <Menu.MenuItem
                    key={preset}
                    id={`vc-messagetiers-preset-${preset}`}
                    label={getTierLabel(preset)}
                    action={() => saveMessageToPreset(message, preset)}
                    icon={makeTierIcon(preset)}
                />
            ))}
        </Menu.MenuItem>
    );

    if (isSaved) {
        targetGroup.push(
            <Menu.MenuItem
                id="vc-messagetiers-remove"
                label="Remove from MessageTiers"
                color="danger"
                action={() => removeMessagePreset(message)}
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
    description: "Preset-based local message bookmarking with hover button, context actions, and a searchable viewer.",
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

    chatBarButton: {
        icon: makeTierIcon(0),
        render: OpenViewerChatBarButton
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
                onClick: () => cycleMessagePreset(message)
            };
        }
    },

    start() {
        migratePresetSettings();
        // Access once to validate and sanitize persisted store structure.
        getAll();
    }
});


