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

    // 2. Restaurar sesión persistente almacenada
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
      // Solo desloguear si estamos online para no interrumpir el trabajo de campo offline
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

  const login = async (username, password) => {
    try {
      const data = await api.post('/auth/login', { username, password });
      if (data.token && data.user) {
        localStorage.setItem('tesa_token', data.token);
        localStorage.setItem('tesa_user', JSON.stringify(data.user));
        localStorage.setItem('tesa_last_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      // Si estamos offline o el servidor no responde, intentamos login con caché offline
      const isNetworkError = !navigator.onLine || offlineSimulated || err.message?.includes('Network') || err.message?.includes('Failed to fetch');
      if (isNetworkError) {
        return loginOffline(username);
      }
      throw err;
    }
  };

  const loginOffline = (requestedUsername) => {
    const lastUserStr = localStorage.getItem('tesa_last_user');
    let offlineUser = null;

    if (lastUserStr) {
      try {
        const parsed = JSON.parse(lastUserStr);
        if (!requestedUsername || parsed.username === requestedUsername || requestedUsername === 'campo_user') {
          offlineUser = parsed;
        }
      } catch (e) {
        console.warn('Error leyendo usuario en caché:', e);
      }
    }

    if (!offlineUser) {
      // Usuario por defecto para operación de emergencia en campo sin señal
      offlineUser = {
        id: 999,
        username: requestedUsername || 'operador_campo',
        nombre: 'Operador de Campo (Modo Fuera de Línea)',
        rol: 'campo',
        tg_user_id: null,
        is_offline_session: true
      };
    }

    const offlineToken = `offline-token-${Date.now()}`;
    localStorage.setItem('tesa_token', offlineToken);
    localStorage.setItem('tesa_user', JSON.stringify(offlineUser));
    setToken(offlineToken);
    setUser(offlineUser);
    return offlineUser;
  };

  const loginWithTelegram = async () => {
    const tg = window.Telegram?.WebApp;
    if (!tg || !tg.initData) {
      throw new Error('Telegram WebApp no detectado en esta sesión de navegador.');
    }

    try {
      const data = await api.post('/auth/telegram', { initData: tg.initData });
      if (data.token && data.user) {
        localStorage.setItem('tesa_token', data.token);
        localStorage.setItem('tesa_user', JSON.stringify(data.user));
        localStorage.setItem('tesa_last_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      if (!navigator.onLine || offlineSimulated) {
        return loginOffline(tgUser?.username || 'telegram_user');
      }
      throw err;
    }
  };

  const quickLogin = async (role) => {
    const userMap = {
      campo: { username: 'campo_user', pass: 'demo123', nombre: 'Operador de Campo', rol: 'campo' },
      supervisor: { username: 'sup_user', pass: 'demo123', nombre: 'Supervisor de Obra', rol: 'supervisor' },
      direccion: { username: 'dir_user', pass: 'demo123', nombre: 'Director de Operaciones', rol: 'direccion' },
      it: { username: 'admin_user', pass: 'demo123', nombre: 'Administrador IT', rol: 'it' }
    };
    const target = userMap[role] || userMap.campo;

    if (!navigator.onLine || offlineSimulated) {
      const offlineUser = {
        id: role === 'campo' ? 1 : role === 'supervisor' ? 2 : role === 'direccion' ? 3 : 4,
        username: target.username,
        nombre: target.nombre,
        rol: target.rol,
        is_offline_session: true
      };
      const offlineToken = `offline-${role}-${Date.now()}`;
      localStorage.setItem('tesa_token', offlineToken);
      localStorage.setItem('tesa_user', JSON.stringify(offlineUser));
      setToken(offlineToken);
      setUser(offlineUser);
      return offlineUser;
    }

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
        isOnline: isOnline && !offlineSimulated,
        offlineSimulated,
        toggleOfflineSimulation,
        login,
        loginOffline,
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
