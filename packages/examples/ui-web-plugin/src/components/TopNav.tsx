import type { UiPluginContext } from "@natalia/ui-host";

export interface TopNavProps {
  ctx: UiPluginContext;
}

export function TopNav(props: TopNavProps) {
  return (
    <nav class="topnav">
      <div class="topnav-left">
        <button type="button" class="topnav-icon-btn" title="后退">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button type="button" class="topnav-icon-btn" title="前进">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="topnav-breadcrumb">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="color: var(--text-dim);">
            <path d="M2 4C2 2.89543 2.89543 2 4 2H5.58579C6.11622 2 6.62493 2.21071 7 2.58579L7.41421 3C7.78929 3.37507 8.29799 3.58579 8.82843 3.58579H12C13.1046 3.58579 14 4.48122 14 5.58579V10C14 11.1046 13.1046 12 12 12H4C2.89543 12 2 11.1046 2 10V4Z" stroke="currentColor" stroke-width="1.2"/>
          </svg>
          <span class="topnav-breadcrumb-segment">文件</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="color: var(--text-dim);">
            <path d="M4.5 2.5L7.5 6L4.5 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="topnav-breadcrumb-segment topnav-breadcrumb-active">你好</span>
        </div>
      </div>
      <div class="topnav-right">
        <button type="button" class="topnav-icon-btn" title="搜索">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
        <button type="button" class="topnav-icon-btn" title="通知">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2C5.79086 2 4 3.79086 4 6V7C4 8.88562 4.66701 10.2283 5.47935 11.0382C5.80285 11.3633 6 11.8042 6 12.2685V12.5C6 13.3284 6.67157 14 7.5 14H8.5C9.32843 14 10 13.3284 10 12.5V12.2685C10 11.8042 10.1971 11.3633 10.5206 11.0382C11.333 10.2283 12 8.88562 12 7V6C12 3.79086 10.2091 2 8 2Z" stroke="currentColor" stroke-width="1.2"/>
            <path d="M7 2.5C7 2.5 7.5 1.5 8 1.5C8.5 1.5 9 2.5 9 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <span class="topnav-notification-dot" />
        </button>
        <div class="topnav-divider" />
        <button type="button" class="topnav-action-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3H11V5M3 7H11M3 11H7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
          </svg>
          打开位置
        </button>
        <button type="button" class="topnav-icon-btn" title="切换布局">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/>
            <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/>
            <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/>
            <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/>
          </svg>
        </button>
      </div>
    </nav>
  );
}
