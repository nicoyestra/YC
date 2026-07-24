import { Fragment, useEffect, useState } from 'react';
import api from '../api/client';

export default function Facturacion() {
  const [facturas, setFacturas] = useState([]);
  const [ordenesVenta, setOrdenesVenta] = useState([]);
  const [error, setError] = useState('');
  const [pago, setPago] = useState({ id: null, monto: '', metodo_pago: 'efectivo', fecha_pago: '' });
  const [mostrarFormFactura, setMostrarFormFactura] = useState(false);
  const [nuevaFactura, setNuevaFactura] = useState({ orden_venta_id: '', numero: '', tipo: 'B', condicion_pago: 'contado', fecha_vencimiento: '' });

  async function cargar() {
    const [facRes, ordRes] = await Promise.all([
      api.get('/facturacion'),
      api.get('/ventas/ordenes'),
    ]);
    setFacturas(facRes.data);
    setOrdenesVenta(ordRes.data);
  }

  useEffect(() => { cargar(); }, []);

  // Órdenes de venta que todavía no tienen una factura generada
  const ordenesSinFacturar = ordenesVenta.filter(
    (o) => !facturas.some((f) => f.orden_venta_id === o.id)
  );

  async function generarFactura(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/facturacion/generar', nuevaFactura);
      setMostrarFormFactura(false);
      setNuevaFactura({ orden_venta_id: '', numero: '', tipo: 'B', condicion_pago: 'contado', fecha_vencimiento: '' });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar la factura');
    }
  }

  async function registrarPago(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/facturacion/${pago.id}/pagos`, {
        monto: pago.monto, metodo_pago: pago.metodo_pago, fecha_pago: pago.fecha_pago,
      });
      setPago({ id: null, monto: '', metodo_pago: 'efectivo', fecha_pago: '' });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el pago');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Facturación</h1>
        <button className="boton" onClick={() => setMostrarFormFactura(!mostrarFormFactura)}>
          {mostrarFormFactura ? 'Cancelar' : '+ Generar factura'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {mostrarFormFactura && (
        <form className="tarjeta" onSubmit={generarFactura}>
          <label>Orden de venta</label>
          <select value={nuevaFactura.orden_venta_id} onChange={(e) => setNuevaFactura({ ...nuevaFactura, orden_venta_id: e.target.value })} required>
            <option value="">Seleccionar</option>
            {ordenesSinFacturar.map((o) => (
              <option key={o.id} value={o.id}>{o.numero} — {o.cliente_nombre} (${Number(o.total).toFixed(2)})</option>
            ))}
          </select>
          {ordenesSinFacturar.length === 0 && (
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: -8 }}>
              No hay órdenes de venta pendientes de facturar.
            </p>
          )}
          <label>Número de factura</label>
          <input value={nuevaFactura.numero} onChange={(e) => setNuevaFactura({ ...nuevaFactura, numero: e.target.value })} required placeholder="A-0001" />
          <label>Tipo</label>
          <select value={nuevaFactura.tipo} onChange={(e) => setNuevaFactura({ ...nuevaFactura, tipo: e.target.value })}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
          <label>Condición de pago</label>
          <select value={nuevaFactura.condicion_pago} onChange={(e) => setNuevaFactura({ ...nuevaFactura, condicion_pago: e.target.value })}>
            <option value="contado">Contado</option>
            <option value="cuenta_corriente">Cuenta corriente</option>
            <option value="cheque">Cheque</option>
          </select>
          {nuevaFactura.condicion_pago === 'cheque' && !nuevaFactura.fecha_vencimiento && (
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: -8 }}>
              Como es cheque, el vencimiento se calcula automático a 60 días si no cargás uno.
            </p>
          )}
          <label>Fecha de vencimiento (opcional, se calcula sola si es cheque)</label>
          <input type="date" value={nuevaFactura.fecha_vencimiento} onChange={(e) => setNuevaFactura({ ...nuevaFactura, fecha_vencimiento: e.target.value })} />
          <button className="boton">Generar factura</button>
        </form>
      )}

      <div className="tarjeta">
        <table>
          <thead><tr><th>Número</th><th>Cliente</th><th>Total</th><th>Condición</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {facturas.map((f) => (
              <Fragment key={f.id}>
                <tr>
                  <td>{f.numero}</td>
                  <td>{f.cliente_nombre}</td>
                  <td>${Number(f.total).toFixed(2)}</td>
                  <td>{f.condicion_pago}</td>
                  <td>{f.fecha_vencimiento ? String(f.fecha_vencimiento).slice(0, 10) : '—'}</td>
                  <td>{f.estado}</td>
                  <td>
                    {f.estado !== 'pagada' && (
                      <button className="boton boton-secundario" onClick={() => setPago({ ...pago, id: pago.id === f.id ? null : f.id })}>
                        Registrar pago
                      </button>
                    )}
                  </td>
                </tr>
                {pago.id === f.id && (
                  <tr>
                    <td colSpan={7}>
                      <form onSubmit={registrarPago} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                        <div>
                          <label>Monto</label>
                          <input type="number" step="0.01" value={pago.monto} onChange={(e) => setPago({ ...pago, monto: e.target.value })} required />
                        </div>
                        <div>
                          <label>Método</label>
                          <select value={pago.metodo_pago} onChange={(e) => setPago({ ...pago, metodo_pago: e.target.value })}>
                            <option value="efectivo">Efectivo</option>
                            <option value="transferencia">Transferencia</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="cheque">Cheque</option>
                          </select>
                        </div>
                        <div>
                          <label>Fecha de pago</label>
                          <input type="date" value={pago.fecha_pago} onChange={(e) => setPago({ ...pago, fecha_pago: e.target.value })} required />
                        </div>
                        <button className="boton" style={{ marginBottom: 12 }}>Confirmar pago</button>
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
