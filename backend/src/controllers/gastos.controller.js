async function listar(req, res) {
  try {
    const db = req.db;

    const {
      desde,
      hasta,
      categoria
    } = req.query;

    let sql = `
      SELECT
        g.*,
        p.nombre AS proveedor_nombre
      FROM gastos g
      LEFT JOIN proveedores p
        ON g.proveedor_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (desde) {
      sql += ' AND g.fecha >= ?';
      params.push(desde);
    }

    if (hasta) {
      sql += ' AND g.fecha <= ?';
      params.push(hasta);
    }

    if (categoria) {
      sql += ' AND g.categoria = ?';
      params.push(categoria);
    }

    sql += ' ORDER BY g.fecha DESC, g.id DESC';

    const [rows] = await db.query(
      sql,
      params
    );

    res.json(rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al listar gastos'
    });
  }
}


async function crear(req, res) {
  try {
    const db = req.db;

    const {
      categoria,
      tipo_comprobante,
      numero_comprobante,
      proveedor_id,
      monto,
      fecha,
      descripcion
    } = req.body;

    if (
      !categoria ||
      !monto ||
      !fecha
    ) {
      return res.status(400).json({
        error:
          'categoria, monto y fecha son obligatorios'
      });
    }

    const [result] = await db.query(
      `INSERT INTO gastos
       (
         categoria,
         tipo_comprobante,
         numero_comprobante,
         proveedor_id,
         monto,
         fecha,
         descripcion,
         usuario_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoria,
        tipo_comprobante || 'factura',
        numero_comprobante || null,
        proveedor_id || null,
        monto,
        fecha,
        descripcion || null,
        req.usuario.id
      ]
    );

    res.status(201).json({
      id: result.insertId
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al crear gasto'
    });
  }
}


async function eliminar(req, res) {
  try {
    const db = req.db;

    const [result] = await db.query(
      'DELETE FROM gastos WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Gasto no encontrado'
      });
    }

    res.json({
      mensaje: 'Gasto eliminado'
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al eliminar gasto'
    });
  }
}


module.exports = {
  listar,
  crear,
  eliminar
};