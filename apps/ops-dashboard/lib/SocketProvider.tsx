"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type SocketClient = import("socket.io-client").Socket;

interface SocketContextValue {
  socket: SocketClient | null;
  disconnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, disconnected: false });

export function SocketProvider({ apiUrl, children }: { apiUrl: string; children: React.ReactNode }) {
  const [disconnected, setDisconnected] = useState(false);
  const [socket, setSocket] = useState<SocketClient | null>(null);
  const wasDisconnectedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    let s: SocketClient | null = null;
    import("socket.io-client").then(({ io }) => {
      if (!mounted) return;
      s = io(apiUrl, { transports: ["websocket", "polling"] });
      setSocket(s);
      s.on("disconnect", () => {
        timerRef.current = setTimeout(() => {
          if (mounted) { setDisconnected(true); wasDisconnectedRef.current = true; }
        }, 10_000);
      });
      s.on("connect", () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (mounted && wasDisconnectedRef.current) {
          setDisconnected(false);
          wasDisconnectedRef.current = false;
        }
      });
    });
    return () => { mounted = false; s?.disconnect(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [apiUrl]);

  return (
    <SocketContext.Provider value={{ socket, disconnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocketContext = () => useContext(SocketContext);
