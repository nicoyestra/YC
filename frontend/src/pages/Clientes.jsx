import { useEffect, useState } from 'react';
import api from '../api/client';

const VACIO = {
  nombre: '',
  cuit_dni: '',
  email: '',
  telefono: '',
  direccion: '',
  codigo_postal: '',
  es_externo: false,
};

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState('');

  async function cargar(filtro = '') {
    try {
      const { data } = await api.get('/ventas/clientes', {
        params: filtro ? { buscar: filtro } : {},
      });

      setClientes(data);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al cargar clientes'
      );
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function buscar(e) {
    e.preventDefault();
    cargar(busqueda);
  }

  function limpiarFormulario() {
    setNuevo(VACIO);
    setEditandoId(null);
    setMostrarForm(false);
  }

  function abrirNuevo() {
    if (mostrarForm && !editandoId) {
      limpiarFormulario();
      return;
    }

    setNuevo(VACIO);
    setEditandoId(null);
    setError('');
    setMostrarForm(true);
  }

  async function editarCliente(cliente) {
    setError('');

    try {
      const { data } = await api.get(
        `/ventas/clientes/${cliente.id}`
      );

      setNuevo({
        nombre: data.nombre || '',
        cuit_dni: data.cuit_dni || '',
        email: data.email || '',
        telefono: data.telefono || '',
        direccion: data.direccion || '',
        codigo_postal: data.codigo_postal || '',
        es_externo: Boolean(data.es_externo),
      });

      setEditandoId(cliente.id);
      setMostrarForm(true);

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al cargar el cliente'
      );
    }
  }

  async function guardarCliente(e) {
    e.preventDefault();
    setError('');

    try {
      if (editandoId) {
        await api.put(
          `/ventas/clientes/${editandoId}`,
          {
            ...nuevo,
            activo: 1,
          }
        );
      } else {
        await api.post(
          '/ventas/clientes',
          nuevo
        );
      }

      limpiarFormulario();
      await cargar(busqueda);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          (editandoId
            ? 'Error al actualizar cliente'
            : 'Error al crear cliente')
      );
    }
  }

  async function desactivarCliente(cliente) {
    const confirmar = window.confirm(
      `¿Querés desactivar al cliente "${cliente.nombre}"?`
    );

    if (!confirmar) {
      return;
    }

    setError('');

    try {
      await api.delete(
        `/ventas/clientes/${cliente.id}`
      );

      await cargar(busqueda);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al desactivar cliente'
      );
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1>Clientes</h1>

        <button
          type="button"
          className="boton"
          onClick={abrirNuevo}
        >
          {mostrarForm && !editandoId
            ? 'Cancelar'
            : '+ Nuevo cliente'}
        </button>
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <form
        className="tarjeta"
        onSubmit={buscar}
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: 1 }}>
          <label>Buscar cliente</label>

          <input
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
            placeholder="Nombre, CUIT/DNI o email..."
          />
        </div>

        <button
          className="boton boton-secundario"
          style={{ marginBottom: 12 }}
        >
          Buscar
        </button>
      </form>

      {mostrarForm && (
        <form
          className="tarjeta"
          onSubmit={guardarCliente}
        >
          <h3>
            {editandoId
              ? 'Editar cliente'
              : 'Nuevo cliente'}
          </h3>

          <label>Nombre</label>
          <input
            value={nuevo.nombre}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                nombre: e.target.value,
              })
            }
            required
          />

          <label>CUIT/DNI</label>
          <input
            value={nuevo.cuit_dni}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                cuit_dni: e.target.value,
              })
            }
          />

          <label>Email</label>
          <input
            type="email"
            value={nuevo.email}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                email: e.target.value,
              })
            }
          />

          <label>Teléfono</label>
          <input
            value={nuevo.telefono}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                telefono: e.target.value,
              })
            }
          />

          <label>Dirección</label>
          <input
            value={nuevo.direccion}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                direccion: e.target.value,
              })
            }
          />

          <label>Código postal</label>
          <input
            value={nuevo.codigo_postal}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                codigo_postal: e.target.value,
              })
            }
          />

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              style={{
                width: 'auto',
                marginBottom: 0,
              }}
              checked={nuevo.es_externo}
              onChange={(e) =>
                setNuevo({
                  ...nuevo,
                  es_externo: e.target.checked,
                })
              }
            />

            Cliente externo (venta a comisión)
          </label>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 12,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="submit"
              className="boton"
            >
              {editandoId
                ? 'Guardar cambios'
                : 'Guardar cliente'}
            </button>

            <button
              type="button"
              className="boton boton-secundario"
              onClick={limpiarFormulario}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="tarjeta">
        <div
          style={{
            overflowX: 'auto',
          }}
        >
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>CUIT/DNI</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>CP</th>
                <th>Tipo</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {clientes.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: 'center',
                      padding: 30,
                      color: '#64748b',
                    }}
                  >
                    No hay clientes para mostrar.
                  </td>
                </tr>
              )}

              {clientes.map((c) => (
                <tr key={c.id}>
                  <td>{c.nombre}</td>
                  <td>{c.cuit_dni || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td>{c.telefono || '—'}</td>
                  <td>
                    {c.codigo_postal || '—'}
                  </td>

                  <td>
                    {c.es_externo ? (
                      <span className="badge">
                        Externo (comisión)
                      </span>
                    ) : (
                      'Propio'
                    )}
                  </td>

                  <td>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        className="boton boton-secundario"
                        onClick={() =>
                          editarCliente(c)
                        }
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className="boton boton-secundario"
                        style={{
                          background: '#dc2626',
                          color: '#fff',
                        }}
                        onClick={() =>
                          desactivarCliente(c)
                        }
                      >
                        Desactivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}