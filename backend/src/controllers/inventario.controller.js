const pool = require('../config/db');

// Registra un movimiento (entrada/salida/ajuste) y actualiza la tabla de stock
async function registrarMovimiento(req, res) {
  const conexion = await pool.getConnection();
  try {
    const { producto_id, almacen_id, tipo, cantidad, motivo, referencia_tipo, referencia_id } = req.body;

    if (!producto_id || !almacen_id || !tipo || !cantidad) {
      conexion.release();
      return res.status(400).json({ error: 'producto_id, almacen_id, tipo y cantidad son obligatorios' });
    }
    if (!['entrada', 'salida', 'ajuste'].includes(tipo)) {
      conexion.release();
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    await conexion.beginTransaction();

    const delta = tipo === 'salida' ? -Math.abs(cantidad) : Math.abs(cantidad);

    // Verifica stock existente en ese almacén, si no existe lo crea en 0
    const [stockActual] = await conexion.query(
      'SELECT id, cantidad FROM stock WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
      [producto_id, almacen_id]
    );

    if (stockActual.length === 0) {
      if (delta < 0) {
        await conexion.rollback();
        conexion.release();
        return res.status(400).json({ error: 'No hay stock suficiente para esta salida' });
      }
      await conexion.query(
        'INSERT INTO stock (producto_id, almacen_id, cantidad) VALUES (?, ?, ?)',
        [producto_id, almacen_id, delta]
      );
    } else {
      const nuevaCantidad = stockActual[0].cantidad + delta;
      if (nuevaCantidad < 0) {
        await conexion.rollback();
        conexion.release();
        return res.status(400).json({ error: 'No hay stock suficiente para esta salida' });
      }
      await conexion.query('UPDATE stock SET cantidad = ? WHERE id = ?', [nuevaCantidad, stockActual[0].id]);
    }

    const [result] = await conexion.query(
      `INSERT INTO movimientos_inventario
        (producto_id, almacen_id, tipo, cantidad, motivo, referencia_tipo, referencia_id, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [producto_id, almacen_id, tipo, cantidad, motivo || null, referencia_tipo || null, referencia_id || null, req.usuario.id]
    );

    await conexion.commit();
    res.status(201).json({ id: result.insertId, mensaje: 'Movimiento registrado' });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al registrar movimiento' });
  } finally {
    conexion.release();
  }
}

async function historial(req, res) {
  try {
    const { producto_id, almacen_id } = req.query;
    let sql = `SELECT m.*, p.nombre AS producto_nombre, a.nombre AS almacen_nombre
               FROM movimientos_inventario m
               JOIN productos p ON m.producto_id = p.id
               JOIN almacenes a ON m.almacen_id = a.id
               WHERE 1=1`;
    const params = [];

    if (producto_id) { sql += ' AND m.producto_id = ?'; params.push(producto_id); }
    if (almacen_id) { sql += ' AND m.almacen_id = ?'; params.push(almacen_id); }

    sql += ' ORDER BY m.created_at DESC LIMIT 200';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
}

async function listarAlmacenes(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM almacenes ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar almacenes' });
  }
}

module.exports = { registrarMovimiento, historial, listarAlmacenes };
