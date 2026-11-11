import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const auth = useAuth();
  const userId = auth?.user?.id;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    // Only establish real-time socket connection when a valid user session & token exist
    if (!token || !userId) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Connect to Course Service which handles courses, homeworks, exams
    const isLocalhost = typeof window !== 'undefined' ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') : false;
    const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
    const socketUrl = import.meta.env.VITE_COURSE_API_URL || '';
    
    if (isVercel && !import.meta.env.VITE_COURSE_API_URL) {
      console.log('ℹ️ WebSockets are disabled on Vercel serverless environment.');
      return;
    }

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to Real-Time Socket.IO Server');
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Real-Time Server:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', () => {
      // Graceful degradation: real-time updates fallback to HTTP polling without unhandled console error spam
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userId, token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
