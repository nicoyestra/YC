const IVA = 0.21; // mismo criterio que facturas.controller.js


async function generarNumero(conexion, prefijo, tabla) {
  const [rows] = await conexion.query(
    `SELECT numero
     FROM ${tabla}
     WHERE numero LIKE '${prefijo}-%'
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`
  );

  let siguiente = 1;

  if (rows[0]) {
    const ultimo = parseInt(
      rows[0].numero.replace(`${prefijo}-`, ''),
      10
    );

    if (!Number.isNaN(ultimo)) {
      siguiente = ultimo + 1;
    }
  }

  return `${prefijo}-${String(siguiente).padStart(6, '0')}`;
}


async function listar(req, res) {
  try {
    const db = req.db;

    const {
      cliente_id,
      desde,
      hasta
    } = req.query;

    let sql = `
      SELECT
        d.*,
        c.nombre AS cliente_nombre,
        ov.numero AS orden_venta_numero,
        nc.numero AS numero_nota_credito,
        nc.total AS total_nota_credito
      FROM devoluciones d
      JOIN clientes c
        ON d.cliente_id = c.id
      LEFT JOIN ordenes_venta ov
        ON d.orden_venta_id = ov.id
      LEFT JOIN notas_credito nc
        ON nc.devolucion_id = d.id
      WHERE 1=1
    `;

    const params = [];

    if (cliente_id) {
      sql += ' AND d.cliente_id = ?';
      params.push(cliente_id);
    }

    if (desde) {
      sql += ' AND d.fecha >= ?';
      params.push(desde);
    }

    if (hasta) {
      sql += ' AND d.fecha <= ?';
      params.push(hasta);
    }

    sql += ' ORDER BY d.fecha DESC, d.id DESC';

    const [rows] = await db.query(
      sql,
      params
    );

    res.json(rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al listar devoluciones'
    });
  }
}


async function obtener(req, res) {
  try {
    const db = req.db;

    const [rows] = await db.query(
      'SELECT * FROM devoluciones WHERE id = ?',
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: 'Devolución no encontrada'
      });
    }

    const [detalle] = await db.query(
      `SELECT
         dd.*,
         p.nombre AS producto_nombre,
         p.sku
       FROM detalle_devoluciones dd
       JOIN productos p
         ON dd.producto_id = p.id
       WHERE dd.devolucion_id = ?`,
      [req.params.id]
    );

    res.json({
      ...rows[0],
      detalle
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al obtener devolución'
    });
  }
}


// Crea la devolución, repone stock y,
// si corresponde, genera nota de crédito.
async function crear(req, res) {
  const db = req.db;
  const conexion = await db.getConnection();

  try {
    const {
      cliente_id,
      orden_venta_id,
      almacen_id,
      motivo,
      fecha,
      items
    } = req.body;

    if (
      !cliente_id ||
      !almacen_id ||
      !motivo ||
      !fecha ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error:
          'Faltan datos obligatorios (cliente, almacén, motivo, fecha o ítems)'
      });
    }

    await conexion.beginTransaction();

    const numero = await generarNumero(
      conexion,
      'ND',
      'devoluciones'
    );

    const subtotal = items.reduce(
      (acc, it) =>
        acc +
        Number(it.cantidad) *
          Number(it.precio_unitario),
      0
    );

    const [devResult] = await conexion.query(
      `INSERT INTO devoluciones
       (
         numero,
         cliente_id,
         orden_venta_id,
         almacen_id,
         motivo,
         fecha,
         subtotal,
         usuario_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero,
        cliente_id,
        orden_venta_id || null,
        almacen_id,
        motivo,
        fecha,
        subtotal,
        req.usuario.id
      ]
    );

    const devolucionId = devResult.insertId;

    for (const item of items) {
      const cantidad = Number(item.cantidad);
      const precioUnitario = Number(item.precio_unitario);
      const itemSubtotal = cantidad * precioUnitario;

      await conexion.query(
        `INSERT INTO detalle_devoluciones
         (
           devolucion_id,
           producto_id,
           cantidad,
           precio_unitario,
           subtotal
         )
         VALUES (?, ?, ?, ?, ?)`,
        [
          devolucionId,
          item.producto_id,
          cantidad,
          precioUnitario,
          itemSubtotal
        ]
      );

      // Repone stock utilizable
      const [stockActual] = await conexion.query(
        `SELECT
           id,
           cantidad
         FROM stock
         WHERE producto_id = ?
           AND almacen_id = ?
         FOR UPDATE`,
        [
          item.producto_id,
          almacen_id
        ]
      );

      if (stockActual.length === 0) {
        await conexion.query(
          `INSERT INTO stock
           (
             producto_id,
             almacen_id,
             cantidad
           )
           VALUES (?, ?, ?)`,
          [
            item.producto_id,
            almacen_id,
            cantidad
          ]
        );
      } else {
        await conexion.query(
          `UPDATE stock
           SET cantidad = cantidad + ?
           WHERE id = ?`,
          [
            cantidad,
            stockActual[0].id
          ]
        );
      }

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
         VALUES (
           ?,
           ?,
           'entrada',
           ?,
           ?,
           'devolucion',
           ?,
           ?
         )`,
        [
          item.producto_id,
          almacen_id,
          cantidad,
          `Devolución de cliente: ${motivo}`,
          devolucionId,
          req.usuario.id
        ]
      );
    }

    let notaCredito = null;

    if (orden_venta_id) {
      const [facturaRows] = await conexion.query(
        `SELECT *
         FROM facturas
         WHERE orden_venta_id = ?
           AND estado != 'anulada'
         LIMIT 1`,
        [orden_venta_id]
      );

      if (facturaRows[0]) {
        const numeroNC = await generarNumero(
          conexion,
          'NC',
          'notas_credito'
        );

        const impuestos = Number(
          (subtotal * IVA).toFixed(2)
        );

        const total = Number(
          (subtotal + impuestos).toFixed(2)
        );

        const [ncResult] = await conexion.query(
          `INSERT INTO notas_credito
           (
             numero,
             factura_id,
             devolucion_id,
             cliente_id,
             fecha_emision,
             subtotal,
             impuestos,
             total
           )
           VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)`,
          [
            numeroNC,
            facturaRows[0].id,
            devolucionId,
            cliente_id,
            subtotal,
            impuestos,
            total
          ]
        );

        await conexion.query(
          `UPDATE devoluciones
           SET nota_credito_generada = TRUE
           WHERE id = ?`,
          [devolucionId]
        );

        notaCredito = {
          id: ncResult.insertId,
          numero: numeroNC,
          total
        };
      }
    }

    await conexion.commit();

    res.status(201).json({
      id: devolucionId,
      numero,
      subtotal,
      notaCredito
    });

  } catch (err) {
    try {
      await conexion.rollback();
    } catch (_) {}

    console.error(err);

    res.status(500).json({
      error: 'Error al registrar la devolución'
    });

  } finally {
    conexion.release();
  }
}


module.exports = {
  listar,
  obtener,
  crear
};