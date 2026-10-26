function permitidaPorRol(item, rol) {
  if (rol === 'admin') return true;
  return item.roles.includes(rol);
}


async function construirNotificaciones(
  db,
  usuarioId,
  rol
) {
  const [
    [stock],
    [compras],
    [facturas],
    [logistica]
  ] = await Promise.all([
    db.query(
      `SELECT
         p.id,
         p.nombre,
         p.sku,
         p.stock_minimo,
         COALESCE(SUM(s.cantidad), 0) AS stock_actual
       FROM productos p
       LEFT JOIN stock s
         ON s.producto_id = p.id
       WHERE p.activo = 1
       GROUP BY
         p.id,
         p.nombre,
         p.sku,
         p.stock_minimo
       HAVING stock_actual <= p.stock_minimo
       ORDER BY stock_actual ASC
       LIMIT 20`
    ),

    db.query(
      `SELECT
         oc.id,
         oc.numero,
         oc.estado,
         oc.fecha,
         pr.nombre AS proveedor
       FROM ordenes_compra oc
       JOIN proveedores pr
         ON pr.id = oc.proveedor_id
       WHERE oc.estado IN (
         'borrador',
         'enviada',
         'parcial'
       )
       ORDER BY oc.fecha ASC
       LIMIT 20`
    ),

    db.query(
      `SELECT
         f.id,
         f.numero,
         f.fecha_vencimiento,
         f.total,
         c.nombre AS cliente,
         f.total - COALESCE(pg.pagado, 0) AS saldo
       FROM facturas f
       JOIN clientes c
         ON c.id = f.cliente_id
       LEFT JOIN (
         SELECT
           factura_id,
           SUM(monto) AS pagado
         FROM pagos
         GROUP BY factura_id
       ) pg
         ON pg.factura_id = f.id
       WHERE f.estado IN (
         'pendiente',
         'vencida'
       )
       AND f.total > COALESCE(pg.pagado, 0)
       ORDER BY
         COALESCE(
           f.fecha_vencimiento,
           f.fecha_emision
         ) ASC
       LIMIT 20`
    ),

    db.query(
      `SELECT
         l.id,
         l.tipo,
         l.estado,
         l.fecha,
         c.nombre AS cliente
       FROM logistica l
       JOIN clientes c
         ON c.id = l.cliente_id
       WHERE l.estado IN (
         'pendiente',
         'en_curso'
       )
       ORDER BY l.fecha ASC
       LIMIT 20`
    )
  ]);

  const items = [
    ...stock.map((x) => ({
      clave: `stock:${x.id}`,
      tipo: 'stock',
      nivel:
        x.stock_actual <= 0
          ? 'critica'
          : 'advertencia',
      titulo:
        `Stock bajo: ${x.nombre}`,
      detalle:
        `${x.stock_actual} disponibles · mínimo ${x.stock_minimo}`,
      ruta: '/inventario',
      fecha: null,
      roles: [
        'inventario',
        'compras'
      ]
    })),

    ...compras.map((x) => ({
      clave:
        `compra:${x.id}:${x.estado}`,
      tipo: 'compra',
      nivel: 'informacion',
      titulo:
        `Compra ${x.numero} sin recibir`,
      detalle:
        `${x.proveedor} · ${x.estado}`,
      ruta: '/compras',
      fecha: x.fecha,
      roles: [
        'compras'
      ]
    })),

    ...facturas.map((x) => {
      const vencida =
        x.fecha_vencimiento &&
        new Date(x.fecha_vencimiento) <
          new Date(
            new Date().toDateString()
          );

      return {
        clave:
          `factura:${x.id}:${Number(x.saldo).toFixed(2)}`,
        tipo: 'factura',
        nivel:
          vencida
            ? 'critica'
            : 'advertencia',
        titulo:
          `Factura ${x.numero} ${vencida ? 'vencida' : 'pendiente'}`,
        detalle:
          `${x.cliente} · saldo $${Number(x.saldo).toLocaleString('es-AR')}`,
        ruta: '/facturacion',
        fecha:
          x.fecha_vencimiento,
        roles: [
          'ventas'
        ]
      };
    }),

    ...logistica.map((x) => ({
      clave:
        `logistica:${x.id}:${x.estado}`,
      tipo: 'logistica',
      nivel: 'informacion',
      titulo:
        `${x.tipo === 'despacho' ? 'Despacho' : 'Retiro'} pendiente`,
      detalle:
        `${x.cliente} · ${x.estado}`,
      ruta: '/logistica',
      fecha: x.fecha,
      roles: [
        'ventas',
        'inventario'
      ]
    }))
  ].filter(
    (x) =>
      permitidaPorRol(x, rol)
  );

  if (!items.length) {
    return [];
  }

  const [leidas] = await db.query(
    `SELECT
       clave,
       leida_en
     FROM notificaciones_leidas
     WHERE usuario_id = ?`,
    [usuarioId]
  );

  const mapa = new Map(
    leidas.map((x) => [
      x.clave,
      x.leida_en
    ])
  );

  return items.map((x) => ({
    ...x,
    leida:
      mapa.has(x.clave),
    leidaEn:
      mapa.get(x.clave) || null
  }));
}


async function listar(req, res) {
  try {
    const db = req.db;

    const items =
      await construirNotificaciones(
        db,
        req.usuario.id,
        req.usuario.rol
      );

    res.json({
      items,
      noLeidas:
        items.filter(
          (x) => !x.leida
        ).length
    });

  } catch (err) {
    console.error(
      'Notificaciones:',
      err
    );

    res.status(500).json({
      error:
        'Error al cargar notificaciones'
    });
  }
}


async function marcarLeida(req, res) {
  try {
    const db = req.db;

    const clave =
      decodeURIComponent(
        req.params.clave || ''
      );

    if (!clave) {
      return res.status(400).json({
        error:
          'Notificación inválida'
      });
    }

    await db.query(
      `INSERT INTO notificaciones_leidas
       (
         usuario_id,
         clave
       )
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE
         leida_en = CURRENT_TIMESTAMP`,
      [
        req.usuario.id,
        clave
      ]
    );

    res.json({
      ok: true
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error:
        'No se pudo marcar la notificación'
    });
  }
}


async function marcarTodas(req, res) {
  try {
    const db = req.db;

    const items =
      await construirNotificaciones(
        db,
        req.usuario.id,
        req.usuario.rol
      );

    if (items.length) {
      const valores =
        items.map((x) => [
          req.usuario.id,
          x.clave
        ]);

      await db.query(
        `INSERT INTO notificaciones_leidas
         (
           usuario_id,
           clave
         )
         VALUES ?
         ON DUPLICATE KEY UPDATE
           leida_en = CURRENT_TIMESTAMP`,
        [valores]
      );
    }

    res.json({
      ok: true
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error:
        'No se pudieron marcar las notificaciones'
    });
  }
}


module.exports = {
  listar,
  marcarLeida,
  marcarTodas
};