import { useEffect, useState } from 'react';
import api from '../api/client';

export default function InventarioDanado() {
  const [danado, setDanado] = useState([]);
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState({ producto_id: '', almacen_id: '', cantidad: '', motivo: '' });

  async function cargar() {
    const [danadoRes, prodRes, almRes] = await Promise.all([
      api.get('/inventario/danado'),
      api.get('/productos'),
      api.get('/inventario/almacenes'),
    ]);
    setDanado(danadoRes.data);
    setProductos(prodRes.data);
    setAlmacenes(almRes.data);
  }

  useEffect(() => { cargar(); }, []);

  function stockDisponible() {
    const prod = productos.find((p) => p.id === Number(nuevo.producto_id));
    return prod ? prod.stock_total : null;
  }

  async function moverADanado(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/inventario/danado', {
        producto_id: Number(nuevo.producto_id),
        almacen_id: Number(nuevo.almacen_id),
        cantidad: Number(nuevo.cantidad),
        motivo: nuevo.motivo,
      });
      setMostrarForm(false);
      setNuevo({ producto_id: '', almacen_id: '', cantidad: '', motivo: '' });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al mover el stock a no utilizable');
    }
  }

  const disponible = stockDisponible();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Inventario no utilizable</h1>
        <button className="boton" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Pasar a no utilizable'}
        </button>
      </div>
      <p style={{ color: '#6b7280', marginTop: -10 }}>
        Artículos con fallas, vencidos o rotos: se descuentan del stock disponible para la venta y
        quedan acá registrados, sin borrarse del sistema.
      </p>

      {error && <div className="error">{error}</div>}

      {mostrarForm && (
        <form className="tarjeta" onSubmit={moverADanado}>
          <label>Producto {disponible !== null && `(stock utilizable: ${disponible})`}</label>
          <select value={nuevo.producto_id} onChange={(e) => setNuevo({ ...nuevo, producto_id: e.target.value })} required>
            <option value="">Seleccionar</option>
            {productos.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.nombre}</option>)}
          </select>

          <label>Almacén</label>
          <select value={nuevo.almacen_id} onChange={(e) => setNuevo({ ...nuevo, almacen_id: e.target.value })} required>
            <option value="">Seleccionar</option>
            {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>

          <label>Cantidad</label>
          <input type="number" min="1" value={nuevo.cantidad} onChange={(e) => setNuevo({ ...nuevo, cantidad: e.target.value })} required />

          <label>Motivo</label>
          <input
            value={nuevo.motivo}
            onChange={(e) => setNuevo({ ...nuevo, motivo: e.target.value })}
            required
            placeholder="Ej: producto roto, vencido, defecto de fábrica..."
          />

          <button className="boton">Confirmar</button>
        </form>
      )}

      <div className="tarjeta">
        <table>
          <thead><tr><th>SKU</th><th>Producto</th><th>Almacén</th><th>Cantidad no utilizable</th></tr></thead>
          <tbody>
            {danado.map((d) => (
              <tr key={d.id}>
                <td>{d.sku}</td>
                <td>{d.producto_nombre}</td>
                <td>{d.almacen_nombre}</td>
                <td><span className="badge">{d.cantidad}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
