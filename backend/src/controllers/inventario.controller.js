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
    if (!['entrada', 'salida', 'ajuste', 'merma'].includes(tipo)) {
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

// Lista el inventario marcado como no utilizable (dañado, con fallas, vencido, etc.)
async function listarDanado(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT sd.*, p.sku, p.nombre AS producto_nombre, a.nombre AS almacen_nombre
       FROM stock_danado sd
       JOIN productos p ON sd.producto_id = p.id
       JOIN almacenes a ON sd.almacen_id = a.id
       WHERE sd.cantidad > 0
       ORDER BY p.nombre`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar el inventario no utilizable' });
  }
}

// Mueve cantidad de stock utilizable hacia el inventario "no utilizable" (dañado/con
// fallas). Descuenta del stock normal y lo suma a stock_danado, dejando registro
// del motivo en el historial de movimientos.
async function moverADanado(req, res) {
  const conexion = await pool.getConnection();
  try {
    const { producto_id, almacen_id, cantidad, motivo } = req.body;
    if (!producto_id || !almacen_id || !cantidad || !motivo) {
      conexion.release();
      return res.status(400).json({ error: 'producto_id, almacen_id, cantidad y motivo son obligatorios' });
    }

    await conexion.beginTransaction();

    const [stockActual] = await conexion.query(
      'SELECT id, cantidad FROM stock WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
      [producto_id, almacen_id]
    );
    const disponible = stockActual[0]?.cantidad || 0;
    if (disponible < cantidad) {
      await conexion.rollback();
      return res.status(400).json({ error: 'No hay suficiente stock utilizable para pasar esa cantidad' });
    }

    await conexion.query('UPDATE stock SET cantidad = cantidad - ? WHERE id = ?', [cantidad, stockActual[0].id]);

    const [danadoActual] = await conexion.query(
      'SELECT id, cantidad FROM stock_danado WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
      [producto_id, almacen_id]
    );
    if (danadoActual.length === 0) {
      await conexion.query(
        'INSERT INTO stock_danado (producto_id, almacen_id, cantidad) VALUES (?, ?, ?)',
        [producto_id, almacen_id, cantidad]
      );
    } else {
      await conexion.query('UPDATE stock_danado SET cantidad = cantidad + ? WHERE id = ?', [cantidad, danadoActual[0].id]);
    }

    await conexion.query(
      `INSERT INTO movimientos_inventario (producto_id, almacen_id, tipo, cantidad, motivo, referencia_tipo, usuario_id)
       VALUES (?, ?, 'merma', ?, ?, 'stock_danado', ?)`,
      [producto_id, almacen_id, cantidad, motivo, req.usuario.id]
    );

    await conexion.commit();
    res.status(201).json({ mensaje: 'Movido a inventario no utilizable' });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al mover el stock a no utilizable' });
  } finally {
    conexion.release();
  }
}

module.exports = { registrarMovimiento, historial, listarAlmacenes, listarDanado, moverADanado };
