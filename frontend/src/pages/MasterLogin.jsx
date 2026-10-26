import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function MasterLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@ycsystem.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(e) {
    e.preventDefault();

    try {
      setCargando(true);
      setError('');

      const { data } = await api.post('/master/login', {
        email,
        password,
      });

      localStorage.setItem('master_token', data.token);
      localStorage.setItem(
        'master_usuario',
        JSON.stringify(data.usuario)
      );

      navigate('/master');
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'No se pudo iniciar sesión Master'
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background:
          'linear-gradient(135deg, #07111f 0%, #0b2239 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          background: '#ffffff',
          borderRadius: 18,
          padding: 30,
          boxShadow: '0 20px 50px rgba(0,0,0,.35)',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#0b63ce',
              marginBottom: 6,
            }}
          >
            YC SYSTEM
          </div>

          <h1 style={{ margin: 0 }}>Master Admin</h1>

          <p
            style={{
              marginTop: 8,
              color: '#667085',
            }}
          >
            Administración general de empresas y licencias.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: 12,
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={iniciarSesion}>
          <label>Email</label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@ycsystem.com"
            autoComplete="username"
            required
            style={{ marginBottom: 16 }}
          />

          <label>Contraseña</label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña Master"
            autoComplete="current-password"
            required
            style={{ marginBottom: 20 }}
          />

          <button
            type="submit"
            className="boton"
            disabled={cargando}
            style={{
              width: '100%',
            }}
          >
            {cargando ? 'Ingresando...' : 'Ingresar al Master'}
          </button>
        </form>
      </div>
    </div>
  );
}