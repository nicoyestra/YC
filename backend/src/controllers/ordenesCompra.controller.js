const pool = require('../config/db');

// Genera un número correlativo tipo OC-000123 (busca el último y suma 1)
async function generarNumero(conexion) {
  const [rows] = await conexion.query(
    "SELECT numero FROM ordenes_compra WHERE numero LIKE 'OC-%' ORDER BY id DESC LIMIT 1 FOR UPDATE"
  );
  let siguiente = 1;
  if (rows[0]) {
    const ultimo = parseInt(rows[0].numero.replace('OC-', ''), 10);
    if (!Number.isNaN(ultimo)) siguiente = ultimo + 1;
  }
  return `OC-${String(siguiente).padStart(6, '0')}`;
}

async function listar(req, res) {
  try {
    const { numero, proveedor_id, estado, desde, hasta } = req.query;
    let sql = `SELECT oc.*, p.nombre AS proveedor_nombre, a.nombre AS almacen_nombre
       FROM ordenes_compra oc
       JOIN proveedores p ON oc.proveedor_id = p.id
       JOIN almacenes a ON oc.almacen_id = a.id
       WHERE 1=1`;
    const params = [];

    if (numero) { sql += ' AND oc.numero LIKE ?'; params.push(`%${numero}%`); }
    if (proveedor_id) { sql += ' AND oc.proveedor_id = ?'; params.push(proveedor_id); }
    if (estado) { sql += ' AND oc.estado = ?'; params.push(estado); }
    if (desde) { sql += ' AND oc.fecha >= ?'; params.push(desde); }
    if (hasta) { sql += ' AND oc.fecha <= ?'; params.push(hasta); }

    sql += ' ORDER BY oc.fecha DESC, oc.id DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar órdenes de compra' });
  }
}

async function obtener(req, res) {
  try {
    const [ordenRows] = await pool.query('SELECT * FROM ordenes_compra WHERE id = ?', [req.params.id]);
    if (!ordenRows[0]) return res.status(404).json({ error: 'Orden no encontrada' });

    const [detalle] = await pool.query(
      `SELECT d.*, p.nombre AS producto_nombre, p.sku
       FROM detalle_ordenes_compra d JOIN productos p ON d.producto_id = p.id
       WHERE d.orden_compra_id = ?`,
      [req.params.id]
    );

    res.json({ ...ordenRows[0], detalle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener orden de compra' });
  }
}

// Crea la orden con numeración automática y su detalle (items) en una transacción
async function crear(req, res) {
  const conexion = await pool.getConnection();
  try {
    const { proveedor_id, almacen_id, fecha, observaciones, items } = req.body;
    if (!proveedor_id || !almacen_id || !fecha || !Array.isArray(items) || items.length === 0) {
      conexion.release();
      return res.status(400).json({ error: 'Faltan datos obligatorios o la orden no tiene items' });
    }

    await conexion.beginTransaction();

    const numero = await generarNumero(conexion);
    const total = items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);

    const [ordenResult] = await conexion.query(
      `INSERT INTO ordenes_compra (numero, proveedor_id, almacen_id, fecha, observaciones, total, usuario_id, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'borrador')`,
      [numero, proveedor_id, almacen_id, fecha, observaciones || null, total, req.usuario.id]
    );

    const ordenId = ordenResult.insertId;

    for (const item of items) {
      const subtotal = item.cantidad * item.precio_unitario;
      await conexion.query(
        `INSERT INTO detalle_ordenes_compra (orden_compra_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [ordenId, item.producto_id, item.cantidad, item.precio_unitario, subtotal]
      );
    }

    await conexion.commit();
    res.status(201).json({ id: ordenId, numero, total });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al crear orden de compra' });
  } finally {
    conexion.release();
  }
}

async function actualizarObservaciones(req, res) {
  try {
    const { observaciones } = req.body;
    const [result] = await pool.query('UPDATE ordenes_compra SET observaciones = ? WHERE id = ?', [observaciones || null, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json({ mensaje: 'Observaciones actualizadas' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar observaciones' });
  }
}

// Recepción parcial o total: recibe { items: [{ detalle_id, cantidad_recibida }], observaciones }
// Solo suma a stock la diferencia respecto de lo ya recibido antes. Si todos los ítems quedan
// completos, la orden pasa a "recibida"; si falta algo, queda en "parcial".
async function recibir(req, res) {
  const conexion = await pool.getConnection();
  try {
    const ordenId = req.params.id;
    const { items, observaciones } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      conexion.release();
      return res.status(400).json({ error: 'Debés indicar qué ítems y cantidades estás recibiendo' });
    }

    await conexion.beginTransaction();

    const [ordenRows] = await conexion.query('SELECT * FROM ordenes_compra WHERE id = ? FOR UPDATE', [ordenId]);
    const orden = ordenRows[0];
    if (!orden) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    if (orden.estado === 'recibida' || orden.estado === 'cancelada') {
      await conexion.rollback();
      return res.status(400).json({ error: `La orden ya está en estado "${orden.estado}"` });
    }

    const [detalleActual] = await conexion.query('SELECT * FROM detalle_ordenes_compra WHERE orden_compra_id = ?', [ordenId]);

    for (const item of items) {
      const linea = detalleActual.find((d) => d.id === item.detalle_id);
      if (!linea) continue;

      const cantidadNueva = Math.max(0, Math.min(item.cantidad_recibida, linea.cantidad));
      const diferencia = cantidadNueva - linea.cantidad_recibida;
      if (diferencia === 0) continue;

      // Actualiza stock con la diferencia (puede ser positiva)
      const [stockActual] = await conexion.query(
        'SELECT id, cantidad FROM stock WHERE producto_id = ? AND almacen_id = ? FOR UPDATE',
        [linea.producto_id, orden.almacen_id]
      );

      if (stockActual.length === 0) {
        await conexion.query(
          'INSERT INTO stock (producto_id, almacen_id, cantidad) VALUES (?, ?, ?)',
          [linea.producto_id, orden.almacen_id, diferencia]
        );
      } else {
        await conexion.query('UPDATE stock SET cantidad = cantidad + ? WHERE id = ?', [diferencia, stockActual[0].id]);
      }

      await conexion.query('UPDATE detalle_ordenes_compra SET cantidad_recibida = ? WHERE id = ?', [cantidadNueva, linea.id]);

      await conexion.query(
        `INSERT INTO movimientos_inventario (producto_id, almacen_id, tipo, cantidad, motivo, referencia_tipo, referencia_id, usuario_id)
         VALUES (?, ?, 'entrada', ?, 'Recepción de orden de compra', 'compra', ?, ?)`,
        [linea.producto_id, orden.almacen_id, diferencia, ordenId, req.usuario.id]
      );
    }

    const [detalleFinal] = await conexion.query('SELECT * FROM detalle_ordenes_compra WHERE orden_compra_id = ?', [ordenId]);
    const completa = detalleFinal.every((d) => d.cantidad_recibida >= d.cantidad);
    const algoRecibido = detalleFinal.some((d) => d.cantidad_recibida > 0);
    const nuevoEstado = completa ? 'recibida' : algoRecibido ? 'parcial' : orden.estado;

    await conexion.query(
      'UPDATE ordenes_compra SET estado = ?, fecha_recepcion = CURDATE(), observaciones = COALESCE(?, observaciones) WHERE id = ?',
      [nuevoEstado, observaciones || null, ordenId]
    );

    await conexion.commit();
    res.json({ mensaje: 'Recepción registrada', estado: nuevoEstado });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al recibir la orden de compra' });
  } finally {
    conexion.release();
  }
}

module.exports = { listar, obtener, crear, actualizarObservaciones, recibir };
