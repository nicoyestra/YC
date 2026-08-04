const pool = require('../config/db');

const ESTADOS = ['borrador', 'enviado', 'aceptado', 'rechazado', 'vencido'];

function numero(valor, minimo = 0) {
  const resultado = Number(valor);
  return Number.isFinite(resultado) && resultado >= minimo ? resultado : null;
}

function redondear(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

async function generarNumero(conexion) {
  const [rows] = await conexion.query(
    "SELECT numero FROM presupuestos WHERE numero LIKE 'PRES-%' ORDER BY id DESC LIMIT 1 FOR UPDATE"
  );

  let siguiente = 1;
  if (rows[0]) {
    const ultimo = parseInt(String(rows[0].numero).replace('PRES-', ''), 10);
    if (!Number.isNaN(ultimo)) siguiente = ultimo + 1;
  }

  return `PRES-${String(siguiente).padStart(6, '0')}`;
}

function calcularItems(items) {
  let subtotal = 0;
  let descuentoTotal = 0;
  let impuestos = 0;
  let total = 0;

  const detalle = items.map((item, indice) => {
    const productoId = numero(item.producto_id, 1);
    const cantidad = numero(item.cantidad, 0.001);
    const precioUnitario = numero(item.precio_unitario, 0);
    const descuentoPorcentaje = numero(item.descuento_porcentaje ?? 0, 0);
    const ivaPorcentaje = numero(item.iva_porcentaje ?? 21, 0);

    if (!productoId || cantidad === null || precioUnitario === null) {
      const error = new Error(`Revisá el producto, cantidad y precio del ítem ${indice + 1}`);
      error.status = 400;
      throw error;
    }
    if (descuentoPorcentaje === null || descuentoPorcentaje > 100) {
      const error = new Error(`El descuento del ítem ${indice + 1} debe estar entre 0 y 100`);
      error.status = 400;
      throw error;
    }
    if (ivaPorcentaje === null || ivaPorcentaje > 100) {
      const error = new Error(`El IVA del ítem ${indice + 1} no es válido`);
      error.status = 400;
      throw error;
    }

    const subtotalBruto = redondear(cantidad * precioUnitario);
    const descuentoImporte = redondear(subtotalBruto * descuentoPorcentaje / 100);
    const subtotalNeto = redondear(subtotalBruto - descuentoImporte);
    const impuestoItem = redondear(subtotalNeto * ivaPorcentaje / 100);
    const totalItem = redondear(subtotalNeto + impuestoItem);

    subtotal += subtotalBruto;
    descuentoTotal += descuentoImporte;
    impuestos += impuestoItem;
    total += totalItem;

    return {
      producto_id: productoId,
      cantidad,
      precio_unitario: precioUnitario,
      descuento_porcentaje: descuentoPorcentaje,
      iva_porcentaje: ivaPorcentaje,
      subtotal_bruto: subtotalBruto,
      descuento_importe: descuentoImporte,
      subtotal_neto: subtotalNeto,
      impuestos: impuestoItem,
      total: totalItem,
    };
  });

  return {
    detalle,
    subtotal: redondear(subtotal),
    descuento_total: redondear(descuentoTotal),
    impuestos: redondear(impuestos),
    total: redondear(total),
  };
}

async function listar(req, res) {
  try {
    const { estado, cliente_id, desde, hasta, buscar } = req.query;
    let sql = `SELECT p.*, c.nombre AS cliente_nombre, c.cuit_dni,
        u.nombre_usuario AS usuario_nombre
      FROM presupuestos p
      JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN usuarios u ON u.id = p.usuario_id
      WHERE 1=1`;
    const params = [];

    if (estado) {
      sql += ' AND p.estado = ?';
      params.push(estado);
    }
    if (cliente_id) {
      sql += ' AND p.cliente_id = ?';
      params.push(cliente_id);
    }
    if (desde) {
      sql += ' AND p.fecha >= ?';
      params.push(desde);
    }
    if (hasta) {
      sql += ' AND p.fecha <= ?';
      params.push(hasta);
    }
    if (buscar) {
      sql += ' AND (p.numero LIKE ? OR c.nombre LIKE ? OR c.cuit_dni LIKE ?)';
      const like = `%${buscar}%`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY p.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error al listar presupuestos:', err);
    res.status(500).json({ error: 'Error al listar presupuestos' });
  }
}

async function obtener(req, res) {
  try {
    const [presupuestos] = await pool.query(
      `SELECT p.*, c.nombre AS cliente_nombre, c.cuit_dni, c.email,
          c.telefono, c.direccion, c.codigo_postal
       FROM presupuestos p
       JOIN clientes c ON c.id = p.cliente_id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (!presupuestos[0]) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }

    const [detalle] = await pool.query(
      `SELECT d.*, pr.sku, pr.codigo_barras, pr.nombre AS producto_nombre,
          pr.descripcion
       FROM detalle_presupuestos d
       JOIN productos pr ON pr.id = d.producto_id
       WHERE d.presupuesto_id = ?
       ORDER BY d.id`,
      [req.params.id]
    );

    res.json({ ...presupuestos[0], detalle });
  } catch (err) {
    console.error('Error al obtener presupuesto:', err);
    res.status(500).json({ error: 'Error al obtener el presupuesto' });
  }
}

async function crear(req, res) {
  const conexion = await pool.getConnection();
  try {
    const { cliente_id, fecha, valido_hasta, observaciones, items } = req.body;

    if (!cliente_id || !fecha || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Cliente, fecha y al menos un ítem son obligatorios',
      });
    }

    if (valido_hasta && valido_hasta < fecha) {
      return res.status(400).json({
        error: 'La fecha de validez no puede ser anterior a la fecha del presupuesto',
      });
    }

    const calculos = calcularItems(items);

    await conexion.beginTransaction();
    const numeroPresupuesto = await generarNumero(conexion);

    const [resultado] = await conexion.query(
      `INSERT INTO presupuestos
        (numero, cliente_id, fecha, valido_hasta, estado, observaciones,
         subtotal, descuento_total, impuestos, total, usuario_id)
       VALUES (?, ?, ?, ?, 'borrador', ?, ?, ?, ?, ?, ?)`,
      [
        numeroPresupuesto,
        Number(cliente_id),
        fecha,
        valido_hasta || null,
        observaciones?.trim() || null,
        calculos.subtotal,
        calculos.descuento_total,
        calculos.impuestos,
        calculos.total,
        req.usuario.id,
      ]
    );

    for (const item of calculos.detalle) {
      await conexion.query(
        `INSERT INTO detalle_presupuestos
          (presupuesto_id, producto_id, cantidad, precio_unitario,
           descuento_porcentaje, iva_porcentaje, subtotal_bruto,
           descuento_importe, subtotal_neto, impuestos, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resultado.insertId,
          item.producto_id,
          item.cantidad,
          item.precio_unitario,
          item.descuento_porcentaje,
          item.iva_porcentaje,
          item.subtotal_bruto,
          item.descuento_importe,
          item.subtotal_neto,
          item.impuestos,
          item.total,
        ]
      );
    }

    await conexion.commit();
    res.status(201).json({
      id: resultado.insertId,
      numero: numeroPresupuesto,
      estado: 'borrador',
      ...calculos,
    });
  } catch (err) {
    await conexion.rollback();
    console.error('Error al crear presupuesto:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Error al crear el presupuesto',
    });
  } finally {
    conexion.release();
  }
}

async function actualizar(req, res) {
  const conexion = await pool.getConnection();
  try {
    const presupuestoId = Number(req.params.id);
    const { cliente_id, fecha, valido_hasta, observaciones, items } = req.body;

    if (!cliente_id || !fecha || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Cliente, fecha y al menos un ítem son obligatorios',
      });
    }

    if (valido_hasta && valido_hasta < fecha) {
      return res.status(400).json({
        error: 'La fecha de validez no puede ser anterior a la fecha del presupuesto',
      });
    }

    const calculos = calcularItems(items);
    await conexion.beginTransaction();

    const [existentes] = await conexion.query(
      'SELECT estado, orden_venta_id FROM presupuestos WHERE id = ? FOR UPDATE',
      [presupuestoId]
    );

    if (!existentes[0]) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }
    if (existentes[0].estado !== 'borrador') {
      await conexion.rollback();
      return res.status(400).json({
        error: 'Solo se pueden editar presupuestos en borrador',
      });
    }
    if (existentes[0].orden_venta_id) {
      await conexion.rollback();
      return res.status(400).json({
        error: 'El presupuesto ya fue vinculado a una orden de venta',
      });
    }

    await conexion.query(
      `UPDATE presupuestos SET cliente_id=?, fecha=?, valido_hasta=?,
        observaciones=?, subtotal=?, descuento_total=?, impuestos=?, total=?
       WHERE id=?`,
      [
        Number(cliente_id),
        fecha,
        valido_hasta || null,
        observaciones?.trim() || null,
        calculos.subtotal,
        calculos.descuento_total,
        calculos.impuestos,
        calculos.total,
        presupuestoId,
      ]
    );

    await conexion.query(
      'DELETE FROM detalle_presupuestos WHERE presupuesto_id = ?',
      [presupuestoId]
    );

    for (const item of calculos.detalle) {
      await conexion.query(
        `INSERT INTO detalle_presupuestos
          (presupuesto_id, producto_id, cantidad, precio_unitario,
           descuento_porcentaje, iva_porcentaje, subtotal_bruto,
           descuento_importe, subtotal_neto, impuestos, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          presupuestoId,
          item.producto_id,
          item.cantidad,
          item.precio_unitario,
          item.descuento_porcentaje,
          item.iva_porcentaje,
          item.subtotal_bruto,
          item.descuento_importe,
          item.subtotal_neto,
          item.impuestos,
          item.total,
        ]
      );
    }

    await conexion.commit();
    res.json({ mensaje: 'Presupuesto actualizado', ...calculos });
  } catch (err) {
    await conexion.rollback();
    console.error('Error al actualizar presupuesto:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Error al actualizar el presupuesto',
    });
  } finally {
    conexion.release();
  }
}

async function cambiarEstado(req, res) {
  try {
    const { estado } = req.body;
    if (!ESTADOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado de presupuesto inválido' });
    }

    const [resultado] = await pool.query(
      'UPDATE presupuestos SET estado = ? WHERE id = ?',
      [estado, req.params.id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }

    res.json({ mensaje: 'Estado actualizado', estado });
  } catch (err) {
    console.error('Error al cambiar estado del presupuesto:', err);
    res.status(500).json({ error: 'Error al cambiar el estado' });
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
};
