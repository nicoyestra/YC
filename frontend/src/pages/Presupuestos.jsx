import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import ProductoAutocomplete from '../components/ProductoAutocomplete';

const ITEM_VACIO = {
  producto_id: '',
  cantidad: 1,
  precio_unitario: '',
  descuento_porcentaje: 0,
  iva_porcentaje: 21,
};

const ESTADOS = ['borrador', 'enviado', 'aceptado', 'rechazado', 'vencido'];

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function sumarDias(fecha, dias) {
  const valor = new Date(`${fecha}T12:00:00`);
  valor.setDate(valor.getDate() + dias);
  return valor.toISOString().slice(0, 10);
}

function dinero(valor) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(Number(valor || 0));
}

function calcularItem(item) {
  const cantidad = Number(item.cantidad || 0);
  const precio = Number(item.precio_unitario || 0);
  const descuento = Number(item.descuento_porcentaje || 0);
  const iva = Number(item.iva_porcentaje || 0);
  const bruto = cantidad * precio;
  const descuentoImporte = bruto * descuento / 100;
  const neto = bruto - descuentoImporte;
  const impuestos = neto * iva / 100;
  return { bruto, descuentoImporte, neto, impuestos, total: neto + impuestos };
}

export default function Presupuestos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [presupuestos, setPresupuestos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(searchParams.get('nuevo') === '1');
  const [detalleAbierto, setDetalleAbierto] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [nuevo, setNuevo] = useState({
    cliente_id: '',
    fecha: hoy(),
    valido_hasta: sumarDias(hoy(), 15),
    observaciones: '',
    items: [{ ...ITEM_VACIO }],
  });

  async function cargar(estado = filtroEstado) {
    try {
      setError('');
      const [presRes, cliRes, prodRes] = await Promise.all([
        api.get('/presupuestos', { params: estado ? { estado } : {} }),
        api.get('/ventas/clientes'),
        api.get('/productos'),
      ]);
      setPresupuestos(Array.isArray(presRes.data) ? presRes.data : []);
      setClientes(Array.isArray(cliRes.data) ? cliRes.data : []);
      setProductos(Array.isArray(prodRes.data) ? prodRes.data : []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los presupuestos');
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (searchParams.get('nuevo') === '1') setMostrarForm(true);
  }, [searchParams]);

  const totales = useMemo(() => {
    return nuevo.items.reduce(
      (acc, item) => {
        const calculo = calcularItem(item);
        acc.subtotal += calculo.bruto;
        acc.descuento += calculo.descuentoImporte;
        acc.impuestos += calculo.impuestos;
        acc.total += calculo.total;
        return acc;
      },
      { subtotal: 0, descuento: 0, impuestos: 0, total: 0 }
    );
  }, [nuevo.items]);

  function actualizarItem(index, campo, valor) {
    const items = [...nuevo.items];
    items[index] = { ...items[index], [campo]: valor };
    setNuevo({ ...nuevo, items });
  }

  function seleccionarProducto(index, producto) {
    const items = [...nuevo.items];
    if (!producto) {
      items[index] = { ...ITEM_VACIO };
    } else {
      items[index] = {
        ...items[index],
        producto_id: producto.id,
        precio_unitario: producto.precio_venta ?? 0,
        iva_porcentaje: producto.iva_porcentaje ?? 21,
      };
    }
    setNuevo({ ...nuevo, items });
  }

  function agregarItem() {
    setNuevo({ ...nuevo, items: [...nuevo.items, { ...ITEM_VACIO }] });
  }

  function quitarItem(index) {
    const items = nuevo.items.filter((_, i) => i !== index);
    setNuevo({ ...nuevo, items: items.length ? items : [{ ...ITEM_VACIO }] });
  }

  function cerrarFormulario() {
    setMostrarForm(false);
    setSearchParams({});
    setError('');
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');

    const invalido = nuevo.items.some(
      (item) => !item.producto_id || Number(item.cantidad) <= 0 || Number(item.precio_unitario) < 0
    );
    if (invalido) {
      setError('Revisá los productos, cantidades y precios del presupuesto.');
      return;
    }

    try {
      setGuardando(true);
      const { data } = await api.post('/presupuestos', nuevo);
      alert(`Presupuesto ${data.numero} creado correctamente`);
      setNuevo({
        cliente_id: '',
        fecha: hoy(),
        valido_hasta: sumarDias(hoy(), 15),
        observaciones: '',
        items: [{ ...ITEM_VACIO }],
      });
      cerrarFormulario();
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el presupuesto');
    } finally {
      setGuardando(false);
    }
  }

  async function verDetalle(id) {
    if (detalleAbierto === id) {
      setDetalleAbierto(null);
      setDetalle(null);
      return;
    }
    try {
      const { data } = await api.get(`/presupuestos/${id}`);
      setDetalleAbierto(id);
      setDetalle(data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo abrir el presupuesto');
    }
  }

  async function cambiarEstado(id, estado) {
    try {
      await api.patch(`/presupuestos/${id}/estado`, { estado });
      if (detalleAbierto === id) {
        setDetalle((actual) => actual ? { ...actual, estado } : actual);
      }
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar el estado');
    }
  }

  function aplicarFiltro(estado) {
    setFiltroEstado(estado);
    cargar(estado);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Presupuestos</h1>
          <p style={{ color: '#6b7280', marginTop: 0 }}>Cotizaciones con validez, descuentos e IVA por artículo.</p>
        </div>
        <button
          type="button"
          className="boton boton-presupuesto"
          onClick={() => setMostrarForm((valor) => !valor)}
        >
          {mostrarForm ? 'Cancelar' : '+ Nuevo presupuesto'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {mostrarForm && (
        <form className="tarjeta" onSubmit={guardar}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 280px' }}>
              <label>Cliente</label>
              <select
                value={nuevo.cliente_id}
                onChange={(e) => setNuevo({ ...nuevo, cliente_id: e.target.value })}
                required
              >
                <option value="">Seleccionar</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}{cliente.cuit_dni ? ` — ${cliente.cuit_dni}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 170px' }}>
              <label>Fecha</label>
              <input
                type="date"
                value={nuevo.fecha}
                onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })}
                required
              />
            </div>
            <div style={{ flex: '1 1 190px' }}>
              <label>Válido hasta</label>
              <input
                type="date"
                min={nuevo.fecha}
                value={nuevo.valido_hasta}
                onChange={(e) => setNuevo({ ...nuevo, valido_hasta: e.target.value })}
              />
            </div>
          </div>

          <h4>Artículos</h4>
          {nuevo.items.map((item, index) => {
            const calculo = calcularItem(item);
            return (
              <div key={index} className="presupuesto-item">
                <div style={{ flex: '3 1 320px' }}>
                  <label>Producto</label>
                  <ProductoAutocomplete
                    productos={productos}
                    value={item.producto_id}
                    onChange={(producto) => seleccionarProducto(index, producto)}
                    placeholder="Buscar por nombre, SKU o código..."
                  />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label>Cantidad</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.cantidad}
                    onChange={(e) => actualizarItem(index, 'cantidad', e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label>Precio unitario</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.precio_unitario}
                    onChange={(e) => actualizarItem(index, 'precio_unitario', e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: '1 1 105px' }}>
                  <label>Descuento %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.descuento_porcentaje}
                    onChange={(e) => actualizarItem(index, 'descuento_porcentaje', e.target.value)}
                  />
                </div>
                <div style={{ flex: '1 1 90px' }}>
                  <label>IVA %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={item.iva_porcentaje}
                    onChange={(e) => actualizarItem(index, 'iva_porcentaje', e.target.value)}
                  />
                </div>
                <div className="presupuesto-item-total">
                  <small>Total</small>
                  <strong>{dinero(calculo.total)}</strong>
                </div>
                <button
                  type="button"
                  className="boton boton-secundario"
                  onClick={() => quitarItem(index)}
                >
                  Quitar
                </button>
              </div>
            );
          })}

          <button type="button" className="boton boton-secundario" onClick={agregarItem}>
            + Agregar artículo
          </button>

          <label style={{ marginTop: 16 }}>Observaciones</label>
          <textarea
            rows={3}
            value={nuevo.observaciones}
            onChange={(e) => setNuevo({ ...nuevo, observaciones: e.target.value })}
            placeholder="Condiciones comerciales, entrega, forma de pago, aclaraciones..."
          />

          <div className="presupuesto-totales">
            <div><span>Subtotal</span><strong>{dinero(totales.subtotal)}</strong></div>
            <div><span>Descuentos</span><strong>- {dinero(totales.descuento)}</strong></div>
            <div><span>IVA</span><strong>{dinero(totales.impuestos)}</strong></div>
            <div className="presupuesto-total-final"><span>Total</span><strong>{dinero(totales.total)}</strong></div>
          </div>

          <button type="submit" className="boton boton-presupuesto" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar presupuesto'}
          </button>
        </form>
      )}

      <div className="tarjeta">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h3>Presupuestos emitidos</h3>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {['', ...ESTADOS].map((estado) => (
              <button
                key={estado || 'todos'}
                type="button"
                className={`boton ${filtroEstado === estado ? '' : 'boton-secundario'}`}
                onClick={() => aplicarFiltro(estado)}
              >
                {estado || 'Todos'}
              </button>
            ))}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Válido hasta</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {presupuestos.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>No hay presupuestos para mostrar.</td></tr>
            )}
            {presupuestos.map((presupuesto) => (
              <Fragment key={presupuesto.id}>
                <tr>
                  <td>{presupuesto.numero}</td>
                  <td>{presupuesto.cliente_nombre}</td>
                  <td>{String(presupuesto.fecha).slice(0, 10)}</td>
                  <td>{presupuesto.valido_hasta ? String(presupuesto.valido_hasta).slice(0, 10) : '—'}</td>
                  <td><span className={`badge presupuesto-estado estado-${presupuesto.estado}`}>{presupuesto.estado}</span></td>
                  <td>{dinero(presupuesto.total)}</td>
                  <td style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    <button type="button" className="boton boton-secundario" onClick={() => verDetalle(presupuesto.id)}>
                      {detalleAbierto === presupuesto.id ? 'Ocultar' : 'Ver detalle'}
                    </button>
                    <select
                      aria-label="Cambiar estado"
                      value={presupuesto.estado}
                      onChange={(e) => cambiarEstado(presupuesto.id, e.target.value)}
                      style={{ width: 130, marginBottom: 0 }}
                    >
                      {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                    </select>
                  </td>
                </tr>
                {detalleAbierto === presupuesto.id && detalle && (
                  <tr>
                    <td colSpan={7}>
                      <div className="presupuesto-detalle-cabecera">
                        <div><strong>{detalle.numero}</strong><small>{detalle.cliente_nombre}</small></div>
                        <div><span>Subtotal</span><strong>{dinero(detalle.subtotal)}</strong></div>
                        <div><span>Descuentos</span><strong>{dinero(detalle.descuento_total)}</strong></div>
                        <div><span>IVA</span><strong>{dinero(detalle.impuestos)}</strong></div>
                        <div><span>Total</span><strong>{dinero(detalle.total)}</strong></div>
                      </div>
                      {detalle.observaciones && <p><strong>Observaciones:</strong> {detalle.observaciones}</p>}
                      <table>
                        <thead><tr><th>SKU</th><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Desc.</th><th>IVA</th><th>Total</th></tr></thead>
                        <tbody>
                          {detalle.detalle.map((item) => (
                            <tr key={item.id}>
                              <td>{item.sku}</td>
                              <td>{item.producto_nombre}</td>
                              <td>{Number(item.cantidad)}</td>
                              <td>{dinero(item.precio_unitario)}</td>
                              <td>{Number(item.descuento_porcentaje)}%</td>
                              <td>{Number(item.iva_porcentaje)}%</td>
                              <td>{dinero(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {detalle.orden_venta_id ? (
                        <p style={{ color: '#166534' }}>Vinculado a la orden de venta #{detalle.orden_venta_id}.</p>
                      ) : (
                        <p style={{ color: '#6b7280' }}>Preparado para convertirse en orden de venta en la siguiente etapa.</p>
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
