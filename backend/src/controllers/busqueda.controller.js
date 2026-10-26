async function buscarGlobal(req, res) {
  try {
    const db = req.db;

    const termino =
      String(req.query.q || '').trim();

    if (termino.length < 2) {
      return res.json({
        productos: [],
        clientes: [],
        ventas: [],
        compras: [],
        facturas: []
      });
    }

    const texto = `%${termino}%`;

    const [
      [productos],
      [clientes],
      [ventas],
      [compras],
      [facturas]
    ] = await Promise.all([
      db.query(
        `
        SELECT
          p.id,
          p.sku,
          p.codigo_barras,
          p.nombre,
          p.descripcion,
          p.precio_venta,
          COALESCE(SUM(s.cantidad), 0) AS stock_total
        FROM productos p
        LEFT JOIN stock s
          ON s.producto_id = p.id
        WHERE p.activo = 1
          AND (
            p.nombre LIKE ?
            OR p.sku LIKE ?
            OR p.codigo_barras LIKE ?
            OR p.descripcion LIKE ?
          )
        GROUP BY
          p.id,
          p.sku,
          p.codigo_barras,
          p.nombre,
          p.descripcion,
          p.precio_venta
        ORDER BY p.nombre
        LIMIT 8
        `,
        [
          texto,
          texto,
          texto,
          texto
        ]
      ),

      db.query(
        `
        SELECT
          id,
          nombre,
          cuit_dni,
          email,
          telefono
        FROM clientes
        WHERE activo = 1
          AND (
            nombre LIKE ?
            OR cuit_dni LIKE ?
            OR email LIKE ?
            OR telefono LIKE ?
          )
        ORDER BY nombre
        LIMIT 8
        `,
        [
          texto,
          texto,
          texto,
          texto
        ]
      ),

      db.query(
        `
        SELECT
          ov.id,
          ov.numero,
          ov.estado,
          ov.fecha,
          ov.total,
          c.nombre AS cliente_nombre
        FROM ordenes_venta ov
        INNER JOIN clientes c
          ON c.id = ov.cliente_id
        WHERE
          ov.numero LIKE ?
          OR c.nombre LIKE ?
          OR ov.estado LIKE ?
        ORDER BY ov.created_at DESC
        LIMIT 8
        `,
        [
          texto,
          texto,
          texto
        ]
      ),

      db.query(
        `
        SELECT
          oc.id,
          oc.numero,
          oc.estado,
          oc.fecha,
          oc.total,
          p.nombre AS proveedor_nombre
        FROM ordenes_compra oc
        INNER JOIN proveedores p
          ON p.id = oc.proveedor_id
        WHERE
          oc.numero LIKE ?
          OR p.nombre LIKE ?
          OR oc.estado LIKE ?
        ORDER BY oc.created_at DESC
        LIMIT 8
        `,
        [
          texto,
          texto,
          texto
        ]
      ),

      db.query(
        `
        SELECT
          f.id,
          f.numero,
          f.estado,
          f.fecha_emision,
          f.total,
          c.nombre AS cliente_nombre
        FROM facturas f
        INNER JOIN clientes c
          ON c.id = f.cliente_id
        WHERE
          f.numero LIKE ?
          OR c.nombre LIKE ?
          OR f.estado LIKE ?
        ORDER BY f.created_at DESC
        LIMIT 8
        `,
        [
          texto,
          texto,
          texto
        ]
      )
    ]);

    return res.json({
      productos,
      clientes,
      ventas,
      compras,
      facturas
    });

  } catch (error) {
    console.error(
      'Error en búsqueda global:',
      error
    );

    return res.status(500).json({
      error:
        'No se pudo realizar la búsqueda global'
    });
  }
}


module.exports = {
  buscarGlobal
};