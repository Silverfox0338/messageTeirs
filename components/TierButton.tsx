import ErrorBoundary from "@components/ErrorBoundary";
import type { IconProps } from "@utils/types";

import type { TierState } from "../types";

export function UnsetTierIcon({ width = 18, height = 18, className }: IconProps) {
    return (
        <svg width={width} height={height} viewBox="0 0 18 18" className={className} fill="none" aria-hidden="true">
            <path
                d="M5.1 2.5h7.8A1.6 1.6 0 0 1 14.5 4.1v11c0 .56-.65.88-1.1.53L9 12.35l-4.4 3.28a.66.66 0 0 1-1.1-.53v-11c0-.88.72-1.6 1.6-1.6Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function TierOneIcon({ width = 18, height = 18, className }: IconProps) {
    return (
        <svg width={width} height={height} viewBox="0 0 18 18" className={className} fill="none" aria-hidden="true">
            <path
                d="M5.1 2.5h7.8A1.6 1.6 0 0 1 14.5 4.1v11c0 .56-.65.88-1.1.53L9 12.35l-4.4 3.28a.66.66 0 0 1-1.1-.53v-11c0-.88.72-1.6 1.6-1.6Z"
                fill="currentColor"
            />
        </svg>
    );
}

export function TierTwoIcon({ width = 18, height = 18, className }: IconProps) {
    return (
        <svg width={width} height={height} viewBox="0 0 18 18" className={className} fill="none" aria-hidden="true">
            <path
                d="M3.2 4.85c0-1.2.98-2.18 2.18-2.18h7.24c1.2 0 2.18.98 2.18 2.18v4.96c0 1.2-.98 2.18-2.18 2.18H8.7l-2.76 2.33c-.5.42-1.26.06-1.26-.59V12H5.4c-1.2 0-2.18-.98-2.18-2.18V4.85Z"
                fill="currentColor"
            />
            <path
                d="M6.35 8.55h1.25V6.9H6.1V8.1c0 .32.1.43.25.45Zm4 0h1.25V6.9H10.1V8.1c0 .32.1.43.25.45Z"
                fill="currentColor"
                fillOpacity="0.5"
            />
        </svg>
    );
}

export function TierThreeIcon({ width = 18, height = 18, className }: IconProps) {
    return (
        <svg width={width} height={height} viewBox="0 0 18 18" className={className} fill="none" aria-hidden="true">
            <path
                d="M9 2.35c.2 0 .38.1.47.28l1.57 3.2c.07.14.2.24.36.26l3.54.52c.43.07.61.6.3.9l-2.55 2.5a.5.5 0 0 0-.15.44l.61 3.52c.08.44-.4.77-.8.56l-3.17-1.67a.54.54 0 0 0-.48 0l-3.17 1.67c-.4.21-.88-.12-.8-.56l.61-3.52a.5.5 0 0 0-.15-.44L2.66 7.5c-.31-.3-.13-.83.3-.9l3.54-.52a.5.5 0 0 0 .36-.26l1.57-3.2A.53.53 0 0 1 9 2.35Z"
                fill="currentColor"
            />
        </svg>
    );
}

const TierPalette: Record<number, string> = {
    1: "var(--text-warning, #f0b232)",
    2: "var(--text-link, #5da9ff)",
    3: "var(--yellow-300, #e7b85a)",
    4: "var(--green-360, #3ba55d)",
    5: "var(--status-positive, #43b581)",
    6: "var(--red-345, #e05252)",
    7: "var(--brand-500, #5865f2)",
    8: "var(--orange-430, #f78b1f)",
    9: "var(--teal-360, #1abc9c)"
};

function getTierColor(tier: TierState) {
    if (tier === 0) return "var(--interactive-muted, #80848e)";
    return TierPalette[tier] ?? TierPalette[1];
}

interface TierButtonProps extends IconProps {
    tier: TierState;
}

function TierButtonComponent({ tier, width = 18, height = 18, className }: TierButtonProps) {
    const Icon = tier === 1
        ? TierOneIcon
        : tier === 2
            ? TierTwoIcon
            : tier === 3
                ? TierThreeIcon
                : tier > 0
                    ? TierOneIcon
                    : UnsetTierIcon;

    return (
        <span
            data-vc-messagetiers-icon
            className={className}
            style={{ color: getTierColor(tier), display: "inline-flex", lineHeight: 0, isolation: "isolate" }}
        >
            <Icon width={width} height={height} />
        </span>
    );
}

export const TierButton = ErrorBoundary.wrap(TierButtonComponent, { noop: true });

export function makeTierIcon(tier: TierState) {
    return function TierIcon(props: IconProps) {
        return <TierButton tier={tier} {...props} />;
    };
}

