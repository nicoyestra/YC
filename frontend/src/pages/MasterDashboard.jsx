import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

function fechaLocal(diasDesdeHoy = 0) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + diasDesdeHoy);

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  return `${anio}-${mes}-${dia}`;
}

function formularioInicial() {
  return {
    codigo: '',
    razon_social: '',
    nombre_fantasia: '',
    cuit: '',
    email: '',
    telefono: '',
    plan: 'demo',
    fecha_inicio: fechaLocal(0),
    fecha_vencimiento: fechaLocal(30),
    limite_usuarios: '',
    admin_nombre_usuario: 'admin',
    admin_email: '',
  };
}

export default function MasterDashboard() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [resumen, setResumen] = useState({
    empresas: 0,
    empresas_activas: 0,
    licencias: 0,
    usuarios_master: 0,
  });

  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const [mostrarNuevaEmpresa, setMostrarNuevaEmpresa] =
    useState(false);

  const [formEmpresa, setFormEmpresa] =
    useState(formularioInicial());

  const [guardandoEmpresa, setGuardandoEmpresa] =
    useState(false);

  const [errorEmpresa, setErrorEmpresa] = useState('');

  const [empresaCreada, setEmpresaCreada] =
    useState(null);

  const [empresaAdministrada, setEmpresaAdministrada] = useState(null);
  const [formAdministrar, setFormAdministrar] = useState(null);
  const [cargandoAdministrar, setCargandoAdministrar] = useState(false);
  const [guardandoAdministrar, setGuardandoAdministrar] = useState(false);
  const [errorAdministrar, setErrorAdministrar] = useState('');
  const [passwordTemporalAdmin, setPasswordTemporalAdmin] = useState('');

  function obtenerConfigMaster() {
    const token = localStorage.getItem('master_token');

    if (!token) {
      return null;
    }

    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

  async function cargarDatos() {
    const config = obtenerConfigMaster();

    if (!config) {
      navigate('/master/login');
      return;
    }

    try {
      setError('');

      const [
        respuestaPerfil,
        respuestaEmpresas,
        respuestaResumen,
      ] = await Promise.all([
        api.get('/master/perfil', config),
        api.get('/master/empresas', config),
        api.get('/master/resumen', config),
      ]);

      setUsuario(respuestaPerfil.data);

      setEmpresas(
        Array.isArray(respuestaEmpresas.data)
          ? respuestaEmpresas.data
          : []
      );

      setResumen({
        empresas:
          Number(respuestaResumen.data?.empresas) || 0,

        empresas_activas:
          Number(respuestaResumen.data?.empresas_activas) || 0,

        licencias:
          Number(respuestaResumen.data?.licencias) || 0,

        usuarios_master:
          Number(respuestaResumen.data?.usuarios_master) || 0,
      });
    } catch (err) {
      const status = err.response?.status;

      if (status === 401 || status === 403) {
        localStorage.removeItem('master_token');
        localStorage.removeItem('master_usuario');

        navigate('/master/login');
        return;
      }

      setError(
        err.response?.data?.error ||
          'No se pudieron cargar los datos del Master'
      );
    }
  }

  useEffect(() => {
    async function iniciar() {
      try {
        await cargarDatos();
      } finally {
        setCargando(false);
      }
    }

    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  function cerrarSesion() {
    localStorage.removeItem('master_token');
    localStorage.removeItem('master_usuario');

    navigate('/master/login');
  }

  function formatearFecha(fecha) {
    if (!fecha) return '—';

    const texto = String(fecha).slice(0, 10);
    const partes = texto.split('-');

    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
      return '—';
    }

    return valor.toLocaleDateString('es-AR');
  }

  function estadoLicencia(empresa) {
    if (!empresa.licencia_id) {
      return 'Sin licencia';
    }

    return Number(empresa.licencia_activa) === 1
      ? 'Activa'
      : 'Inactiva';
  }

  function abrirNuevaEmpresa() {
    setFormEmpresa(formularioInicial());
    setErrorEmpresa('');
    setEmpresaCreada(null);
    setMostrarNuevaEmpresa(true);
  }

  function cerrarNuevaEmpresa() {
    if (guardandoEmpresa) return;

    setMostrarNuevaEmpresa(false);
    setErrorEmpresa('');
    setEmpresaCreada(null);
  }

  function cambiarCampoEmpresa(evento) {
    const { name, value } = evento.target;

    setFormEmpresa((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  }

  async function crearNuevaEmpresa(evento) {
    evento.preventDefault();

    const config = obtenerConfigMaster();

    if (!config) {
      navigate('/master/login');
      return;
    }

    if (
      !formEmpresa.codigo.trim() ||
      !formEmpresa.razon_social.trim() ||
      !formEmpresa.admin_nombre_usuario.trim() ||
      !formEmpresa.admin_email.trim()
    ) {
      setErrorEmpresa(
        'Completá código, razón social, usuario Admin y email del Admin.'
      );
      return;
    }

    if (
      formEmpresa.fecha_inicio &&
      formEmpresa.fecha_vencimiento &&
      formEmpresa.fecha_vencimiento <
        formEmpresa.fecha_inicio
    ) {
      setErrorEmpresa(
        'La fecha de vencimiento no puede ser anterior a la fecha de inicio.'
      );
      return;
    }

    setGuardandoEmpresa(true);
    setErrorEmpresa('');

    try {
      const payload = {
        codigo: formEmpresa.codigo.trim(),
        razon_social:
          formEmpresa.razon_social.trim(),
        nombre_fantasia:
          formEmpresa.nombre_fantasia.trim() || null,
        cuit: formEmpresa.cuit.trim() || null,
        email:
          formEmpresa.email.trim().toLowerCase() ||
          null,
        telefono:
          formEmpresa.telefono.trim() || null,

        plan: formEmpresa.plan,
        fecha_inicio: formEmpresa.fecha_inicio,
        fecha_vencimiento:
          formEmpresa.fecha_vencimiento,
        limite_usuarios:
          formEmpresa.limite_usuarios === ''
            ? null
            : Number(formEmpresa.limite_usuarios),

        admin_nombre_usuario:
          formEmpresa.admin_nombre_usuario.trim(),
        admin_email:
          formEmpresa.admin_email
            .trim()
            .toLowerCase(),
      };

      const respuesta = await api.post(
        '/master/empresas',
        payload,
        config
      );

      setEmpresaCreada(respuesta.data);

      await cargarDatos();
    } catch (err) {
      const status = err.response?.status;

      if (status === 401 || status === 403) {
        localStorage.removeItem('master_token');
        localStorage.removeItem('master_usuario');
        navigate('/master/login');
        return;
      }

      setErrorEmpresa(
        err.response?.data?.detalle ||
          err.response?.data?.error ||
          'No se pudo crear la empresa'
      );
    } finally {
      setGuardandoEmpresa(false);
    }
  }

  async function abrirAdministrarEmpresa(empresa) {
    const config = obtenerConfigMaster();
    if (!config) { navigate('/master/login'); return; }
    setCargandoAdministrar(true);
    setErrorAdministrar('');
    setPasswordTemporalAdmin('');
    try {
      const respuesta = await api.get(`/master/empresas/${empresa.id}`, config);
      const { empresa: datos, licencia, administrador } = respuesta.data;
      setEmpresaAdministrada(datos);
      setFormAdministrar({
        razon_social: datos.razon_social || '',
        nombre_fantasia: datos.nombre_fantasia || '',
        cuit: datos.cuit || '',
        email: datos.email || '',
        telefono: datos.telefono || '',
        estado: datos.estado || 'activa',
        plan: licencia?.plan || 'demo',
        fecha_inicio: String(licencia?.fecha_inicio || fechaLocal(0)).slice(0, 10),
        fecha_vencimiento: String(licencia?.fecha_vencimiento || fechaLocal(30)).slice(0, 10),
        licencia_activa: Number(licencia?.activa ?? 1),
        limite_usuarios: licencia?.limite_usuarios ?? '',
        admin_nombre_usuario: administrador?.nombre_usuario || '',
        admin_email: administrador?.email || '',
        admin_activo: Number(administrador?.activo ?? 0),
      });
    } catch (err) {
      setErrorAdministrar(err.response?.data?.error || 'No se pudo cargar la empresa.');
      setEmpresaAdministrada(empresa);
      setFormAdministrar(null);
    } finally {
      setCargandoAdministrar(false);
    }
  }

  function cerrarAdministrarEmpresa() {
    if (guardandoAdministrar) return;
    setEmpresaAdministrada(null);
    setFormAdministrar(null);
    setErrorAdministrar('');
    setPasswordTemporalAdmin('');
  }

  function cambiarCampoAdministrar(evento) {
    const { name, value } = evento.target;
    setFormAdministrar((anterior) => ({ ...anterior, [name]: value }));
  }

  async function guardarAdministracion(evento) {
    evento.preventDefault();
    const config = obtenerConfigMaster();
    if (!config || !empresaAdministrada || !formAdministrar) return;
    setGuardandoAdministrar(true);
    setErrorAdministrar('');
    try {
      await api.put(`/master/empresas/${empresaAdministrada.id}`, {
        razon_social: formAdministrar.razon_social,
        nombre_fantasia: formAdministrar.nombre_fantasia,
        cuit: formAdministrar.cuit,
        email: formAdministrar.email,
        telefono: formAdministrar.telefono,
        estado: formAdministrar.estado,
        plan: formAdministrar.plan,
        fecha_inicio: formAdministrar.fecha_inicio,
        fecha_vencimiento: formAdministrar.fecha_vencimiento,
        licencia_activa: Number(formAdministrar.licencia_activa),
        limite_usuarios: formAdministrar.limite_usuarios === '' ? null : Number(formAdministrar.limite_usuarios),
      }, config);
      await cargarDatos();
      setErrorAdministrar('Cambios guardados correctamente.');
    } catch (err) {
      setErrorAdministrar(err.response?.data?.error || 'No se pudieron guardar los cambios.');
    } finally {
      setGuardandoAdministrar(false);
    }
  }

  async function generarClaveAdmin() {
    const config = obtenerConfigMaster();
    if (!config || !empresaAdministrada) return;
    if (!window.confirm(`¿Generar una nueva contraseña temporal para ${formAdministrar?.admin_email || 'el administrador'}? La clave anterior dejará de funcionar.`)) return;
    setGuardandoAdministrar(true);
    setErrorAdministrar('');
    setPasswordTemporalAdmin('');
    try {
      const respuesta = await api.post(`/master/empresas/${empresaAdministrada.id}/restablecer-admin`, {}, config);
      setPasswordTemporalAdmin(respuesta.data.password_temporal || '');
      setErrorAdministrar('Contraseña restablecida. Copiala y entregásela al administrador por un medio seguro.');
      setFormAdministrar((anterior) => ({ ...anterior, admin_activo: 1 }));
    } catch (err) {
      setErrorAdministrar(err.response?.data?.error || 'No se pudo restablecer la contraseña.');
    } finally {
      setGuardandoAdministrar(false);
    }
  }

  async function copiarPasswordAdmin() {
    if (!passwordTemporalAdmin) return;
    try { await navigator.clipboard.writeText(passwordTemporalAdmin); alert('Contraseña copiada.'); }
    catch { alert(`Contraseña temporal: ${passwordTemporalAdmin}`); }
  }

  async function copiarPasswordTemporal() {
    const password =
      empresaCreada?.administrador?.password_temporal;

    if (!password) return;

    try {
      await navigator.clipboard.writeText(password);
      alert('Contraseña temporal copiada.');
    } catch {
      alert(
        `Contraseña temporal: ${password}`
      );
    }
  }

  if (cargando) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#07111f',
          color: 'white',
        }}
      >
        Cargando Master...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f7fb',
      }}
    >
      <header
        style={{
          background: '#07111f',
          color: 'white',
          padding: '18px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: '#4da3ff',
              fontWeight: 800,
              letterSpacing: 1,
            }}
          >
            YC SYSTEM
          </div>

          <h2
            style={{
              margin: '4px 0 0',
            }}
          >
            Master Admin
          </h2>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 15,
          }}
        >
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700 }}>
              {usuario?.nombre || 'Administrador'}
            </div>

            <div
              style={{
                fontSize: 12,
                opacity: 0.7,
              }}
            >
              {usuario?.rol || 'master'}
            </div>
          </div>

          <button
            type="button"
            className="boton boton-secundario"
            onClick={cerrarSesion}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main
        style={{
          maxWidth: 1250,
          margin: '0 auto',
          padding: 30,
        }}
      >
        {error && (
          <div
            className="error"
            style={{ marginBottom: 20 }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 20,
            flexWrap: 'wrap',
            marginBottom: 25,
          }}
        >
          <div>
            <h1
              style={{
                marginBottom: 5,
              }}
            >
              Panel Master
            </h1>

            <div style={{ color: '#667085' }}>
              Administración general de YC System
            </div>
          </div>

          <button
            type="button"
            className="boton"
            onClick={abrirNuevaEmpresa}
          >
            + Nueva empresa
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 18,
            marginBottom: 28,
          }}
        >
          <div className="tarjeta">
            <div
              style={{
                color: '#667085',
                marginBottom: 8,
              }}
            >
              Empresas
            </div>

            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              {resumen.empresas}
            </div>
          </div>

          <div className="tarjeta">
            <div
              style={{
                color: '#667085',
                marginBottom: 8,
              }}
            >
              Empresas activas
            </div>

            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              {resumen.empresas_activas}
            </div>
          </div>

          <div className="tarjeta">
            <div
              style={{
                color: '#667085',
                marginBottom: 8,
              }}
            >
              Licencias
            </div>

            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              {resumen.licencias}
            </div>
          </div>

          <div className="tarjeta">
            <div
              style={{
                color: '#667085',
                marginBottom: 8,
              }}
            >
              Administradores Master
            </div>

            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
              }}
            >
              {resumen.usuarios_master}
            </div>
          </div>
        </div>

        <div className="tarjeta">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 15,
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>
                Empresas
              </h2>

              <div
                style={{
                  color: '#667085',
                  marginTop: 4,
                }}
              >
                Empresas registradas en yc_master.
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Empresa</th>
                  <th>Base de datos</th>
                  <th>Estado</th>
                  <th>Licencia</th>
                  <th>Vencimiento</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {empresas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: 'center',
                        padding: 30,
                      }}
                    >
                      No hay empresas registradas.
                    </td>
                  </tr>
                ) : (
                  empresas.map((empresa) => (
                    <tr key={empresa.id}>
                      <td>
                        <strong>
                          {empresa.codigo}
                        </strong>
                      </td>

                      <td>
                        {empresa.nombre_fantasia ||
                          empresa.razon_social ||
                          '—'}
                      </td>

                      <td>
                        <code>
                          {empresa.db_name || '—'}
                        </code>
                      </td>

                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            textTransform: 'capitalize',
                          }}
                        >
                          {empresa.estado || '—'}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                          }}
                        >
                          {estadoLicencia(empresa)}
                        </span>

                        {empresa.licencia_plan && (
                          <div
                            style={{
                              fontSize: 12,
                              color: '#667085',
                              marginTop: 3,
                              textTransform: 'capitalize',
                            }}
                          >
                            {empresa.licencia_plan}
                          </div>
                        )}
                      </td>

                      <td>
                        {formatearFecha(
                          empresa.fecha_vencimiento
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="boton boton-secundario"
                          onClick={() => abrirAdministrarEmpresa(empresa)}
                        >
                          Administrar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {mostrarNuevaEmpresa && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(7, 17, 31, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            overflowY: 'auto',
          }}
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) {
              cerrarNuevaEmpresa();
            }
          }}
        >
          <div
            style={{
              background: 'white',
              width: '100%',
              maxWidth: 860,
              borderRadius: 14,
              boxShadow:
                '0 24px 70px rgba(0, 0, 0, 0.30)',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '22px 24px',
                borderBottom: '1px solid #e4e7ec',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  {empresaCreada
                    ? 'Empresa creada'
                    : 'Nueva empresa'}
                </h2>

                <div
                  style={{
                    color: '#667085',
                    marginTop: 5,
                  }}
                >
                  {empresaCreada
                    ? 'Guardá la contraseña temporal antes de cerrar.'
                    : 'Se creará una base de datos independiente para este cliente.'}
                </div>
              </div>

              <button
                type="button"
                onClick={cerrarNuevaEmpresa}
                disabled={guardandoEmpresa}
                style={{
                  border: 0,
                  background: 'transparent',
                  fontSize: 26,
                  cursor: guardandoEmpresa
                    ? 'not-allowed'
                    : 'pointer',
                  lineHeight: 1,
                  color: '#667085',
                }}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {empresaCreada ? (
              <div style={{ padding: 24 }}>
                <div
                  style={{
                    background: '#ecfdf3',
                    border: '1px solid #abefc6',
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <strong>
                    Empresa creada correctamente.
                  </strong>

                  <div
                    style={{
                      marginTop: 6,
                      color: '#475467',
                    }}
                  >
                    La nueva empresa ya tiene su propia
                    base de datos, licencia y usuario Admin.
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 14,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      border: '1px solid #e4e7ec',
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: '#667085',
                        marginBottom: 5,
                      }}
                    >
                      Empresa
                    </div>

                    <strong>
                      {empresaCreada.empresa
                        ?.nombre_fantasia ||
                        empresaCreada.empresa
                          ?.razon_social ||
                        empresaCreada.empresa?.codigo}
                    </strong>
                  </div>

                  <div
                    style={{
                      border: '1px solid #e4e7ec',
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: '#667085',
                        marginBottom: 5,
                      }}
                    >
                      Base de datos
                    </div>

                    <code>
                      {empresaCreada.empresa?.db_name}
                    </code>
                  </div>

                  <div
                    style={{
                      border: '1px solid #e4e7ec',
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: '#667085',
                        marginBottom: 5,
                      }}
                    >
                      Plan
                    </div>

                    <strong
                      style={{
                        textTransform: 'capitalize',
                      }}
                    >
                      {empresaCreada.licencia?.plan ||
                        '—'}
                    </strong>
                  </div>

                  <div
                    style={{
                      border: '1px solid #e4e7ec',
                      borderRadius: 10,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: '#667085',
                        marginBottom: 5,
                      }}
                    >
                      Vencimiento
                    </div>

                    <strong>
                      {formatearFecha(
                        empresaCreada.licencia
                          ?.fecha_vencimiento
                      )}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    border: '2px solid #4da3ff',
                    borderRadius: 12,
                    padding: 18,
                    background: '#f5faff',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#175cd3',
                      marginBottom: 10,
                    }}
                  >
                    ACCESO INICIAL DEL ADMINISTRADOR
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 14,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#667085',
                        }}
                      >
                        Usuario
                      </div>

                      <strong>
                        {
                          empresaCreada.administrador
                            ?.nombre_usuario
                        }
                      </strong>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#667085',
                        }}
                      >
                        Email
                      </div>

                      <strong>
                        {
                          empresaCreada.administrador
                            ?.email
                        }
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 18,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: '#667085',
                        marginBottom: 7,
                      }}
                    >
                      Contraseña temporal
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <code
                        style={{
                          fontSize: 22,
                          fontWeight: 800,
                          background: 'white',
                          border: '1px solid #d0d5dd',
                          borderRadius: 8,
                          padding: '10px 14px',
                        }}
                      >
                        {
                          empresaCreada.administrador
                            ?.password_temporal
                        }
                      </code>

                      <button
                        type="button"
                        className="boton boton-secundario"
                        onClick={copiarPasswordTemporal}
                      >
                        Copiar contraseña
                      </button>
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: '#b54708',
                        marginTop: 10,
                        fontWeight: 600,
                      }}
                    >
                      Guardala ahora. Esta contraseña se
                      muestra solamente al crear la empresa.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: 22,
                  }}
                >
                  <button
                    type="button"
                    className="boton"
                    onClick={cerrarNuevaEmpresa}
                  >
                    Listo
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={crearNuevaEmpresa}
                style={{ padding: 24 }}
              >
                {errorEmpresa && (
                  <div
                    className="error"
                    style={{
                      marginBottom: 18,
                    }}
                  >
                    {errorEmpresa}
                  </div>
                )}

                <h3
                  style={{
                    marginTop: 0,
                    marginBottom: 14,
                  }}
                >
                  Datos de la empresa
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 15,
                  }}
                >
                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Código *
                    </div>

                    <input
                      name="codigo"
                      value={formEmpresa.codigo}
                      onChange={cambiarCampoEmpresa}
                      placeholder="Ej: CLIENTE002"
                      required
                      disabled={guardandoEmpresa}
                    />
                  </label>

                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Razón social *
                    </div>

                    <input
                      name="razon_social"
                      value={
                        formEmpresa.razon_social
                      }
                      onChange={cambiarCampoEmpresa}
                      placeholder="Razón social"
                      required
                      disabled={guardandoEmpresa}
                    />
                  </label>

                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Nombre fantasía
                    </div>

                    <input
                      name="nombre_fantasia"
                      value={
                        formEmpresa.nombre_fantasia
                      }
                      onChange={cambiarCampoEmpresa}
                      placeholder="Nombre comercial"
                      disabled={guardandoEmpresa}
                    />
                  </label>

                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      CUIT
                    </div>

                    <input
                      name="cuit"
                      value={formEmpresa.cuit}
                      onChange={cambiarCampoEmpresa}
                      placeholder="30-12345678-9"
                      disabled={guardandoEmpresa}
                    />
                  </label>

                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Email empresa
                    </div>

                    <input
                      type="email"
                      name="email"
                      value={formEmpresa.email}
                      onChange={cambiarCampoEmpresa}
                      placeholder="empresa@correo.com"
                      disabled={guardandoEmpresa}
                    />
                  </label>

                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Teléfono
                    </div>

                    <input
                      name="telefono"
                      value={formEmpresa.telefono}
                      onChange={cambiarCampoEmpresa}
                      placeholder="Teléfono"
                      disabled={guardandoEmpresa}
                    />
                  </label>
                </div>

                <h3
                  style={{
                    marginTop: 28,
                    marginBottom: 14,
                  }}
                >
                  Licencia
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 15,
                  }}
                >
                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Plan
                    </div>

                    <select
                      name="plan"
                      value={formEmpresa.plan}
                      onChange={cambiarCampoEmpresa}
                      disabled={guardandoEmpresa}
                    >
                      <option value="demo">
                        Demo
                      </option>

                      <option value="basico">
                        Básico
                      </option>

                      <option value="profesional">
                        Profesional
                      </option>

                      <option value="enterprise">
                        Enterprise
                      </option>
                    </select>
                  </label>

                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Inicio
                    </div>

                    <input
                      type="date"
                      name="fecha_inicio"
                      value={
                        formEmpresa.fecha_inicio
                      }
                      onChange={cambiarCampoEmpresa}
                      required
                      disabled={guardandoEmpresa}
                    />
                  </label>

                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Vencimiento
                    </div>

                    <input
                      type="date"
                      name="fecha_vencimiento"
                      value={
                        formEmpresa.fecha_vencimiento
                      }
                      onChange={cambiarCampoEmpresa}
                      required
                      disabled={guardandoEmpresa}
                    />
                  </label>

                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Límite usuarios
                    </div>

                    <input
                      type="number"
                      min="1"
                      name="limite_usuarios"
                      value={
                        formEmpresa.limite_usuarios
                      }
                      onChange={cambiarCampoEmpresa}
                      placeholder="Sin límite"
                      disabled={guardandoEmpresa}
                    />
                  </label>
                </div>

                <h3
                  style={{
                    marginTop: 28,
                    marginBottom: 6,
                  }}
                >
                  Primer administrador
                </h3>

                <div
                  style={{
                    color: '#667085',
                    marginBottom: 14,
                    fontSize: 13,
                  }}
                >
                  La contraseña se generará
                  automáticamente y se mostrará al
                  finalizar.
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 15,
                  }}
                >
                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Usuario Admin *
                    </div>

                    <input
                      name="admin_nombre_usuario"
                      value={
                        formEmpresa.admin_nombre_usuario
                      }
                      onChange={cambiarCampoEmpresa}
                      placeholder="admin"
                      required
                      disabled={guardandoEmpresa}
                    />
                  </label>

                  <label>
                    <div
                      style={{
                        marginBottom: 6,
                        fontWeight: 600,
                      }}
                    >
                      Email Admin *
                    </div>

                    <input
                      type="email"
                      name="admin_email"
                      value={
                        formEmpresa.admin_email
                      }
                      onChange={cambiarCampoEmpresa}
                      placeholder="admin@empresa.com"
                      required
                      disabled={guardandoEmpresa}
                    />
                  </label>
                </div>

                <div
                  style={{
                    background: '#f9fafb',
                    border: '1px solid #e4e7ec',
                    borderRadius: 10,
                    padding: 14,
                    marginTop: 22,
                    color: '#475467',
                    fontSize: 13,
                  }}
                >
                  Al confirmar, YC System creará una
                  base de datos exclusiva para esta
                  empresa y cargará automáticamente las
                  tablas del ERP.
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 10,
                    marginTop: 22,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    className="boton boton-secundario"
                    onClick={cerrarNuevaEmpresa}
                    disabled={guardandoEmpresa}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="boton"
                    disabled={guardandoEmpresa}
                  >
                    {guardandoEmpresa
                      ? 'Creando empresa...'
                      : 'Crear empresa'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {empresaAdministrada && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(7,17,31,.76)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }} onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarAdministrarEmpresa(); }}>
          <div style={{ background: '#fff', width: 'min(900px, 100%)', maxHeight: '94vh', overflowY: 'auto', borderRadius: 16, padding: 24, boxShadow: '0 24px 70px rgba(0,0,0,.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 18 }}>
              <div><h2 style={{ margin: 0 }}>Administrar empresa</h2><p style={{ margin: '6px 0 0', color: '#667085' }}>{empresaAdministrada.codigo} · Base: {empresaAdministrada.db_name}</p></div>
              <button type="button" className="boton boton-secundario" onClick={cerrarAdministrarEmpresa} disabled={guardandoAdministrar}>Cerrar</button>
            </div>
            {cargandoAdministrar || !formAdministrar ? <p>Cargando datos de la empresa...</p> : (
              <form onSubmit={guardarAdministracion}>
                <h3>Datos de la empresa</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  <label>Razón social<input name="razon_social" value={formAdministrar.razon_social} onChange={cambiarCampoAdministrar} required /></label>
                  <label>Nombre de fantasía<input name="nombre_fantasia" value={formAdministrar.nombre_fantasia} onChange={cambiarCampoAdministrar} /></label>
                  <label>CUIT<input name="cuit" value={formAdministrar.cuit} onChange={cambiarCampoAdministrar} /></label>
                  <label>Email de la empresa<input type="email" name="email" value={formAdministrar.email} onChange={cambiarCampoAdministrar} /></label>
                  <label>Teléfono<input name="telefono" value={formAdministrar.telefono} onChange={cambiarCampoAdministrar} /></label>
                  <label>Estado de la empresa<select name="estado" value={formAdministrar.estado} onChange={cambiarCampoAdministrar}><option value="activa">Activa</option><option value="suspendida">Suspendida</option><option value="bloqueada">Bloqueada</option></select></label>
                </div>
                <h3 style={{ marginTop: 24 }}>Licencia</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                  <label>Plan<select name="plan" value={formAdministrar.plan} onChange={cambiarCampoAdministrar}><option value="demo">Demo</option><option value="basico">Básico</option><option value="profesional">Profesional</option><option value="enterprise">Enterprise</option></select></label>
                  <label>Inicio<input type="date" name="fecha_inicio" value={formAdministrar.fecha_inicio} onChange={cambiarCampoAdministrar} required /></label>
                  <label>Vencimiento<input type="date" name="fecha_vencimiento" value={formAdministrar.fecha_vencimiento} onChange={cambiarCampoAdministrar} required /></label>
                  <label>Estado de licencia<select name="licencia_activa" value={String(formAdministrar.licencia_activa)} onChange={cambiarCampoAdministrar}><option value="1">Activa</option><option value="0">Inactiva</option></select></label>
                  <label>Límite de usuarios (vacío = sin límite)<input type="number" min="1" name="limite_usuarios" value={formAdministrar.limite_usuarios} onChange={cambiarCampoAdministrar} /></label>
                </div>
                <h3 style={{ marginTop: 24 }}>Acceso del administrador</h3>
                <div style={{ padding: 14, background: '#f8fafc', border: '1px solid #e4e7ec', borderRadius: 10 }}>
                  <p style={{ margin: '0 0 6px' }}><strong>Usuario:</strong> {formAdministrar.admin_nombre_usuario || 'No registrado'}</p>
                  <p style={{ margin: '0 0 12px' }}><strong>Email de acceso:</strong> {formAdministrar.admin_email || 'No registrado'}</p>
                  <button type="button" className="boton boton-secundario" onClick={generarClaveAdmin} disabled={guardandoAdministrar || !formAdministrar.admin_email}>Generar nueva contraseña temporal</button>
                  {passwordTemporalAdmin && <div style={{ marginTop: 12, padding: 12, border: '1px solid #b7e4c7', background: '#f0fdf4', borderRadius: 8 }}><strong>Nueva contraseña temporal</strong><p style={{ fontFamily: 'monospace', fontSize: 18, margin: '8px 0' }}>{passwordTemporalAdmin}</p><button type="button" className="boton" onClick={copiarPasswordAdmin}>Copiar contraseña</button><p style={{ marginBottom: 0, fontSize: 12 }}>Guardala ahora: no volverá a mostrarse cuando cierres esta ventana.</p></div>}
                </div>
                {errorAdministrar && <p role="status" style={{ marginTop: 16, padding: 12, borderRadius: 8, background: errorAdministrar.includes('correctamente') || errorAdministrar.includes('restablecida') ? '#ecfdf3' : '#fff1f2', color: errorAdministrar.includes('No se pudo') || errorAdministrar.includes('Revisá') ? '#b42318' : '#027a48' }}>{errorAdministrar}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
                  <button type="button" className="boton boton-secundario" onClick={cerrarAdministrarEmpresa} disabled={guardandoAdministrar}>Cerrar</button>
                  <button type="submit" className="boton" disabled={guardandoAdministrar}>{guardandoAdministrar ? 'Guardando...' : 'Guardar cambios'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}