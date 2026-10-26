import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const VACIO = {
  nombre_usuario: '',
  email: '',
  password: '',
  rol_id: '',
  empleado_id: '',
};

export default function Usuarios() {
  const { usuario: usuarioActual } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [form, setForm] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [passwordUsuario, setPasswordUsuario] = useState(null);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  const rolAdminId = useMemo(
    () => roles.find((r) => r.nombre === 'admin')?.id || '',
    [roles]
  );

  async function cargar() {
    setCargando(true);
    try {
      const [{ data: lista }, { data: opciones }] = await Promise.all([
        api.get('/usuarios'),
        api.get('/usuarios/opciones'),
      ]);
      setUsuarios(lista);
      setRoles(opciones.roles);
      setEmpleados(opciones.empleados);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar usuarios');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    const intervalo = window.setInterval(() => {
      api.get('/usuarios').then(({ data }) => setUsuarios(data)).catch(() => {});
    }, 15000);
    return () => window.clearInterval(intervalo);
  }, []);

  function limpiarAvisos() {
    setError('');
    setMensaje('');
  }

  function abrirNuevo() {
    limpiarAvisos();
    setEditando(null);
    setForm({ ...VACIO, rol_id: rolAdminId });
    setMostrarForm(true);
  }

  function abrirEditar(u) {
    limpiarAvisos();
    setEditando(u);
    setForm({
      nombre_usuario: u.nombre_usuario,
      email: u.email,
      password: '',
      rol_id: String(u.rol_id),
      empleado_id: u.empleado_id ? String(u.empleado_id) : '',
    });
    setMostrarForm(true);
  }

  function cancelarForm() {
    setMostrarForm(false);
    setEditando(null);
    setForm(VACIO);
  }

  async function guardar(e) {
    e.preventDefault();
    limpiarAvisos();
    try {
      const payload = {
        nombre_usuario: form.nombre_usuario,
        email: form.email,
        rol_id: Number(form.rol_id),
        empleado_id: form.empleado_id ? Number(form.empleado_id) : null,
      };

      if (editando) {
        await api.put(`/usuarios/${editando.id}`, payload);
        setMensaje('Usuario actualizado correctamente');
      } else {
        await api.post('/usuarios', { ...payload, password: form.password });
        setMensaje('Usuario creado correctamente');
      }
      cancelarForm();
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el usuario');
    }
  }

  async function alternarEstado(u) {
    limpiarAvisos();
    const accion = u.activo ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Querés ${accion} a ${u.nombre_usuario}?`)) return;
    try {
      await api.patch(`/usuarios/${u.id}/estado`, { activo: !Boolean(u.activo) });
      setMensaje(`Usuario ${u.activo ? 'desactivado' : 'activado'} correctamente`);
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar el estado');
    }
  }

  function abrirPassword(u) {
    limpiarAvisos();
    setPasswordUsuario(u);
    setNuevaPassword('');
  }

  async function eliminarUsuario(u) {
    limpiarAvisos();
    const confirmado = window.confirm(
      `¿Eliminar definitivamente al usuario "${u.nombre_usuario}"?\n\n` +
      'Si tiene movimientos históricos asociados, el sistema impedirá la eliminación para proteger los registros. No se puede deshacer.'
    );
    if (!confirmado) return;

    try {
      const { data } = await api.delete(`/usuarios/${u.id}`);
      setMensaje(data.mensaje || 'Usuario eliminado correctamente');
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar el usuario');
    }
  }

  async function guardarPassword(e) {
    e.preventDefault();
    limpiarAvisos();
    try {
      await api.patch(`/usuarios/${passwordUsuario.id}/password`, { password: nuevaPassword });
      setMensaje(`Contraseña de ${passwordUsuario.nombre_usuario} actualizada`);
      setPasswordUsuario(null);
      setNuevaPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar la contraseña');
    }
  }

  function fecha(valor) {
    if (!valor) return 'Nunca';
    return new Date(valor).toLocaleString('es-AR');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Usuarios</h1>
          <p style={{ marginTop: 0, color: '#6b7280' }}>Administrá accesos, roles y contraseñas del ERP.</p>
        </div>
        <button className="boton" onClick={abrirNuevo}>+ Nuevo usuario</button>
      </div>

      {error && <div className="error tarjeta" style={{ padding: 12 }}>{error}</div>}
      {mensaje && <div className="tarjeta" style={{ padding: 12, color: '#166534', background: '#dcfce7' }}>{mensaje}</div>}

      {mostrarForm && (
        <form className="tarjeta" onSubmit={guardar}>
          <h2>{editando ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <div className="form-grid">
            <div>
              <label>Nombre de usuario</label>
              <input value={form.nombre_usuario} onChange={(e) => setForm({ ...form, nombre_usuario: e.target.value })} required />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            {!editando && (
              <div>
                <label>Contraseña inicial</label>
                <input type="password" minLength="6" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
            )}
            <div>
              <label>Rol</label>
              <select value={form.rol_id} onChange={(e) => setForm({ ...form, rol_id: e.target.value })} required>
                <option value="">Seleccionar rol</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label>Empleado vinculado (opcional)</label>
              <select value={form.empleado_id} onChange={(e) => setForm({ ...form, empleado_id: e.target.value })}>
                <option value="">Sin vincular</option>
                {empleados.map((e) => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="boton" type="submit">{editando ? 'Guardar cambios' : 'Crear usuario'}</button>
            <button className="boton boton-secundario" type="button" onClick={cancelarForm}>Cancelar</button>
          </div>
        </form>
      )}

      {passwordUsuario && (
        <form className="tarjeta" onSubmit={guardarPassword}>
          <h2>Cambiar contraseña</h2>
          <p>Usuario: <strong>{passwordUsuario.nombre_usuario}</strong></p>
          <label>Nueva contraseña</label>
          <input type="password" minLength="6" value={nuevaPassword} onChange={(e) => setNuevaPassword(e.target.value)} required />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="boton" type="submit">Guardar contraseña</button>
            <button className="boton boton-secundario" type="button" onClick={() => setPasswordUsuario(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="tarjeta tabla-responsive">
        {cargando ? <p>Cargando usuarios...</p> : (
          <table>
            <thead>
              <tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Empleado</th><th>Estado</th><th>Conexión</th><th>Último ingreso</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.nombre_usuario}{u.id === usuarioActual?.id ? ' (vos)' : ''}</td>
                  <td>{u.email}</td>
                  <td>{u.rol}</td>
                  <td>{u.empleado || '—'}</td>
                  <td><span className={`badge ${u.activo ? 'badge-activo' : ''}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                  <td><span className={`badge ${u.en_linea ? 'badge-activo' : ''}`} style={!u.en_linea ? { background: '#e5e7eb', color: '#4b5563' } : {}}>{u.en_linea ? 'En línea' : 'Desconectado'}</span></td>
                  <td>{fecha(u.ultimo_login)}</td>
                  <td>
                    <div className="acciones-tabla">
                      <button className="boton boton-chico" onClick={() => abrirEditar(u)}>Editar</button>
                      <button className="boton boton-secundario boton-chico" onClick={() => abrirPassword(u)}>Contraseña</button>
                      <button className="boton boton-secundario boton-chico" disabled={u.id === usuarioActual?.id && Boolean(u.activo)} onClick={() => alternarEstado(u)}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className="boton boton-secundario boton-chico"
                        disabled={u.id === usuarioActual?.id}
                        onClick={() => eliminarUsuario(u)}
                        title={u.id === usuarioActual?.id ? 'No podés eliminar tu propio usuario' : 'Eliminar usuario'}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!usuarios.length && <tr><td colSpan="8">No hay usuarios registrados.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
