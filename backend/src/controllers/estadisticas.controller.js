// Resumen general filtrable por rango de fechas:
// ventas, compras, pagos y gastos.
async function resumen(req, res) {
  try {
    const db = req.db;

    const {
      desde,
      hasta
    } = req.query;

    const rango = [];
    let filtroFecha = '';

    if (desde) {
      filtroFecha += ' AND fecha >= ?';
      rango.push(desde);
    }

    if (hasta) {
      filtroFecha += ' AND fecha <= ?';
      rango.push(hasta);
    }


    const [[ventas]] = await db.query(
      `SELECT
         COUNT(*) AS cantidad,
         COALESCE(SUM(total), 0) AS total
       FROM ordenes_venta
       WHERE estado IN ('confirmada', 'entregada')
       ${filtroFecha}`,
      rango
    );


    const [[compras]] = await db.query(
      `SELECT
         COUNT(*) AS cantidad,
         COALESCE(SUM(total), 0) AS total
       FROM ordenes_compra
       WHERE estado IN ('recibida', 'parcial')
       ${filtroFecha}`,
      rango
    );


    const [[ordenesSinRecibir]] = await db.query(
      `SELECT
         COUNT(*) AS cantidad,
         COALESCE(SUM(total), 0) AS total
       FROM ordenes_compra
       WHERE estado IN ('borrador', 'enviada', 'parcial')
       ${filtroFecha}`,
      rango
    );


    const filtroFechaPago =
      filtroFecha.replace(
        /fecha/g,
        'fecha_pago'
      );


    const [[pagos]] = await db.query(
      `SELECT
         COUNT(*) AS cantidad,
         COALESCE(SUM(monto), 0) AS total
       FROM pagos
       WHERE 1=1
       ${filtroFechaPago}`,
      rango
    );


    const [[gastos]] = await db.query(
      `SELECT
         COUNT(*) AS cantidad,
         COALESCE(SUM(monto), 0) AS total
       FROM gastos
       WHERE 1=1
       ${filtroFecha}`,
      rango
    );


    const [pagosPorMetodo] = await db.query(
      `SELECT
         metodo_pago,
         COUNT(*) AS cantidad,
         COALESCE(SUM(monto), 0) AS total
       FROM pagos
       WHERE 1=1
       ${filtroFechaPago}
       GROUP BY metodo_pago`,
      rango
    );


    const filtroFechaVentas =
      filtroFecha.replace(
        /fecha/g,
        'ov.fecha'
      );


    const [topProductos] = await db.query(
      `SELECT
         p.sku,
         p.nombre,
         SUM(d.cantidad) AS cantidad_vendida,
         SUM(d.subtotal) AS total_vendido
       FROM detalle_ordenes_venta d
       JOIN ordenes_venta ov
         ON d.orden_venta_id = ov.id
       JOIN productos p
         ON d.producto_id = p.id
       WHERE ov.estado IN ('confirmada', 'entregada')
       ${filtroFechaVentas}
       GROUP BY p.id
       ORDER BY cantidad_vendida DESC
       LIMIT 10`,
      rango
    );


    res.json({
      ventas,
      compras,
      ordenesSinRecibir,
      pagos,
      gastos,
      pagosPorMetodo,
      topProductos
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al calcular estadísticas'
    });
  }
}


module.exports = {
  resumen
};