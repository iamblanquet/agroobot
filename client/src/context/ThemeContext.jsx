import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Modo predeterminado: 'light' (modo claro corporativo) o preferencia guardada
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('agrok_theme');
    if (saved) return saved;
    return 'light'; // Predeterminado claro como solicitado
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('agrok_theme', theme);

    // Ajustar color de cabecera de Telegram si está activo
    const tg = window.Telegram?.WebApp;
    if (tg) {
      try {
        if (theme === 'dark') {
          if (tg.setHeaderColor) tg.setHeaderColor('#064e3b');
          if (tg.setBackgroundColor) tg.setBackgroundColor('#022c22');
        } else {
          if (tg.setHeaderColor) tg.setHeaderColor('#064e3b');
          if (tg.setBackgroundColor) tg.setBackgroundColor('#f8fafc');
        }
      } catch (e) {}
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser utilizado dentro de un ThemeProvider');
  }
  return context;
}
