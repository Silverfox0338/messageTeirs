export type Tier = 1 | 2 | 3;
export type TierState = Tier | 0;
export type TierFilter = "all" | Tier;

export type SavedMessage = {
    messageId: string;
    channelId: string;
    guildId?: string;
    content: string;
    authorId: string;
    authorTag: string;
    timestamp: number;
    savedAt: number;
    tier: Tier;
};

export type SaveMessageInput = Omit<SavedMessage, "savedAt" | "tier">;

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
