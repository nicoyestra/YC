const pool = require('../config/db');

async function listar(req, res) {
  try {
    const { buscar } = req.query;
    let sql = `SELECT p.*, c.nombre AS categoria_nombre, pr.nombre AS proveedor_nombre,
        COALESCE(SUM(s.cantidad), 0) AS stock_total
       FROM productos p
       LEFT JOIN categorias_producto c ON p.categoria_id = c.id
       LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
       LEFT JOIN stock s ON s.producto_id = p.id
       WHERE 1=1`;
    const params = [];

    if (buscar) {
      sql += ' AND (p.sku LIKE ? OR p.nombre LIKE ? OR p.codigo_barras LIKE ? OR p.descripcion LIKE ?)';
      const like = `%${buscar}%`;
      params.push(like, like, like, like);
    }

    sql += ' GROUP BY p.id ORDER BY p.nombre';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar productos' });
  }
}

async function obtener(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.nombre AS categoria_nombre, pr.nombre AS proveedor_nombre
       FROM productos p
       LEFT JOIN categorias_producto c ON p.categoria_id = c.id
       LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });

    const [stockRows] = await pool.query(
      `SELECT s.almacen_id, a.nombre AS almacen_nombre, s.cantidad
       FROM stock s JOIN almacenes a ON s.almacen_id = a.id
       WHERE s.producto_id = ?`,
      [req.params.id]
    );

    res.json({ ...rows[0], stock_por_almacen: stockRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
}

// Búsqueda puntual por código de barra (para lectores/escáner)
async function buscarPorCodigoBarras(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, COALESCE(SUM(s.cantidad), 0) AS stock_total
       FROM productos p LEFT JOIN stock s ON s.producto_id = p.id
       WHERE p.codigo_barras = ? GROUP BY p.id`,
      [req.params.codigo]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No se encontró ningún artículo con ese código de barras' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar por código de barras' });
  }
}

async function crear(req, res) {
  try {
    const {
      sku, codigo_barras, nombre, descripcion, categoria_id, proveedor_id,
      precio_costo, precio_venta, iva_porcentaje, stock_minimo, unidad_medida,
    } = req.body;
    if (!sku || !nombre) {
      return res.status(400).json({ error: 'SKU y nombre son obligatorios' });
    }

    const [result] = await pool.query(
      `INSERT INTO productos
        (sku, codigo_barras, nombre, descripcion, categoria_id, proveedor_id, precio_costo, precio_venta, iva_porcentaje, stock_minimo, unidad_medida)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku, codigo_barras || null, nombre, descripcion || null, categoria_id || null, proveedor_id || null,
        precio_costo || 0, precio_venta || 0, iva_porcentaje ?? 21, stock_minimo || 0, unidad_medida || 'unidad',
      ]
    );

    res.status(201).json({ id: result.insertId, sku, nombre });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un producto con ese SKU o código de barras' });
    }
    res.status(500).json({ error: 'Error al crear producto' });
  }
}

async function actualizar(req, res) {
  try {
    const {
      codigo_barras, nombre, descripcion, categoria_id, proveedor_id,
      precio_costo, precio_venta, iva_porcentaje, stock_minimo, unidad_medida, activo,
    } = req.body;

    const [result] = await pool.query(
      `UPDATE productos SET codigo_barras=?, nombre=?, descripcion=?, categoria_id=?, proveedor_id=?,
        precio_costo=?, precio_venta=?, iva_porcentaje=?, stock_minimo=?, unidad_medida=?, activo=?
       WHERE id=?`,
      [
        codigo_barras || null, nombre, descripcion, categoria_id || null, proveedor_id || null,
        precio_costo, precio_venta, iva_porcentaje ?? 21, stock_minimo, unidad_medida, activo, req.params.id,
      ]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto actualizado' });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe otro producto con ese código de barras' });
    }
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
}

async function eliminar(req, res) {
  try {
    const [result] = await pool.query('UPDATE productos SET activo = FALSE WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto desactivado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
}

async function productosBajoStock(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.sku, p.nombre, p.stock_minimo, COALESCE(SUM(s.cantidad), 0) AS stock_actual
       FROM productos p
       LEFT JOIN stock s ON s.producto_id = p.id
       WHERE p.activo = TRUE
       GROUP BY p.id
       HAVING stock_actual <= p.stock_minimo`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener alertas de stock' });
  }
}

module.exports = { listar, obtener, buscarPorCodigoBarras, crear, actualizar, eliminar, productosBajoStock };
