const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { masterPool } = require('../config/db');

/**
 * LOGIN MASTER
 * Acceso exclusivo para administradores generales de YC System.
 */
async function loginMaster(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son obligatorios',
      });
    }

    const [rows] = await masterPool.query(
      `
      SELECT
        id,
        nombre,
        email,
        password_hash,
        rol,
        activo
      FROM usuarios_master
      WHERE email = ?
      LIMIT 1
      `,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: 'Email o contraseña incorrectos',
      });
    }

    const usuario = rows[0];

    if (!usuario.activo) {
      return res.status(403).json({
        error: 'Usuario Master desactivado',
      });
    }

    const passwordCorrecta = await bcrypt.compare(
      password,
      usuario.password_hash
    );

    if (!passwordCorrecta) {
      return res.status(401).json({
        error: 'Email o contraseña incorrectos',
      });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,

        // IMPORTANTE:
        // Esto permite distinguir un usuario Master
        // de un usuario normal de una empresa.
        tipo: 'master',
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '8h',
      }
    );

    await masterPool.query(
      `
      UPDATE usuarios_master
      SET ultimo_login = NOW()
      WHERE id = ?
      `,
      [usuario.id]
    );

    return res.json({
      mensaje: 'Login Master correcto',

      token,

      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        tipo: 'master',
      },
    });
  } catch (error) {
    console.error('Error login Master:', error);

    return res.status(500).json({
      error: 'Error interno al iniciar sesión Master',
    });
  }
}

/**
 * DEVUELVE EL USUARIO MASTER ACTUAL
 *
 * Esta función se utilizará después de pasar
 * por el middleware de autenticación Master.
 */
async function perfilMaster(req, res) {
  try {
    const [rows] = await masterPool.query(
      `
      SELECT
        id,
        nombre,
        email,
        rol,
        activo,
        ultimo_login,
        created_at
      FROM usuarios_master
      WHERE id = ?
      LIMIT 1
      `,
      [req.master.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario Master no encontrado',
      });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error('Error obteniendo perfil Master:', error);

    return res.status(500).json({
      error: 'Error al obtener el perfil Master',
    });
  }
}

module.exports = {
  loginMaster,
  perfilMaster,
};