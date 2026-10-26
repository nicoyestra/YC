import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem('erp_usuario');
    return guardado ? JSON.parse(guardado) : null;
  });

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('erp_token', data.token);
    localStorage.setItem('erp_usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }

  useEffect(() => {
    if (!usuario || !localStorage.getItem('erp_token')) return undefined;
    let activo = true;
    const enviarHeartbeat = () => {
      if (activo && document.visibilityState !== 'hidden') {
        api.post('/auth/heartbeat').catch(() => {});
      }
    };
    enviarHeartbeat();
    const intervalo = window.setInterval(enviarHeartbeat, 25000);
    const alVolver = () => { if (document.visibilityState === 'visible') enviarHeartbeat(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      activo = false;
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [usuario]);

  function logout() {
    // Se dispara el cierre de sesión antes de limpiar el token local.
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_usuario');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
