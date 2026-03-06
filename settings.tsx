import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Button } from "@components/Button";
import { OptionType } from "@utils/types";

import type { SavedMessage, Tier } from "./types";

export const DEFAULT_MAX_SAVED_MESSAGES = 500;

const OpenViewerButton = ErrorBoundary.wrap(() => (
    <Button
        onClick={() => {
            void import("./components/ViewerModal").then(({ openMessageTiersViewerModal }) => {
                openMessageTiersViewerModal();
            });
        }}
    >
        Open MessageTiers Viewer
    </Button>
), { noop: true });

const settings = definePluginSettings({
    tier1Label: {
        type: OptionType.STRING,
        description: "Display label for Tier 1.",
        default: "Important"
    },
    tier2Label: {
        type: OptionType.STRING,
        description: "Display label for Tier 2.",
        default: "Quote"
    },
    tier3Label: {
        type: OptionType.STRING,
        description: "Display label for Tier 3.",
        default: "Favorite"
    },
    maxSavedMessages: {
        type: OptionType.NUMBER,
        description: "Maximum number of saved messages to keep.",
        default: DEFAULT_MAX_SAVED_MESSAGES
    },
    showHoverButton: {
        type: OptionType.BOOLEAN,
        description: "Show the MessageTiers button in the message hover bar.",
        default: true
    },
    blurViewerContent: {
        type: OptionType.BOOLEAN,
        description: "Blur message content in the MessageTiers viewer.",
        default: false
    },
    openViewer: {
        type: OptionType.COMPONENT,
        component: OpenViewerButton
    },
    savedMessages: {
        type: OptionType.CUSTOM,
        default: [] as SavedMessage[]
    }
}, {
    maxSavedMessages: {
        isValid: value => (Number.isFinite(value) && value > 0)
            || "Max saved messages must be a number greater than 0."
    }
}).withPrivateSettings<{
    savedMessages: SavedMessage[];
}>();

export default settings;

export function getTierLabel(tier: Tier) {
    if (tier === 1) return settings.store.tier1Label || "Important";
    if (tier === 2) return settings.store.tier2Label || "Quote";
    if (tier === 3) return settings.store.tier3Label || "Favorite";
    return `Preset ${tier}`;
}
