
// Agrega los campos de marca y equivalencia de forma segura en cada base tenant.
// Se ejecuta sobre req.db: nunca toca yc_master ni otras empresas.
const columnasMarcaPorDb = new WeakSet();
async function asegurarColumnasMarca(db) {
  if (db && (typeof db === 'object' || typeof db === 'function') && columnasMarcaPorDb.has(db)) return;
  const [marca] = await db.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'marca'`);
  const marcaNueva = !marca.length;
  if (marcaNueva) await db.query("ALTER TABLE productos ADD COLUMN marca VARCHAR(60) NULL AFTER nombre");
  const [equiv] = await db.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'productos' AND COLUMN_NAME = 'codigo_equivalencia'`);
  if (!equiv.length) await db.query("ALTER TABLE productos ADD COLUMN codigo_equivalencia VARCHAR(100) NULL AFTER marca");

  // Índice para acelerar búsquedas por nombre en catálogos grandes.
  const [indiceNombre] = await db.query(`
    SELECT INDEX_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'productos'
      AND INDEX_NAME = 'idx_productos_nombre'
    LIMIT 1
  `);
  if (!indiceNombre.length) {
    try {
      await db.query('CREATE INDEX idx_productos_nombre ON productos (nombre)');
    } catch (error) {
      // Otra petición puede haber creado el índice al mismo tiempo.
      if (error.code !== 'ER_DUP_KEYNAME') throw error;
    }
  }

  // No se infieren marcas ni proveedores durante la migración: cada empresa conserva sus datos.
  if (db && (typeof db === 'object' || typeof db === 'function')) columnasMarcaPorDb.add(db);
}

async function listar(req, res) {
  try {
    const db = req.db;
    await asegurarColumnasMarca(db);

    const { buscar } = req.query;
    const usarPaginacion = req.query.limite !== undefined;
    const limiteSolicitado = Number.parseInt(req.query.limite, 10);
    const offsetSolicitado = Number.parseInt(req.query.offset, 10);
    const limite = usarPaginacion
      ? Math.min(Math.max(Number.isFinite(limiteSolicitado) ? limiteSolicitado : 50, 1), 100)
      : null;
    const offset = usarPaginacion
      ? Math.max(Number.isFinite(offsetSolicitado) ? offsetSolicitado : 0, 0)
      : 0;

    // Se evita el JOIN + GROUP BY sobre todas las columnas del producto.
    // El stock se calcula con una subconsulta indexada por producto_id.
    let sql = `
      SELECT
        p.*,
        c.nombre AS categoria_nombre,
        pr.nombre AS proveedor_nombre,
        (
          SELECT COALESCE(SUM(s.cantidad), 0)
          FROM stock s
          WHERE s.producto_id = p.id
        ) AS stock_total
      FROM productos p
      LEFT JOIN categorias_producto c
        ON p.categoria_id = c.id
      LEFT JOIN proveedores pr
        ON p.proveedor_id = pr.id
      WHERE 1=1
    `;

    const params = [];
    const texto = String(buscar || '').trim();

    if (texto) {
      const contiene = `%${texto}%`;
      const comienza = `${texto}%`;
      sql += `
        AND (
          p.sku = ?
          OR p.codigo_barras = ?
          OR p.sku LIKE ?
          OR p.codigo_barras LIKE ?
          OR p.sku LIKE ?
          OR p.codigo_barras LIKE ?
          OR p.nombre LIKE ?
          OR p.descripcion LIKE ?
        )
      `;
      params.push(texto, texto, comienza, comienza, contiene, contiene, contiene, contiene);

      sql += `
        ORDER BY
          CASE
            WHEN p.sku = ? THEN 0
            WHEN p.codigo_barras = ? THEN 1
            WHEN p.sku LIKE ? THEN 2
            WHEN p.codigo_barras LIKE ? THEN 3
            WHEN p.nombre LIKE ? THEN 4
            ELSE 5
          END,
          p.nombre
      `;
      params.push(texto, texto, comienza, comienza, comienza);
    } else {
      sql += ' ORDER BY p.nombre';
    }

    if (usarPaginacion) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(limite, offset);
    }

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error listando productos:', err);
    res.status(500).json({ error: 'Error al listar productos' });
  }
}

async function obtener(req, res) {
  try {
    const db = req.db;
    await asegurarColumnasMarca(db);

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
    await asegurarColumnasMarca(db);

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
    await asegurarColumnasMarca(db);

    const {
      sku,
      codigo_barras,
      nombre,
      marca,
      codigo_equivalencia,
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
         marca,
         codigo_equivalencia,
         descripcion,
         categoria_id,
         proveedor_id,
         precio_costo,
         precio_venta,
         iva_porcentaje,
         stock_minimo,
         unidad_medida
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku,
        codigo_barras || null,
        nombre,
        marca || null,
        codigo_equivalencia || null,
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
    await asegurarColumnasMarca(db);

    const {
      codigo_barras,
      nombre,
      marca,
      codigo_equivalencia,
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
         marca = ?,
         codigo_equivalencia = ?,
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
        marca || null,
        codigo_equivalencia || null,
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



async function actualizarPrecioVenta(req, res) {
  try {
    const precio = Number(req.body?.precio_venta);
    if (!Number.isFinite(precio) || precio < 0) {
      return res.status(400).json({ error: 'El precio de venta debe ser un número válido mayor o igual a cero.' });
    }
    const [result] = await req.db.query(
      'UPDATE productos SET precio_venta = ? WHERE id = ?',
      [precio, req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Artículo no encontrado.' });
    }
    return res.json({ mensaje: 'Precio de venta actualizado.', precio_venta: precio });
  } catch (err) {
    console.error('Error actualizando precio de venta:', err);
    return res.status(500).json({ error: 'No se pudo actualizar el precio de venta.' });
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
const txtSeguro = (v) => String(v ?? '').trim();
async function importarCatalogo(req, res) {
  const db = req.db;
  const filas = Array.isArray(req.body?.filas) ? req.body.filas : [];
  const tipo = ['oferta', 'servicio', 'actualizar_marca'].includes(req.body?.tipo) ? req.body.tipo : 'catalogo';
  const proveedorPorDefecto = txtSeguro(req.body?.proveedor);
  const marcaPorDefecto = txtSeguro(req.body?.marca);
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
    await asegurarColumnasMarca(db);
    // Oferta se guarda separada de precio_costo. Esta tabla se crea de forma idempotente.
    await db.query(`
      CREATE TABLE IF NOT EXISTS precios_oferta_proveedor (
        id INT AUTO_INCREMENT PRIMARY KEY,
        producto_id INT NOT NULL,
        proveedor_id INT NOT NULL,
        codigo_oferta VARCHAR(100) NOT NULL,
        descripcion_oferta VARCHAR(255) NULL,
        precio_neto DECIMAL(12,2) NOT NULL,
        iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 21,
        origen VARCHAR(150) NOT NULL,
        importado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_oferta_producto_origen (producto_id, proveedor_id, origen),
        CONSTRAINT fk_pop_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
        CONSTRAINT fk_pop_proveedor FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // Compatibilidad con empresas que ya tenían creada la tabla sin IVA propio de la oferta.
    const [columnasOferta] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'precios_oferta_proveedor'
         AND COLUMN_NAME = 'iva_porcentaje'`
    );
    if (!columnasOferta.length) {
      await db.query(
        'ALTER TABLE precios_oferta_proveedor ADD COLUMN iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 21 AFTER precio_neto'
      );
    }
    const vistos = new Set();
    const normalizadas = [];
    let omitidas = 0;
    for (const f of filas) {
      const codigo = txt(f.codigo ?? f.Codigo ?? f.Codigo_oferta ?? f.SKU ?? f.sku);
      const clave = normalize(f.codigo_normalizado || codigo);
      const descripcion = txt(f.nombre ?? f.Descripcion ?? f.Modelo_Descripcion ?? f.descripcion);
      const precioVenta = num(f.precio_venta_sugerido ?? f.Precio_venta_sugerido ?? f.precio_venta);
      const precio = tipo === 'servicio' ? 0 : num(f.precio_neto ?? f.Costo_neto_lista ?? f.Costo_neto_oferta ?? f.precio ?? f.precio_costo);
      if (!codigo || !clave || !descripcion ||
          (tipo === 'servicio' ? precioVenta === null || precioVenta < 0 : precio === null || precio < 0)) { omitidas++; continue; }
      if (vistos.has(clave)) { omitidas++; continue; }
      vistos.add(clave);
      const marcaInformada = txt(f.Marca_vidrio ?? f['Marca del vidrio'] ?? f.Fabricante_vidrio ?? f.marca_vidrio ?? f.Marca ?? f.marca);
      const proveedorNombre = txt(f.Proveedor ?? f.proveedor ?? proveedorPorDefecto);
      if (tipo !== 'servicio' && !proveedorNombre) { omitidas++; continue; }
      const marcaDetectada = marcaInformada || marcaPorDefecto || (/\bPILKINGTON\b/i.test(descripcion) ? 'PILKINGTON' : /\bEUROGLASS\b/i.test(descripcion) ? 'EUROGLASS' : /\bFUYAO\b/i.test(descripcion) ? 'FUYAO' : '');
      const equivalencia = txt(f.codigo_equivalencia ?? f.Codigo_equivalencia ?? f['Código equivalencia'] ?? f.Equivalencia ?? f.Codigo_comun);
      normalizadas.push({
        codigo, clave, descripcion,
        marca: marcaDetectada, codigoEquivalencia: equivalencia,
        modelo: txt(f.Modelo ?? f.Modelo_Descripcion),
        detalle: txt(f.Caracteristicas ?? f.Compatibilidades ?? f.Observaciones),
        precio, origen: txt(f.origen ?? f.Origen ?? (tipo === 'oferta' ? 'OFERTA FUYAO' : 'Catálogo habitual')),
        proveedorNombre,
        precioVentaSugerido: precioVenta,
        iva: tipo === 'servicio' ? 0 : (num(f.IVA_pct ?? f.iva_porcentaje) ?? 21)
      });
    }
    if (!normalizadas.length) return res.status(400).json({ error: 'No se encontraron filas válidas. Revisá los encabezados y la columna de precio.' });

    // Modo seguro: actualiza solo marca y nombre de artículos existentes del proveedor elegido.
    // Nunca crea productos/proveedores ni toca precios, IVA, stock, movimientos u ofertas.
    if (tipo === 'actualizar_marca') {
      if (!proveedorPorDefecto) {
        return res.status(400).json({ error: 'Seleccioná el proveedor para limitar la actualización.' });
      }
      conn = typeof db.getConnection === 'function' ? await db.getConnection() : null;
      const cxSeguro = conn || db;
      if (conn) await conn.beginTransaction();
      let actualizadosMarca = 0;
      let noEncontrados = 0;
      let ambiguos = 0;
      try {
        const [existentes] = await cxSeguro.query(
          `SELECT p.id, p.sku, pr.nombre AS proveedor_nombre
           FROM productos p
           INNER JOIN proveedores pr ON pr.id = p.proveedor_id`
        );
        for (const f of normalizadas) {
          const marca = txt(f.marca).toUpperCase();
          if (!marca) { noEncontrados++; continue; }
          const candidatos = existentes.filter(p =>
            normalize(p.sku) === f.clave &&
            txt(p.proveedor_nombre).toLowerCase() === proveedorPorDefecto.toLowerCase()
          );
          if (!candidatos.length) { noEncontrados++; continue; }
          if (candidatos.length > 1) { ambiguos++; continue; }

          const abreviatura = marca === 'PILKINGTON' ? 'PLK'
            : marca === 'EUROGLASS' ? 'EUR'
            : marca === 'FUYAO' ? 'FUYAO' : marca;
          const descripcionLimpia = f.descripcion
            .replace(/\\bPILKINGTON\\b/gi, '')
            .replace(/\\bEUROGLASS\\b/gi, '')
            .replace(/\\bFUYAO\\b/gi, '')
            .replace(/\\s{2,}/g, ' ').trim();
          const nombre = `${abreviatura} ${descripcionLimpia}`.trim().slice(0, 200);
          await cxSeguro.query(
            'UPDATE productos SET marca = ?, nombre = ? WHERE id = ?',
            [marca, nombre, candidatos[0].id]
          );
          actualizadosMarca++;
        }
        if (conn) await conn.commit();
      } catch (e) {
        if (conn) await conn.rollback();
        throw e;
      } finally {
        if (conn) conn.release();
        conn = null;
      }
      return res.json({
        mensaje: 'Actualización de marcas completada',
        tipo,
        leidas: filas.length,
        validas: normalizadas.length,
        creados: 0,
        actualizados: actualizadosMarca,
        ofertas_guardadas: 0,
        omitidas: omitidas + noEncontrados + ambiguos,
        no_encontrados: noEncontrados,
        ambiguos,
        stock_modificado: false,
        precios_modificados: false
      });
    }

    conn = typeof db.getConnection === 'function' ? await db.getConnection() : null;
    const cx = conn || db;
    if (conn) await conn.beginTransaction();
    let creados = 0, actualizados = 0, ofertas = 0;
    try {
      for (const f of normalizadas) {
        const nombreProveedor = tipo === 'servicio' ? 'SERVICIO PROPIO' : f.proveedorNombre;
        const [provRows] = await cx.query(
          'SELECT id FROM proveedores WHERE LOWER(nombre) = LOWER(?) LIMIT 1',
          [nombreProveedor]
        );
        let proveedorId;
        if (provRows.length) proveedorId = provRows[0].id;
        else {
          const [pr] = await cx.query(
            'INSERT INTO proveedores (nombre, activo) VALUES (?, TRUE)',
            [nombreProveedor]
          );
          proveedorId = pr.insertId;
        }
        const sku = f.codigo.slice(0, 50);
        const nombre = `${f.marca && !new RegExp(f.marca, 'i').test(f.descripcion) ? f.marca + ' ' : ''}${f.descripcion}`.slice(0, 200);
        const descripcionCompleta = [f.modelo && f.modelo !== f.descripcion ? `Modelo: ${f.modelo}` : '', f.detalle].filter(Boolean).join(' | ').slice(0, 60000) || null;
        // Buscar por SKU exacto y también por código normalizado: CHM usa
        // indistintamente 52-0403 y 52 0403. Sin esto se crean duplicados y
        // la oferta queda vinculada a otro producto distinto.
        const [todos] = await cx.query('SELECT id, sku, precio_costo, precio_venta FROM productos');
        const claveBuscada = normalize(sku);
        const candidatos = todos.filter((p) => normalize(p.sku) === claveBuscada);
        // Preferir el SKU canónico del catálogo (normalmente con guion) antes
        // que un duplicado que pudo haberse creado con espacios al importar la oferta.
        const ex = candidatos.length
          ? [candidatos.find((p) => String(p.sku || '').includes('-')) || candidatos[0]]
          : [];
        let productoId;
        if (ex.length) {
          productoId = ex[0].id;
          if (tipo === 'servicio') {
            await cx.query(
              `UPDATE productos SET nombre = ?, marca = COALESCE(NULLIF(?, ''), marca), codigo_equivalencia = COALESCE(NULLIF(?, ''), codigo_equivalencia), descripcion = ?, proveedor_id = ?, precio_venta = ?, iva_porcentaje = 0, activo = TRUE WHERE id = ?`,
              [nombre, f.marca, f.codigoEquivalencia, descripcionCompleta, proveedorId, f.precioVentaSugerido, productoId]
            );
          } else if (tipo === 'catalogo') {
            await cx.query(
              `UPDATE productos SET nombre = ?, marca = COALESCE(NULLIF(?, ''), marca), codigo_equivalencia = COALESCE(NULLIF(?, ''), codigo_equivalencia), descripcion = ?, proveedor_id = ?, precio_costo = ?, precio_venta = COALESCE(?, precio_venta), iva_porcentaje = ?, activo = TRUE WHERE id = ?`,
              [nombre, f.marca, f.codigoEquivalencia, descripcionCompleta, proveedorId, f.precio, f.precioVentaSugerido, f.iva, productoId]
            );
          }
          actualizados++;
        } else {
          const costoInicial = ['oferta', 'servicio'].includes(tipo) ? 0 : f.precio;
          const [p] = await cx.query(
            `INSERT INTO productos (sku, nombre, marca, codigo_equivalencia, descripcion, proveedor_id, precio_costo, precio_venta, iva_porcentaje, stock_minimo, unidad_medida, activo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'unidad', TRUE)`,
            [sku, nombre, f.marca || null, f.codigoEquivalencia || null, descripcionCompleta, proveedorId, costoInicial, ['catalogo', 'servicio'].includes(tipo) ? (f.precioVentaSugerido ?? 0) : 0, f.iva]
          );
          productoId = p.insertId;
          creados++;
        }
        if (tipo === 'oferta') {
          await cx.query(
            `INSERT INTO precios_oferta_proveedor (producto_id, proveedor_id, codigo_oferta, descripcion_oferta, precio_neto, iva_porcentaje, origen)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE codigo_oferta = VALUES(codigo_oferta), descripcion_oferta = VALUES(descripcion_oferta),
               precio_neto = VALUES(precio_neto), iva_porcentaje = VALUES(iva_porcentaje), importado_en = CURRENT_TIMESTAMP`,
            [productoId, proveedorId, f.codigo, nombre, f.precio, f.iva, f.origen.slice(0,150)]
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
    const [columnasOferta] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'precios_oferta_proveedor'
         AND COLUMN_NAME = 'iva_porcentaje'`
    );
    const campoIvaOferta = columnasOferta.length ? 'po.iva_porcentaje' : '21 AS iva_porcentaje';
    const [rows] = await db.query(`
      SELECT po.id, po.producto_id, po.proveedor_id, po.codigo_oferta,
             po.descripcion_oferta, po.precio_neto, ${campoIvaOferta}, po.origen, po.importado_en,
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
  actualizarPrecioVenta,
  eliminar,
  productosBajoStock,
  importarCatalogo,
  listarPreciosOferta
};