export type IconName =
  | 'store'
  | 'box'
  | 'search'
  | 'cart'
  | 'route'
  | 'pulse'
  | 'users'
  | 'shield'
  | 'check'
  | 'arrow';

const paths: Record<IconName, string> = {
  store:
    'M3 9.5 4.6 4h14.8L21 9.5M4 9.5V20h16V9.5M4 9.5h16M9.5 20v-6h5v6',
  box: 'M21 8.2 12 3 3 8.2l9 5.2 9-5.2ZM3 8.2v7.6L12 21l9-5.2V8.2M12 13.4V21',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16.2 16.2 21 21',
  cart: 'M3 4h2.2l2.3 10.6a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 7H6M9.5 20.5h.01M17.5 20.5h.01',
  route:
    'M6.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM17.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM9 17.5h5.5a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6H15',
  pulse: 'M3 12h4l2.5-6.5L14 18l2.2-6H21',
  users:
    'M16 20v-1.8a4 4 0 0 0-4-4H6.5a4 4 0 0 0-4 4V20M9.2 10.4a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2ZM21.5 20v-1.8a4 4 0 0 0-3-3.9M16.2 3.4a3.6 3.6 0 0 1 0 7',
  shield: 'M12 3.2 19 6v5.7c0 4.3-2.9 7.3-7 8.9-4.1-1.6-7-4.6-7-8.9V6l7-2.8ZM9 12l2.2 2.2L15.5 10',
  check: 'm4.5 12.5 5 5 10-11',
  arrow: 'M4 12h15M13 6l6 6-6 6',
};

interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
