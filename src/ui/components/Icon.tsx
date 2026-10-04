// A small stroke icon set, drawn on a 20px grid so every icon shares one weight.
const PATHS = {
  close: 'M5 5l10 10M15 5L5 15',
  chevron: 'M7 8l3 3 3-3',
  check: 'M4.5 10.5l3.5 3.5 7.5-8',
  copy: 'M7 7h8v8H7zM5 13V5h8',
  download: 'M10 4v8m-3.5-3.5L10 12l3.5-3.5M5 15.5h10',
  upload: 'M10 13V5M6.5 8.5L10 5l3.5 3.5M5 15.5h10',
  trash: 'M5.5 6.5h9M8.5 6.5V5h3v1.5M7 6.5l.6 9h4.8l.6-9',
  external: 'M11 5h4v4M15 5l-6 6M13 11.5V15H5V7h3.5',
  warning: 'M10 4.5l6 10.5H4zM10 9v2.8M10 13.4v.1',
  undo: 'M7 6L4 9l3 3M4 9h7a4 4 0 010 8H9',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="mx-icon" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
