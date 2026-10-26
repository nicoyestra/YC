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


function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[caracter]));
}

function imprimirPresupuesto(p) {
  if (!p) return;
  const empresa = p.empresa || {};
  const cliente = p.cliente_nombre || 'Cliente';
  const fecha = String(p.fecha || '').slice(0, 10);
  const valido = p.valido_hasta ? String(p.valido_hasta).slice(0, 10) : 'No especificada';
  const filas = (p.detalle || []).map((item) => `
    <tr>
      <td>${escaparHtml(item.sku || item.codigo_barras || '')}</td>
      <td>${escaparHtml(item.producto_nombre || item.descripcion || '')}</td>
      <td class="num">${escaparHtml(item.cantidad)}</td>
      <td class="num">${dinero(item.precio_unitario)}</td>
      <td class="num">${Number(item.descuento_porcentaje || 0)}%</td>
      <td class="num">${Number(item.iva_porcentaje || 0)}%</td>
      <td class="num">${dinero(item.total)}</td>
    </tr>`).join('');
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes para este sitio.'); return; }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Presupuesto ${escaparHtml(p.numero)}</title>
  <style>
  @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#172033;margin:0}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #155eef;padding-bottom:18px}.brand h1{font-size:22px;margin:0 0 7px}.muted{color:#5b6473;line-height:1.5}.doc{text-align:right}.doc h2{font-size:22px;margin:0 0 8px;color:#155eef}.notice{border:1px solid #b9c8e5;background:#f4f7ff;padding:9px;margin:16px 0;font-weight:bold;text-align:center;letter-spacing:.5px}.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:20px 0}.parties h3{font-size:11px;text-transform:uppercase;color:#667085;margin-bottom:7px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#eef3fb;text-align:left;font-size:10px;text-transform:uppercase}th,td{border:1px solid #d9e0eb;padding:8px 6px;vertical-align:top}.num{text-align:right;white-space:nowrap}.totals{width:300px;margin:18px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:5px 0}.totals .grand{font-size:17px;border-top:2px solid #172033;margin-top:5px;padding-top:10px;font-weight:bold}.notes{margin-top:20px;padding:12px;background:#f7f8fa;white-space:pre-wrap}.foot{margin-top:30px;border-top:1px solid #d9e0eb;padding-top:12px;color:#667085;font-size:10px}@media print{button{display:none}}
  </style></head><body>
  <div class="top"><div class="brand"><h1>${escaparHtml(empresa.nombre_fantasia || empresa.razon_social || 'YC System')}</h1><div class="muted">${empresa.razon_social && empresa.nombre_fantasia ? escaparHtml(empresa.razon_social)+'<br>' : ''}${empresa.cuit ? 'CUIT: '+escaparHtml(empresa.cuit)+'<br>' : ''}${empresa.direccion ? escaparHtml(empresa.direccion)+'<br>' : ''}${empresa.telefono ? 'Tel.: '+escaparHtml(empresa.telefono)+'<br>' : ''}${empresa.email ? escaparHtml(empresa.email) : ''}</div></div><div class="doc"><h2>PRESUPUESTO</h2><strong>${escaparHtml(p.numero || '')}</strong><div class="muted">Fecha: ${escaparHtml(fecha)}<br>Válido hasta: ${escaparHtml(valido)}<br>Estado: ${escaparHtml(p.estado || 'borrador')}</div></div></div>
  <div class="notice">PRESUPUESTO COMERCIAL — NO ES FACTURA NI COMPROBANTE FISCAL</div>
  <div class="parties"><div><h3>Presupuestado para</h3><strong>${escaparHtml(cliente)}</strong><div class="muted">${p.cuit_dni ? 'CUIT/DNI: '+escaparHtml(p.cuit_dni)+'<br>' : ''}${p.direccion ? escaparHtml(p.direccion)+'<br>' : ''}${p.telefono ? 'Tel.: '+escaparHtml(p.telefono)+'<br>' : ''}${p.email ? escaparHtml(p.email) : ''}</div></div><div><h3>Condiciones</h3><div>Validez de la oferta: hasta ${escaparHtml(valido)}</div><div>Los precios y condiciones corresponden a este presupuesto.</div></div></div>
  <table><thead><tr><th>Código</th><th>Descripción</th><th class="num">Cant.</th><th class="num">Precio unit.</th><th class="num">Desc.</th><th class="num">IVA</th><th class="num">Total</th></tr></thead><tbody>${filas}</tbody></table>
  <div class="totals"><div><span>Subtotal</span><strong>${dinero(p.subtotal)}</strong></div><div><span>Descuentos</span><strong>− ${dinero(p.descuento_total)}</strong></div><div><span>IVA</span><strong>${dinero(p.impuestos)}</strong></div><div class="grand"><span>TOTAL</span><strong>${dinero(p.total)}</strong></div></div>
  ${p.observaciones ? `<div class="notes"><strong>Observaciones y condiciones</strong><br>${escaparHtml(p.observaciones)}</div>` : ''}
  <div class="foot">Este documento es una cotización comercial. No acredita pago ni reemplaza una factura fiscal.</div><script>window.onload=()=>window.print();</script></body></html>`);
  w.document.close();
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
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <button type="button" className="boton boton-presupuesto" onClick={() => imprimirPresupuesto(detalle)}>
                          Imprimir / Guardar PDF para cliente
                        </button>
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
