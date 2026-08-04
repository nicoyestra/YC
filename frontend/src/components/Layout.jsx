import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import NotificationCenter from './NotificationCenter';
import BuscadorGlobal from './BuscadorGlobal';

const ICONOS = {
  '/': '⌂',
  '/articulos': '▦',
  '/inventario': '◫',
  '/compras': '↓',
  '/ventas': '↑',
  '/devoluciones': '↶',
  '/clientes': '♙',
  '/facturacion': '▤',
  '/logistica': '⌁',
  '/inventario-danado': '△',
  '/gastos': '$',
  '/estadisticas': '▥',
  '/rrhh': '♧',
  '/usuarios': '◎',
};

const MODULOS = [
  { path: '/', label: 'Inicio', roles: null },
  { path: '/articulos', label: 'Artículos', roles: ['admin', 'inventario', 'compras'] },
  { path: '/inventario', label: 'Inventario', roles: ['admin', 'inventario'] },
  { path: '/compras', label: 'Compras', roles: ['admin', 'compras'] },
  { path: '/ventas', label: 'Ventas', roles: ['admin', 'ventas'] },
  { path: '/devoluciones', label: 'Devoluciones', roles: ['admin', 'ventas'] },
  { path: '/clientes', label: 'Clientes', roles: ['admin', 'ventas'] },
  { path: '/facturacion', label: 'Facturación', roles: ['admin', 'ventas'] },
  { path: '/logistica', label: 'Logística', roles: ['admin', 'ventas', 'inventario'] },
  { path: '/inventario-danado', label: 'Stock dañado', roles: ['admin', 'inventario'] },
  { path: '/gastos', label: 'Centro de costos', roles: ['admin', 'compras', 'rrhh'] },
  { path: '/estadisticas', label: 'Estadísticas', roles: ['admin'] },
  { path: '/rrhh', label: 'RRHH', roles: ['admin', 'rrhh'] },
  { path: '/usuarios', label: 'Usuarios', roles: ['admin'] },
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

  const inicial = (usuario?.nombre_usuario || 'U').charAt(0).toUpperCase();

  return (
    <div className="layout app-shell-v5">
      <aside className="sidebar sidebar-v5">
        <div className="sidebar-brand"><Logo showName /></div>
        <div className="sidebar-section-label">MENÚ PRINCIPAL</div>
        <nav>
          {modulosVisibles.map((m) => (
            <NavLink
              key={m.path}
              to={m.path}
              end={m.path === '/'}
              className={({ isActive }) => (isActive ? 'activo' : '')}
            >
              <span className="nav-icon" aria-hidden="true">{ICONOS[m.path]}</span>
              <span>{m.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-status-dot" />
          <div><strong>Sistema conectado</strong><small>YC System ERP</small></div>
        </div>
      </aside>

      <div className="app-main-v5">

<header className="topbar topbar-v5">
  <div className="topbar-welcome">
    <strong>Panel de gestión</strong>
    <span>Administrá tu empresa en tiempo real</span>
  </div>

  <div className="topbar-search-area">
    <BuscadorGlobal />
  </div>

  <div className="topbar-actions">
    <NotificationCenter />

    <div className="user-chip">
      <span className="user-avatar">{inicial}</span>

      <span className="user-chip-copy">
        <strong>{usuario?.nombre_usuario}</strong>
        <small>{usuario?.rol}</small>
      </span>
    </div>

    <button
      className="boton boton-secundario logout-button"
      onClick={salir}
    >
      Salir
    </button>
  </div>
</header>


        <main className="contenido contenido-v5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
