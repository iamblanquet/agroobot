import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTelegram, setIsTelegram] = useState(false);
  const [tgUser, setTgUser] = useState(null);
  const [offlineSimulated, setOfflineSimulated] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Monitoreo de conectividad real del navegador
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 1. Detección y Configuración de Telegram WebApp SDK
    const tg = window.Telegram?.WebApp;
    if (tg && tg.initData) {
      setIsTelegram(true);
      try {
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#064e3b');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#022c22');
        if (tg.initDataUnsafe?.user) {
          setTgUser(tg.initDataUnsafe.user);
        }
      } catch (err) {
        console.warn('Error configurando Telegram WebApp SDK:', err);
      }
    }

    // 2. Restaurar sesión persistente (Recordar operador)
    const savedToken = localStorage.getItem('tesa_token');
    const savedUser = localStorage.getItem('tesa_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('tesa_token');
        localStorage.removeItem('tesa_user');
      }
    }

    // 3. Listener para deslogueo por 401
    const handleUnauthorized = () => {
      if (navigator.onLine && !offlineSimulated) {
        setUser(null);
        setToken(null);
      }
    };
    window.addEventListener('tesa:unauthorized', handleUnauthorized);

    setIsLoading(false);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('tesa:unauthorized', handleUnauthorized);
    };
  }, [offlineSimulated]);

  /**
   * Login rápido con PIN de 4 dígitos (Recomendado para campo)
   */
  const loginWithPin = async (pin) => {
    try {
      const data = await api.post('/auth/pin-login', { pin });
      if (data.token && data.user) {
        localStorage.setItem('tesa_token', data.token);
        localStorage.setItem('tesa_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      throw err;
    }
  };

  /**
   * Login administrativo tradicional por usuario y password
   */
  const login = async (username, password) => {
    try {
      const data = await api.post('/auth/login', { username, password });
      if (data.token && data.user) {
        localStorage.setItem('tesa_token', data.token);
        localStorage.setItem('tesa_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      throw err;
    }
  };

  // Se conserva para no romper consumidores existentes, pero nunca cambia de
  // identidad ni usa credenciales de demostración incrustadas en el cliente.
  const quickLogin = async () => user;

  const logout = () => {
    localStorage.removeItem('tesa_token');
    localStorage.removeItem('tesa_user');
    setToken(null);
    setUser(null);
  };

  const toggleOfflineSimulation = () => {
    setOfflineSimulated(prev => !prev);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        isTelegram,
        tgUser,
        isOnline: isOnline && !offlineSimulated,
        offlineSimulated,
        toggleOfflineSimulation,
        loginWithPin,
        login,
        quickLogin,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}
