import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

type MessageHandler = (data: unknown) => void;

export function useWebSocket(teamId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, MessageHandler[]>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    // TODO: Implement WebSocket connection
    // const token = useAuthStore.getState().accessToken;
    // if (!token || !teamId) return;
    // wsRef.current = new WebSocket(`ws://localhost:3000/ws/chat/${teamId}?token=${token}`);
    // wsRef.current.onmessage = (event) => {
    //   try {
    //     const parsed = JSON.parse(event.data);
    //     const { type, payload } = parsed;
    //     const handlers = handlersRef.current.get(type) || [];
    //     handlers.forEach((handler) => handler(payload));
    //   } catch (e) {
    //     console.error('[WebSocket] Failed to parse message:', e);
    //   }
    // };
    // wsRef.current.onopen = () => { isConnectedRef.current = true; };
    // wsRef.current.onclose = () => { isConnectedRef.current = false; };
    // wsRef.current.onerror = (err) => { console.error('[WebSocket] Error:', err); };
    console.warn('[WebSocket] connect() is not yet implemented');
  }, [teamId, setIsConnected]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, [setIsConnected]);

  const send = useCallback((data: unknown) => {
    // TODO: Implement WebSocket send
    // if (wsRef.current?.readyState === WebSocket.OPEN) {
    //   wsRef.current.send(JSON.stringify(data));
    // }
    console.warn('[WebSocket] send() is not yet implemented');
  }, []);

  const on = useCallback((event: string, handler: MessageHandler) => {
    const existing = handlersRef.current.get(event) || [];
    existing.push(handler);
    handlersRef.current.set(event, existing);
  }, []);

  const off = useCallback((event: string, handler: MessageHandler) => {
    const existing = handlersRef.current.get(event) || [];
    const filtered = existing.filter((h) => h !== handler);
    if (filtered.length === 0) {
      handlersRef.current.delete(event);
    } else {
      handlersRef.current.set(event, filtered);
    }
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    connect,
    disconnect,
    send,
    on,
    off,
    isConnected,
  };
}
