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
    preset1Visible: {
        type: OptionType.BOOLEAN,
        description: "Show Preset 1 in menus/tabs.",
        default: true
    },
    preset2Visible: {
        type: OptionType.BOOLEAN,
        description: "Show Preset 2 in menus/tabs.",
        default: true
    },
    preset3Visible: {
        type: OptionType.BOOLEAN,
        description: "Show Preset 3 in menus/tabs.",
        default: true
    },
    preset4Visible: {
        type: OptionType.BOOLEAN,
        description: "Show Preset 4 in menus/tabs.",
        default: false
    },
    preset5Visible: {
        type: OptionType.BOOLEAN,
        description: "Show Preset 5 in menus/tabs.",
        default: false
    },
    preset6Visible: {
        type: OptionType.BOOLEAN,
        description: "Show Preset 6 in menus/tabs.",
        default: false
    },
    preset7Visible: {
        type: OptionType.BOOLEAN,
        description: "Show Preset 7 in menus/tabs.",
        default: false
    },
    preset8Visible: {
        type: OptionType.BOOLEAN,
        description: "Show Preset 8 in menus/tabs.",
        default: false
    },
    preset9Visible: {
        type: OptionType.BOOLEAN,
        description: "Show Preset 9 in menus/tabs.",
        default: false
    },
    preset1Nsfw: {
        type: OptionType.BOOLEAN,
        description: "Mark Preset 1 as NSFW.",
        default: false
    },
    preset2Nsfw: {
        type: OptionType.BOOLEAN,
        description: "Mark Preset 2 as NSFW.",
        default: false
    },
    preset3Nsfw: {
        type: OptionType.BOOLEAN,
        description: "Mark Preset 3 as NSFW.",
        default: false
    },
    preset4Nsfw: {
        type: OptionType.BOOLEAN,
        description: "Mark Preset 4 as NSFW.",
        default: false
    },
    preset5Nsfw: {
        type: OptionType.BOOLEAN,
        description: "Mark Preset 5 as NSFW.",
        default: false
    },
    preset6Nsfw: {
        type: OptionType.BOOLEAN,
        description: "Mark Preset 6 as NSFW.",
        default: false
    },
    preset7Nsfw: {
        type: OptionType.BOOLEAN,
        description: "Mark Preset 7 as NSFW.",
        default: false
    },
    preset8Nsfw: {
        type: OptionType.BOOLEAN,
        description: "Mark Preset 8 as NSFW.",
        default: false
    },
    preset9Nsfw: {
        type: OptionType.BOOLEAN,
        description: "Mark Preset 9 as NSFW.",
        default: false
    },
    activePresetCount: {
        type: OptionType.NUMBER,
        description: "Legacy preset count control (kept for compatibility).",
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

function readPresetVisible(tier: Tier) {
    switch (tier) {
        case 1: return settings.store.preset1Visible;
        case 2: return settings.store.preset2Visible;
        case 3: return settings.store.preset3Visible;
        case 4: return settings.store.preset4Visible;
        case 5: return settings.store.preset5Visible;
        case 6: return settings.store.preset6Visible;
        case 7: return settings.store.preset7Visible;
        case 8: return settings.store.preset8Visible;
        case 9: return settings.store.preset9Visible;
    }
}

function writePresetVisible(tier: Tier, value: boolean) {
    switch (tier) {
        case 1: settings.store.preset1Visible = value; break;
        case 2: settings.store.preset2Visible = value; break;
        case 3: settings.store.preset3Visible = value; break;
        case 4: settings.store.preset4Visible = value; break;
        case 5: settings.store.preset5Visible = value; break;
        case 6: settings.store.preset6Visible = value; break;
        case 7: settings.store.preset7Visible = value; break;
        case 8: settings.store.preset8Visible = value; break;
        case 9: settings.store.preset9Visible = value; break;
    }
}

function readPresetNsfw(tier: Tier) {
    switch (tier) {
        case 1: return settings.store.preset1Nsfw;
        case 2: return settings.store.preset2Nsfw;
        case 3: return settings.store.preset3Nsfw;
        case 4: return settings.store.preset4Nsfw;
        case 5: return settings.store.preset5Nsfw;
        case 6: return settings.store.preset6Nsfw;
        case 7: return settings.store.preset7Nsfw;
        case 8: return settings.store.preset8Nsfw;
        case 9: return settings.store.preset9Nsfw;
    }
}

function writePresetNsfw(tier: Tier, value: boolean) {
    switch (tier) {
        case 1: settings.store.preset1Nsfw = value; break;
        case 2: settings.store.preset2Nsfw = value; break;
        case 3: settings.store.preset3Nsfw = value; break;
        case 4: settings.store.preset4Nsfw = value; break;
        case 5: settings.store.preset5Nsfw = value; break;
        case 6: settings.store.preset6Nsfw = value; break;
        case 7: settings.store.preset7Nsfw = value; break;
        case 8: settings.store.preset8Nsfw = value; break;
        case 9: settings.store.preset9Nsfw = value; break;
    }
}

export function isPresetVisible(tier: Tier) {
    return Boolean(readPresetVisible(tier));
}

export function setPresetVisible(tier: Tier, visible: boolean) {
    writePresetVisible(tier, visible);

    if (getVisiblePresetIds().length === 0) {
        writePresetVisible(1, true);
    }
}

export function getVisiblePresetIds(): Tier[] {
    const visible = ([] as Tier[]);

    for (let preset = 1; preset <= MAX_PRESET_COUNT; preset++) {
        const tier = preset as Tier;
        if (isPresetVisible(tier)) visible.push(tier);
    }

    if (visible.length > 0) return visible;
    return [1];
}

export function isPresetNsfw(tier: Tier) {
    return Boolean(readPresetNsfw(tier));
}

export function setPresetNsfw(tier: Tier, nsfw: boolean) {
    writePresetNsfw(tier, nsfw);
}

export function getTierLabel(tier: Tier) {
    return normalizePresetLabel(getRawTierLabel(tier), `Preset ${tier}`);
}

export function getPresetDisplayLabel(tier: Tier) {
    const label = getTierLabel(tier);
    return isPresetNsfw(tier) ? `${label} [NSFW]` : label;
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

    const looksLikeLegacyVisibility = [1, 2, 3, 4, 5, 6, 7, 8, 9].every(value => {
        const tier = value as Tier;
        const shouldBeVisibleByDefault = tier <= DEFAULT_ACTIVE_PRESET_COUNT;
        return isPresetVisible(tier) === shouldBeVisibleByDefault;
    });

    if (looksLikeLegacyVisibility) {
        const activeCount = getActivePresetCount();
        for (let preset = 1; preset <= MAX_PRESET_COUNT; preset++) {
            const tier = preset as Tier;
            writePresetVisible(tier, tier <= activeCount);
        }
    }

    if (getVisiblePresetIds().length === 0) {
        writePresetVisible(1, true);
    }

    setActivePresetCount(getVisiblePresetIds().length);
}

export default settings;
