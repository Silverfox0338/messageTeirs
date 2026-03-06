import { copyToClipboard } from "@utils/clipboard";
import { insertTextIntoChatInputBox } from "@utils/discord";
import ErrorBoundary from "@components/ErrorBoundary";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { GuildStore, MessageActions, NavigationRouter, React, TabBar, Text, Toasts, showToast } from "@webpack/common";

import settings, {
    getActivePresetCount,
    getActivePresetIds,
    getTierLabel,
    setActivePresetCount,
    setPresetLabel
} from "../settings";
import { filterByTier, getAll, remove, search, subscribeToStoreUpdates, upsertWithTier } from "../store/messageStore";
import type { SaveMessageInput, SavedAttachment, SavedMessage, Tier, TierFilter } from "../types";

const CLICK_WINDOW_MS = 300;
const AUTHOR_NAME = "silverfox0338_";
const AUTHOR_ID = "1235005349883412550";
const ALL_PRESET_IDS: Tier[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const PresetSettingKeys = [
    "tier1Label",
    "tier2Label",
    "tier3Label",
    "tier4Label",
    "tier5Label",
    "tier6Label",
    "tier7Label",
    "tier8Label",
    "tier9Label",
    "activePresetCount",
    "blurViewerContent",
    "showHoverButton"
] as const;

type ContextMenuState = {
    entry: SavedMessage;
    x: number;
    y: number;
    showMoveMenu: boolean;
};

function getTabLabel(tab: TierFilter) {
    if (tab === "all") return "All";
    if (tab === "archived") return "Archived";
    return getTierLabel(tab);
}

function resolveServerName(entry: SavedMessage) {
    if (!entry.guildId) return "Direct Message";
    return GuildStore?.getGuild?.(entry.guildId)?.name ?? "Unknown Server";
}

function jumpToSavedMessage(entry: SavedMessage, onClose: () => void) {
    try {
        if (typeof MessageActions?.jumpToMessage === "function") {
            MessageActions.jumpToMessage({
                channelId: entry.channelId,
                messageId: entry.messageId,
                flash: true,
                jumpType: "INSTANT"
            });
            onClose();
            return;
        }

        const router = NavigationRouter as unknown as { transitionToChannel?: (channelId: string) => void; };

        if (typeof router.transitionToChannel === "function") {
            router.transitionToChannel(entry.channelId);
            onClose();
        }
    } catch {
        // Silent fallback for missing internals.
    }
}

function isGifLink(value: string) {
    return /(?:tenor\.com|giphy\.com|media\d*\.giphy\.com)/i.test(value) || /\.gif(?:\?|$)/i.test(value);
}

function getMediaAttachments(entry: SavedMessage) {
    return (entry.attachments ?? []).filter(attachment => {
        if (!attachment) return false;

        const isImageNonGif = Boolean(attachment.isImage) && !Boolean(attachment.isGif);
        return Boolean(attachment.isVideo) || isImageNonGif;
    });
}

function getGifAttachment(entry: SavedMessage) {
    return (entry.attachments ?? []).find(attachment => Boolean(attachment?.isGif))?.url;
}

function hasChatInputAvailable() {
    try {
        const selectors = [
            '[class*="channelTextArea"] textarea',
            '[class*="channelTextArea"] [contenteditable="true"]',
            '[class*="channelTextArea"] input'
        ];

        if (selectors.some(selector => Boolean(document.querySelector(selector)))) {
            return true;
        }

        const active = document.activeElement as HTMLElement | null;
        if (!active) return false;

        if (active.tagName === "TEXTAREA" || active.tagName === "INPUT" || active.isContentEditable) {
            return true;
        }

        return false;
    } catch {
        return false;
    }
}

async function downloadAttachment(attachment: SavedAttachment, fallbackName: string) {
    const response = await fetch(attachment.url);
    if (!response.ok) throw new Error("download failed");

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = attachment.filename || fallbackName;
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

function buildSaveInput(entry: SavedMessage): SaveMessageInput {
    return {
        messageId: entry.messageId,
        channelId: entry.channelId,
        guildId: entry.guildId,
        content: entry.content,
        authorId: entry.authorId,
        authorTag: entry.authorTag,
        timestamp: entry.timestamp,
        attachments: entry.attachments ?? []
    };
}

function ViewerModalComponent({ modalProps }: { modalProps: ModalProps; }) {
    const ui = settings.use([...PresetSettingKeys]);

    const activePresetCount = getActivePresetCount();
    const activePresets = React.useMemo(() => getActivePresetIds(), [ui.activePresetCount]);
    const tabOrder = React.useMemo<TierFilter[]>(() => ["all", ...activePresets], [activePresets]);

    const [activeTab, setActiveTab] = React.useState<TierFilter>("all");
    const [query, setQuery] = React.useState("");
    const [showSettingsPanel, setShowSettingsPanel] = React.useState(false);
    const [version, bumpVersion] = React.useReducer((value: number) => value + 1, 0);
    const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);

    const contextMenuRef = React.useRef<HTMLDivElement | null>(null);
    const clickTrackerRef = React.useRef<Record<string, { count: number; timeoutId?: number; }>>({});
    const pendingDoubleRef = React.useRef<Record<string, number>>({});
    const tripleTriggerRef = React.useRef<{ messageId: string; at: number; } | null>(null);

    React.useEffect(() => subscribeToStoreUpdates(() => bumpVersion()), []);

    React.useEffect(() => {
        if (typeof activeTab === "number" && activeTab > activePresetCount) {
            setActiveTab("all");
        }
    }, [activeTab, activePresetCount]);

    React.useEffect(() => {
        if (!contextMenu) return;

        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as Node | null;
            if (target && contextMenuRef.current?.contains(target)) return;
            setContextMenu(null);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setContextMenu(null);
        };

        document.addEventListener("mousedown", onMouseDown, true);
        document.addEventListener("keydown", onKeyDown, true);

        return () => {
            document.removeEventListener("mousedown", onMouseDown, true);
            document.removeEventListener("keydown", onKeyDown, true);
        };
    }, [contextMenu]);

    React.useEffect(() => () => {
        Object.values(clickTrackerRef.current).forEach(entry => {
            if (entry.timeoutId) clearTimeout(entry.timeoutId);
        });

        Object.values(pendingDoubleRef.current).forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
    }, []);

    const entries = React.useMemo(() => {
        const presetFiltered = filterByTier(activeTab, getAll(), activePresetCount);
        return search(query, presetFiltered);
    }, [activeTab, query, version, activePresetCount]);

    const openContextMenuAt = React.useCallback((entry: SavedMessage, x: number, y: number) => {
        const maxX = typeof window !== "undefined" ? window.innerWidth - 240 : x;
        const maxY = typeof window !== "undefined" ? window.innerHeight - 160 : y;

        setContextMenu({
            entry,
            x: Math.max(8, Math.min(maxX, x)),
            y: Math.max(8, Math.min(maxY, y)),
            showMoveMenu: false
        });
    }, []);

    const onDownloadMedia = React.useCallback(async (entry: SavedMessage) => {
        const mediaAttachments = getMediaAttachments(entry);

        if (!mediaAttachments.length) {
            showToast("Nothing to insert for this message", Toasts.Type.MESSAGE);
            return;
        }

        try {
            for (let i = 0; i < mediaAttachments.length; i++) {
                const attachment = mediaAttachments[i];
                await downloadAttachment(attachment, `messagetiers-${entry.messageId}-${i + 1}`);
            }

            showToast("Download started", Toasts.Type.SUCCESS);
        } catch {
            showToast("Download failed — try copying the link manually", Toasts.Type.FAILURE);
        }
    }, []);

    const onDoubleClickInsert = React.useCallback((entry: SavedMessage) => {
        const messageText = entry.content.trim();
        const gifFromContent = isGifLink(messageText) ? messageText : "";
        const gifFromAttachment = getGifAttachment(entry) || "";
        const mediaAttachments = getMediaAttachments(entry);

        if (!messageText && !gifFromContent && !gifFromAttachment && mediaAttachments.length > 0) {
            try {
                const toastApi = Toasts as unknown as {
                    show?: (payload: Record<string, unknown>) => void;
                    genId?: () => string;
                };

                if (typeof toastApi.show === "function") {
                    toastApi.show({
                        id: toastApi.genId?.(),
                        message: "Can't insert media — click to download",
                        type: Toasts.Type.MESSAGE,
                        onClick: () => { void onDownloadMedia(entry); }
                    });
                } else {
                    showToast("Can't insert media — click to download", Toasts.Type.MESSAGE);
                }
            } catch {
                showToast("Can't insert media — click to download", Toasts.Type.MESSAGE);
            }

            return;
        }

        const insertable = messageText || gifFromContent || gifFromAttachment || entry.messageLink;

        if (!insertable) {
            showToast("Nothing to insert for this message", Toasts.Type.MESSAGE);
            return;
        }

        if (!hasChatInputAvailable()) {
            showToast("No active chat input found", Toasts.Type.MESSAGE);
            return;
        }

        try {
            insertTextIntoChatInputBox(insertable);
            showToast("Inserted into chat input", Toasts.Type.SUCCESS);
        } catch {
            // Silent fallback for missing internals.
        }
    }, [onDownloadMedia]);

    const onCardClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>, entry: SavedMessage) => {
        event.preventDefault();
        event.stopPropagation();

        const tracker = clickTrackerRef.current[entry.messageId] ?? { count: 0 };
        tracker.count += 1;

        if (tracker.timeoutId) {
            clearTimeout(tracker.timeoutId);
            tracker.timeoutId = void 0;
        }

        if (tracker.count >= 3) {
            tracker.count = 0;

            const pending = pendingDoubleRef.current[entry.messageId];
            if (pending) {
                clearTimeout(pending);
                delete pendingDoubleRef.current[entry.messageId];
            }

            tripleTriggerRef.current = {
                messageId: entry.messageId,
                at: Date.now()
            };

            openContextMenuAt(entry, event.clientX, event.clientY);

            clickTrackerRef.current[entry.messageId] = tracker;
            return;
        }

        tracker.timeoutId = window.setTimeout(() => {
            if (tracker.count === 1) {
                jumpToSavedMessage(entry, modalProps.onClose);
            }

            tracker.count = 0;
            tracker.timeoutId = void 0;
        }, CLICK_WINDOW_MS);

        clickTrackerRef.current[entry.messageId] = tracker;
    }, [modalProps.onClose, openContextMenuAt]);

    const onCardDoubleClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>, entry: SavedMessage) => {
        event.preventDefault();
        event.stopPropagation();

        const existing = pendingDoubleRef.current[entry.messageId];
        if (existing) clearTimeout(existing);

        pendingDoubleRef.current[entry.messageId] = window.setTimeout(() => {
            const triple = tripleTriggerRef.current;
            if (triple && triple.messageId === entry.messageId && Date.now() - triple.at <= CLICK_WINDOW_MS + 40) {
                return;
            }

            onDoubleClickInsert(entry);
        }, CLICK_WINDOW_MS + 20);
    }, [onDoubleClickInsert]);

    const onCardContextMenu = React.useCallback((event: React.MouseEvent<HTMLDivElement>, entry: SavedMessage) => {
        event.preventDefault();
        event.stopPropagation();

        const tracker = clickTrackerRef.current[entry.messageId];
        if (tracker?.timeoutId) clearTimeout(tracker.timeoutId);
        if (tracker) {
            tracker.count = 0;
            tracker.timeoutId = void 0;
            clickTrackerRef.current[entry.messageId] = tracker;
        }

        const pending = pendingDoubleRef.current[entry.messageId];
        if (pending) {
            clearTimeout(pending);
            delete pendingDoubleRef.current[entry.messageId];
        }

        openContextMenuAt(entry, event.clientX, event.clientY);
    }, [openContextMenuAt]);

    const closeContextMenu = React.useCallback((event?: React.MouseEvent<HTMLElement>) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        setContextMenu(null);
    }, []);

    const copyWithToast = React.useCallback(async (event: React.MouseEvent<HTMLElement>, text: string, successMessage: string) => {
        event.preventDefault();
        event.stopPropagation();

        try {
            await copyToClipboard(text);
            showToast(successMessage, Toasts.Type.SUCCESS);
        } catch {
            showToast("Copy failed", Toasts.Type.FAILURE);
        }

        setContextMenu(null);
    }, []);

    const moveEntryToTier = React.useCallback((event: React.MouseEvent<HTMLElement>, entry: SavedMessage, tier: Tier) => {
        event.preventDefault();
        event.stopPropagation();

        const result = upsertWithTier(buildSaveInput(entry), tier);
        bumpVersion();

        if (result.evicted) {
            showToast("MessageTiers: oldest saved message was removed to respect your max limit.", Toasts.Type.MESSAGE);
        }

        showToast(`Moved to ${getTierLabel(tier)}.`, Toasts.Type.SUCCESS);
        setContextMenu(null);
    }, []);

    const updatePresetLabel = React.useCallback((tier: Tier, value: string) => {
        setPresetLabel(tier, value);
        bumpVersion();
    }, []);

    const updatePresetCount = React.useCallback((value: string) => {
        const next = Number.parseInt(value, 10);
        if (!Number.isFinite(next)) return;

        setActivePresetCount(next);
        bumpVersion();
    }, []);

    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE} className="vc-messagetiers-modal-root" fullscreenOnMobile>
            <ModalHeader>
                <div style={{ flexGrow: 1 }}>
                    <Text variant="heading-lg/semibold">
                        MessageTiers Viewer
                    </Text>
                    <Text variant="text-xs/normal" color="text-muted">
                        Author: {AUTHOR_NAME} ({AUTHOR_ID})
                    </Text>
                </div>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent className="vc-messagetiers-modal-content">
                <div data-vc-messagetiers-root>
                    <div data-vc-messagetiers-search-wrap>
                        <input
                            data-vc-messagetiers-search
                            type="text"
                            value={query}
                            onChange={event => setQuery(event.currentTarget.value)}
                            placeholder="Search by message content, author, or server"
                        />
                        <button
                            data-vc-messagetiers-settings-toggle
                            type="button"
                            onClick={() => setShowSettingsPanel(value => !value)}
                        >
                            {showSettingsPanel ? "Close Settings" : "Settings"}
                        </button>
                    </div>

                    {showSettingsPanel && (
                        <div data-vc-messagetiers-settings>
                            <div data-vc-messagetiers-settings-row>
                                <label data-vc-messagetiers-settings-label>
                                    Active Presets (1-9)
                                    <input
                                        data-vc-messagetiers-settings-input
                                        type="number"
                                        min={1}
                                        max={9}
                                        value={String(activePresetCount)}
                                        onChange={event => updatePresetCount(event.currentTarget.value)}
                                    />
                                </label>

                                <label data-vc-messagetiers-settings-check>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(ui.blurViewerContent)}
                                        onChange={event => {
                                            settings.store.blurViewerContent = event.currentTarget.checked;
                                            bumpVersion();
                                        }}
                                    />
                                    Blur message content
                                </label>
                            </div>

                            <div data-vc-messagetiers-preset-grid>
                                {ALL_PRESET_IDS.map(tier => (
                                    <label key={tier} data-vc-messagetiers-settings-label>
                                        Preset {tier}
                                        <input
                                            data-vc-messagetiers-settings-input
                                            type="text"
                                            value={getTierLabel(tier)}
                                            onChange={event => updatePresetLabel(tier, event.currentTarget.value)}
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <TabBar
                        type="top"
                        look="brand"
                        selectedItem={activeTab}
                        onItemSelect={item => setActiveTab(item as TierFilter)}
                        style={{ marginBottom: 12 }}
                    >
                        {tabOrder.map(tab => (
                            <TabBar.Item key={String(tab)} id={tab}>
                                {getTabLabel(tab)}
                            </TabBar.Item>
                        ))}
                    </TabBar>

                    {entries.length === 0 && (
                        <Text variant="text-sm/normal" color="text-muted">
                            No saved messages match the current filter.
                        </Text>
                    )}

                    <div data-vc-messagetiers-list>
                        {entries.map(entry => {
                            const hasMedia = getMediaAttachments(entry).length > 0;

                            return (
                                <div
                                    data-vc-messagetiers-card
                                    key={entry.messageId}
                                    role="button"
                                    onClick={event => onCardClick(event, entry)}
                                    onDoubleClick={event => onCardDoubleClick(event, entry)}
                                    onContextMenu={event => onCardContextMenu(event, entry)}
                                >
                                    <div data-vc-messagetiers-card-head>
                                        <Text variant="text-sm/medium">{entry.authorTag}</Text>
                                        <div data-vc-messagetiers-actions>
                                            {hasMedia && (
                                                <button
                                                    data-vc-messagetiers-download
                                                    type="button"
                                                    onClick={event => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        void onDownloadMedia(entry);
                                                    }}
                                                >
                                                    Download media
                                                </button>
                                            )}

                                            <button
                                                data-vc-messagetiers-delete
                                                type="button"
                                                onClick={event => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    const removed = remove(entry.messageId);
                                                    if (removed) {
                                                        showToast("Removed from MessageTiers.", Toasts.Type.SUCCESS);
                                                        bumpVersion();
                                                    }
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>

                                    <Text data-vc-messagetiers-meta variant="text-xs/normal" color="text-muted">
                                        {resolveServerName(entry)} • {new Date(entry.timestamp).toLocaleString()}
                                    </Text>

                                    <div
                                        data-vc-messagetiers-content={ui.blurViewerContent ? "blurred" : "clear"}
                                        style={{
                                            filter: ui.blurViewerContent ? "blur(4px)" : "none",
                                            transition: "filter 120ms ease"
                                        }}
                                    >
                                        {entry.content || "[No text content]"}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {contextMenu && (
                        <div
                            ref={contextMenuRef}
                            data-vc-messagetiers-context
                            style={{
                                top: contextMenu.y,
                                left: contextMenu.x,
                                position: "fixed"
                            }}
                            onMouseLeave={() => setContextMenu(null)}
                            onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                        >
                            <button
                                data-vc-messagetiers-context-item
                                type="button"
                                onClick={event => {
                                    void copyWithToast(event, contextMenu.entry.content, "Message content copied");
                                }}
                            >
                                Copy message content
                            </button>

                            <button
                                data-vc-messagetiers-context-item
                                type="button"
                                onClick={event => {
                                    void copyWithToast(event, contextMenu.entry.messageLink, "Message link copied");
                                }}
                            >
                                Copy message link
                            </button>

                            <button
                                data-vc-messagetiers-context-item
                                type="button"
                                onClick={event => {
                                    void copyWithToast(event, contextMenu.entry.authorTag, "Author tag copied");
                                }}
                            >
                                Copy author tag
                            </button>

                            <button
                                data-vc-messagetiers-context-item
                                type="button"
                                onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setContextMenu(state => state ? { ...state, showMoveMenu: !state.showMoveMenu } : state);
                                }}
                            >
                                Move to preset
                            </button>

                            {contextMenu.showMoveMenu && (
                                <div data-vc-messagetiers-context-submenu>
                                    {activePresets.map(tier => (
                                        <button
                                            key={tier}
                                            data-vc-messagetiers-context-item
                                            type="button"
                                            onClick={event => moveEntryToTier(event, contextMenu.entry, tier)}
                                        >
                                            {getTierLabel(tier)}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {getMediaAttachments(contextMenu.entry).length > 0 && (
                                <button
                                    data-vc-messagetiers-context-item
                                    type="button"
                                    onClick={event => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setContextMenu(null);
                                        void onDownloadMedia(contextMenu.entry);
                                    }}
                                >
                                    Download attachment
                                </button>
                            )}

                            <button
                                data-vc-messagetiers-context-item
                                data-vc-messagetiers-context-danger
                                type="button"
                                onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    const removed = remove(contextMenu.entry.messageId);
                                    if (removed) {
                                        showToast("Removed from MessageTiers.", Toasts.Type.SUCCESS);
                                        bumpVersion();
                                    }
                                    setContextMenu(null);
                                }}
                            >
                                Delete entry
                            </button>

                            <button
                                data-vc-messagetiers-context-item
                                type="button"
                                onClick={closeContextMenu}
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

const ViewerModal = ErrorBoundary.wrap(ViewerModalComponent, { noop: true });

export function openMessageTiersViewerModal() {
    openModal(modalProps => <ViewerModal modalProps={modalProps} />);
}

export default ViewerModal;

