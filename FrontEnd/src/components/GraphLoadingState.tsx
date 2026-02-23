'use client';

/**
 * GraphLoadingState
 *
 * Displays an animated skeleton process-graph while data is being fetched.
 * No fake progress steps — just an honest "graph is coming" visual.
 */
export default function GraphLoadingState() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden select-none">

      {/* ── Backdrop ── */}
      <div className="absolute inset-0 bg-white/88 backdrop-blur-sm" />

      {/* ── Soft background blobs ── */}
      <div className="absolute w-[480px] h-[480px] rounded-full bg-blue-100/50 blur-3xl -top-40 -right-40 animate-pulse"
        style={{ animationDuration: "6s" }} />
      <div className="absolute w-[380px] h-[380px] rounded-full bg-indigo-100/40 blur-3xl -bottom-28 -left-28 animate-pulse"
        style={{ animationDuration: "8s", animationDelay: "1s" }} />

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-col items-center gap-8 graph-empty-state-card" dir="rtl">

        {/* Skeleton graph SVG */}
        <div className="relative">
          <svg
            width="520"
            height="220"
            viewBox="0 0 520 220"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="opacity-90"
          >
            <defs>
              {/* Shimmer gradient — sweeps left to right */}
              <linearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#e2e8f0" stopOpacity="1" />
                <stop offset="45%"  stopColor="#f1f5f9" stopOpacity="1" />
                <stop offset="55%"  stopColor="#cbd5e1" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#e2e8f0" stopOpacity="1" />
                <animateTransform
                  attributeName="gradientTransform"
                  type="translate"
                  from="-1 0"
                  to="2 0"
                  dur="1.8s"
                  repeatCount="indefinite"
                />
              </linearGradient>

              {/* Edge shimmer */}
              <linearGradient id="edge-shimmer" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#cbd5e1" stopOpacity="0.4" />
                <stop offset="50%"  stopColor="#94a3b8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.4" />
                <animateTransform
                  attributeName="gradientTransform"
                  type="translate"
                  from="-1 0"
                  to="2 0"
                  dur="2.2s"
                  repeatCount="indefinite"
                />
              </linearGradient>

              {/* Blue glow for active node */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* ── Edges (drawn behind nodes) ── */}
            {/* START → Node A */}
            <path d="M 80 110 C 110 110, 130 75, 160 75" stroke="url(#edge-shimmer)" strokeWidth="2.5" strokeLinecap="round" />
            {/* START → Node B */}
            <path d="M 80 110 C 110 110, 130 145, 160 145" stroke="url(#edge-shimmer)" strokeWidth="2.5" strokeLinecap="round" />
            {/* Node A → Node C */}
            <path d="M 240 75 C 265 75, 275 110, 310 110" stroke="url(#edge-shimmer)" strokeWidth="2.5" strokeLinecap="round" />
            {/* Node B → Node C */}
            <path d="M 240 145 C 265 145, 275 110, 310 110" stroke="url(#edge-shimmer)" strokeWidth="2.5" strokeLinecap="round" />
            {/* Node C → END */}
            <path d="M 390 110 L 440 110" stroke="url(#edge-shimmer)" strokeWidth="2.5" strokeLinecap="round" />

            {/* Animated flow dots on edges */}
            <circle r="4" fill="#3b82f6" opacity="0.7" filter="url(#glow)">
              <animateMotion dur="1.6s" repeatCount="indefinite" path="M 80 110 C 110 110, 130 75, 160 75" />
            </circle>
            <circle r="4" fill="#6366f1" opacity="0.7" filter="url(#glow)">
              <animateMotion dur="2s" repeatCount="indefinite" begin="0.6s" path="M 80 110 C 110 110, 130 145, 160 145" />
            </circle>
            <circle r="4" fill="#3b82f6" opacity="0.7" filter="url(#glow)">
              <animateMotion dur="1.8s" repeatCount="indefinite" begin="0.3s" path="M 240 75 C 265 75, 275 110, 310 110" />
            </circle>
            <circle r="4" fill="#6366f1" opacity="0.7" filter="url(#glow)">
              <animateMotion dur="1.8s" repeatCount="indefinite" begin="0.9s" path="M 240 145 C 265 145, 275 110, 310 110" />
            </circle>
            <circle r="4" fill="#3b82f6" opacity="0.7" filter="url(#glow)">
              <animateMotion dur="1.4s" repeatCount="indefinite" begin="0.2s" path="M 390 110 L 440 110" />
            </circle>

            {/* ── Skeleton Nodes ── */}

            {/* START node — circle */}
            <circle cx="50" cy="110" r="30" fill="url(#shimmer)" />
            {/* Inner line placeholder */}
            <rect x="30" y="106" width="40" height="8" rx="4" fill="#cbd5e1" opacity="0.5">
              <animate attributeName="opacity" values="0.5;0.9;0.5" dur="1.8s" repeatCount="indefinite" />
            </rect>

            {/* Node A */}
            <rect x="160" y="52" width="80" height="46" rx="12" fill="url(#shimmer)" />
            <rect x="172" y="64" width="56" height="9" rx="4" fill="#cbd5e1" opacity="0.5">
              <animate attributeName="opacity" values="0.5;0.9;0.5" dur="1.8s" begin="0.2s" repeatCount="indefinite" />
            </rect>
            <rect x="172" y="78" width="36" height="7" rx="3" fill="#cbd5e1" opacity="0.35">
              <animate attributeName="opacity" values="0.35;0.7;0.35" dur="1.8s" begin="0.2s" repeatCount="indefinite" />
            </rect>

            {/* Node B */}
            <rect x="160" y="122" width="80" height="46" rx="12" fill="url(#shimmer)" />
            <rect x="172" y="134" width="56" height="9" rx="4" fill="#cbd5e1" opacity="0.5">
              <animate attributeName="opacity" values="0.5;0.9;0.5" dur="1.8s" begin="0.5s" repeatCount="indefinite" />
            </rect>
            <rect x="172" y="148" width="44" height="7" rx="3" fill="#cbd5e1" opacity="0.35">
              <animate attributeName="opacity" values="0.35;0.7;0.35" dur="1.8s" begin="0.5s" repeatCount="indefinite" />
            </rect>

            {/* Node C — center hub */}
            <rect x="310" y="82" width="80" height="56" rx="12" fill="url(#shimmer)" />
            <rect x="322" y="96" width="56" height="9" rx="4" fill="#cbd5e1" opacity="0.5">
              <animate attributeName="opacity" values="0.5;0.9;0.5" dur="1.8s" begin="0.8s" repeatCount="indefinite" />
            </rect>
            <rect x="322" y="110" width="40" height="7" rx="3" fill="#cbd5e1" opacity="0.35">
              <animate attributeName="opacity" values="0.35;0.7;0.35" dur="1.8s" begin="0.8s" repeatCount="indefinite" />
            </rect>

            {/* END node — circle */}
            <circle cx="470" cy="110" r="30" fill="url(#shimmer)" />
            <rect x="450" y="106" width="40" height="8" rx="4" fill="#cbd5e1" opacity="0.5">
              <animate attributeName="opacity" values="0.5;0.9;0.5" dur="1.8s" begin="1s" repeatCount="indefinite" />
            </rect>
          </svg>
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-lg font-extrabold text-slate-700 tracking-tight">
            در حال ساخت گراف فرآیندی...
          </h2>
          <p className="text-slate-400 text-xs font-medium">لطفاً چند لحظه صبر کنید</p>
        </div>

        {/* Indeterminate progress bar */}
        <div className="w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full w-1/3 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-400 rounded-full"
            style={{
              animation: "loading-slide 1.6s ease-in-out infinite",
              backgroundSize: "200% 100%",
            }}
          />
        </div>
      </div>

      {/* ── Keyframe for indeterminate bar ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loading-slide {
          0%   { transform: translateX(-150%); }
          100% { transform: translateX(450%); }
        }
      `}} />
    </div>
  );
}
