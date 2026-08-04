const pool = require('../config/db');

// Genera un número correlativo tipo OV-000123 (busca el último y suma 1)
async function generarNumero(conexion) {
  const [rows] = await conexion.query(
    "SELECT numero FROM ordenes_venta WHERE numero LIKE 'OV-%' ORDER BY id DESC LIMIT 1 FOR UPDATE"
  );
  let siguiente = 1;
  if (rows[0]) {
    const ultimo = parseInt(rows[0].numero.replace('OV-', ''), 10);
    if (!Number.isNaN(ultimo)) siguiente = ultimo + 1;
  }
  return `OV-${String(siguiente).padStart(6, '0')}`;
}

async function listar(req, res) {
  try {
    const { estado, cliente_id, desde, hasta } = req.query;
    let sql = `SELECT ov.*, c.nombre AS cliente_nombre, c.es_externo, a.nombre AS almacen_nombre
       FROM ordenes_venta ov
       JOIN clientes c ON ov.cliente_id = c.id
       JOIN almacenes a ON ov.almacen_id = a.id
       WHERE 1=1`;
    const params = [];

    if (estado) { sql += ' AND ov.estado = ?'; params.push(estado); }
    if (cliente_id) { sql += ' AND ov.cliente_id = ?'; params.push(cliente_id); }
    if (desde) { sql += ' AND ov.fecha >= ?'; params.push(desde); }
    if (hasta) { sql += ' AND ov.fecha <= ?'; params.push(hasta); }

    sql += ' ORDER BY ov.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar órdenes de venta' });
  }
}

async function obtener(req, res) {
  try {
    const [ordenRows] = await pool.query('SELECT * FROM ordenes_venta WHERE id = ?', [req.params.id]);
    if (!ordenRows[0]) return res.status(404).json({ error: 'Orden no encontrada' });

    const [detalle] = await pool.query(
      `SELECT d.*, p.nombre AS producto_nombre, p.sku
       FROM detalle_ordenes_venta d JOIN productos p ON d.producto_id = p.id
       WHERE d.orden_venta_id = ?`,
      [req.params.id]
    );

    res.json({ ...ordenRows[0], detalle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener orden de venta' });
  }
}

// Crea la orden en estado "pendiente": NO descuenta stock todavía. Cualquier
// usuario/sector con permiso puede retomarla más tarde y confirmarla.
async function crear(req, res) {
  const conexion = await pool.getConnection();
  try {
    const { cliente_id, almacen_id, fecha, items } = req.body;
    if (!cliente_id || !almacen_id || !fecha || !Array.isArray(items) || items.length === 0) {
      conexion.release();
      return res.status(400).json({ error: 'Faltan datos obligatorios o la orden no tiene items' });
    }

    await conexion.beginTransaction();

    const numero = await generarNumero(conexion);
    const total = items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);

    const [ordenResult] = await conexion.query(
      `INSERT INTO ordenes_venta (numero, cliente_id, almacen_id, fecha, total, usuario_id, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
      [numero, cliente_id, almacen_id, fecha, total, req.usuario.id]
    );
    const ordenId = ordenResult.insertId;

    for (const item of items) {
      const subtotal = item.cantidad * item.precio_unitario;
      await conexion.query(
        `INSERT INTO detalle_ordenes_venta (orden_venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [ordenId, item.producto_id, item.cantidad, item.precio_unitario, subtotal]
      );
    }

    await conexion.commit();
    res.status(201).json({ id: ordenId, numero, total, estado: 'pendiente' });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una orden con ese número' });
    }
    res.status(500).json({ error: 'Error al crear orden de venta' });
  } finally {
    conexion.release();
  }
}

// Confirma una orden pendiente: valida y descuenta stock, deja la orden "confirmada".
// Pensado para que la cierre otro sector distinto de quien la cargó.
async function confirmar(req, res) {
  const conexion = await pool.getConnection();
  try {
    const ordenId = req.params.id;

    await conexion.beginTransaction();

    const [ordenRows] = await conexion.query('SELECT * FROM ordenes_venta WHERE id = ? FOR UPDATE', [ordenId]);
    const orden = ordenRows[0];
    if (!orden) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    if (orden.estado !== 'pendiente') {
      await conexion.rollback();
      return res.status(400).json({ error: `La orden ya está en estado "${orden.estado}"` });
    }

    const [items] = await conexion.query('SELECT * FROM detalle_ordenes_venta WHERE orden_venta_id = ?', [ordenId]);

    for (const item of items) {
      const [stockRows] = await conexion.query(
        'SELECT cantidad FROM stock WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
        [item.producto_id, orden.almacen_id]
      );
      const disponible = stockRows[0]?.cantidad || 0;
      if (disponible < item.cantidad) {
        await conexion.rollback();
        return res.status(400).json({ error: `Stock insuficiente para el producto ${item.producto_id}` });
      }
    }

    for (const item of items) {
      await conexion.query(
        'UPDATE stock SET cantidad = cantidad - ? WHERE producto_id = ? AND almacen_id = ?',
        [item.cantidad, item.producto_id, orden.almacen_id]
      );
      await conexion.query(
        `INSERT INTO movimientos_inventario (producto_id, almacen_id, tipo, cantidad, motivo, referencia_tipo, referencia_id, usuario_id)
         VALUES (?, ?, 'salida', ?, 'Venta confirmada', 'venta', ?, ?)`,
        [item.producto_id, orden.almacen_id, item.cantidad, ordenId, req.usuario.id]
      );
    }

    await conexion.query("UPDATE ordenes_venta SET estado = 'confirmada' WHERE id = ?", [ordenId]);

    await conexion.commit();
    res.json({ mensaje: 'Orden confirmada y stock descontado' });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al confirmar la orden de venta' });
  } finally {
    conexion.release();
  }
}


// Cancela una orden pendiente o confirmada.
// Si estaba confirmada, devuelve automáticamente el stock al almacén.
async function cancelar(req, res) {
  const conexion = await pool.getConnection();

  try {
    const ordenId = req.params.id;

    await conexion.beginTransaction();

    const [ordenRows] = await conexion.query(
      'SELECT * FROM ordenes_venta WHERE id = ? FOR UPDATE',
      [ordenId]
    );

    const orden = ordenRows[0];

    if (!orden) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    if (orden.estado === 'cancelada') {
      await conexion.rollback();
      return res.status(400).json({ error: 'La orden ya está cancelada' });
    }

    if (orden.estado === 'entregada') {
      await conexion.rollback();
      return res.status(400).json({
        error: 'Una orden entregada no puede cancelarse. Debe registrarse una devolución.'
      });
    }

    if (!['pendiente', 'confirmada'].includes(orden.estado)) {
      await conexion.rollback();
      return res.status(400).json({
        error: `No se puede cancelar una orden en estado "${orden.estado}"`
      });
    }

    // Si la orden estaba confirmada, el stock ya había sido descontado.
    // Por lo tanto, debe devolverse al inventario.
    if (orden.estado === 'confirmada') {
      const [items] = await conexion.query(
        'SELECT * FROM detalle_ordenes_venta WHERE orden_venta_id = ?',
        [ordenId]
      );

      for (const item of items) {
        await conexion.query(
          `INSERT INTO stock (producto_id, almacen_id, cantidad)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE cantidad = cantidad + VALUES(cantidad)`,
          [item.producto_id, orden.almacen_id, item.cantidad]
        );

        await conexion.query(
          `INSERT INTO movimientos_inventario
           (
             producto_id,
             almacen_id,
             tipo,
             cantidad,
             motivo,
             referencia_tipo,
             referencia_id,
             usuario_id
           )
           VALUES (?, ?, 'entrada', ?, ?, 'venta', ?, ?)`,
          [
            item.producto_id,
            orden.almacen_id,
            item.cantidad,
            `Cancelación de venta ${orden.numero}`,
            ordenId,
            req.usuario.id
          ]
        );
      }
    }

    await conexion.query(
      "UPDATE ordenes_venta SET estado = 'cancelada' WHERE id = ?",
      [ordenId]
    );

    await conexion.commit();

    res.json({
      mensaje:
        orden.estado === 'confirmada'
          ? 'Orden cancelada y stock devuelto correctamente'
          : 'Orden pendiente cancelada correctamente',
      estado: 'cancelada'
    });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al cancelar la orden de venta' });
  } finally {
    conexion.release();
  }
}


// Marca como entregada una orden previamente confirmada.
// No vuelve a modificar el stock porque ya fue descontado al confirmar.
async function entregar(req, res) {
  const conexion = await pool.getConnection();

  try {
    const ordenId = req.params.id;

    await conexion.beginTransaction();

    const [ordenRows] = await conexion.query(
      'SELECT * FROM ordenes_venta WHERE id = ? FOR UPDATE',
      [ordenId]
    );

    const orden = ordenRows[0];

    if (!orden) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    if (orden.estado !== 'confirmada') {
      await conexion.rollback();
      return res.status(400).json({
        error: `Solo se puede entregar una orden confirmada. Estado actual: "${orden.estado}"`
      });
    }

    await conexion.query(
      "UPDATE ordenes_venta SET estado = 'entregada' WHERE id = ?",
      [ordenId]
    );

    await conexion.commit();

    res.json({
      mensaje: 'Orden marcada como entregada',
      estado: 'entregada'
    });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al entregar la orden de venta' });
  } finally {
    conexion.release();
  }
}


module.exports = {
  listar,
  obtener,
  crear,
  confirmar,
  cancelar,
  entregar
};