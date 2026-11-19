export function PortalIcon({ name }: { name: 'home' | 'history' | 'request' | 'profile' | 'camera' | 'pin' | 'arrow' | 'check' | 'clock' | 'lock' | 'logout' | 'chevron' }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></>,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" /></>,
    request: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v4H9zM9 12h6M9 16h4" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    camera: <><path d="M3 7h4l2-3h6l2 3h4v13H3z" /><circle cx="12" cy="13" r="4" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3" /></>,
    logout: <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m6-12 4 4-4 4m-7-4h11" />,
    chevron: <path d="m9 6 6 6-6 6" />,
  };
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
