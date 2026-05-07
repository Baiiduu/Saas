import { create } from 'zustand';

export interface UIState {
  sidebarCollapsed: boolean;
  themeMode: 'light' | 'dark';
  globalLoading: boolean;
}

export interface UIActions {
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setThemeMode: (mode: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setGlobalLoading: (loading: boolean) => void;
}

const initialState: UIState = {
  sidebarCollapsed: false,
  themeMode: 'light',
  globalLoading: false,
};

export const useUIStore = create<UIState & UIActions>()((set) => ({
  ...initialState,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) =>
    set({ sidebarCollapsed: collapsed }),

  setThemeMode: (mode) =>
    set({ themeMode: mode }),

  toggleTheme: () =>
    set((state) => ({ themeMode: state.themeMode === 'light' ? 'dark' : 'light' })),

  setGlobalLoading: (loading) =>
    set({ globalLoading: loading }),
}));
