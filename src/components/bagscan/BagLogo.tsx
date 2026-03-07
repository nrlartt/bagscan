interface BagLogoProps {
    size?: number;
    className?: string;
    glow?: boolean;
}

export function BagLogo({ size = 32, className, glow = true }: BagLogoProps) {
    const id = `bag-glow-${size}`;
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                {glow && (
                    <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                        <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0  0 0 0 0 1  0 0 0 0 0.25  0 0 0 0.5 0" result="glow" />
                        <feMerge>
                            <feMergeNode in="glow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                )}
                <linearGradient id={`${id}-grad`} x1="50" y1="8" x2="50" y2="92" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#33ff66" />
                    <stop offset="100%" stopColor="#00cc33" />
                </linearGradient>
            </defs>

            <g filter={glow ? `url(#${id})` : undefined}>
                {/* Bag knot – rounded top piece */}
                <path
                    d="M38 18 C38 10, 62 10, 62 18 C62 23, 58 25, 55 25 L45 25 C42 25, 38 23, 38 18Z"
                    fill={`url(#${id}-grad)`}
                />

                {/* Neck gap */}
                <path
                    d="M42 25 L42 30 C42 30, 44 31, 50 31 C56 31, 58 30, 58 30 L58 25"
                    fill="black"
                />

                {/* Bag body – smooth rounded pouch */}
                <path
                    d="M28 42
                       C28 34, 35 30, 50 30
                       C65 30, 72 34, 72 42
                       C73 50, 74 60, 72 68
                       C70 76, 62 82, 50 82
                       C38 82, 30 76, 28 68
                       C26 60, 27 50, 28 42Z"
                    fill={`url(#${id}-grad)`}
                />

                {/* Inner highlight – subtle shine on body */}
                <path
                    d="M36 44
                       C36 38, 42 35, 50 35
                       C55 35, 58 37, 59 40
                       C56 38, 50 36, 44 37
                       C38 38, 36 41, 36 44Z"
                    fill="rgba(255,255,255,0.12)"
                />

                {/* Scan line across body – CRT accent */}
                <line x1="32" y1="55" x2="68" y2="55" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
                <line x1="30" y1="62" x2="70" y2="62" stroke="rgba(0,0,0,0.1)" strokeWidth="0.8" />
                <line x1="33" y1="48" x2="67" y2="48" stroke="rgba(0,0,0,0.08)" strokeWidth="0.6" />
            </g>
        </svg>
    );
}
