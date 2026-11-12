const paths: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  matters: <path d="M3 6h7l2 2h9v12H3z" />,
  agents: <path d="M12 2v7m0 6v7M2 12h7m6 0h7" />,
  precedents: <path d="M5 3v18M10 3v18m4-17 5 17" />,
  notices: <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zm4 5h4" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" />
      <path d="M3 10h18M8 2v6m8-6v6" />
    </>
  ),
  documents: (
    <>
      <path d="M6 2h8l5 5v15H6z" />
      <path d="M14 2v6h5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
    </>
  ),
  search: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  plus: <path d="M12 4v16M4 12h16" />,
  send: <path d="m3 11 18-8-6 18-4-8zm8 2L21 3" />,
  close: <path d="m5 5 14 14M5 19 19 5" />,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5" />,
  edit: <path d="m4 16 12-12 4 4L8 20H4zm10-10 4 4" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  court: <path d="m3 8 9-5 9 5H3zm2 3v7m7-7v7m7-7v7M2 21h20" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
};
export default function Icon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {paths[name] || paths.documents}
    </svg>
  );
}
