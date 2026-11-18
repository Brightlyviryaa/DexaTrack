export type IconName = 'grid' | 'users' | 'calendar' | 'clock' | 'check' | 'briefcase' | 'arrow' | 'logout' | 'activity' | 'file' | 'settings';

export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M8 12h10" /></>,
    activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
    file: <><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M10 2h4l.7 2.5 2 .9L19 4l2 3.5-1.8 1.9.2 2.3 2.6 1v4l-2.7.6-1.4 1.6.1 2.6-3.8 1-1.3-2.1h-1.8l-1.3 2.1-3.8-1 .1-2.6-1.4-1.6L2 16.7v-4l2.6-1 .2-2.3L3 7.5 5 4l2.3 1.4 2-.9L10 2Z" transform="translate(0 .4) scale(1 .94)" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
