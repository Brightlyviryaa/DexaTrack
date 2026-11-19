import type { CSSProperties, ReactNode } from 'react';
import { NavLink } from 'react-router';

type MobileTab = { to: string; label: string; icon: ReactNode };

export function MobileNavigation({ tabs, label, variant }: {
  tabs: readonly MobileTab[];
  label: string;
  variant: 'hr' | 'employee';
}) {
  return (
    <nav className={`mobile-navigation mobile-navigation--${variant}`} aria-label={label}>
      <div className="mobile-navigation-tabs" style={{ '--tab-count': tabs.length } as CSSProperties}>
        <span className="mobile-navigation-indicator" aria-hidden="true" />
        {tabs.map(tab => (
          <NavLink key={tab.to} to={tab.to} end>
            <span className="mobile-tab-icon">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
