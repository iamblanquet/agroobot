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

  useEffect(() => {
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

    // 2. Restaurar sesión almacenada
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
      setUser(null);
      setToken(null);
    };
    window.addEventListener('tesa:unauthorized', handleUnauthorized);

    setIsLoading(false);

    return () => {
      window.removeEventListener('tesa:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (username, password) => {
    const data = await api.post('/auth/login', { username, password });
    if (data.token && data.user) {
      localStorage.setItem('tesa_token', data.token);
      localStorage.setItem('tesa_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    }
  };

  const loginWithTelegram = async () => {
    const tg = window.Telegram?.WebApp;
    if (!tg || !tg.initData) {
      throw new Error('Telegram WebApp no detectado en esta sesión de navegador.');
    }

    const data = await api.post('/auth/telegram', { initData: tg.initData });
    if (data.token && data.user) {
      localStorage.setItem('tesa_token', data.token);
      localStorage.setItem('tesa_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    }
  };

  const quickLogin = async (role) => {
    const userMap = {
      campo: { username: 'campo_user', pass: 'demo123' },
      supervisor: { username: 'sup_user', pass: 'demo123' },
      direccion: { username: 'dir_user', pass: 'demo123' },
      it: { username: 'admin_user', pass: 'demo123' }
    };
    const target = userMap[role] || userMap.campo;
    return login(target.username, target.pass);
  };

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
        offlineSimulated,
        toggleOfflineSimulation,
        login,
        loginWithTelegram,
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
