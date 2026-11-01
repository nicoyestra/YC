async function listar(req, res) {
  try {
    const db = req.db;

    const { buscar } = req.query;

    let sql = 'SELECT * FROM proveedores WHERE 1=1';
    const params = [];

    if (buscar) {
      sql += ' AND (nombre LIKE ? OR cuit LIKE ? OR email LIKE ?)';

      const like = `%${buscar}%`;

      params.push(
        like,
        like,
        like
      );
    }

    sql += ' ORDER BY nombre';

    const [rows] = await db.query(
      sql,
      params
    );

    res.json(rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al listar proveedores'
    });
  }
}


async function crear(req, res) {
  try {
    const db = req.db;

    const {
      nombre,
      cuit,
      email,
      telefono,
      direccion
    } = req.body;

    if (!nombre) {
      return res.status(400).json({
        error: 'El nombre es obligatorio'
      });
    }

    const [result] = await db.query(
      `INSERT INTO proveedores
       (
         nombre,
         cuit,
         email,
         telefono,
         direccion
       )
       VALUES (?, ?, ?, ?, ?)`,
      [
        nombre,
        cuit || null,
        email || null,
        telefono || null,
        direccion || null
      ]
    );

    res.status(201).json({
      id: result.insertId,
      nombre
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al crear proveedor'
    });
  }
}


async function actualizar(req, res) {
  try {
    const db = req.db;

    const {
      nombre,
      cuit,
      email,
      telefono,
      direccion,
      activo
    } = req.body;

    const [result] = await db.query(
      `UPDATE proveedores
       SET
         nombre = ?,
         cuit = ?,
         email = ?,
         telefono = ?,
         direccion = ?,
         activo = ?
       WHERE id = ?`,
      [
        nombre,
        cuit,
        email,
        telefono,
        direccion,
        activo,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Proveedor no encontrado'
      });
    }

    res.json({
      mensaje: 'Proveedor actualizado'
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al actualizar proveedor'
    });
  }
}


async function eliminar(req, res) {
  try {
    const db = req.db;
    const [result] = await db.query('DELETE FROM proveedores WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Proveedor no encontrado' });
    return res.json({ mensaje: 'Proveedor eliminado definitivamente' });
  } catch (err) {
    console.error('Error eliminando proveedor:', err);
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({ error: 'No se puede eliminar este proveedor porque tiene compras, artículos u otros movimientos asociados. Se debe conservar para el historial.' });
    }
    return res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
}

module.exports = {
  listar,
  crear,
  actualizar,
  eliminar
};