import { copyToClipboard } from "@utils/clipboard";
import { insertTextIntoChatInputBox } from "@utils/discord";
import ErrorBoundary from "@components/ErrorBoundary";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { GuildStore, MessageActions, NavigationRouter, React, TabBar, Text, Toasts, showToast } from "@webpack/common";

import settings from "../settings";
import { filterByTier, getAll, remove, search, subscribeToStoreUpdates, upsertWithTier } from "../store/messageStore";
import type { SaveMessageInput, SavedAttachment, SavedMessage, Tier, TierFilter } from "../types";

const TierTabOrder: TierFilter[] = ["all", 1, 2, 3, 4, 5, 6, 7, 8, 9];
const CLICK_WINDOW_MS = 300;

type ViewerUiSettings = {
    tier1Label?: string;
    tier2Label?: string;
    tier3Label?: string;
};

type ContextMenuState = {
    entry: SavedMessage;
    x: number;
    y: number;
    showMoveMenu: boolean;
};

function getTabLabel(tab: TierFilter, ui: ViewerUiSettings) {
    if (tab === "all") return "All";
    if (tab === 1) return ui.tier1Label || "Important";
    if (tab === 2) return ui.tier2Label || "Quote";
    if (tab === 3) return ui.tier3Label || "Favorite";
    return `Preset ${tab}`;
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
    const ui = settings.use(["tier1Label", "tier2Label", "tier3Label", "blurViewerContent"]);

    const [activeTab, setActiveTab] = React.useState<TierFilter>("all");
    const [query, setQuery] = React.useState("");
    const [version, bumpVersion] = React.useReducer((value: number) => value + 1, 0);
    const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null);

    const contextMenuRef = React.useRef<HTMLDivElement | null>(null);
    const clickTrackerRef = React.useRef<Record<string, { count: number; timeoutId?: number; }>>({});
    const pendingDoubleRef = React.useRef<Record<string, number>>({});
    const tripleTriggerRef = React.useRef<{ messageId: string; at: number; } | null>(null);

    React.useEffect(() => subscribeToStoreUpdates(() => bumpVersion()), []);

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
        const tierFiltered = filterByTier(activeTab, getAll());
        return search(query, tierFiltered);
    }, [activeTab, query, version]);

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

            setContextMenu({
                entry,
                x: event.clientX,
                y: event.clientY,
                showMoveMenu: false
            });

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
    }, [modalProps.onClose]);

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

        showToast(`Moved to ${getTabLabel(tier, ui)}.`, Toasts.Type.SUCCESS);
        setContextMenu(null);
    }, [ui]);

    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE} className="vc-messagetiers-modal-root" fullscreenOnMobile>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>
                    MessageTiers Viewer
                </Text>
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
                    </div>

                    <TabBar
                        type="top"
                        look="brand"
                        selectedItem={activeTab}
                        onItemSelect={item => setActiveTab(item as TierFilter)}
                        style={{ marginBottom: 12 }}
                    >
                        {TierTabOrder.map(tab => (
                            <TabBar.Item key={String(tab)} id={tab}>
                                {getTabLabel(tab, ui)}
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
                                top: Math.max(8, contextMenu.y),
                                left: Math.max(8, contextMenu.x),
                                position: "fixed"
                            }}
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
                                    {(TierTabOrder.filter(value => value !== "all") as Tier[]).map(tier => (
                                        <button
                                            key={tier}
                                            data-vc-messagetiers-context-item
                                            type="button"
                                            onClick={event => moveEntryToTier(event, contextMenu.entry, tier)}
                                        >
                                            {getTabLabel(tier, ui)}
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
