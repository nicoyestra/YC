import { Fragment, useEffect, useState } from 'react';
import api from '../api/client';

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarMovimiento, setMostrarMovimiento] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [error, setError] = useState('');

  const [movimiento, setMovimiento] = useState({ almacen_id: '', tipo: 'entrada', cantidad: '', motivo: '' });

  async function cargarDatos(filtro = '') {
    const [prodRes, almRes] = await Promise.all([
      api.get('/productos', { params: filtro ? { buscar: filtro } : {} }),
      api.get('/inventario/almacenes'),
    ]);
    setProductos(prodRes.data);
    setAlmacenes(almRes.data);
  }

  useEffect(() => { cargarDatos(); }, []);

  function buscar(e) {
    e.preventDefault();
    cargarDatos(busqueda);
  }

  async function registrarMovimiento(e, productoId) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/inventario/movimientos', { ...movimiento, producto_id: productoId });
      setMostrarMovimiento(null);
      setMovimiento({ almacen_id: '', tipo: 'entrada', cantidad: '', motivo: '' });
      cargarDatos(busqueda);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar movimiento');
    }
  }

  return (
    <div>
      <h1>Inventario</h1>
      <p style={{ color: '#6b7280', marginTop: -10 }}>
        Acá ves stock y movimientos. Para dar de alta un artículo nuevo o editar sus datos (SKU, código
        de barras, precios), andá a <strong>Artículos</strong>.
      </p>

      {error && <div className="error">{error}</div>}

      <form className="tarjeta" onSubmit={buscar} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label>Buscar artículo</label>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="SKU, nombre o descripción..." />
        </div>
        <button className="boton boton-secundario" style={{ marginBottom: 12 }}>Buscar</button>
      </form>

      <div className="tarjeta">
        <table>
          <thead>
            <tr>
              <th>SKU</th><th>Nombre</th><th>Proveedor</th><th>Stock total</th>
              <th>Precio compra (s/IVA)</th><th>IVA</th><th>Precio venta</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>{p.sku}</td>
                  <td>
                    {p.nombre}
                    <div>
                      <button
                        className="boton boton-secundario"
                        style={{ padding: '2px 8px', fontSize: 12, marginTop: 4 }}
                        onClick={() => setExpandido(expandido === p.id ? null : p.id)}
                      >
                        {expandido === p.id ? 'Ocultar desc.' : 'Ver descripción'}
                      </button>
                    </div>
                  </td>
                  <td>{p.proveedor_nombre || '—'}</td>
                  <td>{p.stock_total}</td>
                  <td>${Number(p.precio_costo).toFixed(2)}</td>
                  <td>{p.iva_porcentaje}%</td>
                  <td>${Number(p.precio_venta).toFixed(2)}</td>
                  <td>
                    <button
                      className="boton boton-secundario"
                      onClick={() => setMostrarMovimiento(mostrarMovimiento === p.id ? null : p.id)}
                    >
                      Movimiento
                    </button>
                  </td>
                </tr>
                {expandido === p.id && (
                  <tr>
                    <td colSpan={8} style={{ background: '#f9fafb' }}>
                      <strong>Descripción:</strong> {p.descripcion || 'Sin descripción cargada.'}
                    </td>
                  </tr>
                )}
                {mostrarMovimiento === p.id && (
                  <tr>
                    <td colSpan={8}>
                      <form onSubmit={(e) => registrarMovimiento(e, p.id)} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label>Almacén</label>
                          <select value={movimiento.almacen_id} onChange={(e) => setMovimiento({ ...movimiento, almacen_id: e.target.value })} required>
                            <option value="">Seleccionar</option>
                            {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label>Tipo</label>
                          <select value={movimiento.tipo} onChange={(e) => setMovimiento({ ...movimiento, tipo: e.target.value })}>
                            <option value="entrada">Entrada</option>
                            <option value="salida">Salida</option>
                            <option value="ajuste">Ajuste</option>
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label>Cantidad</label>
                          <input type="number" value={movimiento.cantidad} onChange={(e) => setMovimiento({ ...movimiento, cantidad: e.target.value })} required />
                        </div>
                        <div style={{ flex: 2 }}>
                          <label>Motivo</label>
                          <input value={movimiento.motivo} onChange={(e) => setMovimiento({ ...movimiento, motivo: e.target.value })} />
                        </div>
                        <button className="boton" style={{ marginBottom: 12 }}>Confirmar</button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
