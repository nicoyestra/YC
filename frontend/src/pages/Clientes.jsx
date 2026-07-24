import { useEffect, useState } from 'react';
import api from '../api/client';

const VACIO = { nombre: '', cuit_dni: '', email: '', telefono: '', direccion: '', codigo_postal: '', es_externo: false };

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [error, setError] = useState('');

  async function cargar(filtro = '') {
    const { data } = await api.get('/ventas/clientes', { params: filtro ? { buscar: filtro } : {} });
    setClientes(data);
  }

  useEffect(() => { cargar(); }, []);

  function buscar(e) {
    e.preventDefault();
    cargar(busqueda);
  }

  async function crearCliente(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/ventas/clientes', nuevo);
      setMostrarForm(false);
      setNuevo(VACIO);
      cargar(busqueda);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear cliente');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Clientes</h1>
        <button className="boton" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo cliente'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <form className="tarjeta" onSubmit={buscar} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label>Buscar cliente</label>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, CUIT/DNI o email..." />
        </div>
        <button className="boton boton-secundario" style={{ marginBottom: 12 }}>Buscar</button>
      </form>

      {mostrarForm && (
        <form className="tarjeta" onSubmit={crearCliente}>
          <label>Nombre</label>
          <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />
          <label>CUIT/DNI</label>
          <input value={nuevo.cuit_dni} onChange={(e) => setNuevo({ ...nuevo, cuit_dni: e.target.value })} />
          <label>Email</label>
          <input type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
          <label>Teléfono</label>
          <input value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
          <label>Dirección</label>
          <input value={nuevo.direccion} onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })} />
          <label>Código postal</label>
          <input value={nuevo.codigo_postal} onChange={(e) => setNuevo({ ...nuevo, codigo_postal: e.target.value })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              style={{ width: 'auto', marginBottom: 0 }}
              checked={nuevo.es_externo}
              onChange={(e) => setNuevo({ ...nuevo, es_externo: e.target.checked })}
            />
            Cliente externo (venta a comisión)
          </label>
          <button className="boton">Guardar cliente</button>
        </form>
      )}

      <div className="tarjeta">
        <table>
          <thead>
            <tr><th>Nombre</th><th>CUIT/DNI</th><th>Email</th><th>Teléfono</th><th>CP</th><th>Tipo</th></tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id}>
                <td>{c.nombre}</td>
                <td>{c.cuit_dni}</td>
                <td>{c.email}</td>
                <td>{c.telefono}</td>
                <td>{c.codigo_postal || '—'}</td>
                <td>{c.es_externo ? <span className="badge">Externo (comisión)</span> : 'Propio'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
