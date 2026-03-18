import { useEffect, useRef, useState } from "react";
import type { SaleChangedPayload } from "./types";

type SocketClient = import("socket.io-client").Socket;

export function useSocket(
  apiUrl: string,
  onSaleChanged: (payload: SaleChangedPayload) => void,
  onReconnect?: () => void,
  additionalHandlers?: Record<string, (data: any) => void>,
) {
  const [disconnected, setDisconnected] = useState(false);
  const socketRef = useRef<SocketClient | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cbRef = useRef(onSaleChanged);
  const reconnectRef = useRef(onReconnect);
  const handlersRef = useRef(additionalHandlers);
  const wasDisconnectedRef = useRef(false);
  cbRef.current = onSaleChanged;
  reconnectRef.current = onReconnect;
  handlersRef.current = additionalHandlers;

  useEffect(() => {
    let mounted = true;
    import("socket.io-client").then(({ io }) => {
      if (!mounted) return;
      const socket = io(apiUrl, { transports: ["websocket", "polling"] });
      socketRef.current = socket;

      socket.on("sale:changed", (data: SaleChangedPayload) => {
        cbRef.current(data);
      });

      if (handlersRef.current) {
        for (const [event, handler] of Object.entries(handlersRef.current)) {
          socket.on(event, (data: any) => {
            handlersRef.current?.[event]?.(data);
          });
        }
      }

      socket.on("disconnect", () => {
        timerRef.current = setTimeout(() => {
          if (mounted) {
            setDisconnected(true);
            wasDisconnectedRef.current = true;
          }
        }, 10_000);
      });

      socket.on("connect", () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (mounted && wasDisconnectedRef.current) {
          setDisconnected(false);
          wasDisconnectedRef.current = false;
          reconnectRef.current?.();
        }
      });
    });

    return () => {
      mounted = false;
      socketRef.current?.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [apiUrl]);

  return { disconnected };
}
