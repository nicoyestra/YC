const { masterPool } = require('../config/db');

const esquemaPorPool = new WeakMap();

async function asegurarEsquema(db) {
  if (esquemaPorPool.has(db)) return esquemaPorPool.get(db);
  const promesa = (async () => {
    const [columnas] = await db.query('SHOW COLUMNS FROM gastos');
    const existentes = new Set(columnas.map(c => c.Field));
    const cambios = [
      ['fecha_vencimiento', "ALTER TABLE gastos ADD COLUMN fecha_vencimiento DATE NULL"],
      ['estado_pago', "ALTER TABLE gastos ADD COLUMN estado_pago ENUM('pendiente','pagado') NOT NULL DEFAULT 'pendiente'"],
      ['recordatorio_dias', "ALTER TABLE gastos ADD COLUMN recordatorio_dias INT NOT NULL DEFAULT 7"]
    ];
    for (const [nombre, sql] of cambios) {
      if (!existentes.has(nombre)) await db.query(sql);
    }
    await db.query(`
      CREATE TABLE IF NOT EXISTS gastos_pagos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        gasto_id INT NOT NULL,
        monto DECIMAL(14,2) NOT NULL,
        fecha DATE NOT NULL,
        medio_pago VARCHAR(60) NULL,
        observaciones VARCHAR(255) NULL,
        usuario_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_gastos_pagos_gasto (gasto_id),
        CONSTRAINT fk_gastos_pagos_gasto
          FOREIGN KEY (gasto_id) REFERENCES gastos(id) ON DELETE CASCADE
      )
    `);
  })();
  esquemaPorPool.set(db, promesa);
  try { await promesa; } catch (e) { esquemaPorPool.delete(db); throw e; }
}

async function obtenerUsuarioLocalId(db, usuario) {
  let email = usuario?.email || null;
  if (!email && usuario?.id && usuario?.empresa_id) {
    const [accesos] = await masterPool.query(
      'SELECT email FROM accesos WHERE id = ? AND empresa_id = ? LIMIT 1',
      [usuario.id, usuario.empresa_id]
    );
    email = accesos[0]?.email || null;
  }
  if (email) {
    const [rows] = await db.query(
      'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) AND activo = 1 LIMIT 1',
      [email]
    );
    if (rows[0]) return rows[0].id;
  }
  const nombre = usuario?.nombre || usuario?.nombre_usuario;
  if (nombre) {
    const [rows] = await db.query(
      'SELECT id FROM usuarios WHERE LOWER(nombre_usuario) = LOWER(?) AND activo = 1 LIMIT 1',
      [nombre]
    );
    if (rows[0]) return rows[0].id;
  }
  const error = new Error('No se encontró un usuario local activo para registrar la operación.');
  error.status = 400;
  throw error;
}

async function listar(req, res) {
  try {
    const db = req.db;
    await asegurarEsquema(db);
    const { desde, hasta, categoria, estado } = req.query;
    let sql = `
      SELECT g.*, p.nombre AS proveedor_nombre,
        COALESCE(pg.total_pagado, 0) AS total_pagado,
        GREATEST(g.monto - COALESCE(pg.total_pagado, 0), 0) AS saldo_pendiente,
        CASE
          WHEN COALESCE(pg.total_pagado, 0) >= g.monto THEN 'pagado'
          WHEN g.fecha_vencimiento IS NOT NULL AND g.fecha_vencimiento < CURDATE() THEN 'vencido'
          ELSE 'pendiente'
        END AS estado_calculado
      FROM gastos g
      LEFT JOIN proveedores p ON g.proveedor_id = p.id
      LEFT JOIN (
        SELECT gasto_id, SUM(monto) AS total_pagado
        FROM gastos_pagos GROUP BY gasto_id
      ) pg ON pg.gasto_id = g.id
      WHERE 1=1
    `;
    const params = [];
    if (desde) { sql += ' AND g.fecha >= ?'; params.push(desde); }
    if (hasta) { sql += ' AND g.fecha <= ?'; params.push(hasta); }
    if (categoria) { sql += ' AND g.categoria = ?'; params.push(categoria); }
    if (estado === 'pagado') sql += ' AND COALESCE(pg.total_pagado,0) >= g.monto';
    if (estado === 'pendiente') sql += ' AND COALESCE(pg.total_pagado,0) < g.monto AND (g.fecha_vencimiento IS NULL OR g.fecha_vencimiento >= CURDATE())';
    if (estado === 'vencido') sql += ' AND COALESCE(pg.total_pagado,0) < g.monto AND g.fecha_vencimiento < CURDATE()';
    sql += ' ORDER BY COALESCE(g.fecha_vencimiento, g.fecha) ASC, g.id DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error al listar gastos:', err);
    res.status(500).json({ error: 'Error al listar gastos' });
  }
}

async function crear(req, res) {
  try {
    const db = req.db;
    await asegurarEsquema(db);
    const {
      categoria, tipo_comprobante, numero_comprobante, proveedor_id,
      monto, fecha, fecha_vencimiento, descripcion, estado_pago,
      recordatorio_dias
    } = req.body;
    if (!String(categoria || '').trim() || monto === undefined || monto === null || monto === '' || !fecha) {
      return res.status(400).json({ error: 'Categoría, monto y fecha son obligatorios.' });
    }
    const montoNumero = Number(monto);
    if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
    }
    const usuarioLocalId = await obtenerUsuarioLocalId(db, req.usuario);
    const [result] = await db.query(
      `INSERT INTO gastos
       (categoria, tipo_comprobante, numero_comprobante, proveedor_id, monto, fecha,
        descripcion, usuario_id, fecha_vencimiento, estado_pago, recordatorio_dias)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(categoria).trim(), tipo_comprobante || 'factura',
        numero_comprobante || null, proveedor_id || null, montoNumero, fecha,
        descripcion || null, usuarioLocalId, fecha_vencimiento || null,
        estado_pago === 'pagado' ? 'pagado' : 'pendiente',
        Math.max(0, Math.min(60, Number(recordatorio_dias ?? 7)))
      ]
    );
    if (estado_pago === 'pagado') {
      await db.query(
        `INSERT INTO gastos_pagos (gasto_id, monto, fecha, observaciones, usuario_id)
         VALUES (?, ?, ?, ?, ?)`,
        [result.insertId, montoNumero, fecha, 'Pago inicial registrado al crear el gasto', usuarioLocalId]
      );
    }
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Error al crear gasto:', err);
    res.status(err.status || 500).json({ error: err.message || 'Error al crear gasto' });
  }
}

async function actualizar(req, res) {
  try {
    const db = req.db;
    await asegurarEsquema(db);
    const { categoria, tipo_comprobante, numero_comprobante, proveedor_id, monto, fecha, fecha_vencimiento, descripcion, recordatorio_dias } = req.body;
    const montoNumero = Number(monto);
    if (!String(categoria || '').trim() || !Number.isFinite(montoNumero) || montoNumero <= 0 || !fecha) {
      return res.status(400).json({ error: 'Revisá categoría, monto y fecha.' });
    }
    const [pagos] = await db.query('SELECT COALESCE(SUM(monto),0) AS total FROM gastos_pagos WHERE gasto_id = ?', [req.params.id]);
    if (montoNumero < Number(pagos[0].total || 0)) {
      return res.status(400).json({ error: 'El monto total no puede ser menor a los pagos ya registrados.' });
    }
    const [result] = await db.query(
      `UPDATE gastos SET categoria=?, tipo_comprobante=?, numero_comprobante=?, proveedor_id=?,
       monto=?, fecha=?, fecha_vencimiento=?, descripcion=?, recordatorio_dias=?
       WHERE id=?`,
      [String(categoria).trim(), tipo_comprobante || 'factura', numero_comprobante || null,
       proveedor_id || null, montoNumero, fecha, fecha_vencimiento || null, descripcion || null,
       Math.max(0, Math.min(60, Number(recordatorio_dias ?? 7))), req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Gasto no encontrado.' });
    res.json({ mensaje: 'Gasto actualizado.' });
  } catch (err) {
    console.error('Error al actualizar gasto:', err);
    res.status(500).json({ error: 'Error al actualizar gasto.' });
  }
}

async function registrarPago(req, res) {
  let conexion;
  try {
    const db = req.db;
    await asegurarEsquema(db);
    const { monto, fecha, medio_pago, observaciones } = req.body;
    const importe = Number(monto);
    if (!Number.isFinite(importe) || importe <= 0 || !fecha) {
      return res.status(400).json({ error: 'Indicá un importe válido y la fecha del pago.' });
    }
    const usuarioLocalId = await obtenerUsuarioLocalId(db, req.usuario);
    conexion = await db.getConnection();
    await conexion.beginTransaction();
    const [gastos] = await conexion.query('SELECT id, monto FROM gastos WHERE id=? FOR UPDATE', [req.params.id]);
    if (!gastos.length) {
      await conexion.rollback();
      return res.status(404).json({ error: 'Gasto no encontrado.' });
    }
    const [[sumas]] = await conexion.query('SELECT COALESCE(SUM(monto),0) AS total FROM gastos_pagos WHERE gasto_id=?', [req.params.id]);
    const saldo = Number(gastos[0].monto) - Number(sumas.total || 0);
    if (importe > saldo + 0.005) {
      await conexion.rollback();
      return res.status(400).json({ error: `El pago supera el saldo pendiente (${saldo.toFixed(2)}).` });
    }
    await conexion.query(
      `INSERT INTO gastos_pagos (gasto_id, monto, fecha, medio_pago, observaciones, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, importe, fecha, medio_pago || null, observaciones || null, usuarioLocalId]
    );
    const nuevoTotal = Number(sumas.total || 0) + importe;
    await conexion.query('UPDATE gastos SET estado_pago=? WHERE id=?', [nuevoTotal >= Number(gastos[0].monto) - 0.005 ? 'pagado' : 'pendiente', req.params.id]);
    await conexion.commit();
    res.status(201).json({ mensaje: 'Pago registrado.', saldo_pendiente: Math.max(0, saldo - importe) });
  } catch (err) {
    if (conexion) await conexion.rollback();
    console.error('Error al registrar pago:', err);
    res.status(500).json({ error: 'Error al registrar pago.' });
  } finally {
    if (conexion) conexion.release();
  }
}

async function listarPagos(req, res) {
  try {
    await asegurarEsquema(req.db);
    const [rows] = await req.db.query(
      `SELECT id, gasto_id, monto, fecha, medio_pago, observaciones
       FROM gastos_pagos WHERE gasto_id=? ORDER BY fecha DESC, id DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al listar pagos:', err);
    res.status(500).json({ error: 'Error al listar pagos.' });
  }
}

async function eliminar(req, res) {
  try {
    const db = req.db;
    await asegurarEsquema(db);
    const [result] = await db.query('DELETE FROM gastos WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Gasto no encontrado.' });
    res.json({ mensaje: 'Gasto eliminado.' });
  } catch (err) {
    console.error('Error al eliminar gasto:', err);
    res.status(500).json({ error: 'Error al eliminar gasto.' });
  }
}

module.exports = { listar, crear, actualizar, registrarPago, listarPagos, eliminar };
