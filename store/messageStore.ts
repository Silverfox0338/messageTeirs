import type { Message } from "@vencord/discord-types";
import { ChannelStore, FluxDispatcher, GuildStore } from "@webpack/common";

import settings, { DEFAULT_MAX_SAVED_MESSAGES } from "../settings";
import type {
    CycleTierResult,
    SaveMessageInput,
    SavedMessage,
    Tier,
    UpsertResult
} from "../types";

const STORE_UPDATE_EVENT = "MESSAGETIERS_STORE_UPDATE";

function isTier(value: unknown): value is Tier {
    return value === 1 || value === 2 || value === 3;
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

    return fallback;
}

function normalizeMaxSavedMessages() {
    const value = Number(settings.store.maxSavedMessages);
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_SAVED_MESSAGES;
    return Math.floor(value);
}

function normalizeSavedMessage(value: unknown): SavedMessage | null {
    if (!value || typeof value !== "object") return null;

    const maybe = value as Partial<SavedMessage>;
    if (!maybe.messageId || !maybe.channelId || !maybe.authorId || !maybe.authorTag || !isTier(maybe.tier)) return null;

    return {
        messageId: String(maybe.messageId),
        channelId: String(maybe.channelId),
        guildId: maybe.guildId ? String(maybe.guildId) : void 0,
        content: typeof maybe.content === "string" ? maybe.content : "",
        authorId: String(maybe.authorId),
        authorTag: String(maybe.authorTag),
        timestamp: toNumber(maybe.timestamp, Date.now()),
        savedAt: toNumber(maybe.savedAt, Date.now()),
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
        || deduped.some((entry, index) => raw[index]?.messageId !== entry.messageId || raw[index]?.savedAt !== entry.savedAt);

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
        timestamp: toNumber(input.timestamp, now)
    };

    const messages = getSanitizedStore();
    const existingIndex = messages.findIndex(entry => entry.messageId === normalizedInput.messageId);

    const entry: SavedMessage = {
        ...normalizedInput,
        savedAt: now,
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

    if (existing.tier === 1) {
        const result = upsertWithTier(input, 2);
        return {
            action: result.action,
            tier: 2,
            entry: result.entry,
            evicted: result.evicted
        };
    }

    if (existing.tier === 2) {
        const result = upsertWithTier(input, 3);
        return {
            action: result.action,
            tier: 3,
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

export function filterByTier(tier: Tier | "all", source: SavedMessage[] = getAll()) {
    if (tier === "all") return [...source];
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

    if ((author as any).globalName) {
        return `${(author as any).globalName} (@${author.username})`;
    }

    return `@${author.username}`;
}

export function createSaveMessageInput(message: Message): SaveMessageInput {
    const channel = ChannelStore?.getChannel?.(message.channel_id);
    const timestamp = toNumber((message as any).timestamp, Date.now());

    return {
        messageId: message.id,
        channelId: message.channel_id,
        guildId: (message as any).guild_id ?? channel?.guild_id ?? void 0,
        content: typeof message.content === "string" ? message.content : "",
        authorId: message.author?.id ?? "0",
        authorTag: resolveAuthorTag(message),
        timestamp
    };
}
