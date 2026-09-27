type IconProps = { className?: string };

function Svg({ className = "w-7 h-7", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} text-primary`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const KitchenIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-3Z" />
    <path d="M2 11h2M20 11h2M9 7c0-1 1-1.5 1-2.5M13 7c0-1 1-1.5 1-2.5" />
  </Svg>
);

export const NurseIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);

export const InspectorIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

export const EduIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
    <path d="M7 10.5V15c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5" />
  </Svg>
);

export const ParentIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2" />
  </Svg>
);

export const TrainingIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m10 8.5 5 3.5-5 3.5v-7Z" />
  </Svg>
);

export const AlertIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 2.5 20h19L12 3Z" />
    <path d="M12 10v4M12 17h.01" />
  </Svg>
);

export const TraceIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <path d="M8 7.5 10.5 16M16 7.5 13.5 16M8.5 6h7" />
  </Svg>
);

export const ChartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="m7 15 4-4 3 3 5-6" />
  </Svg>
);

export const PhotoCheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" />
    <circle cx="12" cy="13" r="3.2" />
    <path d="m17.5 17 1.4 1.4 2.6-2.8" />
  </Svg>
);
