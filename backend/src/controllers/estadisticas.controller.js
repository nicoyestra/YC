const pool = require('../config/db');

// Resumen general filtrable por rango de fechas: ventas, compras, pagos y gastos.
async function resumen(req, res) {
  try {
    const { desde, hasta } = req.query;
    const rango = [];
    let filtroFecha = '';
    if (desde) { filtroFecha += ' AND fecha >= ?'; rango.push(desde); }
    if (hasta) { filtroFecha += ' AND fecha <= ?'; rango.push(hasta); }

    const [[ventas]] = await pool.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(total),0) AS total
       FROM ordenes_venta WHERE estado IN ('confirmada','entregada') ${filtroFecha}`,
      rango
    );

    const [[compras]] = await pool.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(total),0) AS total
       FROM ordenes_compra WHERE estado IN ('recibida','parcial') ${filtroFecha}`,
      rango
    );

    const filtroFechaPago = filtroFecha.replace(/fecha/g, 'fecha_pago');
    const [[pagos]] = await pool.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(monto),0) AS total
       FROM pagos WHERE 1=1 ${filtroFechaPago}`,
      rango
    );

    const [[gastos]] = await pool.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(monto),0) AS total
       FROM gastos WHERE 1=1 ${filtroFecha}`,
      rango
    );

    const [pagosPorMetodo] = await pool.query(
      `SELECT metodo_pago, COUNT(*) AS cantidad, COALESCE(SUM(monto),0) AS total
       FROM pagos WHERE 1=1 ${filtroFechaPago} GROUP BY metodo_pago`,
      rango
    );

    const [topProductos] = await pool.query(
      `SELECT p.sku, p.nombre, SUM(d.cantidad) AS cantidad_vendida, SUM(d.subtotal) AS total_vendido
       FROM detalle_ordenes_venta d
       JOIN ordenes_venta ov ON d.orden_venta_id = ov.id
       JOIN productos p ON d.producto_id = p.id
       WHERE ov.estado IN ('confirmada','entregada') ${filtroFecha.replace(/fecha/g, 'ov.fecha')}
       GROUP BY p.id ORDER BY cantidad_vendida DESC LIMIT 10`,
      rango
    );

    res.json({ ventas, compras, pagos, gastos, pagosPorMetodo, topProductos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular estadísticas' });
  }
}

module.exports = { resumen };
