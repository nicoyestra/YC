import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const permisos = {
  ventas: ['admin', 'ventas'], compras: ['admin', 'compras'], articulos: ['admin', 'inventario', 'compras'],
  inventario: ['admin', 'inventario'], estadisticas: ['admin'], usuarios: ['admin'], clientes: ['admin', 'ventas'],
  facturacion: ['admin', 'ventas'], logistica: ['admin', 'ventas', 'inventario'], rrhh: ['admin', 'rrhh'],
};

const dinero = (valor) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(valor || 0));

function MiniGrafico({ datos }) {
  const puntos = useMemo(() => {
    if (!datos?.length) return '';
    const valores = datos.map(x => Number(x.total));
    const max = Math.max(...valores, 1);
    return valores.map((v, i) => `${(i/(valores.length-1))*100},${44-(v/max)*38}`).join(' ');
  }, [datos]);
  return <svg className="sales-chart" viewBox="0 0 100 48" preserveAspectRatio="none" aria-label="Ventas últimos 30 días"><polyline points={puntos} fill="none" vectorEffect="non-scaling-stroke" /><line x1="0" y1="44" x2="100" y2="44" /></svg>;
}

export default function Inicio() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const rol = usuario?.rol || '';
  const puede = (modulo) => permisos[modulo]?.includes(rol);

  useEffect(() => {
    api.get('/dashboard/resumen').then(r => setData(r.data)).catch(e => setError(e.response?.data?.error || 'No se pudo cargar el dashboard')).finally(() => setCargando(false));
  }, []);

  const k = data?.kpis || {};
  const tarjetas = [
    { modulo:'ventas', ruta:'/ventas', etiqueta:'Ventas de hoy', valor:dinero(k.ventasHoy?.total), detalle:`${k.ventasHoy?.cantidad || 0} comprobantes`, clase:'kpi-blue', icono:'↑' },
    { modulo:'ventas', ruta:'/ventas', etiqueta:'Ventas del mes', valor:dinero(k.ventasMes?.total), detalle:`${k.ventasMes?.cantidad || 0} comprobantes`, clase:'kpi-indigo', icono:'▥' },
    { modulo:'facturacion', ruta:'/facturacion', etiqueta:'Por cobrar', valor:dinero(k.facturasPendientes?.total), detalle:`${k.facturasPendientes?.cantidad || 0} facturas`, clase:'kpi-orange', icono:'$' },
    { modulo:'inventario', ruta:'/inventario', etiqueta:'Stock bajo', valor:k.stockBajo?.cantidad || 0, detalle:`de ${k.productos?.cantidad || 0} artículos`, clase:'kpi-red', icono:'△' },
    { modulo:'compras', ruta:'/compras', etiqueta:'Compras pendientes', valor:k.comprasPendientes?.cantidad || 0, detalle:dinero(k.comprasPendientes?.total), clase:'kpi-cyan', icono:'↓' },
    { modulo:'clientes', ruta:'/clientes', etiqueta:'Clientes activos', valor:k.clientes?.cantidad || 0, detalle:'base comercial', clase:'kpi-slate', icono:'♙' },
  ].filter(x => puede(x.modulo));

  const accesos = [
    { modulo:'ventas', ruta:'/ventas', titulo:'Nueva venta', detalle:'Registrar operación', icono:'↑' },
    { modulo:'compras', ruta:'/compras', titulo:'Nueva compra', detalle:'Cargar orden', icono:'↓' },
    { modulo:'articulos', ruta:'/articulos', titulo:'Nuevo artículo', detalle:'Administrar catálogo', icono:'▦' },
    { modulo:'clientes', ruta:'/clientes', titulo:'Nuevo cliente', detalle:'Gestionar contactos', icono:'♙' },
    { modulo:'rrhh', ruta:'/rrhh', titulo:'Nuevo empleado', detalle:'Gestionar RRHH', icono:'♧' },
  ].filter(x => puede(x.modulo));

  if (cargando) return <div className="dashboard-loading"><span /><p>Cargando centro de control…</p></div>;
  if (error) return <div className="tarjeta error">{error}</div>;

  return (
    <div className="dashboard-v15">
      <section className="control-hero">
        <div><span className="eyebrow">CENTRO DE CONTROL</span><h1>Buen día, {usuario?.nombre_usuario || 'Administrador'} 👋</h1><p>Esta es la situación actual de tu empresa, actualizada en tiempo real.</p></div>
        <div className="live-pill"><i /> En línea</div>
      </section>

      <section className="kpi-grid">
        {tarjetas.map(t => <button key={t.etiqueta} className={`kpi-card ${t.clase}`} onClick={() => navigate(t.ruta)}><span className="kpi-icon">{t.icono}</span><small>{t.etiqueta}</small><strong>{t.valor}</strong><p>{t.detalle}</p></button>)}
      </section>

      <section className="dashboard-main-grid">
        {(rol === 'admin' || rol === 'ventas') && (
          <article className="tarjeta dashboard-widget chart-widget">
            <div className="widget-heading"><div><span className="eyebrow">RENDIMIENTO</span><h3>Ventas de los últimos 30 días</h3></div><button onClick={() => navigate('/estadisticas')}>Ver estadísticas →</button></div>
            <MiniGrafico datos={data?.ventas30Dias} />
            <div className="chart-labels"><span>Hace 30 días</span><strong>{dinero(k.ventasMes?.total)}</strong><span>Hoy</span></div>
          </article>
        )}

        <article className="tarjeta dashboard-widget attention-widget">
          <div className="widget-heading"><div><span className="eyebrow">ATENCIÓN</span><h3>Lo que necesita revisión</h3></div></div>
          <div className="attention-list">
            {puede('inventario') && <button onClick={() => navigate('/inventario')}><span className="attention-red">△</span><div><strong>{k.stockBajo?.cantidad || 0} artículos con stock bajo</strong><small>Revisar existencias y mínimos</small></div><b>›</b></button>}
            {puede('compras') && <button onClick={() => navigate('/compras')}><span className="attention-blue">↓</span><div><strong>{k.comprasPendientes?.cantidad || 0} compras sin recibir</strong><small>{dinero(k.comprasPendientes?.total)} comprometidos</small></div><b>›</b></button>}
            {puede('facturacion') && <button onClick={() => navigate('/facturacion')}><span className="attention-orange">$</span><div><strong>{k.facturasPendientes?.cantidad || 0} facturas pendientes</strong><small>{dinero(k.facturasPendientes?.total)} por cobrar</small></div><b>›</b></button>}
            {puede('logistica') && <button onClick={() => navigate('/logistica')}><span className="attention-cyan">⌁</span><div><strong>{k.logisticaPendiente?.cantidad || 0} operaciones logísticas</strong><small>Pendientes o en curso</small></div><b>›</b></button>}
          </div>
        </article>

        {(rol === 'admin' || rol === 'ventas') && <article className="tarjeta dashboard-widget top-products-widget"><div className="widget-heading"><div><span className="eyebrow">RANKING</span><h3>Productos más vendidos</h3></div></div><div className="product-ranking">{data?.topProductos?.length ? data.topProductos.map((p,i) => <div key={p.id}><span>{i+1}</span><div><strong>{p.nombre}</strong><small>{p.sku}</small></div><b>{p.cantidad} u.</b></div>) : <p className="widget-empty">Todavía no hay ventas suficientes.</p>}</div></article>}

        <article className="tarjeta dashboard-widget activity-widget"><div className="widget-heading"><div><span className="eyebrow">ACTIVIDAD</span><h3>Últimos movimientos</h3></div></div><div className="activity-list">{data?.actividadReciente?.length ? data.actividadReciente.map(x => <button key={`${x.tipo}-${x.id}`} onClick={() => navigate(x.ruta)}><i /><div><strong>{x.titulo}</strong><small>{x.detalle}</small></div><time>{new Date(x.fecha).toLocaleDateString('es-AR')}</time></button>) : <p className="widget-empty">Sin actividad reciente.</p>}</div></article>

        <aside className="tarjeta dashboard-widget quick-widget"><div className="widget-heading"><div><span className="eyebrow">ATAJOS</span><h3>Accesos rápidos</h3></div></div><div className="quick-list">{accesos.map(a => <button key={a.ruta} className="quick-access-button" onClick={() => navigate(a.ruta)}><span>{a.icono}</span><div><strong>{a.titulo}</strong><small>{a.detalle}</small></div><b>›</b></button>)}</div></aside>
      </section>
    </div>
  );
}
