/**
 * @jest-environment node
 */

import { useUIStore } from '../uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarCollapsed: false,
      themeMode: 'light',
      globalLoading: false,
    });
  });

  it('should initialize with default state', () => {
    const state = useUIStore.getState();
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.themeMode).toBe('light');
    expect(state.globalLoading).toBe(false);
  });

  it('should toggle sidebar', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('should set sidebar collapsed explicitly', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().setSidebarCollapsed(false);
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('should set theme mode', () => {
    useUIStore.getState().setThemeMode('dark');
    expect(useUIStore.getState().themeMode).toBe('dark');
    useUIStore.getState().setThemeMode('light');
    expect(useUIStore.getState().themeMode).toBe('light');
  });

  it('should set global loading', () => {
    expect(useUIStore.getState().globalLoading).toBe(false);
    useUIStore.getState().setGlobalLoading(true);
    expect(useUIStore.getState().globalLoading).toBe(true);
    useUIStore.getState().setGlobalLoading(false);
    expect(useUIStore.getState().globalLoading).toBe(false);
  });
});
