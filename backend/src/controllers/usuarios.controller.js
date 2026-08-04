const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function listar(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.nombre_usuario, u.email, u.activo, u.ultimo_login, u.created_at,
              u.rol_id, r.nombre AS rol,
              u.empleado_id,
              CONCAT(e.nombre, ' ', e.apellido) AS empleado
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN empleados e ON e.id = u.empleado_id
       ORDER BY u.nombre_usuario`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
}

async function opciones(req, res) {
  try {
    const [[roles], [empleados]] = await Promise.all([
      pool.query('SELECT id, nombre, descripcion FROM roles ORDER BY id'),
      pool.query(
        `SELECT id, nombre, apellido, email
         FROM empleados
         WHERE activo = TRUE
         ORDER BY apellido, nombre`
      ),
    ]);
    res.json({ roles, empleados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar opciones de usuarios' });
  }
}

async function crear(req, res) {
  try {
    const { nombre_usuario, email, password, rol_id, empleado_id } = req.body;
    if (!nombre_usuario || !email || !password || !rol_id) {
      return res.status(400).json({ error: 'Nombre, email, contraseña y rol son obligatorios' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre_usuario, email, password_hash, rol_id, empleado_id, activo)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [nombre_usuario.trim(), email.trim().toLowerCase(), password_hash, rol_id, empleado_id || null]
    );

    res.status(201).json({ id: result.insertId, mensaje: 'Usuario creado' });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El nombre de usuario o email ya existe' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
}

async function actualizar(req, res) {
  try {
    const { nombre_usuario, email, rol_id, empleado_id } = req.body;
    if (!nombre_usuario || !email || !rol_id) {
      return res.status(400).json({ error: 'Nombre, email y rol son obligatorios' });
    }

    const [result] = await pool.query(
      `UPDATE usuarios
       SET nombre_usuario = ?, email = ?, rol_id = ?, empleado_id = ?
       WHERE id = ?`,
      [nombre_usuario.trim(), email.trim().toLowerCase(), rol_id, empleado_id || null, req.params.id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El nombre de usuario o email ya existe' });
    }
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
}

async function cambiarEstado(req, res) {
  try {
    const id = Number(req.params.id);
    const { activo } = req.body;
    if (typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El estado activo es obligatorio' });
    }
    if (id === Number(req.usuario.id) && !activo) {
      return res.status(400).json({ error: 'No podés desactivar tu propio usuario' });
    }

    const [result] = await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: activo ? 'Usuario activado' : 'Usuario desactivado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar el estado del usuario' });
  }
}

async function cambiarPassword(req, res) {
  try {
    const { password } = req.body;
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'UPDATE usuarios SET password_hash = ? WHERE id = ?',
      [password_hash, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ mensaje: 'Contraseña actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
}

module.exports = { listar, opciones, crear, actualizar, cambiarEstado, cambiarPassword };
