/**
 * Shared hero backdrop (homepage hero + Ask AI Bajan page): deep teal gradient with soft light,
 * a muted sun, beach umbrella, palm frond, bench and hill silhouette. Purely decorative.
 */
export function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(115deg,#0a2533_0%,#0b3343_38%,#0d5563_70%,#0e6b74_100%)]" />
      <div className="absolute -right-[10%] -top-[15%] h-[75%] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgba(64,201,193,0.28),transparent)]" />
      <div className="absolute -left-[15%] bottom-[-25%] h-[60%] w-[55%] rounded-full bg-[radial-gradient(closest-side,rgba(8,26,38,0.75),transparent)]" />
      <svg
        className="absolute bottom-0 right-0 h-[78%] w-auto max-w-none opacity-95 sm:h-[82%]"
        viewBox="0 0 640 720"
        fill="none"
        preserveAspectRatio="xMaxYMax meet"
      >
        {/* sun */}
        <circle cx="430" cy="300" r="64" fill="#5f8f86" opacity="0.65" />
        {/* umbrella */}
        <g stroke="#2aa3a0" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" opacity="0.85">
          <path d="M345 465 L400 375 L455 465 Z" />
          <path d="M400 345 L400 560" />
          <path d="M372 430 L428 430" />
        </g>
        {/* palm frond */}
        <path d="M520 640 C 530 560, 560 500, 640 470" stroke="#2aa3a0" strokeWidth="7" strokeLinecap="round" opacity="0.85" />
        <path d="M548 545 C 575 520, 605 515, 640 520" stroke="#2aa3a0" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
        <path d="M600 470 C 580 450, 560 448, 540 452" stroke="#2aa3a0" strokeWidth="6" strokeLinecap="round" opacity="0.7" />
        {/* bench */}
        <g stroke="#7aa6a4" strokeWidth="6" strokeLinecap="round" opacity="0.55">
          <path d="M75 520 L145 520" />
          <path d="M60 545 L160 545" />
          <path d="M80 520 L80 575 M140 520 L140 575" />
        </g>
        {/* hills */}
        <path d="M0 720 L0 640 C 120 560, 220 580, 300 610 C 380 520, 520 500, 640 560 L640 720 Z" fill="#0b2a36" opacity="0.92" />
        <path d="M160 720 C 260 650, 420 640, 640 690 L640 720 Z" fill="#14636a" opacity="0.6" />
      </svg>
    </div>
  );
}
