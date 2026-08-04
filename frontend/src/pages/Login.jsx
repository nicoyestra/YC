import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import logoHorizontal from '../assets/yc-logo-horizontal.png';
import loginWarehouse from '../assets/yc-login-warehouse.jpg';

import {
  Package,
  DollarSign,
  BarChart3,
  UserRound,
  Eye,
  EyeOff
} from 'lucide-react';


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function manejarSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login-page">
      <section
        className="login-visual"
        style={{ backgroundImage: `url(${loginWarehouse})` }}
      >
        <div className="login-visual-overlay" />

        <div className="login-visual-content">
          <div className="login-brand">
            <img
              src={logoHorizontal}
              alt="YC System"
              className="login-brand-logo"
            />
          </div>

          <div className="login-beneficios">
            <div className="login-beneficio-card">
<span className="login-beneficio-icon">
  <Package size={30} strokeWidth={1.8} />
</span>             

 <strong>Inventario</strong>
              <small>Control total de tu stock</small>
            </div>

            <div className="login-beneficio-card">
<span className="login-beneficio-icon">
  <DollarSign size={30} strokeWidth={1.8} />
</span>
              <strong>Ventas</strong>
              <small>Clientes y operaciones</small>
            </div>

            <div className="login-beneficio-card">

<span className="login-beneficio-icon">
  <BarChart3 size={30} strokeWidth={1.8} />
</span>
              <strong>Estadísticas</strong>
              <small>Información en tiempo real</small>
            </div>
          </div>
        </div>

        <div className="login-copyright">
          YC System ERP · © 2026
        </div>
      </section>

      <section className="login-form-area">
        <div className="login-card">

<div className="login-user-icon">
  <UserRound size={34} strokeWidth={2} />
</div>


          <div className="login-heading">
            <h2>Iniciar sesión</h2>
            <p>Ingresá tus credenciales para acceder al sistema</p>
          </div>

          <form onSubmit={manejarSubmit}>
            {error && <div className="error">{error}</div>}

            <div className="campo-login">
              <label htmlFor="email">Email o usuario</label>
              <input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ingresá tu email o usuario"
                autoComplete="username"
                required
              />
            </div>

            <div className="campo-login">
              <label htmlFor="password">Contraseña</label>

              <div className="password-wrapper">
                <input
                  id="password"
                  type={mostrarPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresá tu contraseña"
                  autoComplete="current-password"
                  required
                />

                
<button
  type="button"
  className="password-toggle"
  onClick={() => setMostrarPassword(!mostrarPassword)}
  aria-label={
    mostrarPassword
      ? "Ocultar contraseña"
      : "Mostrar contraseña"
  }
>
  {mostrarPassword ? (
    <EyeOff size={20} strokeWidth={2} />
  ) : (
    <Eye size={20} strokeWidth={2} />
  )}
</button>

              </div>
            </div>

            <button
              className="boton login-submit"
              type="submit"
              disabled={cargando}
            >
              {cargando ? 'Ingresando...' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="login-seguridad">
            Acceso seguro · YC System
          </div>
        </div>
      </section>
    </main>
  );
}