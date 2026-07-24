import { useEffect, useState } from 'react';
import api from '../api/client';

export default function RRHH() {
  const [empleados, setEmpleados] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState({
    nombre: '', apellido: '', dni: '', email: '', telefono: '', puesto: '', departamento: '', fecha_ingreso: '',
  });

  async function cargar() {
    const { data } = await api.get('/empleados');
    setEmpleados(data);
  }

  useEffect(() => { cargar(); }, []);

  async function crearEmpleado(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/empleados', nuevo);
      setMostrarForm(false);
      setNuevo({ nombre: '', apellido: '', dni: '', email: '', telefono: '', puesto: '', departamento: '', fecha_ingreso: '' });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear empleado');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>RRHH</h1>
        <button className="boton" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? 'Cancelar' : '+ Nuevo empleado'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {mostrarForm && (
        <form className="tarjeta" onSubmit={crearEmpleado}>
          <label>Nombre</label>
          <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />
          <label>Apellido</label>
          <input value={nuevo.apellido} onChange={(e) => setNuevo({ ...nuevo, apellido: e.target.value })} required />
          <label>DNI</label>
          <input value={nuevo.dni} onChange={(e) => setNuevo({ ...nuevo, dni: e.target.value })} />
          <label>Email</label>
          <input type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} required />
          <label>Puesto</label>
          <input value={nuevo.puesto} onChange={(e) => setNuevo({ ...nuevo, puesto: e.target.value })} />
          <label>Departamento</label>
          <input value={nuevo.departamento} onChange={(e) => setNuevo({ ...nuevo, departamento: e.target.value })} />
          <label>Fecha de ingreso</label>
          <input type="date" value={nuevo.fecha_ingreso} onChange={(e) => setNuevo({ ...nuevo, fecha_ingreso: e.target.value })} />
          <button className="boton">Guardar empleado</button>
        </form>
      )}

      <div className="tarjeta">
        <table>
          <thead><tr><th>Nombre</th><th>Puesto</th><th>Departamento</th><th>Email</th></tr></thead>
          <tbody>
            {empleados.map((e) => (
              <tr key={e.id}>
                <td>{e.nombre} {e.apellido}</td><td>{e.puesto}</td><td>{e.departamento}</td><td>{e.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
