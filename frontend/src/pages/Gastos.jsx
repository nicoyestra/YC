import { useEffect, useState } from 'react';
import api from '../api/client';

const VACIO = { categoria: '', tipo_comprobante: 'factura', numero_comprobante: '', proveedor_id: '', monto: '', fecha: '', descripcion: '' };

export default function Gastos() {
  const [gastos, setGastos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [filtro, setFiltro] = useState({ desde: '', hasta: '' });
  const [error, setError] = useState('');

  async function cargar(params = {}) {
    const [gastosRes, provRes] = await Promise.all([
      api.get('/gastos', { params }),
      api.get('/compras/proveedores'),
    ]);
    setGastos(gastosRes.data);
    setProveedores(provRes.data);
  }

  useEffect(() => { cargar(); }, []);

  function aplicarFiltro(e) {
    e.preventDefault();
    const params = {};
    if (filtro.desde) params.desde = filtro.desde;
    if (filtro.hasta) params.hasta = filtro.hasta;
    cargar(params);
  }

  async function crearGasto(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/gastos', nuevo);
      setMostrarForm(false);
      setNuevo(VACIO);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el gasto');
    }
  }

  const totalFiltrado = gastos.reduce((acc, g) => acc + Number(g.monto), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Centro de costos</h1>
        <button className="boton" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo gasto'}
        </button>
      </div>

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
        <button className="boton boton-secundario" style={{ marginBottom: 12 }}>Filtrar</button>
        <div style={{ marginLeft: 'auto', fontWeight: 600, marginBottom: 12 }}>Total: ${totalFiltrado.toFixed(2)}</div>
      </form>

      {mostrarForm && (
        <form className="tarjeta" onSubmit={crearGasto}>
          <label>Categoría</label>
          <input value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })} required placeholder="Ej: Alquiler, Sueldos, Insumos, Fletes..." />
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Tipo de comprobante</label>
              <select value={nuevo.tipo_comprobante} onChange={(e) => setNuevo({ ...nuevo, tipo_comprobante: e.target.value })}>
                <option value="factura">Factura</option>
                <option value="remito">Remito</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label>Número de comprobante</label>
              <input value={nuevo.numero_comprobante} onChange={(e) => setNuevo({ ...nuevo, numero_comprobante: e.target.value })} />
            </div>
          </div>
          <label>Proveedor (opcional)</label>
          <select value={nuevo.proveedor_id} onChange={(e) => setNuevo({ ...nuevo, proveedor_id: e.target.value })}>
            <option value="">Sin especificar</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Monto</label>
              <input type="number" step="0.01" value={nuevo.monto} onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value })} required />
            </div>
            <div style={{ flex: 1 }}>
              <label>Fecha</label>
              <input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} required />
            </div>
          </div>
          <label>Descripción</label>
          <textarea rows={2} value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} />
          <button className="boton">Guardar gasto</button>
        </form>
      )}

      <div className="tarjeta">
        <table>
          <thead><tr><th>Fecha</th><th>Categoría</th><th>Comprobante</th><th>Proveedor</th><th>Monto</th></tr></thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id}>
                <td>{String(g.fecha).slice(0, 10)}</td>
                <td>{g.categoria}</td>
                <td>{g.tipo_comprobante} {g.numero_comprobante}</td>
                <td>{g.proveedor_nombre || '—'}</td>
                <td>${Number(g.monto).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
