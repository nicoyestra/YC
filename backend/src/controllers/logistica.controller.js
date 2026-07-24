const pool = require('../config/db');

async function listar(req, res) {
  try {
    const { estado, tipo, desde, hasta } = req.query;
    let sql = `SELECT l.*, c.nombre AS cliente_nombre, ov.numero AS orden_venta_numero
       FROM logistica l
       JOIN clientes c ON l.cliente_id = c.id
       LEFT JOIN ordenes_venta ov ON l.orden_venta_id = ov.id
       WHERE 1=1`;
    const params = [];

    if (estado) { sql += ' AND l.estado = ?'; params.push(estado); }
    if (tipo) { sql += ' AND l.tipo = ?'; params.push(tipo); }
    if (desde) { sql += ' AND l.fecha >= ?'; params.push(desde); }
    if (hasta) { sql += ' AND l.fecha <= ?'; params.push(hasta); }

    sql += ' ORDER BY l.fecha DESC, l.id DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar la logística' });
  }
}

async function crear(req, res) {
  try {
    const { tipo, cliente_id, orden_venta_id, direccion, codigo_postal, fecha, notas } = req.body;
    if (!tipo || !cliente_id || !fecha) {
      return res.status(400).json({ error: 'tipo, cliente_id y fecha son obligatorios' });
    }

    const [result] = await pool.query(
      `INSERT INTO logistica (tipo, cliente_id, orden_venta_id, direccion, codigo_postal, fecha, notas, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tipo, cliente_id, orden_venta_id || null, direccion || null, codigo_postal || null, fecha, notas || null, req.usuario.id]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el registro de logística' });
  }
}

async function actualizarEstado(req, res) {
  try {
    const { estado } = req.body;
    const [result] = await pool.query('UPDATE logistica SET estado = ? WHERE id = ?', [estado, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json({ mensaje: 'Estado actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
}

module.exports = { listar, crear, actualizarEstado };
