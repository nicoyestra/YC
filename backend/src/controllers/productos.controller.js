async function listar(req, res) {
  try {
    const db = req.db;

    const { buscar } = req.query;

    let sql = `
      SELECT
        p.*,
        c.nombre AS categoria_nombre,
        pr.nombre AS proveedor_nombre,
        COALESCE(SUM(s.cantidad), 0) AS stock_total
      FROM productos p
      LEFT JOIN categorias_producto c
        ON p.categoria_id = c.id
      LEFT JOIN proveedores pr
        ON p.proveedor_id = pr.id
      LEFT JOIN stock s
        ON s.producto_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (buscar) {
      sql += `
        AND (
          p.sku LIKE ?
          OR p.nombre LIKE ?
          OR p.codigo_barras LIKE ?
          OR p.descripcion LIKE ?
        )
      `;

      const like = `%${buscar}%`;

      params.push(
        like,
        like,
        like,
        like
      );
    }

    sql += `
      GROUP BY p.id
      ORDER BY p.nombre
    `;

    const [rows] = await db.query(
      sql,
      params
    );

    res.json(rows);

  } catch (err) {
    console.error(
      'Error listando productos:',
      err
    );

    res.status(500).json({
      error: 'Error al listar productos'
    });
  }
}


async function obtener(req, res) {
  try {
    const db = req.db;

    const [rows] = await db.query(
      `SELECT
         p.*,
         c.nombre AS categoria_nombre,
         pr.nombre AS proveedor_nombre
       FROM productos p
       LEFT JOIN categorias_producto c
         ON p.categoria_id = c.id
       LEFT JOIN proveedores pr
         ON p.proveedor_id = pr.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: 'Producto no encontrado'
      });
    }

    const [stockRows] = await db.query(
      `SELECT
         s.almacen_id,
         a.nombre AS almacen_nombre,
         s.cantidad
       FROM stock s
       JOIN almacenes a
         ON s.almacen_id = a.id
       WHERE s.producto_id = ?`,
      [req.params.id]
    );

    res.json({
      ...rows[0],
      stock_por_almacen: stockRows
    });

  } catch (err) {
    console.error(
      'Error obteniendo producto:',
      err
    );

    res.status(500).json({
      error: 'Error al obtener producto'
    });
  }
}


// Búsqueda puntual por código de barras
async function buscarPorCodigoBarras(req, res) {
  try {
    const db = req.db;

    const [rows] = await db.query(
      `SELECT
         p.*,
         COALESCE(SUM(s.cantidad), 0) AS stock_total
       FROM productos p
       LEFT JOIN stock s
         ON s.producto_id = p.id
       WHERE p.codigo_barras = ?
       GROUP BY p.id`,
      [req.params.codigo]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error:
          'No se encontró ningún artículo con ese código de barras'
      });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error(
      'Error buscando producto por código de barras:',
      err
    );

    res.status(500).json({
      error: 'Error al buscar por código de barras'
    });
  }
}


async function crear(req, res) {
  try {
    const db = req.db;

    const {
      sku,
      codigo_barras,
      nombre,
      descripcion,
      categoria_id,
      proveedor_id,
      precio_costo,
      precio_venta,
      iva_porcentaje,
      stock_minimo,
      unidad_medida,
    } = req.body;

    if (!sku || !nombre) {
      return res.status(400).json({
        error: 'SKU y nombre son obligatorios'
      });
    }

    const [result] = await db.query(
      `INSERT INTO productos
       (
         sku,
         codigo_barras,
         nombre,
         descripcion,
         categoria_id,
         proveedor_id,
         precio_costo,
         precio_venta,
         iva_porcentaje,
         stock_minimo,
         unidad_medida
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku,
        codigo_barras || null,
        nombre,
        descripcion || null,
        categoria_id || null,
        proveedor_id || null,
        precio_costo || 0,
        precio_venta || 0,
        iva_porcentaje ?? 21,
        stock_minimo || 0,
        unidad_medida || 'unidad',
      ]
    );

    res.status(201).json({
      id: result.insertId,
      sku,
      nombre
    });

  } catch (err) {
    console.error(
      'Error creando producto:',
      err
    );

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error:
          'Ya existe un producto con ese SKU o código de barras'
      });
    }

    res.status(500).json({
      error: 'Error al crear producto'
    });
  }
}


async function actualizar(req, res) {
  try {
    const db = req.db;

    const {
      codigo_barras,
      nombre,
      descripcion,
      categoria_id,
      proveedor_id,
      precio_costo,
      precio_venta,
      iva_porcentaje,
      stock_minimo,
      unidad_medida,
      activo,
    } = req.body;

    const [result] = await db.query(
      `UPDATE productos
       SET
         codigo_barras = ?,
         nombre = ?,
         descripcion = ?,
         categoria_id = ?,
         proveedor_id = ?,
         precio_costo = ?,
         precio_venta = ?,
         iva_porcentaje = ?,
         stock_minimo = ?,
         unidad_medida = ?,
         activo = ?
       WHERE id = ?`,
      [
        codigo_barras || null,
        nombre,
        descripcion,
        categoria_id || null,
        proveedor_id || null,
        precio_costo,
        precio_venta,
        iva_porcentaje ?? 21,
        stock_minimo,
        unidad_medida,
        activo,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado'
      });
    }

    res.json({
      mensaje: 'Producto actualizado'
    });

  } catch (err) {
    console.error(
      'Error actualizando producto:',
      err
    );

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error:
          'Ya existe otro producto con ese código de barras'
      });
    }

    res.status(500).json({
      error: 'Error al actualizar producto'
    });
  }
}


async function eliminar(req, res) {
  try {
    const db = req.db;

    const [result] = await db.query(
      `UPDATE productos
       SET activo = FALSE
       WHERE id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado'
      });
    }

    res.json({
      mensaje: 'Producto desactivado'
    });

  } catch (err) {
    console.error(
      'Error eliminando producto:',
      err
    );

    res.status(500).json({
      error: 'Error al eliminar producto'
    });
  }
}


async function productosBajoStock(req, res) {
  try {
    const db = req.db;

    const [rows] = await db.query(
      `SELECT
         p.id,
         p.sku,
         p.nombre,
         p.stock_minimo,
         COALESCE(SUM(s.cantidad), 0) AS stock_actual
       FROM productos p
       LEFT JOIN stock s
         ON s.producto_id = p.id
       WHERE p.activo = TRUE
       GROUP BY p.id
       HAVING stock_actual <= p.stock_minimo`
    );

    res.json(rows);

  } catch (err) {
    console.error(
      'Error obteniendo productos bajo stock:',
      err
    );

    res.status(500).json({
      error: 'Error al obtener alertas de stock'
    });
  }
}



// Importación masiva de catálogos de proveedor. No crea ni modifica existencias.
async function importarCatalogo(req, res) {
  const db = req.db;
  const filas = Array.isArray(req.body?.filas) ? req.body.filas : [];
  const tipo = req.body?.tipo === 'oferta' ? 'oferta' : 'catalogo';
  if (!filas.length) return res.status(400).json({ error: 'No hay filas para importar.' });
  if (filas.length > 5000) return res.status(400).json({ error: 'El archivo supera el máximo de 5.000 filas por importación.' });

  const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const s = String(v).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const txt = (v) => String(v ?? '').trim();
  const normalize = (v) => txt(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  let conn;
  try {
    // Oferta se guarda separada de precio_costo. Esta tabla se crea de forma idempotente.
    await db.query(`
      CREATE TABLE IF NOT EXISTS precios_oferta_proveedor (
        id INT AUTO_INCREMENT PRIMARY KEY,
        producto_id INT NOT NULL,
        proveedor_id INT NOT NULL,
        codigo_oferta VARCHAR(100) NOT NULL,
        descripcion_oferta VARCHAR(255) NULL,
        precio_neto DECIMAL(12,2) NOT NULL,
        origen VARCHAR(150) NOT NULL,
        importado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_oferta_producto_origen (producto_id, proveedor_id, origen),
        CONSTRAINT fk_pop_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
        CONSTRAINT fk_pop_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    const [provRows] = await db.query('SELECT id FROM proveedores WHERE LOWER(nombre) = LOWER(?) LIMIT 1', ['CHM']);
    let proveedorId;
    if (provRows.length) proveedorId = provRows[0].id;
    else {
      const [pr] = await db.query('INSERT INTO proveedores (nombre, activo) VALUES (?, TRUE)', ['CHM']);
      proveedorId = pr.insertId;
    }

    const vistos = new Set();
    const normalizadas = [];
    let omitidas = 0;
    for (const f of filas) {
      const codigo = txt(f.codigo ?? f.Codigo ?? f.Codigo_oferta ?? f.SKU ?? f.sku);
      const clave = normalize(f.codigo_normalizado || codigo);
      const descripcion = txt(f.nombre ?? f.Descripcion ?? f.Modelo_Descripcion ?? f.descripcion);
      const precio = num(f.precio_neto ?? f.Costo_neto_lista ?? f.Costo_neto_oferta ?? f.precio ?? f.precio_costo);
      if (!codigo || !clave || !descripcion || precio === null || precio < 0) { omitidas++; continue; }
      if (vistos.has(clave)) { omitidas++; continue; }
      vistos.add(clave);
      normalizadas.push({
        codigo, clave, descripcion,
        marca: txt(f.Marca), modelo: txt(f.Modelo ?? f.Modelo_Descripcion),
        detalle: txt(f.Caracteristicas ?? f.Compatibilidades ?? f.Observaciones),
        precio, origen: txt(f.origen ?? f.Origen ?? (tipo === 'oferta' ? 'OFERTA FUYAO' : 'Catálogo habitual CHM')),
        iva: num(f.IVA_pct ?? f.iva_porcentaje) ?? 21
      });
    }
    if (!normalizadas.length) return res.status(400).json({ error: 'No se encontraron filas válidas. Revisá los encabezados y la columna de precio.' });

    conn = typeof db.getConnection === 'function' ? await db.getConnection() : null;
    const cx = conn || db;
    if (conn) await conn.beginTransaction();
    let creados = 0, actualizados = 0, ofertas = 0;
    try {
      for (const f of normalizadas) {
        const sku = f.codigo.slice(0, 50);
        const nombre = `${f.marca ? f.marca + ' ' : ''}${f.descripcion}`.slice(0, 200);
        const descripcionCompleta = [f.modelo && f.modelo !== f.descripcion ? `Modelo: ${f.modelo}` : '', f.detalle].filter(Boolean).join(' | ').slice(0, 60000) || null;
        const [ex] = await cx.query('SELECT id, precio_costo, precio_venta FROM productos WHERE sku = ? LIMIT 1', [sku]);
        let productoId;
        if (ex.length) {
          productoId = ex[0].id;
          if (tipo === 'catalogo') {
            await cx.query(
              'UPDATE productos SET nombre = ?, descripcion = ?, proveedor_id = ?, precio_costo = ?, iva_porcentaje = ?, activo = TRUE WHERE id = ?',
              [nombre, descripcionCompleta, proveedorId, f.precio, f.iva, productoId]
            );
          }
          actualizados++;
        } else {
          const [p] = await cx.query(
            `INSERT INTO productos (sku, nombre, descripcion, proveedor_id, precio_costo, precio_venta, iva_porcentaje, stock_minimo, unidad_medida, activo)
             VALUES (?, ?, ?, ?, ?, 0, ?, 0, 'unidad', TRUE)`,
            [sku, nombre, descripcionCompleta, proveedorId, f.precio, f.iva]
          );
          productoId = p.insertId;
          creados++;
        }
        if (tipo === 'oferta') {
          await cx.query(
            `INSERT INTO precios_oferta_proveedor (producto_id, proveedor_id, codigo_oferta, descripcion_oferta, precio_neto, origen)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE codigo_oferta = VALUES(codigo_oferta), descripcion_oferta = VALUES(descripcion_oferta),
               precio_neto = VALUES(precio_neto), importado_en = CURRENT_TIMESTAMP`,
            [productoId, proveedorId, f.codigo, nombre, f.precio, f.origen.slice(0,150)]
          );
          ofertas++;
        }
      }
      if (conn) await conn.commit();
    } catch (e) {
      if (conn) await conn.rollback();
      throw e;
    }
    return res.json({ mensaje: 'Importación completada', tipo, leidas: filas.length, validas: normalizadas.length, creados, actualizados, ofertas_guardadas: ofertas, omitidas, stock_modificado: false });
  } catch (err) {
    console.error('Error importando catálogo:', err);
    return res.status(500).json({ error: 'No se pudo importar el catálogo. No se modificó el stock.', detalle: err.message });
  } finally {
    if (conn) conn.release();
  }
}



async function listarPreciosOferta(req, res) {
  try {
    const db = req.db;
    const [rows] = await db.query(`
      SELECT po.id, po.producto_id, po.proveedor_id, po.codigo_oferta,
             po.descripcion_oferta, po.precio_neto, po.origen, po.importado_en,
             p.sku, p.nombre AS producto_nombre, pr.nombre AS proveedor_nombre
      FROM precios_oferta_proveedor po
      INNER JOIN productos p ON p.id = po.producto_id
      INNER JOIN proveedores pr ON pr.id = po.proveedor_id
      ORDER BY p.sku, pr.nombre
    `);
    res.json(rows);
  } catch (err) {
    // La tabla puede no existir en instalaciones donde aún no se importaron ofertas.
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    console.error('Error listando precios de oferta:', err);
    res.status(500).json({ error: 'No se pudieron consultar los precios de oferta' });
  }
}

module.exports = {
  listar,
  obtener,
  buscarPorCodigoBarras,
  crear,
  actualizar,
  eliminar,
  productosBajoStock,
  importarCatalogo,
  listarPreciosOferta
};