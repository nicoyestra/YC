import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

const MODULOS = [
  { path: '/', label: 'Inicio', roles: null },
  { path: '/articulos', label: 'Artículos', roles: ['admin', 'inventario', 'compras'] },
  { path: '/inventario', label: 'Inventario', roles: ['admin', 'inventario'] },
  { path: '/compras', label: 'Compras', roles: ['admin', 'compras'] },
  { path: '/ventas', label: 'Ventas', roles: ['admin', 'ventas'] },
  { path: '/clientes', label: 'Clientes', roles: ['admin', 'ventas'] },
  { path: '/facturacion', label: 'Facturación', roles: ['admin', 'ventas'] },
  { path: '/logistica', label: 'Logística', roles: ['admin', 'ventas', 'inventario'] },
  { path: '/gastos', label: 'Centro de costos', roles: ['admin', 'compras', 'rrhh'] },
  { path: '/estadisticas', label: 'Estadísticas', roles: null },
  { path: '/rrhh', label: 'RRHH', roles: ['admin', 'rrhh'] },
];

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  function salir() {
    logout();
    navigate('/login');
  }

  const modulosVisibles = MODULOS.filter(
    (m) => !m.roles || m.roles.includes(usuario?.rol) || usuario?.rol === 'admin'
  );

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Logo />
        </div>
        <nav>
          {modulosVisibles.map((m) => (
            <NavLink
              key={m.path}
              to={m.path}
              end={m.path === '/'}
              className={({ isActive }) => (isActive ? 'activo' : '')}
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="topbar" style={{ padding: '16px 32px 0' }}>
          <span>{usuario?.nombre_usuario} · <span style={{ color: '#6b7280' }}>{usuario?.rol}</span></span>
          <button className="boton boton-secundario" onClick={salir}>Salir</button>
        </div>
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
