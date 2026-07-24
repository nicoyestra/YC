import { Fragment, useEffect, useState } from 'react';
import api from '../api/client';

const ITEM_VACIO = { producto_id: '', cantidad: '', precio_unitario: '' };

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function Ventas() {
  const [clientes, setClientes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);

  const [mostrarFormOrden, setMostrarFormOrden] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [ordenExpandida, setOrdenExpandida] = useState(null);
  const [detalleOrden, setDetalleOrden] = useState(null);
  const [error, setError] = useState('');

  const [nuevaOrden, setNuevaOrden] = useState({
    numero: '', cliente_id: '', almacen_id: '', fecha: hoy(),
    items: [{ ...ITEM_VACIO }],
  });

  async function cargar(estado = '') {
    const [cliRes, ordRes, prodRes, almRes] = await Promise.all([
      api.get('/ventas/clientes'),
      api.get('/ventas/ordenes', { params: estado ? { estado } : {} }),
      api.get('/productos'),
      api.get('/inventario/almacenes'),
    ]);
    setClientes(cliRes.data);
    setOrdenes(ordRes.data);
    setProductos(prodRes.data);
    setAlmacenes(almRes.data);
  }

  useEffect(() => { cargar(); }, []);

  function actualizarItem(index, campo, valor) {
    const items = [...nuevaOrden.items];
    items[index] = { ...items[index], [campo]: valor };

    if (campo === 'producto_id') {
      const prod = productos.find((p) => p.id === Number(valor));
      if (prod) items[index].precio_unitario = prod.precio_venta;
    }

    setNuevaOrden({ ...nuevaOrden, items });
  }

  function agregarItem() {
    setNuevaOrden({ ...nuevaOrden, items: [...nuevaOrden.items, { ...ITEM_VACIO }] });
  }

  function quitarItem(index) {
    const items = nuevaOrden.items.filter((_, i) => i !== index);
    setNuevaOrden({ ...nuevaOrden, items: items.length ? items : [{ ...ITEM_VACIO }] });
  }

  function stockDisponible(productoId) {
    const prod = productos.find((p) => p.id === Number(productoId));
    return prod ? prod.stock_total : null;
  }

  const totalOrden = nuevaOrden.items.reduce(
    (acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0),
    0
  );

  async function crearOrden(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...nuevaOrden,
        items: nuevaOrden.items.map((it) => ({
          producto_id: Number(it.producto_id),
          cantidad: Number(it.cantidad),
          precio_unitario: Number(it.precio_unitario),
        })),
      };
      await api.post('/ventas/ordenes', payload);
      setMostrarFormOrden(false);
      setNuevaOrden({ numero: '', cliente_id: '', almacen_id: '', fecha: hoy(), items: [{ ...ITEM_VACIO }] });
      cargar(filtroEstado);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la orden de venta');
    }
  }

  async function confirmarOrden(id) {
    setError('');
    try {
      await api.post(`/ventas/ordenes/${id}/confirmar`);
      cargar(filtroEstado);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al confirmar la orden (revisá el stock disponible)');
    }
  }

  async function verDetalle(id) {
    if (ordenExpandida === id) {
      setOrdenExpandida(null);
      setDetalleOrden(null);
      return;
    }
    setOrdenExpandida(id);
    const { data } = await api.get(`/ventas/ordenes/${id}`);
    setDetalleOrden(data);
  }

  function cambiarFiltro(estado) {
    setFiltroEstado(estado);
    cargar(estado);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Ventas</h1>
        <button className="boton" onClick={() => setMostrarFormOrden(!mostrarFormOrden)}>
          {mostrarFormOrden ? 'Cancelar' : '+ Orden de venta'}
        </button>
      </div>
      <p style={{ color: '#6b7280', marginTop: -10 }}>
        La gestión de clientes se mudó a su propia sección — andá a <strong>Clientes</strong> en el menú.
      </p>

      {error && <div className="error">{error}</div>}

      {mostrarFormOrden && (
        <form className="tarjeta" onSubmit={crearOrden}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Número de orden</label>
              <input value={nuevaOrden.numero} onChange={(e) => setNuevaOrden({ ...nuevaOrden, numero: e.target.value })} required placeholder="OV-0001" />
            </div>
            <div style={{ flex: 1 }}>
              <label>Cliente</label>
              <select value={nuevaOrden.cliente_id} onChange={(e) => setNuevaOrden({ ...nuevaOrden, cliente_id: e.target.value })} required>
                <option value="">Seleccionar</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.es_externo ? ' (externo)' : ''}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Almacén origen</label>
              <select value={nuevaOrden.almacen_id} onChange={(e) => setNuevaOrden({ ...nuevaOrden, almacen_id: e.target.value })} required>
                <option value="">Seleccionar</option>
                {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Fecha (hoy por defecto, editable)</label>
              <input type="date" value={nuevaOrden.fecha} onChange={(e) => setNuevaOrden({ ...nuevaOrden, fecha: e.target.value })} required />
            </div>
          </div>

          <h4>Ítems</h4>
          {nuevaOrden.items.map((item, i) => {
            const disponible = stockDisponible(item.producto_id);
            const excede = disponible !== null && Number(item.cantidad) > disponible;
            return (
              <div key={i}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ flex: 3 }}>
                    <label>Producto {disponible !== null && `(stock: ${disponible})`}</label>
                    <select value={item.producto_id} onChange={(e) => actualizarItem(i, 'producto_id', e.target.value)} required>
                      <option value="">Seleccionar</option>
                      {productos.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.nombre}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Cantidad</label>
                    <input type="number" min="1" value={item.cantidad} onChange={(e) => actualizarItem(i, 'cantidad', e.target.value)} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Precio unitario</label>
                    <input type="number" step="0.01" min="0" value={item.precio_unitario} onChange={(e) => actualizarItem(i, 'precio_unitario', e.target.value)} required />
                  </div>
                  <button type="button" className="boton boton-secundario" style={{ marginBottom: 12 }} onClick={() => quitarItem(i)}>Quitar</button>
                </div>
                {excede && <div className="error" style={{ marginTop: -8 }}>La cantidad supera el stock disponible ({disponible}) — igual podés guardarla como pendiente, se validará al confirmar.</div>}
              </div>
            );
          })}
          <button type="button" className="boton boton-secundario" onClick={agregarItem}>+ Agregar ítem</button>

          <div style={{ marginTop: 16, fontWeight: 600 }}>Total: ${totalOrden.toFixed(2)}</div>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            La orden queda como <strong>pendiente</strong> y no descuenta stock hasta que alguien la confirme
            (puede ser otro sector, desde el listado de abajo).
          </p>
          <button className="boton" style={{ marginTop: 10 }}>Guardar orden de venta</button>
        </form>
      )}

      <div className="tarjeta">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Órdenes de venta</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {['', 'pendiente', 'confirmada', 'entregada', 'cancelada'].map((e) => (
              <button
                key={e || 'todas'}
                className={`boton ${filtroEstado === e ? '' : 'boton-secundario'}`}
                onClick={() => cambiarFiltro(e)}
              >
                {e || 'Todas'}
              </button>
            ))}
          </div>
        </div>
        <table>
          <thead><tr><th>Número</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead>
          <tbody>
            {ordenes.map((o) => (
              <Fragment key={o.id}>
                <tr>
                  <td>{o.numero}</td>
                  <td>{o.cliente_nombre}{o.es_externo ? ' (externo)' : ''}</td>
                  <td>{o.estado}</td>
                  <td>${Number(o.total).toFixed(2)}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button className="boton boton-secundario" onClick={() => verDetalle(o.id)}>
                      {ordenExpandida === o.id ? 'Ocultar' : 'Ver ítems'}
                    </button>
                    {o.estado === 'pendiente' && (
                      <button className="boton" onClick={() => confirmarOrden(o.id)}>Confirmar (descuenta stock)</button>
                    )}
                  </td>
                </tr>
                {ordenExpandida === o.id && detalleOrden && (
                  <tr>
                    <td colSpan={5}>
                      <table>
                        <thead><tr><th>SKU</th><th>Producto</th><th>Cantidad</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
                        <tbody>
                          {detalleOrden.detalle.map((d) => (
                            <tr key={d.id}>
                              <td>{d.sku}</td>
                              <td>{d.producto_nombre}</td>
                              <td>{d.cantidad}</td>
                              <td>${Number(d.precio_unitario).toFixed(2)}</td>
                              <td>${Number(d.subtotal).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
