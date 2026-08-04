import { useEffect, useState } from 'react';
import api from '../api/client';

// Arma un CSV a partir de encabezados y filas, y dispara la descarga en el navegador
function exportarCSV(nombreArchivo, encabezados, filas) {
  const escapar = (valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`;
  const contenido = [encabezados.map(escapar).join(','), ...filas.map((fila) => fila.map(escapar).join(','))].join('\n');
  const blob = new Blob([`\uFEFF${contenido}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function Estadisticas() {
  const [datos, setDatos] = useState(null);
  const [filtro, setFiltro] = useState({ desde: '', hasta: '' });
  const [error, setError] = useState('');

  async function cargar(params = {}) {
    try {
      const { data } = await api.get('/estadisticas/resumen', { params });
      setDatos(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar estadísticas');
    }
  }

  useEffect(() => { cargar(); }, []);

  function aplicarFiltro(e) {
    e.preventDefault();
    const params = {};
    if (filtro.desde) params.desde = filtro.desde;
    if (filtro.hasta) params.hasta = filtro.hasta;
    cargar(params);
  }

  function exportarResumen() {
    exportarCSV('resumen_estadisticas.csv',
      ['Indicador', 'Cantidad', 'Total'],
      [
        ['Ventas confirmadas', datos.ventas.cantidad, Number(datos.ventas.total).toFixed(2)],
        ['Compras recibidas', datos.compras.cantidad, Number(datos.compras.total).toFixed(2)],
        ['Órdenes de compra sin recibir', datos.ordenesSinRecibir.cantidad, Number(datos.ordenesSinRecibir.total).toFixed(2)],
        ['Pagos recibidos', datos.pagos.cantidad, Number(datos.pagos.total).toFixed(2)],
        ['Gastos', datos.gastos.cantidad, Number(datos.gastos.total).toFixed(2)],
      ]
    );
  }

  function exportarTopProductos() {
    exportarCSV('productos_mas_vendidos.csv',
      ['SKU', 'Producto', 'Cantidad vendida', 'Total vendido'],
      datos.topProductos.map((p) => [p.sku, p.nombre, p.cantidad_vendida, Number(p.total_vendido).toFixed(2)])
    );
  }

  return (
    <div>
      <h1>Estadísticas</h1>
      {error && <div className="error">{error}</div>}

      <form className="tarjeta" onSubmit={aplicarFiltro} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div>
          <label>Desde</label>
          <input type="date" value={filtro.desde} onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} />
        </div>
        <div>
          <label>Hasta</label>
          <input type="date" value={filtro.hasta} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} />
        </div>
        <button className="boton" style={{ marginBottom: 12 }}>Filtrar</button>
      </form>

      {datos && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="boton boton-secundario" onClick={exportarResumen}>Exportar resumen (CSV)</button>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="tarjeta" style={{ flex: 1 }}>
              <h4>Ventas</h4>
              <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>${Number(datos.ventas.total).toFixed(2)}</p>
              <p style={{ color: '#6b7280', margin: 0 }}>{datos.ventas.cantidad} órdenes confirmadas</p>
            </div>
            <div className="tarjeta" style={{ flex: 1 }}>
              <h4>Compras</h4>
              <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>${Number(datos.compras.total).toFixed(2)}</p>
              <p style={{ color: '#6b7280', margin: 0 }}>{datos.compras.cantidad} órdenes recibidas</p>
            </div>
            <div className="tarjeta" style={{ flex: 1 }}>
              <h4>Compras sin recibir</h4>
              <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>${Number(datos.ordenesSinRecibir.total).toFixed(2)}</p>
              <p style={{ color: '#6b7280', margin: 0 }}>{datos.ordenesSinRecibir.cantidad} órdenes pendientes/parciales</p>
            </div>
            <div className="tarjeta" style={{ flex: 1 }}>
              <h4>Pagos recibidos</h4>
              <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>${Number(datos.pagos.total).toFixed(2)}</p>
              <p style={{ color: '#6b7280', margin: 0 }}>{datos.pagos.cantidad} pagos</p>
            </div>
            <div className="tarjeta" style={{ flex: 1 }}>
              <h4>Gastos</h4>
              <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>${Number(datos.gastos.total).toFixed(2)}</p>
              <p style={{ color: '#6b7280', margin: 0 }}>{datos.gastos.cantidad} registros</p>
            </div>
          </div>

          <div className="tarjeta">
            <h3>Pagos por método</h3>
            <table>
              <thead><tr><th>Método</th><th>Cantidad</th><th>Total</th></tr></thead>
              <tbody>
                {datos.pagosPorMetodo.map((p) => (
                  <tr key={p.metodo_pago}>
                    <td>{p.metodo_pago}</td><td>{p.cantidad}</td><td>${Number(p.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="tarjeta">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Productos más vendidos</h3>
              <button className="boton boton-secundario" onClick={exportarTopProductos}>Exportar (CSV)</button>
            </div>
            <table>
              <thead><tr><th>SKU</th><th>Producto</th><th>Cantidad vendida</th><th>Total vendido</th></tr></thead>
              <tbody>
                {datos.topProductos.map((p) => (
                  <tr key={p.sku}>
                    <td>{p.sku}</td><td>{p.nombre}</td><td>{p.cantidad_vendida}</td><td>${Number(p.total_vendido).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
