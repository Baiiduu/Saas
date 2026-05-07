/**
 * @jest-environment node
 *
 * Test useWebSocket hook by mocking React primitives.
 * This avoids requiring jsdom or @testing-library/react.
 */

const mockSetIsConnected = jest.fn();
const mockUseRef = jest.fn((initial: unknown) => ({ current: initial }));

jest.mock('react', () => ({
  useState: jest.fn((initial: boolean) => [initial, mockSetIsConnected]),
  useCallback: jest.fn((fn: () => void) => fn),
  useEffect: jest.fn(),
  useRef: mockUseRef,
}));

import { useWebSocket } from '../useWebSocket';

describe('useWebSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize isConnected as false', () => {
    const result = useWebSocket('team-1');
    expect(result.isConnected).toBe(false);
  });

  it('should return connect, disconnect, send, on, off functions', () => {
    const result = useWebSocket('team-1');
    expect(result).toHaveProperty('connect');
    expect(result).toHaveProperty('disconnect');
    expect(result).toHaveProperty('send');
    expect(result).toHaveProperty('on');
    expect(result).toHaveProperty('off');
    expect(typeof result.connect).toBe('function');
    expect(typeof result.disconnect).toBe('function');
    expect(typeof result.send).toBe('function');
    expect(typeof result.on).toBe('function');
    expect(typeof result.off).toBe('function');
  });

  it('should set isConnected to false on disconnect', () => {
    const result = useWebSocket('team-1');
    result.disconnect();
    expect(mockSetIsConnected).toHaveBeenCalledWith(false);
  });

  it('should not throw when disconnect is called multiple times', () => {
    const result = useWebSocket('team-1');
    expect(() => {
      result.disconnect();
      result.disconnect();
      result.disconnect();
    }).not.toThrow();
    // Each call to disconnect triggers setIsConnected(false)
    expect(mockSetIsConnected).toHaveBeenCalledTimes(3);
    expect(mockSetIsConnected).toHaveBeenCalledWith(false);
  });

  it('should accept optional teamId parameter', () => {
    const result = useWebSocket();
    expect(result.isConnected).toBe(false);
    expect(typeof result.connect).toBe('function');
  });

  it('should accept on/off for event subscription management', () => {
    const result = useWebSocket('team-1');
    const handler = jest.fn();

    // Verify on and off exist and don't throw
    expect(() => {
      result.on('message', handler);
    }).not.toThrow();

    expect(() => {
      result.off('message', handler);
    }).not.toThrow();
  });
});
