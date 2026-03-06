import ErrorBoundary from "@components/ErrorBoundary";
import type { IconProps } from "@utils/types";

import type { TierState } from "../types";

export function UnsetTierIcon({ width = 18, height = 18, className }: IconProps) {
    return (
        <svg width={width} height={height} viewBox="0 0 18 18" className={className} fill="none" aria-hidden="true">
            <path
                d="M5 2.5h8a1.5 1.5 0 0 1 1.5 1.5v11.25c0 .58-.67.9-1.12.54L9 12.5l-4.38 3.29A.75.75 0 0 1 3.5 15.25V4A1.5 1.5 0 0 1 5 2.5Z"
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
                d="M5 2.5h8a1.5 1.5 0 0 1 1.5 1.5v11.25c0 .58-.67.9-1.12.54L9 12.5l-4.38 3.29A.75.75 0 0 1 3.5 15.25V4A1.5 1.5 0 0 1 5 2.5Z"
                fill="currentColor"
            />
        </svg>
    );
}

export function TierTwoIcon({ width = 18, height = 18, className }: IconProps) {
    return (
        <svg width={width} height={height} viewBox="0 0 18 18" className={className} fill="none" aria-hidden="true">
            <path
                d="M3.25 4.75c0-1.1.9-2 2-2h7.5c1.1 0 2 .9 2 2v5.5c0 1.1-.9 2-2 2H8.8l-2.8 2.38c-.49.41-1.25.07-1.25-.57v-1.81H5.25c-1.1 0-2-.9-2-2v-5.5Z"
                fill="currentColor"
            />
            <path
                d="M6.4 8.7h1.25V6.9H6.1V8c0 .38.18.58.3.7Zm3.7 0h1.25V6.9H9.8V8c0 .38.18.58.3.7Z"
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
                d="M9 15.15c-.2 0-.38-.06-.54-.17-2.47-1.74-4.21-3.24-5.2-4.51C2.35 9.33 1.9 8.27 1.9 7.22c0-2.18 1.74-3.92 3.92-3.92 1.23 0 2.33.57 3.04 1.47A3.92 3.92 0 0 1 11.9 3.3c2.18 0 3.92 1.74 3.92 3.92 0 1.05-.45 2.11-1.35 3.25-.99 1.27-2.73 2.77-5.2 4.51-.16.11-.34.17-.54.17Z"
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
