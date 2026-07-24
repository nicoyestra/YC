import { Fragment, useEffect, useState } from 'react';
import api from '../api/client';

const VACIO = {
  sku: '', codigo_barras: '', nombre: '', descripcion: '', proveedor_id: '',
  precio_costo: '', precio_venta: '', iva_porcentaje: 21, stock_minimo: 0, unidad_medida: 'unidad',
};

export default function Articulos() {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [error, setError] = useState('');
  const [expandido, setExpandido] = useState(null);

  async function cargar(filtro = '') {
    const [prodRes, provRes] = await Promise.all([
      api.get('/productos', { params: filtro ? { buscar: filtro } : {} }),
      api.get('/compras/proveedores'),
    ]);
    setProductos(prodRes.data);
    setProveedores(provRes.data);
  }

  useEffect(() => { cargar(); }, []);

  function buscar(e) {
    e.preventDefault();
    cargar(busqueda);
  }

  async function buscarPorCodigoBarras(codigo) {
    if (!codigo) return;
    try {
      const { data } = await api.get(`/productos/codigo/${codigo}`);
      setError('');
      alert(`Encontrado: ${data.sku} — ${data.nombre} (stock: ${data.stock_total})`);
    } catch (err) {
      setError(err.response?.data?.error || 'No se encontró ese código de barras');
    }
  }

  async function crearArticulo(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/productos', nuevo);
      setMostrarForm(false);
      setNuevo(VACIO);
      cargar(busqueda);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el artículo');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Artículos</h1>
        <button className="boton" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo artículo'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <form className="tarjeta" onSubmit={buscar} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label>Buscar (SKU, nombre, descripción o código de barras)</label>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Escribí para buscar..." />
        </div>
        <button className="boton boton-secundario" style={{ marginBottom: 12 }}>Buscar</button>
      </form>

      <form
        className="tarjeta"
        onSubmit={(e) => { e.preventDefault(); buscarPorCodigoBarras(e.target.codigo.value); e.target.reset(); }}
        style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}
      >
        <div style={{ flex: 1 }}>
          <label>Escanear código de barra (lector o manual)</label>
          <input name="codigo" placeholder="Enfocá acá y escaneá, o escribí el código y Enter" autoFocus />
        </div>
        <button className="boton boton-secundario" style={{ marginBottom: 12 }}>Buscar por código</button>
      </form>

      {mostrarForm && (
        <form className="tarjeta" onSubmit={crearArticulo}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>SKU</label>
              <input value={nuevo.sku} onChange={(e) => setNuevo({ ...nuevo, sku: e.target.value })} required />
            </div>
            <div style={{ flex: 1 }}>
              <label>Código de barras (escanealo o escribilo)</label>
              <input
                value={nuevo.codigo_barras}
                onChange={(e) => setNuevo({ ...nuevo, codigo_barras: e.target.value })}
                placeholder="Enfocá acá y escaneá con el lector"
                autoFocus
              />
            </div>
          </div>

          <label>Nombre</label>
          <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />

          <label>Descripción detallada</label>
          <textarea
            rows={3}
            value={nuevo.descripcion}
            onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
            placeholder="Detalle completo del artículo: características, medidas, variantes, etc."
          />

          <label>Proveedor habitual</label>
          <select value={nuevo.proveedor_id} onChange={(e) => setNuevo({ ...nuevo, proveedor_id: e.target.value })}>
            <option value="">Sin especificar</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Precio de compra (sin IVA)</label>
              <input type="number" step="0.01" value={nuevo.precio_costo} onChange={(e) => setNuevo({ ...nuevo, precio_costo: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label>IVA %</label>
              <input type="number" step="0.01" value={nuevo.iva_porcentaje} onChange={(e) => setNuevo({ ...nuevo, iva_porcentaje: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Precio de venta</label>
              <input type="number" step="0.01" value={nuevo.precio_venta} onChange={(e) => setNuevo({ ...nuevo, precio_venta: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Stock mínimo</label>
              <input type="number" value={nuevo.stock_minimo} onChange={(e) => setNuevo({ ...nuevo, stock_minimo: e.target.value })} />
            </div>
          </div>

          <button className="boton">Guardar artículo</button>
        </form>
      )}

      <div className="tarjeta">
        <table>
          <thead>
            <tr><th>SKU</th><th>Cód. barras</th><th>Nombre</th><th>Proveedor</th><th>Precio venta</th><th>IVA</th><th></th></tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>{p.sku}</td>
                  <td>{p.codigo_barras || '—'}</td>
                  <td>{p.nombre}</td>
                  <td>{p.proveedor_nombre || '—'}</td>
                  <td>${Number(p.precio_venta).toFixed(2)}</td>
                  <td>{p.iva_porcentaje}%</td>
                  <td>
                    <button className="boton boton-secundario" onClick={() => setExpandido(expandido === p.id ? null : p.id)}>
                      {expandido === p.id ? 'Ocultar' : 'Ver descripción'}
                    </button>
                  </td>
                </tr>
                {expandido === p.id && (
                  <tr>
                    <td colSpan={7} style={{ background: '#f9fafb' }}>
                      <strong>Descripción:</strong> {p.descripcion || 'Sin descripción cargada.'}
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
