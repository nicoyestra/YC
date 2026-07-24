const pool = require('../config/db');

const IVA = 0.21; // ajustable según necesidad fiscal
const DIAS_VENCIMIENTO_CHEQUE = 60;

async function listar(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, c.nombre AS cliente_nombre
       FROM facturas f JOIN clientes c ON f.cliente_id = c.id
       ORDER BY f.fecha_emision DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar facturas' });
  }
}

async function obtener(req, res) {
  try {
    const [facturaRows] = await pool.query('SELECT * FROM facturas WHERE id = ?', [req.params.id]);
    if (!facturaRows[0]) return res.status(404).json({ error: 'Factura no encontrada' });

    const [detalle] = await pool.query(
      `SELECT d.*, p.nombre AS producto_nombre FROM detalle_facturas d
       JOIN productos p ON d.producto_id = p.id WHERE d.factura_id = ?`,
      [req.params.id]
    );
    const [pagos] = await pool.query('SELECT * FROM pagos WHERE factura_id = ?', [req.params.id]);

    res.json({ ...facturaRows[0], detalle, pagos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener factura' });
  }
}

// Genera una factura a partir de una orden de venta ya confirmada.
// Si la condición de pago es "cheque", el vencimiento se calcula automáticamente
// a 60 días de la emisión (salvo que se mande uno puntual).
async function generarDesdeOrdenVenta(req, res) {
  const conexion = await pool.getConnection();
  try {
    const { orden_venta_id, numero, tipo, condicion_pago, fecha_vencimiento } = req.body;
    if (!orden_venta_id || !numero) {
      conexion.release();
      return res.status(400).json({ error: 'orden_venta_id y numero son obligatorios' });
    }

    await conexion.beginTransaction();

    const [ordenRows] = await conexion.query('SELECT * FROM ordenes_venta WHERE id = ?', [orden_venta_id]);
    const orden = ordenRows[0];
    if (!orden) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Orden de venta no encontrada' });
    }

    const [detalleOrden] = await conexion.query(
      'SELECT * FROM detalle_ordenes_venta WHERE orden_venta_id = ?',
      [orden_venta_id]
    );

    const subtotal = detalleOrden.reduce((acc, it) => acc + Number(it.subtotal), 0);
    const impuestos = Number((subtotal * IVA).toFixed(2));
    const total = Number((subtotal + impuestos).toFixed(2));

    const condicion = condicion_pago || 'contado';
    let vencimiento = fecha_vencimiento || null;

    if (!vencimiento && condicion === 'cheque') {
      const fechaVto = new Date();
      fechaVto.setDate(fechaVto.getDate() + DIAS_VENCIMIENTO_CHEQUE);
      vencimiento = fechaVto.toISOString().slice(0, 10); // YYYY-MM-DD
    }

    const [facturaResult] = await conexion.query(
      `INSERT INTO facturas
        (numero, tipo, condicion_pago, orden_venta_id, cliente_id, fecha_emision, fecha_vencimiento, subtotal, impuestos, total, usuario_id)
       VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?)`,
      [numero, tipo || 'B', condicion, orden_venta_id, orden.cliente_id, vencimiento, subtotal, impuestos, total, req.usuario.id]
    );
    const facturaId = facturaResult.insertId;

    for (const item of detalleOrden) {
      await conexion.query(
        `INSERT INTO detalle_facturas (factura_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [facturaId, item.producto_id, item.cantidad, item.precio_unitario, item.subtotal]
      );
    }

    await conexion.commit();
    res.status(201).json({ id: facturaId, numero, subtotal, impuestos, total, condicion_pago: condicion });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una factura con ese número' });
    }
    res.status(500).json({ error: 'Error al generar factura' });
  } finally {
    conexion.release();
  }
}

async function registrarPago(req, res) {
  const conexion = await pool.getConnection();
  try {
    const { monto, metodo_pago, fecha_pago, referencia } = req.body;
    const facturaId = req.params.id;

    if (!monto || !metodo_pago || !fecha_pago) {
      conexion.release();
      return res.status(400).json({ error: 'monto, metodo_pago y fecha_pago son obligatorios' });
    }

    await conexion.beginTransaction();

    const [facturaRows] = await conexion.query('SELECT * FROM facturas WHERE id = ? FOR UPDATE', [facturaId]);
    const factura = facturaRows[0];
    if (!factura) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    await conexion.query(
      'INSERT INTO pagos (factura_id, monto, metodo_pago, fecha_pago, referencia) VALUES (?, ?, ?, ?, ?)',
      [facturaId, monto, metodo_pago, fecha_pago, referencia || null]
    );

    const [pagosRows] = await conexion.query('SELECT COALESCE(SUM(monto),0) AS total_pagado FROM pagos WHERE factura_id = ?', [facturaId]);
    const totalPagado = Number(pagosRows[0].total_pagado);

    if (totalPagado >= Number(factura.total)) {
      await conexion.query("UPDATE facturas SET estado = 'pagada' WHERE id = ?", [facturaId]);
    }

    await conexion.commit();
    res.status(201).json({ mensaje: 'Pago registrado', total_pagado: totalPagado });
  } catch (err) {
    await conexion.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al registrar pago' });
  } finally {
    conexion.release();
  }
}

module.exports = { listar, obtener, generarDesdeOrdenVenta, registrarPago };
