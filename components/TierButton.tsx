import ErrorBoundary from "@components/ErrorBoundary";
import type { IconProps } from "@utils/types";

import type { TierState } from "../types";

export function UnsetTierIcon({ width = 16, height = 16, className }: IconProps) {
    return (
        <svg width={width} height={height} viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
            <path
                d="M2.5 3.5C2.5 2.67 3.17 2 4 2h5.03c.4 0 .78.16 1.06.44l3.47 3.47a1.5 1.5 0 0 1 0 2.12l-4.03 4.03a1.5 1.5 0 0 1-2.12 0L2.94 7.6a1.5 1.5 0 0 1-.44-1.06V3.5Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
            />
            <circle cx="5.3" cy="5" r="1" fill="currentColor" />
        </svg>
    );
}

export function TierOneIcon({ width = 16, height = 16, className }: IconProps) {
    return (
        <svg width={width} height={height} viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
            <path
                d="M2.5 3.5C2.5 2.67 3.17 2 4 2h5.03c.4 0 .78.16 1.06.44l3.47 3.47a1.5 1.5 0 0 1 0 2.12l-4.03 4.03a1.5 1.5 0 0 1-2.12 0L2.94 7.6a1.5 1.5 0 0 1-.44-1.06V3.5Z"
                fill="currentColor"
            />
            <circle cx="5.3" cy="5" r="1" fill="currentColor" fillOpacity="0.55" />
        </svg>
    );
}

export function TierTwoIcon({ width = 16, height = 16, className }: IconProps) {
    return (
        <svg width={width} height={height} viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
            <path
                d="M3 3h10a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 13 11h-5L4.2 13.65c-.33.22-.7-.03-.7-.43V11H3A1.5 1.5 0 0 1 1.5 9.5v-5A1.5 1.5 0 0 1 3 3Z"
                fill="currentColor"
            />
            <circle cx="5.2" cy="7" r=".8" fill="currentColor" fillOpacity="0.55" />
            <circle cx="8" cy="7" r=".8" fill="currentColor" fillOpacity="0.55" />
            <circle cx="10.8" cy="7" r=".8" fill="currentColor" fillOpacity="0.55" />
        </svg>
    );
}

export function TierThreeIcon({ width = 16, height = 16, className }: IconProps) {
    return (
        <svg width={width} height={height} viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
            <path
                d="m8 1.75 1.8 3.64 4.02.59-2.91 2.84.69 4.01L8 10.94l-3.6 1.89.69-4.01-2.91-2.84 4.02-.59L8 1.75Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="0.6"
                strokeLinejoin="round"
            />
        </svg>
    );
}

const TierColors: Record<TierState, string> = {
    0: "var(--interactive-muted, #80848e)",
    1: "var(--text-warning, #f0b232)",
    2: "var(--text-link, #5da9ff)",
    3: "var(--yellow-300, #e7b85a)"
};

interface TierButtonProps extends IconProps {
    tier: TierState;
}

function TierButtonComponent({ tier, width = 16, height = 16, className }: TierButtonProps) {
    const Icon = tier === 1
        ? TierOneIcon
        : tier === 2
            ? TierTwoIcon
            : tier === 3
                ? TierThreeIcon
                : UnsetTierIcon;

    return (
        <span
            data-vc-messagetiers-icon
            className={className}
            style={{ color: TierColors[tier], display: "inline-flex", lineHeight: 0, isolation: "isolate" }}
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
