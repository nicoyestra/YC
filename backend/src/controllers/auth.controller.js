const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.nombre_usuario, u.email, u.password_hash, u.activo, r.nombre AS rol
       FROM usuarios u JOIN roles r ON u.rol_id = r.id
       WHERE u.email = ?`,
      [email]
    );

    const usuario = rows[0];
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const passwordOk = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre_usuario },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await pool.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?', [usuario.id]);

    res.json({
      token,
      usuario: { id: usuario.id, nombre_usuario: usuario.nombre_usuario, email: usuario.email, rol: usuario.rol },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

async function registrar(req, res) {
  try {
    const { nombre_usuario, email, password, rol_id, empleado_id } = req.body;
    if (!nombre_usuario || !email || !password || !rol_id) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre_usuario, email, password_hash, rol_id, empleado_id)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre_usuario, email, password_hash, rol_id, empleado_id || null]
    );

    res.status(201).json({ id: result.insertId, nombre_usuario, email });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El usuario o email ya existe' });
    }
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
}

module.exports = { login, registrar };
