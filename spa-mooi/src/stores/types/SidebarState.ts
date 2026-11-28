export interface SidebarState {
  /** The desktop sidebar shows icons only. */
  collapsed: boolean;
  toggleCollapsed: () => void;
}
