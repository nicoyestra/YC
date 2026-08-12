async function asignarStockPendienteFIFO(
  conexion,
  productoId,
  almacenId
) {
  const [stockRows] = await conexion.query(
    `SELECT cantidad
     FROM stock
     WHERE producto_id = ? AND almacen_id = ?
     FOR UPDATE`,
    [productoId, almacenId]
  );

  const stockFisico = Number(stockRows[0]?.cantidad || 0);

  const [asignadoRows] = await conexion.query(
    `SELECT COALESCE(SUM(d.cantidad_asignada), 0) AS total_asignado
     FROM detalle_ordenes_venta d
     INNER JOIN ordenes_venta ov
       ON ov.id = d.orden_venta_id
     WHERE d.producto_id = ?
       AND ov.almacen_id = ?
       AND ov.estado = 'pendiente'`,
    [productoId, almacenId]
  );

  const totalYaAsignado = Number(
    asignadoRows[0]?.total_asignado || 0
  );

  let disponibleParaAsignar = Math.max(
    0,
    stockFisico - totalYaAsignado
  );

  if (disponibleParaAsignar <= 0) {
    return {
      asignado: 0,
      pedidosAfectados: 0,
    };
  }

  const [pedidosPendientes] = await conexion.query(
    `SELECT
       d.id AS detalle_id,
       d.cantidad,
       d.cantidad_asignada,
       ov.id AS orden_id,
       ov.numero,
       ov.fecha,
       ov.created_at
     FROM detalle_ordenes_venta d
     INNER JOIN ordenes_venta ov
       ON ov.id = d.orden_venta_id
     WHERE d.producto_id = ?
       AND ov.almacen_id = ?
       AND ov.estado = 'pendiente'
       AND d.cantidad_asignada < d.cantidad
     ORDER BY
       ov.fecha ASC,
       ov.created_at ASC,
       ov.id ASC,
       d.id ASC
     FOR UPDATE`,
    [productoId, almacenId]
  );

  let totalAsignadoAhora = 0;
  let pedidosAfectados = 0;

  for (const pedido of pedidosPendientes) {
    if (disponibleParaAsignar <= 0) break;

    const cantidadSolicitada = Number(pedido.cantidad);
    const cantidadAsignada = Number(
      pedido.cantidad_asignada || 0
    );

    const cantidadFaltante = Math.max(
      0,
      cantidadSolicitada - cantidadAsignada
    );

    if (cantidadFaltante <= 0) continue;

    const cantidadAAsignar = Math.min(
      cantidadFaltante,
      disponibleParaAsignar
    );

    await conexion.query(
      `UPDATE detalle_ordenes_venta
       SET cantidad_asignada = cantidad_asignada + ?
       WHERE id = ?`,
      [cantidadAAsignar, pedido.detalle_id]
    );

    disponibleParaAsignar -= cantidadAAsignar;
    totalAsignadoAhora += cantidadAAsignar;
    pedidosAfectados += 1;
  }

  return {
    asignado: totalAsignadoAhora,
    pedidosAfectados,
  };
}

module.exports = {
  asignarStockPendienteFIFO,
};