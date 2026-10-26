const IVA = 0.21; // ajustable según necesidad fiscal
const DIAS_VENCIMIENTO_CHEQUE = 60;
const { masterPool } = require('../config/db');

// El token usa el ID central; las facturas requieren el ID local de usuarios.
async function obtenerUsuarioLocalId(conexion, usuario) {
  let email = usuario?.email || null;
  const empresaId = usuario?.empresa_id;
  if (!email && usuario?.id && empresaId) {
    const [accesos] = await masterPool.query(
      'SELECT email FROM accesos WHERE id = ? AND empresa_id = ? LIMIT 1',
      [usuario.id, empresaId]
    );
    if (accesos[0]?.email) email = accesos[0].email;
  }
  if (email) {
    const [rows] = await conexion.query(
      'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) AND activo = 1 LIMIT 1',
      [email]
    );
    if (rows[0]) return rows[0].id;
  }
  const nombre = usuario?.nombre;
  if (nombre) {
    const [rows] = await conexion.query(
      'SELECT id FROM usuarios WHERE LOWER(nombre_usuario) = LOWER(?) AND activo = 1 LIMIT 1',
      [nombre]
    );
    if (rows[0]) return rows[0].id;
  }
  const error = new Error('No se encontró un usuario local activo para registrar la factura.');
  error.code = 'USUARIO_LOCAL_NO_ENCONTRADO';
  throw error;
}

async function generarNumeroFacturaLocal(conexion) {
  const [rows] = await conexion.query(
    "SELECT numero FROM facturas WHERE tipo = 'C' AND numero LIKE 'C-LOCAL-%' ORDER BY id DESC LIMIT 1 FOR UPDATE"
  );
  let siguiente = 1;
  if (rows[0]?.numero) {
    const n = Number(rows[0].numero.replace('C-LOCAL-', ''));
    if (Number.isInteger(n) && n >= 1) siguiente = n + 1;
  }
  return `C-LOCAL-${String(siguiente).padStart(6, '0')}`;
}


// LISTAR FACTURAS
async function listar(req, res) {
  try {
    const db = req.db;

    const [rows] = await db.query(
      `SELECT
         f.*,
         c.nombre AS cliente_nombre
       FROM facturas f
       JOIN clientes c
         ON f.cliente_id = c.id
       ORDER BY f.fecha_emision DESC`
    );

    res.json(rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al listar facturas'
    });
  }
}


// OBTENER FACTURA
async function obtener(req, res) {
  try {
    const db = req.db;

    const [facturaRows] = await db.query(
      'SELECT * FROM facturas WHERE id = ?',
      [req.params.id]
    );

    if (!facturaRows[0]) {
      return res.status(404).json({
        error: 'Factura no encontrada'
      });
    }

    const [detalle] = await db.query(
      `SELECT
         d.*,
         p.nombre AS producto_nombre
       FROM detalle_facturas d
       JOIN productos p
         ON d.producto_id = p.id
       WHERE d.factura_id = ?`,
      [req.params.id]
    );

    const [pagos] = await db.query(
      'SELECT * FROM pagos WHERE factura_id = ?',
      [req.params.id]
    );

    res.json({
      ...facturaRows[0],
      detalle,
      pagos
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al obtener factura'
    });
  }
}


// GENERAR FACTURA DESDE ORDEN DE VENTA
async function generarDesdeOrdenVenta(req, res) {
  const db = req.db;
  const conexion = await db.getConnection();

  try {
    const {
      orden_venta_id,
      tipo,
      condicion_pago,
      fecha_vencimiento
    } = req.body;

    if (!orden_venta_id) {
      return res.status(400).json({
        error: 'orden_venta_id es obligatorio'
      });
    }

    await conexion.beginTransaction();

    const [ordenRows] = await conexion.query(
      'SELECT * FROM ordenes_venta WHERE id = ?',
      [orden_venta_id]
    );

    const orden = ordenRows[0];

    if (!orden) {
      await conexion.rollback();

      return res.status(404).json({
        error: 'Orden de venta no encontrada'
      });
    }

    const [detalleOrden] = await conexion.query(
      `SELECT *
       FROM detalle_ordenes_venta
       WHERE orden_venta_id = ?`,
      [orden_venta_id]
    );

    const subtotal = detalleOrden.reduce(
      (acc, it) =>
        acc + Number(it.subtotal),
      0
    );

    const impuestos = Number(
      (subtotal * IVA).toFixed(2)
    );

    const total = Number(
      (subtotal + impuestos).toFixed(2)
    );

    const condicion =
      condicion_pago || 'contado';

    let vencimiento =
      fecha_vencimiento || null;

    if (
      !vencimiento &&
      condicion === 'cheque'
    ) {
      const fechaVto = new Date();

      fechaVto.setDate(
        fechaVto.getDate() +
          DIAS_VENCIMIENTO_CHEQUE
      );

      vencimiento =
        fechaVto
          .toISOString()
          .slice(0, 10);
    }

    const usuarioLocalId = await obtenerUsuarioLocalId(conexion, req.usuario);
    const numero = await generarNumeroFacturaLocal(conexion);

    const [facturaResult] =
      await conexion.query(
        `INSERT INTO facturas
         (
           numero,
           tipo,
           condicion_pago,
           orden_venta_id,
           cliente_id,
           fecha_emision,
           fecha_vencimiento,
           subtotal,
           impuestos,
           total,
           usuario_id
         )
         VALUES (
           ?,
           ?,
           ?,
           ?,
           ?,
           CURDATE(),
           ?,
           ?,
           ?,
           ?,
           ?
         )`,
        [
          numero,
          'C',
          condicion,
          orden_venta_id,
          orden.cliente_id,
          vencimiento,
          subtotal,
          impuestos,
          total,
          usuarioLocalId
        ]
      );

    const facturaId =
      facturaResult.insertId;

    for (const item of detalleOrden) {
      await conexion.query(
        `INSERT INTO detalle_facturas
         (
           factura_id,
           producto_id,
           cantidad,
           precio_unitario,
           subtotal
         )
         VALUES (?, ?, ?, ?, ?)`,
        [
          facturaId,
          item.producto_id,
          item.cantidad,
          item.precio_unitario,
          item.subtotal
        ]
      );
    }

    await conexion.commit();

    res.status(201).json({
      id: facturaId,
      numero,
      subtotal,
      impuestos,
      total,
      condicion_pago: condicion
    });

  } catch (err) {
    try {
      await conexion.rollback();
    } catch (_) {}

    console.error(err);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error:
          'Ya existe una factura con ese número'
      });
    }

    res.status(500).json({
      error: err.code === 'USUARIO_LOCAL_NO_ENCONTRADO'
        ? err.message
        : 'Error al generar factura'
    });

  } finally {
    conexion.release();
  }
}


// REGISTRAR PAGO
async function registrarPago(req, res) {
  const db = req.db;
  const conexion = await db.getConnection();

  try {
    const {
      monto,
      metodo_pago,
      fecha_pago,
      referencia
    } = req.body;

    const facturaId =
      req.params.id;

    if (
      !monto ||
      !metodo_pago ||
      !fecha_pago
    ) {
      return res.status(400).json({
        error:
          'monto, metodo_pago y fecha_pago son obligatorios'
      });
    }

    await conexion.beginTransaction();

    const [facturaRows] =
      await conexion.query(
        `SELECT *
         FROM facturas
         WHERE id = ?
         FOR UPDATE`,
        [facturaId]
      );

    const factura =
      facturaRows[0];

    if (!factura) {
      await conexion.rollback();

      return res.status(404).json({
        error: 'Factura no encontrada'
      });
    }

    await conexion.query(
      `INSERT INTO pagos
       (
         factura_id,
         monto,
         metodo_pago,
         fecha_pago,
         referencia
       )
       VALUES (?, ?, ?, ?, ?)`,
      [
        facturaId,
        monto,
        metodo_pago,
        fecha_pago,
        referencia || null
      ]
    );

    const [pagosRows] =
      await conexion.query(
        `SELECT
           COALESCE(SUM(monto), 0)
             AS total_pagado
         FROM pagos
         WHERE factura_id = ?`,
        [facturaId]
      );

    const totalPagado =
      Number(
        pagosRows[0].total_pagado
      );

    if (
      totalPagado >=
      Number(factura.total)
    ) {
      await conexion.query(
        `UPDATE facturas
         SET estado = 'pagada'
         WHERE id = ?`,
        [facturaId]
      );
    }

    await conexion.commit();

    res.status(201).json({
      mensaje: 'Pago registrado',
      total_pagado: totalPagado
    });

  } catch (err) {
    try {
      await conexion.rollback();
    } catch (_) {}

    console.error(err);

    res.status(500).json({
      error:
        'Error al registrar pago'
    });

  } finally {
    conexion.release();
  }
}


module.exports = {
  listar,
  obtener,
  generarDesdeOrdenVenta,
  registrarPago
};