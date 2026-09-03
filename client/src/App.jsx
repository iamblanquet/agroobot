import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginView from './views/LoginView';
import CampoView from './views/CampoView';
import SupervisorView from './views/SupervisorView';
import DireccionView from './views/DireccionView';
import AdminView from './views/AdminView';

export default function App() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState('campo');

  // Ajustar vista predeterminada según el rol del usuario autenticado
  useEffect(() => {
    if (user?.rol) {
      if (user.rol === 'campo') setCurrentView('campo');
      else if (user.rol === 'supervisor') setCurrentView('supervisor');
      else if (user.rol === 'direccion') setCurrentView('direccion');
      else if (user.rol === 'it') setCurrentView('it');
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8faf2] dark:bg-[#0c1400] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#2c4001] border-2 border-[#a1c62e] text-[#a1c62e] font-black text-2xl flex items-center justify-center mx-auto shadow-lg shadow-[#2c4001]/30 animate-pulse">
            🌽
          </div>
          <p className="text-xs font-bold text-[#2c4001] dark:text-[#a1c62e] tracking-wide uppercase">AGROKOOL · Iniciando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-[#f8faf2] dark:bg-[#0c1400] text-[#1c2d01] dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        onSyncComplete={() => {
          // Trigger refresh if needed
        }}
      />

      <main className="flex-1">
        {currentView === 'campo' && <CampoView />}
        {currentView === 'supervisor' && <SupervisorView />}
        {currentView === 'direccion' && <DireccionView />}
        {currentView === 'it' && <AdminView />}
      </main>
    </div>
  );
}
