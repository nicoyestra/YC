import { Fragment, useEffect, useState } from 'react';
import api from '../api/client';

const ITEM_VACIO = { producto_id: '', cantidad: '', precio_unitario: '' };

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function Devoluciones() {
  const [devoluciones, setDevoluciones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState('');

  const [nueva, setNueva] = useState({
    cliente_id: '', orden_venta_id: '', almacen_id: '', motivo: '', fecha: hoy(),
    items: [{ ...ITEM_VACIO }],
  });

  async function cargar() {
    const [devRes, cliRes, ordRes, prodRes, almRes] = await Promise.all([
      api.get('/devoluciones'),
      api.get('/ventas/clientes'),
      api.get('/ventas/ordenes', { params: { estado: 'confirmada' } }),
      api.get('/productos'),
      api.get('/inventario/almacenes'),
    ]);
    setDevoluciones(devRes.data);
    setClientes(cliRes.data);
    setOrdenes(ordRes.data);
    setProductos(prodRes.data);
    setAlmacenes(almRes.data);
  }

  useEffect(() => { cargar(); }, []);

  function actualizarItem(index, campo, valor) {
    const items = [...nueva.items];
    items[index] = { ...items[index], [campo]: valor };
    if (campo === 'producto_id') {
      const prod = productos.find((p) => p.id === Number(valor));
      if (prod) items[index].precio_unitario = prod.precio_venta;
    }
    setNueva({ ...nueva, items });
  }

  function agregarItem() {
    setNueva({ ...nueva, items: [...nueva.items, { ...ITEM_VACIO }] });
  }

  function quitarItem(index) {
    const items = nueva.items.filter((_, i) => i !== index);
    setNueva({ ...nueva, items: items.length ? items : [{ ...ITEM_VACIO }] });
  }

  // Filtra las órdenes de venta según el cliente elegido (para no mostrar las de otros)
  const ordenesDelCliente = nueva.cliente_id
    ? ordenes.filter((o) => o.cliente_id === Number(nueva.cliente_id))
    : [];

  const totalDevolucion = nueva.items.reduce(
    (acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0),
    0
  );

  async function crearDevolucion(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...nueva,
        orden_venta_id: nueva.orden_venta_id || null,
        items: nueva.items.map((it) => ({
          producto_id: Number(it.producto_id),
          cantidad: Number(it.cantidad),
          precio_unitario: Number(it.precio_unitario),
        })),
      };
      const { data } = await api.post('/devoluciones', payload);
      setMostrarForm(false);
      setNueva({ cliente_id: '', orden_venta_id: '', almacen_id: '', motivo: '', fecha: hoy(), items: [{ ...ITEM_VACIO }] });
      cargar();
      if (data.notaCredito) {
        alert(`Devolución ${data.numero} registrada. Se generó la nota de crédito ${data.notaCredito.numero} por $${data.notaCredito.total.toFixed(2)}.`);
      } else {
        alert(`Devolución ${data.numero} registrada (no había factura asociada, no se generó nota de crédito).`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar la devolución');
    }
  }

  async function verDetalle(id) {
    if (expandido === id) {
      setExpandido(null);
      setDetalle(null);
      return;
    }
    setExpandido(id);
    const { data } = await api.get(`/devoluciones/${id}`);
    setDetalle(data);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Devoluciones</h1>
        <button className="boton" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Nueva devolución'}
        </button>
      </div>
      <p style={{ color: '#6b7280', marginTop: -10 }}>
        Si la devolución está vinculada a una orden de venta que ya tiene factura, se genera
        automáticamente la nota de crédito correspondiente.
      </p>

      {error && <div className="error">{error}</div>}

      {mostrarForm && (
        <form className="tarjeta" onSubmit={crearDevolucion}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Cliente</label>
              <select
                value={nueva.cliente_id}
                onChange={(e) => setNueva({ ...nueva, cliente_id: e.target.value, orden_venta_id: '' })}
                required
              >
                <option value="">Seleccionar</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Orden de venta relacionada (opcional)</label>
              <select value={nueva.orden_venta_id} onChange={(e) => setNueva({ ...nueva, orden_venta_id: e.target.value })}>
                <option value="">Sin relacionar</option>
                {ordenesDelCliente.map((o) => <option key={o.id} value={o.id}>{o.numero}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Almacén de destino</label>
              <select value={nueva.almacen_id} onChange={(e) => setNueva({ ...nueva, almacen_id: e.target.value })} required>
                <option value="">Seleccionar</option>
                {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Fecha</label>
              <input type="date" value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })} required />
            </div>
          </div>

          <label>Motivo</label>
          <input
            value={nueva.motivo}
            onChange={(e) => setNueva({ ...nueva, motivo: e.target.value })}
            required
            placeholder="Ej: producto en mal estado, talle incorrecto, arrepentimiento de compra..."
          />

          <h4>Ítems devueltos</h4>
          {nueva.items.map((item, i) => (
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

          <div style={{ marginTop: 16, fontWeight: 600 }}>Total: ${totalDevolucion.toFixed(2)}</div>
          <button className="boton" style={{ marginTop: 10 }}>Registrar devolución</button>
        </form>
      )}

      <div className="tarjeta">
        <table>
          <thead>
            <tr><th>Número</th><th>Cliente</th><th>Motivo</th><th>Total</th><th>Nota de crédito</th><th>Fecha</th><th></th></tr>
          </thead>
          <tbody>
            {devoluciones.map((d) => (
              <Fragment key={d.id}>
                <tr>
                  <td>{d.numero}</td>
                  <td>{d.cliente_nombre}</td>
                  <td>{d.motivo}</td>
                  <td>${Number(d.subtotal).toFixed(2)}</td>
                  <td>
                    {d.numero_nota_credito
                      ? <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>{d.numero_nota_credito}</span>
                      : '—'}
                  </td>
                  <td>{String(d.fecha).slice(0, 10)}</td>
                  <td>
                    <button className="boton boton-secundario" onClick={() => verDetalle(d.id)}>
                      {expandido === d.id ? 'Ocultar' : 'Ver ítems'}
                    </button>
                  </td>
                </tr>
                {expandido === d.id && detalle && (
                  <tr>
                    <td colSpan={7}>
                      <table>
                        <thead><tr><th>SKU</th><th>Producto</th><th>Cantidad</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
                        <tbody>
                          {detalle.detalle.map((it) => (
                            <tr key={it.id}>
                              <td>{it.sku}</td>
                              <td>{it.producto_nombre}</td>
                              <td>{it.cantidad}</td>
                              <td>${Number(it.precio_unitario).toFixed(2)}</td>
                              <td>${Number(it.subtotal).toFixed(2)}</td>
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
