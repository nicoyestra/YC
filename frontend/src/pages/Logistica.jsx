import { Fragment, useEffect, useState } from 'react';
import api from '../api/client';

const VACIO = { tipo: 'despacho', cliente_id: '', orden_venta_id: '', direccion: '', codigo_postal: '', fecha: '', notas: '' };

export default function Logistica() {
  const [registros, setRegistros] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [error, setError] = useState('');
  const [expandido, setExpandido] = useState(null);
  const [detalleOrden, setDetalleOrden] = useState(null);

  async function cargar() {
    const [logRes, cliRes, ordRes] = await Promise.all([
      api.get('/logistica'),
      api.get('/ventas/clientes'),
      api.get('/ventas/ordenes'),
    ]);
    setRegistros(logRes.data);
    setClientes(cliRes.data);
    setOrdenes(ordRes.data);
  }

  useEffect(() => { cargar(); }, []);

  // Autocompleta dirección y CP con los datos ya cargados del cliente
  function elegirCliente(clienteId) {
    const cliente = clientes.find((c) => c.id === Number(clienteId));
    setNuevo({
      ...nuevo,
      cliente_id: clienteId,
      direccion: cliente?.direccion || '',
      codigo_postal: cliente?.codigo_postal || '',
    });
  }

  async function crear(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/logistica', nuevo);
      setMostrarForm(false);
      setNuevo(VACIO);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el registro de logística');
    }
  }

  async function cambiarEstado(id, estado) {
    setError('');
    try {
      await api.put(`/logistica/${id}/estado`, { estado });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el estado');
    }
  }

  async function verDetalle(ordenVentaId, registroId) {
    if (expandido === registroId) {
      setExpandido(null);
      setDetalleOrden(null);
      return;
    }
    setExpandido(registroId);
    const { data } = await api.get(`/ventas/ordenes/${ordenVentaId}`);
    setDetalleOrden(data);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Logística</h1>
        <button className="boton" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo despacho/retiro'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {mostrarForm && (
        <form className="tarjeta" onSubmit={crear}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Tipo</label>
              <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>
                <option value="despacho">Despacho (entrega a domicilio)</option>
                <option value="retiro">Retiro (cliente pasa a buscar)</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Cliente</label>
              <select value={nuevo.cliente_id} onChange={(e) => elegirCliente(e.target.value)} required>
                <option value="">Seleccionar</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Orden de venta relacionada (opcional)</label>
              <select value={nuevo.orden_venta_id} onChange={(e) => setNuevo({ ...nuevo, orden_venta_id: e.target.value })}>
                <option value="">Sin relacionar</option>
                {ordenes.map((o) => <option key={o.id} value={o.id}>{o.numero} — {o.cliente_nombre}</option>)}
              </select>
            </div>
          </div>

          {nuevo.tipo === 'despacho' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 3 }}>
                <label>Dirección (autocompletada desde el cliente, editable)</label>
                <input value={nuevo.direccion} onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Código postal</label>
                <input value={nuevo.codigo_postal} onChange={(e) => setNuevo({ ...nuevo, codigo_postal: e.target.value })} />
              </div>
            </div>
          )}

          <label>Fecha</label>
          <input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} required />

          <label>Notas</label>
          <textarea rows={2} value={nuevo.notas} onChange={(e) => setNuevo({ ...nuevo, notas: e.target.value })} />

          <button className="boton">Guardar</button>
        </form>
      )}

      <div className="tarjeta">
        <table>
          <thead><tr><th>Tipo</th><th>Cliente</th><th>Dirección</th><th>Fecha</th><th>Estado</th><th>Orden</th><th>Acciones</th></tr></thead>
          <tbody>
            {registros.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td>{r.tipo}</td>
                  <td>{r.cliente_nombre}</td>
                  <td>{r.direccion || '—'} {r.codigo_postal && `(CP ${r.codigo_postal})`}</td>
                  <td>{String(r.fecha).slice(0, 10)}</td>
                  <td>{r.estado}</td>
                  <td>
                    {r.orden_venta_id ? (
                      <button className="boton boton-secundario" onClick={() => verDetalle(r.orden_venta_id, r.id)}>
                        {expandido === r.id ? 'Ocultar' : `Ver ${r.orden_venta_numero || 'ítems'}`}
                      </button>
                    ) : '—'}
                  </td>
                  <td>
                    {r.estado !== 'completado' && r.estado !== 'cancelado' && (
                      <select
                        value={r.estado}
                        onChange={(e) => cambiarEstado(r.id, e.target.value)}
                        style={{ marginBottom: 0, width: 'auto' }}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_curso">En curso</option>
                        <option value="completado">Completado</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    )}
                  </td>
                </tr>
                {expandido === r.id && detalleOrden && (
                  <tr>
                    <td colSpan={7}>
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
