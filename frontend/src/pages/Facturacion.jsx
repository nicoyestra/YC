import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { exportarExcel } from '../utils/exportarExcel';

export default function Facturacion() {
  const navigate = useNavigate();
  const [facturas, setFacturas] = useState([]);
  const [ordenesVenta, setOrdenesVenta] = useState([]);
  const [error, setError] = useState('');
  const [pago, setPago] = useState({
    id: null,
    monto: '',
    metodo_pago: 'efectivo',
    fecha_pago: '',
  });
  const [mostrarFormFactura, setMostrarFormFactura] = useState(false);
  const [nuevaFactura, setNuevaFactura] = useState({
    orden_venta_id: '',
    numero: '',
    tipo: 'C',
    condicion_pago: 'contado',
    fecha_vencimiento: '',
  });

  async function cargar() {
    try {
      const [facRes, ordRes] = await Promise.all([
        api.get('/facturacion'),
        api.get('/ventas/ordenes'),
      ]);

      setFacturas(Array.isArray(facRes.data) ? facRes.data : []);
      setOrdenesVenta(Array.isArray(ordRes.data) ? ordRes.data : []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'No se pudieron cargar las facturas'
      );
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  // Órdenes de venta que todavía no tienen una factura generada
  const ordenesSinFacturar = ordenesVenta.filter(
    (orden) =>
      !facturas.some(
        (factura) => factura.orden_venta_id === orden.id
      )
  );

  async function generarFactura(e) {
    e.preventDefault();
    setError('');

    try {
      await api.post('/facturacion/generar', nuevaFactura);

      setMostrarFormFactura(false);

      setNuevaFactura({
        orden_venta_id: '',
        numero: '',
        tipo: 'C',
        condicion_pago: 'contado',
        fecha_vencimiento: '',
      });

      await cargar();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al generar la factura'
      );
    }
  }

  async function registrarPago(e) {
    e.preventDefault();
    setError('');

    try {
      await api.post(`/facturacion/${pago.id}/pagos`, {
        monto: pago.monto,
        metodo_pago: pago.metodo_pago,
        fecha_pago: pago.fecha_pago,
      });

      setPago({
        id: null,
        monto: '',
        metodo_pago: 'efectivo',
        fecha_pago: '',
      });

      await cargar();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al registrar el pago'
      );
    }
  }

  function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  async function imprimirFactura(factura) {
    try {
      const { data } = await api.get(`/facturacion/${factura.id}`);
      const detalle = Array.isArray(data.detalle) ? data.detalle : [];
      const ventana = window.open('', '_blank', 'width=900,height=700');
      if (!ventana) {
        setError('El navegador bloqueó la ventana. Permití las ventanas emergentes para imprimir la factura.');
        return;
      }
      const filas = detalle.map((item) => `<tr><td>${escaparHtml(item.producto_nombre || 'Artículo')}</td><td>${Number(item.cantidad || 0)}</td><td>$ ${Number(item.precio_unitario || 0).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td><td>$ ${Number(item.subtotal || 0).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td></tr>`).join('');
      ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante ${escaparHtml(factura.numero)}</title><style>
        *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;padding:34px;background:#fff}.hoja{max-width:800px;margin:auto;border:1px solid #d5dbe5;padding:34px}.cabecera{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1f4f91;padding-bottom:18px}.marca{font-size:25px;font-weight:800;color:#174ea6}.sub{font-size:12px;color:#64748b;margin-top:5px}.tipo{border:2px solid #174ea6;width:64px;text-align:center;padding:8px;font-size:27px;font-weight:bold;color:#174ea6}.titulo{font-size:18px;font-weight:bold;margin-top:24px}.datos{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0 24px}.dato{padding:10px;background:#f5f7fb;border-radius:5px;font-size:13px}.dato b{display:block;color:#64748b;font-size:11px;text-transform:uppercase;margin-bottom:5px}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:13px}th{background:#edf2f8;text-align:left}th,td{padding:11px 9px;border-bottom:1px solid #dce2eb}.num{text-align:right}.total{margin:22px 0 0 auto;width:270px;border-top:2px solid #174ea6;padding-top:14px;font-size:23px;font-weight:bold;text-align:right}.aviso{margin-top:28px;padding:12px;background:#fff7e6;color:#8a4b08;font-size:11px;border:1px solid #f4d49b}.pie{margin-top:30px;font-size:11px;color:#64748b;text-align:center}@media print{body{padding:0}.hoja{border:0;max-width:none;padding:18mm}.no-print{display:none}}
        </style></head><body><div class="hoja"><div class="cabecera"><div><div class="marca">MX3</div><div style="font-size:16px;font-weight:800;letter-spacing:.4px;color:#172033;margin-top:3px">CRISTALES Y EQUIPAMIENTOS</div><div class="sub">Comprobante de venta</div><div class="sub">Gestión y comprobantes emitidos con YC System</div></div><div><div class="tipo">C</div><div style="font-size:11px;text-align:center;margin-top:5px">Comprobante tipo C</div></div></div><div class="titulo">Comprobante ${escaparHtml(factura.numero || '')}</div><div class="datos"><div class="dato"><b>Cliente</b>${escaparHtml(factura.cliente_nombre || 'Cliente')}</div><div class="dato"><b>Orden de venta</b>${escaparHtml(factura.orden_venta_numero || 'OV-' + (factura.orden_venta_id || ''))}</div><div class="dato"><b>Fecha de emisión</b>${escaparHtml(String(factura.fecha_emision || '').slice(0,10))}</div><div class="dato"><b>Condición de pago</b>${escaparHtml(factura.condicion_pago || '')}</div></div><table><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio unitario</th><th class="num">Subtotal</th></tr></thead><tbody>${filas || '<tr><td colspan="4">Sin detalle disponible</td></tr>'}</tbody></table><div class="total">TOTAL: $ ${Number(data.total ?? factura.total ?? 0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})}</div><div class="aviso"><b>COMPROBANTE INTERNO PROVISIONAL.</b> No es una factura fiscal autorizada por ARCA. No contiene CAE ni número fiscal autorizado.</div><div class="pie">MX3 Cristales y Equipamientos · Comprobante de gestión · Guardá este documento como PDF o imprimilo desde el navegador.</div><div class="no-print" style="margin-top:24px;text-align:center"><button onclick="window.print()" style="padding:12px 22px;background:#174ea6;color:#fff;border:0;border-radius:6px;font-weight:bold;cursor:pointer">Imprimir / Guardar como PDF</button></div></div><script>window.onload=()=>{};</script></body></html>`);
      ventana.document.close();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo preparar el comprobante para imprimir.');
    }
  }

  function compartirWhatsApp(factura) {
    const texto = `Hola${factura.cliente_nombre ? ' ' + factura.cliente_nombre : ''}, te compartimos el comprobante interno ${factura.numero || ''} de YC System por $ ${Number(factura.total || 0).toLocaleString('es-AR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}. Este documento es provisional y todavía no está autorizado por ARCA.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
  }

  function exportarFacturacion() {
    const datos = facturas.map((factura) => ({
      Número: factura.numero || '',
      Tipo: factura.tipo || '',
      Cliente: factura.cliente_nombre || '',
      'Orden de venta': factura.orden_venta_numero || '',
      Total: Number(factura.total || 0),
      'Condición de pago': factura.condicion_pago || '',
      'Fecha de emisión': factura.fecha_emision
        ? String(factura.fecha_emision).slice(0, 10)
        : '',
      'Fecha de vencimiento': factura.fecha_vencimiento
        ? String(factura.fecha_vencimiento).slice(0, 10)
        : '',
      Estado: factura.estado || '',
    }));

    exportarExcel(datos, 'Facturacion_YC_System');
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <h1>Facturación</h1>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="boton boton-excel"
            onClick={exportarFacturacion}
            disabled={facturas.length === 0}
          >
            Exportar Excel
          </button>

          <button
            type="button"
            className="boton boton-presupuesto"
            onClick={() => navigate('/presupuestos?nuevo=1')}
          >
            Nuevo presupuesto
          </button>

          <button
            type="button"
            className="boton"
            onClick={() =>
              setMostrarFormFactura(!mostrarFormFactura)
            }
          >
            {mostrarFormFactura
              ? 'Cancelar'
              : '+ Generar factura'}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {mostrarFormFactura && (
        <form
          className="tarjeta"
          onSubmit={generarFactura}
        >
          <label>Orden de venta</label>

          <select
            value={nuevaFactura.orden_venta_id}
            onChange={(e) =>
              setNuevaFactura({
                ...nuevaFactura,
                orden_venta_id: e.target.value,
              })
            }
            required
          >
            <option value="">Seleccionar</option>

            {ordenesSinFacturar.map((orden) => (
              <option
                key={orden.id}
                value={orden.id}
              >
                {orden.numero} — {orden.cliente_nombre} ($
                {Number(orden.total || 0).toFixed(2)})
              </option>
            ))}
          </select>

          {ordenesSinFacturar.length === 0 && (
            <p
              style={{
                fontSize: 13,
                color: '#6b7280',
                marginTop: -8,
              }}
            >
              No hay órdenes de venta pendientes de facturar.
            </p>
          )}

          <label>Número de factura</label>
          <input value="Automático al generar" readOnly />
          <p style={{ fontSize: 13, color: '#64748b', marginTop: -8 }}>
            YC System asigna un número interno automáticamente. El número fiscal se confirmará al integrar ARCA.
          </p>

          <label>Tipo de comprobante</label>
          <input value="C — Consumidor final / comprobante tipo C" readOnly />
          <p style={{ fontSize: 12, color: '#b45309', marginTop: -8 }}>
            Registro provisional: todavía no autorizado por ARCA ni con CAE.
          </p>

          <label>Condición de pago</label>

          <select
            value={nuevaFactura.condicion_pago}
            onChange={(e) =>
              setNuevaFactura({
                ...nuevaFactura,
                condicion_pago: e.target.value,
              })
            }
          >
            <option value="contado">Contado</option>
            <option value="transferencia">Transferencia bancaria</option>
            <option value="cuenta_corriente">
              Cuenta corriente
            </option>
            <option value="cheque">Cheque</option>
          </select>

          {nuevaFactura.condicion_pago === 'cheque' &&
            !nuevaFactura.fecha_vencimiento && (
              <p
                style={{
                  fontSize: 13,
                  color: '#6b7280',
                  marginTop: -8,
                }}
              >
                Como es cheque, el vencimiento se calcula
                automáticamente a 60 días si no cargás uno.
              </p>
            )}

          <label>
            Fecha de vencimiento (opcional, se calcula sola si es
            cheque)
          </label>

          <input
            type="date"
            value={nuevaFactura.fecha_vencimiento}
            onChange={(e) =>
              setNuevaFactura({
                ...nuevaFactura,
                fecha_vencimiento: e.target.value,
              })
            }
          />

          <button
            type="submit"
            className="boton"
          >
            Generar factura
          </button>
        </form>
      )}

      <div className="tarjeta">
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Condición</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {facturas.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    padding: 30,
                    color: '#64748b',
                  }}
                >
                  No hay facturas para mostrar.
                </td>
              </tr>
            )}

            {facturas.map((factura) => (
              <Fragment key={factura.id}>
                <tr>
                  <td>{factura.numero}</td>
                  <td>{factura.cliente_nombre}</td>
                  <td>
                    ${Number(factura.total || 0).toFixed(2)}
                  </td>
                  <td>{factura.condicion_pago}</td>
                  <td>
                    {factura.fecha_vencimiento
                      ? String(
                          factura.fecha_vencimiento
                        ).slice(0, 10)
                      : '—'}
                  </td>
                  <td>{factura.estado}</td>
                  <td>
                    {factura.estado !== 'pagada' && (
                      <button
                        type="button"
                        className="boton boton-secundario"
                        onClick={() =>
                          setPago({
                            ...pago,
                            id:
                              pago.id === factura.id
                                ? null
                                : factura.id,
                          })
                        }
                      >
                        Registrar pago
                      </button>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      <button type="button" className="boton boton-secundario" onClick={() => imprimirFactura(factura)}>Imprimir / PDF</button>
                      <button type="button" className="boton boton-secundario" onClick={() => compartirWhatsApp(factura)}>WhatsApp</button>
                    </div>
                  </td>
                </tr>

                {pago.id === factura.id && (
                  <tr>
                    <td colSpan={7}>
                      <form
                        onSubmit={registrarPago}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-end',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <label>Monto</label>

                          <input
                            type="number"
                            step="0.01"
                            value={pago.monto}
                            onChange={(e) =>
                              setPago({
                                ...pago,
                                monto: e.target.value,
                              })
                            }
                            required
                          />
                        </div>

                        <div>
                          <label>Método</label>

                          <select
                            value={pago.metodo_pago}
                            onChange={(e) =>
                              setPago({
                                ...pago,
                                metodo_pago:
                                  e.target.value,
                              })
                            }
                          >
                            <option value="efectivo">
                              Efectivo
                            </option>
                            <option value="transferencia">
                              Transferencia
                            </option>
                            <option value="tarjeta">
                              Tarjeta
                            </option>
                            <option value="cheque">
                              Cheque
                            </option>
                          </select>
                        </div>

                        <div>
                          <label>Fecha de pago</label>

                          <input
                            type="date"
                            value={pago.fecha_pago}
                            onChange={(e) =>
                              setPago({
                                ...pago,
                                fecha_pago: e.target.value,
                              })
                            }
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          className="boton"
                          style={{ marginBottom: 12 }}
                        >
                          Confirmar pago
                        </button>
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
