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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-black text-xl flex items-center justify-center mx-auto animate-pulse">
            TESA
          </div>
          <p className="text-xs text-slate-400">Iniciando entorno operativo...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
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
