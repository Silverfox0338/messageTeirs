import type { Message } from "@vencord/discord-types";
import { ChannelStore, FluxDispatcher, GuildStore } from "@webpack/common";

import settings, { DEFAULT_MAX_SAVED_MESSAGES, getActivePresetCount, MAX_PRESET_COUNT } from "../settings";
import type {
    CycleTierResult,
    SaveMessageInput,
    SavedAttachment,
    SavedMessage,
    Tier,
    TierFilter,
    UpsertResult
} from "../types";

const STORE_UPDATE_EVENT = "MESSAGETIERS_STORE_UPDATE";

function isTier(value: unknown): value is Tier {
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_PRESET_COUNT;
}

function toNumber(value: unknown, fallback: number) {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (value instanceof Date) {
        const ts = value.getTime();
        return Number.isFinite(ts) ? ts : fallback;
    }

    if (typeof value === "string") {
        const ts = Date.parse(value);
        return Number.isFinite(ts) ? ts : fallback;
    }

    if (value && typeof value === "object" && typeof (value as { valueOf?: () => unknown; }).valueOf === "function") {
        const ts = (value as { valueOf: () => unknown; }).valueOf();
        if (typeof ts === "number" && Number.isFinite(ts)) return ts;
    }

    return fallback;
}

function normalizeMaxSavedMessages() {
    const value = Number(settings.store.maxSavedMessages);
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_SAVED_MESSAGES;
    return Math.floor(value);
}

function buildMessageLink(guildId: string | undefined, channelId: string, messageId: string) {
    return `https://discord.com/channels/${guildId ?? "@me"}/${channelId}/${messageId}`;
}

function inferExtension(filename = "") {
    const dot = filename.lastIndexOf(".");
    if (dot === -1) return "";
    return filename.slice(dot + 1).toLowerCase();
}

function normalizeAttachment(value: unknown): SavedAttachment | null {
    if (!value || typeof value !== "object") return null;

    const maybe = value as Partial<SavedAttachment>;
    if (!maybe.url || typeof maybe.url !== "string") return null;

    const filename = typeof maybe.filename === "string" ? maybe.filename : "";
    const contentType = typeof maybe.contentType === "string" ? maybe.contentType : "";
    const ext = inferExtension(filename);

    const isGif = Boolean(maybe.isGif)
        || contentType.toLowerCase().includes("gif")
        || ext === "gif"
        || maybe.url.toLowerCase().includes(".gif");

    const isImage = Boolean(maybe.isImage)
        || contentType.toLowerCase().startsWith("image/")
        || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"].includes(ext)
        || /\.(png|jpe?g|webp|gif|bmp|avif)(\?|$)/i.test(maybe.url);

    const isVideo = Boolean(maybe.isVideo)
        || contentType.toLowerCase().startsWith("video/")
        || ["mp4", "webm", "mov", "m4v", "mkv"].includes(ext)
        || /\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(maybe.url);

    return {
        url: maybe.url,
        filename: filename || void 0,
        contentType: contentType || void 0,
        isImage,
        isVideo,
        isGif
    };
}

function normalizeSavedMessage(value: unknown): SavedMessage | null {
    if (!value || typeof value !== "object") return null;

    const maybe = value as Partial<SavedMessage>;
    if (!maybe.messageId || !maybe.channelId || !maybe.authorId || !maybe.authorTag || !isTier(maybe.tier)) return null;

    const messageId = String(maybe.messageId);
    const channelId = String(maybe.channelId);
    const guildId = maybe.guildId ? String(maybe.guildId) : void 0;

    const attachments = Array.isArray(maybe.attachments)
        ? maybe.attachments.map(normalizeAttachment).filter((entry): entry is SavedAttachment => entry !== null)
        : [];

    return {
        messageId,
        channelId,
        guildId,
        messageLink: typeof maybe.messageLink === "string" && maybe.messageLink.length > 0
            ? maybe.messageLink
            : buildMessageLink(guildId, channelId, messageId),
        content: typeof maybe.content === "string" ? maybe.content : "",
        authorId: String(maybe.authorId),
        authorTag: String(maybe.authorTag),
        timestamp: toNumber(maybe.timestamp, Date.now()),
        savedAt: toNumber(maybe.savedAt, Date.now()),
        attachments,
        tier: maybe.tier
    };
}

function dedupeByMessageId(messages: SavedMessage[]) {
    const map = new Map<string, SavedMessage>();

    for (const entry of messages) {
        const existing = map.get(entry.messageId);
        if (!existing || existing.savedAt < entry.savedAt) {
            map.set(entry.messageId, entry);
        }
    }

    return Array.from(map.values());
}

function saveStore(messages: SavedMessage[], notify = true) {
    settings.store.savedMessages = messages;
    if (notify) emitStoreUpdate();
}

function getSanitizedStore() {
    const raw = Array.isArray(settings.store.savedMessages)
        ? settings.store.savedMessages
        : [];

    const normalized = raw
        .map(normalizeSavedMessage)
        .filter((entry): entry is SavedMessage => entry !== null);

    const deduped = dedupeByMessageId(normalized);

    const changed = deduped.length !== raw.length
        || deduped.some((entry, index) => {
            const rawEntry = raw[index] as SavedMessage | undefined;
            return rawEntry?.messageId !== entry.messageId
                || rawEntry?.savedAt !== entry.savedAt
                || rawEntry?.messageLink !== entry.messageLink
                || rawEntry?.tier !== entry.tier;
        });

    if (changed) saveStore(deduped, false);

    return deduped;
}

export function emitStoreUpdate() {
    try {
        FluxDispatcher?.dispatch?.({ type: STORE_UPDATE_EVENT });
    } catch {
        // Silent fallback for missing internals.
    }
}

export function subscribeToStoreUpdates(listener: () => void) {
    const callback = () => listener();

    try {
        FluxDispatcher?.subscribe?.(STORE_UPDATE_EVENT, callback);
    } catch {
        return () => void 0;
    }

    return () => {
        try {
            FluxDispatcher?.unsubscribe?.(STORE_UPDATE_EVENT, callback);
        } catch {
            // Silent fallback for missing internals.
        }
    };
}

export function getAll() {
    return [...getSanitizedStore()].sort((a, b) => b.savedAt - a.savedAt);
}

export function getByMessageId(messageId: string) {
    return getSanitizedStore().find(entry => entry.messageId === messageId);
}

export function upsertWithTier(input: SaveMessageInput, tier: Tier): UpsertResult {
    const now = Date.now();
    const normalizedInput: SaveMessageInput = {
        messageId: String(input.messageId),
        channelId: String(input.channelId),
        guildId: input.guildId ? String(input.guildId) : void 0,
        content: typeof input.content === "string" ? input.content : "",
        authorId: String(input.authorId),
        authorTag: String(input.authorTag),
        timestamp: toNumber(input.timestamp, now),
        attachments: Array.isArray(input.attachments)
            ? input.attachments.map(normalizeAttachment).filter((entry): entry is SavedAttachment => entry !== null)
            : []
    };

    const messages = getSanitizedStore();
    const existingIndex = messages.findIndex(entry => entry.messageId === normalizedInput.messageId);

    const entry: SavedMessage = {
        ...normalizedInput,
        savedAt: now,
        messageLink: buildMessageLink(normalizedInput.guildId, normalizedInput.channelId, normalizedInput.messageId),
        tier
    };

    const action = existingIndex === -1 ? "saved" : "updated";

    if (existingIndex === -1) {
        messages.push(entry);
    } else {
        messages[existingIndex] = entry;
    }

    let evicted: SavedMessage | undefined;
    const maxSavedMessages = normalizeMaxSavedMessages();

    if (messages.length > maxSavedMessages) {
        const sortedOldestFirst = [...messages].sort((a, b) => a.savedAt - b.savedAt);
        const toRemoveCount = messages.length - maxSavedMessages;
        const evictedItems = sortedOldestFirst.slice(0, toRemoveCount);
        const evictedIds = new Set(evictedItems.map(saved => saved.messageId));
        evicted = evictedItems[evictedItems.length - 1];

        for (let i = messages.length - 1; i >= 0; i--) {
            if (evictedIds.has(messages[i].messageId)) messages.splice(i, 1);
        }
    }

    saveStore(messages);

    return {
        action,
        entry,
        evicted
    };
}

export function remove(messageId: string) {
    const messages = getSanitizedStore();
    const index = messages.findIndex(entry => entry.messageId === messageId);
    if (index === -1) return null;

    const [removed] = messages.splice(index, 1);
    saveStore(messages);
    return removed;
}

export function cycleTier(input: SaveMessageInput): CycleTierResult {
    const activePresetCount = getActivePresetCount();
    const existing = getByMessageId(input.messageId);

    if (!existing) {
        const result = upsertWithTier(input, 1);
        return {
            action: result.action,
            tier: 1,
            entry: result.entry,
            evicted: result.evicted
        };
    }

    if (existing.tier > activePresetCount) {
        const result = upsertWithTier(input, 1);
        return {
            action: result.action,
            tier: 1,
            entry: result.entry,
            evicted: result.evicted
        };
    }

    if (existing.tier < activePresetCount) {
        const nextTier = (existing.tier + 1) as Tier;
        const result = upsertWithTier(input, nextTier);
        return {
            action: result.action,
            tier: nextTier,
            entry: result.entry,
            evicted: result.evicted
        };
    }

    const removed = remove(existing.messageId) ?? void 0;
    return {
        action: "removed",
        removed
    };
}

export function filterByTier(
    tier: TierFilter,
    source: SavedMessage[] = getAll(),
    activePresetCount = getActivePresetCount()
) {
    if (tier === "all") {
        return [...source];
    }

    if (tier === "archived") {
        return source.filter(entry => entry.tier > activePresetCount);
    }

    return source.filter(entry => entry.tier === tier);
}

export function search(query: string, source: SavedMessage[] = getAll()) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [...source];

    return source.filter(entry => {
        const guildName = entry.guildId ? GuildStore?.getGuild?.(entry.guildId)?.name ?? "" : "";

        return (
            entry.content.toLowerCase().includes(normalizedQuery)
            || entry.authorTag.toLowerCase().includes(normalizedQuery)
            || guildName.toLowerCase().includes(normalizedQuery)
        );
    });
}

function resolveAuthorTag(message: Message) {
    const author = message.author;
    if (!author) return "Unknown User";

    if (author.tag) return author.tag;

    if (author.discriminator && author.discriminator !== "0") {
        return `${author.username}#${author.discriminator}`;
    }

    if ((author as { globalName?: string; }).globalName) {
        return `${(author as { globalName?: string; }).globalName} (@${author.username})`;
    }

    return `@${author.username}`;
}

function extractSavedAttachments(message: Message): SavedAttachment[] {
    const rawAttachments = (message as { attachments?: Array<{ url?: string; filename?: string; content_type?: string; contentType?: string; }>; }).attachments;
    if (!Array.isArray(rawAttachments)) return [];

    return rawAttachments
        .map(attachment => normalizeAttachment({
            url: attachment.url,
            filename: attachment.filename,
            contentType: attachment.content_type ?? attachment.contentType
        }))
        .filter((entry): entry is SavedAttachment => entry !== null);
}

export function createSaveMessageInput(message: Message): SaveMessageInput {
    const channel = ChannelStore?.getChannel?.(message.channel_id);
    const timestamp = toNumber((message as { timestamp?: unknown; }).timestamp, Date.now());

    return {
        messageId: message.id,
        channelId: message.channel_id,
        guildId: (message as { guild_id?: string; }).guild_id ?? channel?.guild_id ?? void 0,
        content: typeof message.content === "string" ? message.content : "",
        authorId: message.author?.id ?? "0",
        authorTag: resolveAuthorTag(message),
        timestamp,
        attachments: extractSavedAttachments(message)
    };
}

