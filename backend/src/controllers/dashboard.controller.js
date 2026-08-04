const pool = require('../config/db');

async function resumen(req, res) {
  try {
    const [
      [[ventasHoy]],
      [[ventasMes]],
      [[comprasPendientes]],
      [[clientes]],
      [[productos]],
      [[stockBajo]],
      [[facturasPendientes]],
      [[logisticaPendiente]],
      [ventas30Dias],
      [topProductos],
      [actividadReciente],
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*) cantidad, COALESCE(SUM(total),0) total
                  FROM facturas WHERE estado <> 'anulada' AND fecha_emision = CURDATE()`),
      pool.query(`SELECT COUNT(*) cantidad, COALESCE(SUM(total),0) total
                  FROM facturas WHERE estado <> 'anulada'
                    AND YEAR(fecha_emision)=YEAR(CURDATE()) AND MONTH(fecha_emision)=MONTH(CURDATE())`),
      pool.query(`SELECT COUNT(*) cantidad, COALESCE(SUM(total),0) total
                  FROM ordenes_compra WHERE estado IN ('borrador','enviada','parcial')`),
      pool.query(`SELECT COUNT(*) cantidad FROM clientes WHERE activo = 1`),
      pool.query(`SELECT COUNT(*) cantidad FROM productos WHERE activo = 1`),
      pool.query(`SELECT COUNT(*) cantidad FROM (
                    SELECT p.id
                    FROM productos p LEFT JOIN stock s ON s.producto_id=p.id
                    WHERE p.activo=1
                    GROUP BY p.id, p.stock_minimo
                    HAVING COALESCE(SUM(s.cantidad),0) <= p.stock_minimo
                  ) x`),
      pool.query(`SELECT COUNT(*) cantidad, COALESCE(SUM(f.total - COALESCE(pg.pagado,0)),0) total
                  FROM facturas f
                  LEFT JOIN (SELECT factura_id, SUM(monto) pagado FROM pagos GROUP BY factura_id) pg ON pg.factura_id=f.id
                  WHERE f.estado IN ('pendiente','vencida') AND f.total > COALESCE(pg.pagado,0)`),
      pool.query(`SELECT COUNT(*) cantidad FROM logistica WHERE estado IN ('pendiente','en_curso')`),
      pool.query(`SELECT DATE_FORMAT(d.fecha,'%Y-%m-%d') fecha, COALESCE(SUM(f.total),0) total
                  FROM (
                    SELECT CURDATE() - INTERVAL n DAY fecha
                    FROM (
                      SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                      UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
                      UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
                      UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
                      UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24
                      UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
                    ) nums
                  ) d
                  LEFT JOIN facturas f ON f.fecha_emision=d.fecha AND f.estado <> 'anulada'
                  GROUP BY d.fecha ORDER BY d.fecha`),
      pool.query(`SELECT p.id, p.sku, p.nombre, SUM(df.cantidad) cantidad, SUM(df.subtotal) total
                  FROM detalle_facturas df
                  JOIN facturas f ON f.id=df.factura_id AND f.estado <> 'anulada'
                  JOIN productos p ON p.id=df.producto_id
                  WHERE f.fecha_emision >= CURDATE() - INTERVAL 30 DAY
                  GROUP BY p.id, p.sku, p.nombre
                  ORDER BY cantidad DESC LIMIT 5`),
      pool.query(`(SELECT 'factura' tipo, f.id, CONCAT('Factura ',f.numero,' creada') titulo,
                         CONCAT(c.nombre,' · $',FORMAT(f.total,2)) detalle, f.created_at fecha, '/facturacion' ruta
                  FROM facturas f JOIN clientes c ON c.id=f.cliente_id)
                  UNION ALL
                  (SELECT 'venta', ov.id, CONCAT('Venta ',ov.numero) titulo,
                         CONCAT(c.nombre,' · $',FORMAT(ov.total,2)) detalle, ov.created_at fecha, '/ventas' ruta
                  FROM ordenes_venta ov JOIN clientes c ON c.id=ov.cliente_id)
                  UNION ALL
                  (SELECT 'compra', oc.id, CONCAT('Compra ',oc.numero) titulo,
                         CONCAT(p.nombre,' · ',oc.estado) detalle, oc.created_at fecha, '/compras' ruta
                  FROM ordenes_compra oc JOIN proveedores p ON p.id=oc.proveedor_id)
                  UNION ALL
                  (SELECT 'cliente', c.id, 'Cliente agregado' titulo, c.nombre detalle, c.created_at fecha, '/clientes' ruta
                  FROM clientes c)
                  ORDER BY fecha DESC LIMIT 10`),
    ]);

    res.json({
      kpis: { ventasHoy, ventasMes, comprasPendientes, clientes, productos, stockBajo, facturasPendientes, logisticaPendiente },
      ventas30Dias,
      topProductos,
      actividadReciente,
      generadoEn: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Dashboard:', err);
    res.status(500).json({ error: 'Error al cargar el centro de control' });
  }
}

module.exports = { resumen };
