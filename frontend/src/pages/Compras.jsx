import { Fragment, useEffect, useState } from 'react';
import api from '../api/client';

const ITEM_VACIO = { producto_id: '', cantidad: '', precio_unitario: '' };

export default function Compras() {
  const [proveedores, setProveedores] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);

  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [busquedaOrden, setBusquedaOrden] = useState('');
  const [mostrarFormProveedor, setMostrarFormProveedor] = useState(false);
  const [mostrarFormOrden, setMostrarFormOrden] = useState(false);
  const [ordenExpandida, setOrdenExpandida] = useState(null);
  const [detalleOrden, setDetalleOrden] = useState(null);
  const [recepcion, setRecepcion] = useState({}); // { detalle_id: cantidad }
  const [error, setError] = useState('');

  const [nuevoProveedor, setNuevoProveedor] = useState({ nombre: '', cuit: '', email: '', telefono: '' });
  const [nuevaOrden, setNuevaOrden] = useState({
    proveedor_id: '', almacen_id: '', fecha: '', observaciones: '',
    items: [{ ...ITEM_VACIO }],
  });

  async function cargar(filtroProv = '', filtroOrd = '') {
    const [provRes, ordRes, prodRes, almRes] = await Promise.all([
      api.get('/compras/proveedores', { params: filtroProv ? { buscar: filtroProv } : {} }),
      api.get('/compras/ordenes', { params: filtroOrd ? { numero: filtroOrd } : {} }),
      api.get('/productos'),
      api.get('/inventario/almacenes'),
    ]);
    setProveedores(provRes.data);
    setOrdenes(ordRes.data);
    setProductos(prodRes.data);
    setAlmacenes(almRes.data);
  }

  useEffect(() => { cargar(); }, []);

  function buscarProveedor(e) {
    e.preventDefault();
    cargar(busquedaProveedor, busquedaOrden);
  }

  function buscarOrden(e) {
    e.preventDefault();
    cargar(busquedaProveedor, busquedaOrden);
  }

  async function crearProveedor(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/compras/proveedores', nuevoProveedor);
      setMostrarFormProveedor(false);
      setNuevoProveedor({ nombre: '', cuit: '', email: '', telefono: '' });
      cargar(busquedaProveedor, busquedaOrden);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear proveedor');
    }
  }

  function actualizarItem(index, campo, valor) {
    const items = [...nuevaOrden.items];
    items[index] = { ...items[index], [campo]: valor };

    if (campo === 'producto_id') {
      const prod = productos.find((p) => p.id === Number(valor));
      if (prod) items[index].precio_unitario = prod.precio_costo;
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
      const { data } = await api.post('/compras/ordenes', payload);
      setMostrarFormOrden(false);
      setNuevaOrden({ proveedor_id: '', almacen_id: '', fecha: '', observaciones: '', items: [{ ...ITEM_VACIO }] });
      cargar(busquedaProveedor, busquedaOrden);
      alert(`Orden creada con el número automático ${data.numero}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la orden de compra');
    }
  }

  async function verDetalle(id) {
    if (ordenExpandida === id) {
      setOrdenExpandida(null);
      setDetalleOrden(null);
      return;
    }
    setOrdenExpandida(id);
    const { data } = await api.get(`/compras/ordenes/${id}`);
    setDetalleOrden(data);
    // Prepara el formulario de recepción con lo que falta de cada ítem
    const inicial = {};
    data.detalle.forEach((d) => { inicial[d.id] = d.cantidad - d.cantidad_recibida; });
    setRecepcion(inicial);
  }

  async function confirmarRecepcion(ordenId) {
    setError('');
    try {
      const items = Object.entries(recepcion).map(([detalle_id, cantidad_recibida]) => ({
        detalle_id: Number(detalle_id),
        cantidad_recibida: (detalleOrden.detalle.find((d) => d.id === Number(detalle_id))?.cantidad_recibida || 0) + Number(cantidad_recibida || 0),
      }));
      await api.post(`/compras/ordenes/${ordenId}/recibir`, { items });
      setOrdenExpandida(null);
      setDetalleOrden(null);
      cargar(busquedaProveedor, busquedaOrden);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar la recepción');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Compras</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="boton boton-secundario" onClick={() => setMostrarFormProveedor(!mostrarFormProveedor)}>
            {mostrarFormProveedor ? 'Cancelar' : '+ Proveedor'}
          </button>
          <button className="boton" onClick={() => setMostrarFormOrden(!mostrarFormOrden)}>
            {mostrarFormOrden ? 'Cancelar' : '+ Orden de compra'}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {mostrarFormProveedor && (
        <form className="tarjeta" onSubmit={crearProveedor}>
          <label>Nombre</label>
          <input value={nuevoProveedor.nombre} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, nombre: e.target.value })} required />
          <label>CUIT</label>
          <input value={nuevoProveedor.cuit} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, cuit: e.target.value })} />
          <label>Email</label>
          <input type="email" value={nuevoProveedor.email} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, email: e.target.value })} />
          <label>Teléfono</label>
          <input value={nuevoProveedor.telefono} onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, telefono: e.target.value })} />
          <button className="boton">Guardar proveedor</button>
        </form>
      )}

      {mostrarFormOrden && (
        <form className="tarjeta" onSubmit={crearOrden}>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 0 }}>
            El número de orden se genera automáticamente al guardar.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Proveedor</label>
              <select value={nuevaOrden.proveedor_id} onChange={(e) => setNuevaOrden({ ...nuevaOrden, proveedor_id: e.target.value })} required>
                <option value="">Seleccionar</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Almacén destino</label>
              <select value={nuevaOrden.almacen_id} onChange={(e) => setNuevaOrden({ ...nuevaOrden, almacen_id: e.target.value })} required>
                <option value="">Seleccionar</option>
                {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Fecha</label>
              <input type="date" value={nuevaOrden.fecha} onChange={(e) => setNuevaOrden({ ...nuevaOrden, fecha: e.target.value })} required />
            </div>
          </div>

          <label>Observaciones (opcional)</label>
          <textarea
            rows={2}
            value={nuevaOrden.observaciones}
            onChange={(e) => setNuevaOrden({ ...nuevaOrden, observaciones: e.target.value })}
            placeholder="Ej: si no llega todo junto, anotá acá los detalles de la entrega parcial"
          />

          <h4>Ítems</h4>
          {nuevaOrden.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 3 }}>
                <label>Producto</label>
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
          ))}
          <button type="button" className="boton boton-secundario" onClick={agregarItem}>+ Agregar ítem</button>

          <div style={{ marginTop: 16, fontWeight: 600 }}>Total: ${totalOrden.toFixed(2)}</div>
          <button className="boton" style={{ marginTop: 10 }}>Crear orden de compra</button>
        </form>
      )}

      <div className="tarjeta">
        <h3>Proveedores</h3>
        <form onSubmit={buscarProveedor} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label>🔍 Buscar proveedor</label>
            <input value={busquedaProveedor} onChange={(e) => setBusquedaProveedor(e.target.value)} placeholder="Nombre, CUIT o email..." style={{ marginBottom: 0 }} />
          </div>
          <button className="boton boton-secundario">Buscar</button>
        </form>
        <table>
          <thead><tr><th>Nombre</th><th>CUIT</th><th>Email</th><th>Teléfono</th></tr></thead>
          <tbody>
            {proveedores.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td><td>{p.cuit}</td><td>{p.email}</td><td>{p.telefono}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tarjeta">
        <h3>Órdenes de compra</h3>
        <form onSubmit={buscarOrden} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label>🔍 Buscar por número de orden</label>
            <input value={busquedaOrden} onChange={(e) => setBusquedaOrden(e.target.value)} placeholder="Ej: OC-000012" style={{ marginBottom: 0 }} />
          </div>
          <button className="boton boton-secundario">Buscar</button>
        </form>
        <table>
          <thead><tr><th>Número</th><th>Proveedor</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead>
          <tbody>
            {ordenes.map((o) => (
              <Fragment key={o.id}>
                <tr>
                  <td>{o.numero}</td>
                  <td>{o.proveedor_nombre}</td>
                  <td>{o.estado}</td>
                  <td>${Number(o.total).toFixed(2)}</td>
                  <td>
                    <button className="boton boton-secundario" onClick={() => verDetalle(o.id)}>
                      {ordenExpandida === o.id ? 'Ocultar' : 'Ver / recibir'}
                    </button>
                  </td>
                </tr>
                {ordenExpandida === o.id && detalleOrden && (
                  <tr>
                    <td colSpan={5}>
                      {detalleOrden.observaciones && (
                        <p><strong>Observaciones:</strong> {detalleOrden.observaciones}</p>
                      )}
                      <table>
                        <thead>
                          <tr><th>SKU</th><th>Producto</th><th>Pedido</th><th>Recibido</th><th>A recibir ahora</th></tr>
                        </thead>
                        <tbody>
                          {detalleOrden.detalle.map((d) => (
                            <tr key={d.id}>
                              <td>{d.sku}</td>
                              <td>{d.producto_nombre}</td>
                              <td>{d.cantidad}</td>
                              <td>{d.cantidad_recibida}</td>
                              <td>
                                {d.cantidad_recibida >= d.cantidad ? (
                                  <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>Completo</span>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    max={d.cantidad - d.cantidad_recibida}
                                    value={recepcion[d.id] ?? 0}
                                    onChange={(e) => setRecepcion({ ...recepcion, [d.id]: e.target.value })}
                                    style={{ marginBottom: 0, width: 90 }}
                                  />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {o.estado !== 'recibida' && o.estado !== 'cancelada' && (
                        <button className="boton" style={{ marginTop: 10 }} onClick={() => confirmarRecepcion(o.id)}>
                          Registrar recepción (parcial o total)
                        </button>
                      )}
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
