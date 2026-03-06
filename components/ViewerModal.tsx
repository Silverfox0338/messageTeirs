import ErrorBoundary from "@components/ErrorBoundary";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { GuildStore, MessageActions, NavigationRouter, React, TabBar, Text, Toasts, showToast } from "@webpack/common";

import settings from "../settings";
import { filterByTier, getAll, remove, search, subscribeToStoreUpdates } from "../store/messageStore";
import type { SavedMessage, TierFilter } from "../types";

const TierTabOrder: TierFilter[] = ["all", 1, 2, 3];

type ViewerUiSettings = {
    tier1Label?: string;
    tier2Label?: string;
    tier3Label?: string;
};

function getTabLabel(tab: TierFilter, ui: ViewerUiSettings) {
    if (tab === "all") return "All";
    if (tab === 1) return ui.tier1Label || "Important";
    if (tab === 2) return ui.tier2Label || "Quote";
    return ui.tier3Label || "Favorite";
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

        if (typeof NavigationRouter?.transitionToChannel === "function") {
            NavigationRouter.transitionToChannel(entry.channelId);
            onClose();
        }
    } catch {
        // Silent fallback for missing internals.
    }
}

function ViewerModalComponent({ modalProps }: { modalProps: ModalProps; }) {
    const ui = settings.use(["tier1Label", "tier2Label", "tier3Label", "blurViewerContent"]);

    const [activeTab, setActiveTab] = React.useState<TierFilter>("all");
    const [query, setQuery] = React.useState("");
    const [version, bumpVersion] = React.useReducer((value: number) => value + 1, 0);

    React.useEffect(() => subscribeToStoreUpdates(() => bumpVersion()), []);

    const entries = React.useMemo(() => {
        const tierFiltered = filterByTier(activeTab, getAll());
        return search(query, tierFiltered);
    }, [activeTab, query, version]);

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
                        {entries.map(entry => (
                            <div
                                data-vc-messagetiers-card
                                key={entry.messageId}
                                role="button"
                                onClick={() => jumpToSavedMessage(entry, modalProps.onClose)}
                            >
                                <div data-vc-messagetiers-card-head>
                                    <Text variant="text-sm/medium">{entry.authorTag}</Text>
                                    <button
                                        data-vc-messagetiers-delete
                                        type="button"
                                        onClick={event => {
                                            event.stopPropagation();
                                            const removed = remove(entry.messageId);
                                            if (removed) showToast("Removed from MessageTiers.", Toasts.Type.SUCCESS);
                                        }}
                                    >
                                        Delete
                                    </button>
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
                        ))}
                    </div>
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
