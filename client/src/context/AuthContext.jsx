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

    // 3. Sincronizar catálogo de operadores para validación PIN offline
    if (navigator.onLine && !offlineSimulated) {
      api.get('/auth/operators')
        .then(data => {
          if (data?.operators) {
            localStorage.setItem('tesa_cached_operators', JSON.stringify(data.operators));
          }
        })
        .catch(() => {});
    }

    // 4. Listener para deslogueo por 401
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
        localStorage.setItem('tesa_last_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      // Si estamos offline o el servidor no responde, validar contra caché local
      const isNetworkError = !navigator.onLine || offlineSimulated || err.message?.includes('Network') || err.message?.includes('Failed to fetch');
      if (isNetworkError) {
        const cachedOpsStr = localStorage.getItem('tesa_cached_operators');
        if (cachedOpsStr) {
          try {
            const ops = JSON.parse(cachedOpsStr);
            const matched = ops.find(o => String(o.pin) === String(pin));
            if (matched) {
              return loginOffline(matched.username);
            }
          } catch (e) {}
        }

        // Mapeo rápido de demo PINs offline
        if (pin === '1234') return loginOffline('campo_user');
        if (pin === '2345') return loginOffline('sup_user');
        if (pin === '3456') return loginOffline('dir_user');
        if (pin === '9999') return loginOffline('admin_user');
      }
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
        localStorage.setItem('tesa_last_user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
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
      } catch (e) {}
    }

    if (!offlineUser) {
      const role = requestedUsername === 'sup_user' ? 'supervisor' : requestedUsername === 'dir_user' ? 'direccion' : requestedUsername === 'admin_user' ? 'it' : 'campo';
      offlineUser = {
        id: role === 'campo' ? 1 : role === 'supervisor' ? 2 : role === 'direccion' ? 3 : 4,
        username: requestedUsername || 'operador_campo',
        nombre: role === 'campo' ? 'Juan Pérez - Residente de Campo' : 'Usuario Operativo (Offline)',
        rol: role,
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

  const quickLogin = async (role) => {
    // Protección: Solo permitir alternar roles si ya existe una sesión iniciada
    if (!token || !user) {
      throw new Error('Acceso protegido: Debe iniciar sesión con su PIN o contraseña para poder cambiar de rol.');
    }
    const userMap = {
      campo: { pin: '1234', username: 'campo_user', pass: 'demo123' },
      supervisor: { pin: '2345', username: 'sup_user', pass: 'demo123' },
      direccion: { pin: '3456', username: 'dir_user', pass: 'demo123' },
      it: { pin: '9999', username: 'admin_user', pass: 'demo123' }
    };
    const target = userMap[role] || userMap.campo;
    return loginWithPin(target.pin);
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
        loginWithPin,
        login,
        loginOffline,
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
