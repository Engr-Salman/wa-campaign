import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from '../lib/apiBase';

// Resolve the Socket.io endpoint:
// 1. If VITE_API_URL was set at build time, use that (prod on Netlify pointing
//    to a separately-hosted backend).
// 2. If running on localhost in dev, go straight to :3001.
// 3. Otherwise fall back to the same origin (backend + frontend on one host).
const SOCKET_URL =
  API_BASE ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? `http://${window.location.hostname}:3001`
    : (typeof window !== 'undefined' ? window.location.origin : ''));

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return { socket: socketRef.current, connected, on, off };
}
