const pool = require('../config/db');

async function listar(req, res) {
  try {
    const { buscar } = req.query;
    let sql = 'SELECT * FROM proveedores WHERE 1=1';
    const params = [];

    if (buscar) {
      sql += ' AND (nombre LIKE ? OR cuit LIKE ? OR email LIKE ?)';
      const like = `%${buscar}%`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY nombre';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar proveedores' });
  }
}

async function crear(req, res) {
  try {
    const { nombre, cuit, email, telefono, direccion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const [result] = await pool.query(
      'INSERT INTO proveedores (nombre, cuit, email, telefono, direccion) VALUES (?, ?, ?, ?, ?)',
      [nombre, cuit || null, email || null, telefono || null, direccion || null]
    );
    res.status(201).json({ id: result.insertId, nombre });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
}

async function actualizar(req, res) {
  try {
    const { nombre, cuit, email, telefono, direccion, activo } = req.body;
    const [result] = await pool.query(
      'UPDATE proveedores SET nombre=?, cuit=?, email=?, telefono=?, direccion=?, activo=? WHERE id=?',
      [nombre, cuit, email, telefono, direccion, activo, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ mensaje: 'Proveedor actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
}

async function eliminar(req, res) {
  try {
    const [result] = await pool.query('UPDATE proveedores SET activo = FALSE WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json({ mensaje: 'Proveedor desactivado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
}

module.exports = { listar, crear, actualizar, eliminar };
