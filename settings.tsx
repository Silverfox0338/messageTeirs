import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Button } from "@components/Button";
import { OptionType } from "@utils/types";

import type { SavedMessage, Tier } from "./types";

export const MAX_PRESET_COUNT = 9;
export const DEFAULT_ACTIVE_PRESET_COUNT = 3;
export const DEFAULT_MAX_SAVED_MESSAGES = 500;

const LEGACY_PRESET_DEFAULTS: Record<1 | 2 | 3, string> = {
    1: "Important",
    2: "Quote",
    3: "Favorite"
};

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
        description: "Display label for Preset 1.",
        default: "Preset 1"
    },
    tier2Label: {
        type: OptionType.STRING,
        description: "Display label for Preset 2.",
        default: "Preset 2"
    },
    tier3Label: {
        type: OptionType.STRING,
        description: "Display label for Preset 3.",
        default: "Preset 3"
    },
    tier4Label: {
        type: OptionType.STRING,
        description: "Display label for Preset 4.",
        default: "Preset 4"
    },
    tier5Label: {
        type: OptionType.STRING,
        description: "Display label for Preset 5.",
        default: "Preset 5"
    },
    tier6Label: {
        type: OptionType.STRING,
        description: "Display label for Preset 6.",
        default: "Preset 6"
    },
    tier7Label: {
        type: OptionType.STRING,
        description: "Display label for Preset 7.",
        default: "Preset 7"
    },
    tier8Label: {
        type: OptionType.STRING,
        description: "Display label for Preset 8.",
        default: "Preset 8"
    },
    tier9Label: {
        type: OptionType.STRING,
        description: "Display label for Preset 9.",
        default: "Preset 9"
    },
    activePresetCount: {
        type: OptionType.NUMBER,
        description: "How many presets are active (1-9). Hidden presets are archived.",
        default: DEFAULT_ACTIVE_PRESET_COUNT
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
    activePresetCount: {
        isValid: value => (
            Number.isFinite(value)
            && value >= 1
            && value <= MAX_PRESET_COUNT
        ) || `Active presets must be a number between 1 and ${MAX_PRESET_COUNT}.`
    },
    maxSavedMessages: {
        isValid: value => (Number.isFinite(value) && value > 0)
            || "Max saved messages must be a number greater than 0."
    }
}).withPrivateSettings<{
    savedMessages: SavedMessage[];
}>();

function normalizePresetLabel(value: unknown, fallback: string) {
    if (typeof value !== "string") return fallback;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}

function getRawTierLabel(tier: Tier): unknown {
    switch (tier) {
        case 1: return settings.store.tier1Label;
        case 2: return settings.store.tier2Label;
        case 3: return settings.store.tier3Label;
        case 4: return settings.store.tier4Label;
        case 5: return settings.store.tier5Label;
        case 6: return settings.store.tier6Label;
        case 7: return settings.store.tier7Label;
        case 8: return settings.store.tier8Label;
        case 9: return settings.store.tier9Label;
    }
}

function writeTierLabel(tier: Tier, value: string) {
    switch (tier) {
        case 1: settings.store.tier1Label = value; break;
        case 2: settings.store.tier2Label = value; break;
        case 3: settings.store.tier3Label = value; break;
        case 4: settings.store.tier4Label = value; break;
        case 5: settings.store.tier5Label = value; break;
        case 6: settings.store.tier6Label = value; break;
        case 7: settings.store.tier7Label = value; break;
        case 8: settings.store.tier8Label = value; break;
        case 9: settings.store.tier9Label = value; break;
    }
}

function normalizeActivePresetCount(value: unknown) {
    const rawValue = Number(value);
    if (!Number.isFinite(rawValue)) return DEFAULT_ACTIVE_PRESET_COUNT;
    return Math.min(MAX_PRESET_COUNT, Math.max(1, Math.floor(rawValue)));
}

export function getActivePresetCount() {
    return normalizeActivePresetCount(settings.store.activePresetCount);
}

export function setActivePresetCount(value: number) {
    settings.store.activePresetCount = normalizeActivePresetCount(value);
}

export function getActivePresetIds(): Tier[] {
    const count = getActivePresetCount();
    return Array.from({ length: count }, (_, index) => (index + 1) as Tier);
}

export function getTierLabel(tier: Tier) {
    return normalizePresetLabel(getRawTierLabel(tier), `Preset ${tier}`);
}

export function setPresetLabel(tier: Tier, value: string) {
    writeTierLabel(tier, normalizePresetLabel(value, `Preset ${tier}`));
}

export function migratePresetSettings() {
    for (let preset = 1; preset <= MAX_PRESET_COUNT; preset++) {
        const tier = preset as Tier;
        const defaultLabel = `Preset ${tier}`;
        const current = normalizePresetLabel(getRawTierLabel(tier), defaultLabel);

        if (tier <= 3) {
            const legacyDefault = LEGACY_PRESET_DEFAULTS[tier as 1 | 2 | 3];
            if (current === legacyDefault) {
                writeTierLabel(tier, defaultLabel);
                continue;
            }
        }

        writeTierLabel(tier, current);
    }

    setActivePresetCount(getActivePresetCount());
}

export default settings;

