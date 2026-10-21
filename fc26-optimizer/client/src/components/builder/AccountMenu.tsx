import React from 'react';
import { useAccount } from '@/hooks/useAccount';

interface AccountMenuProps {
  /** Opens the My Profile screen (plan, archetype levels, saved profile, My Builds) */
  onOpenProfile: () => void;
}

/**
 * Header control.
 *  - Logged out: a "Log in" button.
 *  - Logged in:  a "My Profile" button. Plan, AI builds left, archetype levels and My Builds live inside it.
 */
export const AccountMenu: React.FC<AccountMenuProps> = ({ onOpenProfile }) => {
  const { isAuthenticated, loading } = useAccount();

  if (loading) return <div className="w-[88px] h-7" aria-hidden />;

  if (!isAuthenticated) {
    return (
      <a
        href="/login"
        className="flex items-center px-3 py-1 rounded-full border border-[#26334A] bg-[#131A2A] text-[#F4F7FB] text-[11px] font-bold transition-colors hover:bg-[#192235] hover:border-[#4D8DFF]/50"
      >
        Log in
      </a>
    );
  }

  return (
    <button
      onClick={onOpenProfile}
      aria-label="My profile"
      className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#21E6A4]/40 bg-[#192235] text-[#21E6A4] text-[11px] font-bold transition-colors hover:bg-[#26334A]"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </svg>
      My Profile
    </button>
  );
};
