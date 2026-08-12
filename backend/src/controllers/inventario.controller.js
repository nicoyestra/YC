const pool = require('../config/db');

const {
  asignarStockPendienteFIFO,
} = require('../services/abastecimiento.service');


// Registra un movimiento (entrada/salida/ajuste) y actualiza la tabla de stock
async function registrarMovimiento(req, res) {
  const conexion = await pool.getConnection();

  try {
    const {
      producto_id,
      almacen_id,
      tipo,
      cantidad,
      motivo,
      referencia_tipo,
      referencia_id
    } = req.body;

    if (!producto_id || !almacen_id || !tipo || !cantidad) {
      return res.status(400).json({
        error: 'producto_id, almacen_id, tipo y cantidad son obligatorios'
      });
    }

    if (!['entrada', 'salida', 'ajuste', 'merma'].includes(tipo)) {
      return res.status(400).json({
        error: 'Tipo inválido'
      });
    }

    await conexion.beginTransaction();

    const delta =
      tipo === 'salida'
        ? -Math.abs(Number(cantidad))
        : Math.abs(Number(cantidad));

    const [stockActual] = await conexion.query(
      `SELECT id, cantidad
       FROM stock
       WHERE producto_id = ? AND almacen_id = ?
       FOR UPDATE`,
      [producto_id, almacen_id]
    );

    if (stockActual.length === 0) {
      if (delta < 0) {
        await conexion.rollback();

        return res.status(400).json({
          error: 'No hay stock suficiente para esta salida'
        });
      }

      await conexion.query(
        `INSERT INTO stock
         (producto_id, almacen_id, cantidad)
         VALUES (?, ?, ?)`,
        [producto_id, almacen_id, delta]
      );
    } else {
      const nuevaCantidad =
        Number(stockActual[0].cantidad) + delta;

      if (nuevaCantidad < 0) {
        await conexion.rollback();

        return res.status(400).json({
          error: 'No hay stock suficiente para esta salida'
        });
      }

      await conexion.query(
        'UPDATE stock SET cantidad = ? WHERE id = ?',
        [nuevaCantidad, stockActual[0].id]
      );
    }

    const [result] = await conexion.query(
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        producto_id,
        almacen_id,
        tipo,
        cantidad,
        motivo || null,
        referencia_tipo || null,
        referencia_id || null,
        req.usuario.id
      ]
    );

    let resultadoAsignacion = {
      asignado: 0,
      pedidosAfectados: 0,
    };

    // Si entra mercadería, intenta abastecer automáticamente
    // los pedidos pendientes más antiguos.
    if (tipo === 'entrada') {
      resultadoAsignacion =
        await asignarStockPendienteFIFO(
          conexion,
          Number(producto_id),
          Number(almacen_id)
        );
    }

    await conexion.commit();

    res.status(201).json({
      id: result.insertId,
      mensaje:
        resultadoAsignacion.asignado > 0
          ? `Movimiento registrado. Se asignaron ${resultadoAsignacion.asignado} unidades a ${resultadoAsignacion.pedidosAfectados} pedido(s) pendiente(s).`
          : 'Movimiento registrado',
      asignacion: resultadoAsignacion,
    });

  } catch (err) {
    await conexion.rollback();
    console.error(err);

    res.status(500).json({
      error: 'Error al registrar movimiento'
    });
  } finally {
    conexion.release();
  }
}



async function transferirStock(req, res) {
  const conexion = await pool.getConnection();

  try {
    const {
      producto_id,
      almacen_origen_id,
      almacen_destino_id,
      cantidad,
      motivo
    } = req.body;

    const cantidadTransferir = Number(cantidad);

    if (
      !producto_id ||
      !almacen_origen_id ||
      !almacen_destino_id ||
      !cantidadTransferir
    ) {
      return res.status(400).json({
        error:
          'producto_id, almacen_origen_id, almacen_destino_id y cantidad son obligatorios'
      });
    }

    if (Number(almacen_origen_id) === Number(almacen_destino_id)) {
      return res.status(400).json({
        error: 'El almacén de origen y destino no pueden ser el mismo'
      });
    }

    if (cantidadTransferir <= 0) {
      return res.status(400).json({
        error: 'La cantidad debe ser mayor a cero'
      });
    }

    await conexion.beginTransaction();

    // Bloqueamos el stock del almacén origen.
    const [stockOrigenRows] = await conexion.query(
      `SELECT id, cantidad
       FROM stock
       WHERE producto_id = ?
         AND almacen_id = ?
       FOR UPDATE`,
      [producto_id, almacen_origen_id]
    );

    const stockOrigen = Number(
      stockOrigenRows[0]?.cantidad || 0
    );

    if (stockOrigen < cantidadTransferir) {
      await conexion.rollback();

      return res.status(400).json({
        error: `Stock insuficiente en el almacén origen. Disponible: ${stockOrigen}`
      });
    }

    // Descontamos del origen.
    await conexion.query(
      `UPDATE stock
       SET cantidad = cantidad - ?
       WHERE producto_id = ?
         AND almacen_id = ?`,
      [
        cantidadTransferir,
        producto_id,
        almacen_origen_id
      ]
    );

    // Sumamos al destino.
    await conexion.query(
      `INSERT INTO stock
       (
         producto_id,
         almacen_id,
         cantidad
       )
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cantidad = cantidad + VALUES(cantidad)`,
      [
        producto_id,
        almacen_destino_id,
        cantidadTransferir
      ]
    );

    const textoMotivo =
      motivo?.trim() ||
      'Transferencia entre almacenes';

    // Movimiento de salida del origen.
    await conexion.query(
      `INSERT INTO movimientos_inventario
       (
         producto_id,
         almacen_id,
         tipo,
         cantidad,
         motivo,
         referencia_tipo,
         usuario_id
       )
       VALUES (?, ?, 'salida', ?, ?, 'transferencia', ?)`,
      [
        producto_id,
        almacen_origen_id,
        cantidadTransferir,
        textoMotivo,
        req.usuario.id
      ]
    );

    // Movimiento de entrada al destino.
    await conexion.query(
      `INSERT INTO movimientos_inventario
       (
         producto_id,
         almacen_id,
         tipo,
         cantidad,
         motivo,
         referencia_tipo,
         usuario_id
       )
       VALUES (?, ?, 'entrada', ?, ?, 'transferencia', ?)`,
      [
        producto_id,
        almacen_destino_id,
        cantidadTransferir,
        textoMotivo,
        req.usuario.id
      ]
    );

    // Al llegar stock al destino, intenta completar
    // automáticamente las órdenes pendientes de ese almacén.
    const resultadoAsignacion =
      await asignarStockPendienteFIFO(
        conexion,
        Number(producto_id),
        Number(almacen_destino_id)
      );

    await conexion.commit();

    res.json({
      mensaje:
        resultadoAsignacion.asignado > 0
          ? `Transferencia realizada. Se asignaron ${resultadoAsignacion.asignado} unidades a ${resultadoAsignacion.pedidosAfectados} pedido(s) pendiente(s).`
          : 'Transferencia realizada correctamente',
      transferencia: {
        producto_id: Number(producto_id),
        almacen_origen_id: Number(almacen_origen_id),
        almacen_destino_id: Number(almacen_destino_id),
        cantidad: cantidadTransferir
      },
      asignacion: resultadoAsignacion
    });

  } catch (err) {
    await conexion.rollback();
    console.error(err);

    res.status(500).json({
      error: 'Error al transferir stock entre almacenes'
    });
  } finally {
    conexion.release();
  }
}

async function historial(req, res) {
  try {
    const { producto_id, almacen_id } = req.query;

    let sql = `
      SELECT
        m.*,
        p.nombre AS producto_nombre,
        a.nombre AS almacen_nombre
      FROM movimientos_inventario m
      JOIN productos p
        ON m.producto_id = p.id
      JOIN almacenes a
        ON m.almacen_id = a.id
      WHERE 1=1
    `;

    const params = [];

    if (producto_id) {
      sql += ' AND m.producto_id = ?';
      params.push(producto_id);
    }

    if (almacen_id) {
      sql += ' AND m.almacen_id = ?';
      params.push(almacen_id);
    }

    sql += ' ORDER BY m.created_at DESC LIMIT 200';

    const [rows] = await pool.query(sql, params);

    res.json(rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al obtener historial'
    });
  }
}


async function listarAlmacenes(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM almacenes ORDER BY nombre'
    );

    res.json(rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al listar almacenes'
    });
  }
}


// Lista el inventario marcado como no utilizable
async function listarDanado(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         sd.*,
         p.sku,
         p.nombre AS producto_nombre,
         a.nombre AS almacen_nombre
       FROM stock_danado sd
       JOIN productos p
         ON sd.producto_id = p.id
       JOIN almacenes a
         ON sd.almacen_id = a.id
       WHERE sd.cantidad > 0
       ORDER BY p.nombre`
    );

    res.json(rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al listar el inventario no utilizable'
    });
  }
}


// Mueve stock utilizable a stock dañado/no utilizable
async function moverADanado(req, res) {
  const conexion = await pool.getConnection();

  try {
    const {
      producto_id,
      almacen_id,
      cantidad,
      motivo
    } = req.body;

    if (
      !producto_id ||
      !almacen_id ||
      !cantidad ||
      !motivo
    ) {
      return res.status(400).json({
        error:
          'producto_id, almacen_id, cantidad y motivo son obligatorios'
      });
    }

    await conexion.beginTransaction();

    const [stockActual] = await conexion.query(
      `SELECT id, cantidad
       FROM stock
       WHERE producto_id = ? AND almacen_id = ?
       FOR UPDATE`,
      [producto_id, almacen_id]
    );

    const disponible =
      Number(stockActual[0]?.cantidad || 0);

    if (disponible < Number(cantidad)) {
      await conexion.rollback();

      return res.status(400).json({
        error:
          'No hay suficiente stock utilizable para pasar esa cantidad'
      });
    }

    await conexion.query(
      `UPDATE stock
       SET cantidad = cantidad - ?
       WHERE id = ?`,
      [cantidad, stockActual[0].id]
    );

    const [danadoActual] = await conexion.query(
      `SELECT id, cantidad
       FROM stock_danado
       WHERE producto_id = ? AND almacen_id = ?
       FOR UPDATE`,
      [producto_id, almacen_id]
    );

    if (danadoActual.length === 0) {
      await conexion.query(
        `INSERT INTO stock_danado
         (producto_id, almacen_id, cantidad)
         VALUES (?, ?, ?)`,
        [producto_id, almacen_id, cantidad]
      );
    } else {
      await conexion.query(
        `UPDATE stock_danado
         SET cantidad = cantidad + ?
         WHERE id = ?`,
        [cantidad, danadoActual[0].id]
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
         usuario_id
       )
       VALUES (?, ?, 'merma', ?, ?, 'stock_danado', ?)`,
      [
        producto_id,
        almacen_id,
        cantidad,
        motivo,
        req.usuario.id
      ]
    );

    await conexion.commit();

    res.status(201).json({
      mensaje: 'Movido a inventario no utilizable'
    });

  } catch (err) {
    await conexion.rollback();
    console.error(err);

    res.status(500).json({
      error: 'Error al mover el stock a no utilizable'
    });
  } finally {
    conexion.release();
  }
}

async function listarStockPorAlmacen(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         s.producto_id,
         s.almacen_id,
         a.nombre AS almacen_nombre,
         s.cantidad
       FROM stock s
       JOIN almacenes a
         ON a.id = s.almacen_id
       ORDER BY a.nombre`
    );

    res.json(rows);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al obtener stock por almacén'
    });
  }
}
async function disponibilidadVentas(req, res) {
  try {
    const {
      producto_id,
      almacen_id,
      orden_id
    } = req.query;

    if (!producto_id || !almacen_id) {
      return res.status(400).json({
        error: 'producto_id y almacen_id son obligatorios'
      });
    }

    const [stockRows] = await pool.query(
      `SELECT COALESCE(cantidad, 0) AS stock_fisico
       FROM stock
       WHERE producto_id = ?
         AND almacen_id = ?`,
      [producto_id, almacen_id]
    );

    const stockFisico = Number(
      stockRows[0]?.stock_fisico || 0
    );

    let sqlReservado = `
      SELECT
        COALESCE(SUM(d.cantidad_asignada), 0) AS reservado
      FROM detalle_ordenes_venta d
      JOIN ordenes_venta ov
        ON ov.id = d.orden_venta_id
      WHERE d.producto_id = ?
        AND ov.almacen_id = ?
        AND ov.estado = 'pendiente'
    `;

    const params = [
      producto_id,
      almacen_id
    ];

    // Al editar una orden, no contamos como reserva
    // las unidades de esa misma orden.
    if (orden_id) {
      sqlReservado += `
        AND ov.id <> ?
      `;

      params.push(orden_id);
    }

    const [reservadoRows] = await pool.query(
      sqlReservado,
      params
    );

    const reservado = Number(
      reservadoRows[0]?.reservado || 0
    );

    const disponible = Math.max(
      0,
      stockFisico - reservado
    );

    res.json({
      producto_id: Number(producto_id),
      almacen_id: Number(almacen_id),
      stock_fisico: stockFisico,
      reservado,
      disponible
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al calcular disponibilidad'
    });
  }
}

module.exports = {
  registrarMovimiento,
  transferirStock,
  historial,
  listarAlmacenes,
  listarStockPorAlmacen,
  listarDanado,
  moverADanado,
  disponibilidadVentas,
};