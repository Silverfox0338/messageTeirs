export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type TierState = Tier | 0;
export type TierFilter = "all" | "archived" | Tier;

export type SavedAttachment = {
    url: string;
    filename?: string;
    contentType?: string;
    isImage?: boolean;
    isVideo?: boolean;
    isGif?: boolean;
};

export type SavedMessage = {
    messageId: string;
    channelId: string;
    guildId?: string;
    messageLink: string;
    content: string;
    authorId: string;
    authorTag: string;
    timestamp: number;
    savedAt: number;
    attachments?: SavedAttachment[];
    tier: Tier;
};

export type SaveMessageInput = Omit<SavedMessage, "savedAt" | "tier" | "messageLink">;

export type UpsertResult = {
    action: "saved" | "updated";
    entry: SavedMessage;
    evicted?: SavedMessage;
};

export type CycleTierResult = {
    action: "saved" | "updated" | "removed";
    tier?: Tier;
    entry?: SavedMessage;
    removed?: SavedMessage;
    evicted?: SavedMessage;
};
