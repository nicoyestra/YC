import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const ICONOS = { stock: '▦', compra: '↓', factura: '$', logistica: '⌁' };

export default function NotificationCenter() {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState({ items: [], noLeidas: 0 });
  const [cargando, setCargando] = useState(false);
  const contenedor = useRef(null);
  const navigate = useNavigate();

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const { data } = await api.get('/notificaciones');
      setDatos(data);
    } catch {
      setDatos({ items: [], noLeidas: 0 });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 60000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  useEffect(() => {
    function cerrarFuera(e) {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', cerrarFuera);
    return () => document.removeEventListener('mousedown', cerrarFuera);
  }, []);

  async function abrirItem(item) {
    if (!item.leida) {
      await api.post(`/notificaciones/${encodeURIComponent(item.clave)}/leer`);
    }
    setAbierto(false);
    navigate(item.ruta);
    cargar();
  }

  async function leerTodas() {
    await api.post('/notificaciones/leer-todas');
    cargar();
  }

  return (
    <div className="notification-center" ref={contenedor}>
      <button
        type="button"
        className={`topbar-icon-button notification-trigger ${abierto ? 'is-open' : ''}`}
        aria-label="Notificaciones"
        onClick={() => { setAbierto(v => !v); if (!abierto) cargar(); }}
      >
        <span className="notification-bell" aria-hidden="true">🔔</span>
        {datos.noLeidas > 0 && <b>{datos.noLeidas > 99 ? '99+' : datos.noLeidas}</b>}
      </button>

      {abierto && (
        <div className="notification-popover">
          <div className="notification-header">
            <div><strong>Notificaciones</strong><small>{datos.noLeidas} sin leer</small></div>
            {datos.noLeidas > 0 && <button type="button" onClick={leerTodas}>Marcar todas</button>}
          </div>

          <div className="notification-list">
            {cargando && datos.items.length === 0 ? (
              <div className="notification-empty">Cargando alertas…</div>
            ) : datos.items.length === 0 ? (
              <div className="notification-empty"><span>✓</span><strong>Todo al día</strong><p>No hay alertas pendientes.</p></div>
            ) : datos.items.map(item => (
              <button
                type="button"
                key={item.clave}
                className={`notification-item ${item.leida ? 'is-read' : ''} level-${item.nivel}`}
                onClick={() => abrirItem(item)}
              >
                <span className="notification-type-icon">{ICONOS[item.tipo] || '•'}</span>
                <span className="notification-copy"><strong>{item.titulo}</strong><small>{item.detalle}</small></span>
                {!item.leida && <i />}
              </button>
            ))}
          </div>
          <div className="notification-footer">Se actualiza automáticamente cada minuto</div>
        </div>
      )}
    </div>
  );
}
