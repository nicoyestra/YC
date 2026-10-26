async function listar(req, res) {
  try {
    const db = req.db;

    const { buscar, es_externo } = req.query;

    let sql = 'SELECT * FROM clientes WHERE 1=1';
    const params = [];

    if (buscar) {
      sql += `
        AND (
          nombre LIKE ?
          OR cuit_dni LIKE ?
          OR email LIKE ?
        )
      `;

      const like = `%${buscar}%`;

      params.push(
        like,
        like,
        like
      );
    }

    if (es_externo !== undefined) {
      sql += ' AND es_externo = ?';

      params.push(
        es_externo === 'true' ? 1 : 0
      );
    }

    sql += ' ORDER BY nombre';

    const [rows] = await db.query(
      sql,
      params
    );

    res.json(rows);

  } catch (err) {
    console.error(
      'Error listando clientes:',
      err
    );

    res.status(500).json({
      error: 'Error al listar clientes'
    });
  }
}


async function obtener(req, res) {
  try {
    const db = req.db;

    const [rows] = await db.query(
      `SELECT *
       FROM clientes
       WHERE id = ?`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: 'Cliente no encontrado'
      });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error(
      'Error obteniendo cliente:',
      err
    );

    res.status(500).json({
      error: 'Error al obtener cliente'
    });
  }
}


async function crear(req, res) {
  try {
    const db = req.db;

    const {
      nombre,
      cuit_dni,
      email,
      telefono,
      direccion,
      codigo_postal,
      es_externo
    } = req.body;

    if (!nombre) {
      return res.status(400).json({
        error: 'El nombre es obligatorio'
      });
    }

    const [result] = await db.query(
      `INSERT INTO clientes
       (
         nombre,
         cuit_dni,
         email,
         telefono,
         direccion,
         codigo_postal,
         es_externo
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        cuit_dni || null,
        email || null,
        telefono || null,
        direccion || null,
        codigo_postal || null,
        !!es_externo
      ]
    );

    res.status(201).json({
      id: result.insertId,
      nombre
    });

  } catch (err) {
    console.error(
      'Error creando cliente:',
      err
    );

    res.status(500).json({
      error: 'Error al crear cliente'
    });
  }
}


async function actualizar(req, res) {
  try {
    const db = req.db;

    const {
      nombre,
      cuit_dni,
      email,
      telefono,
      direccion,
      codigo_postal,
      es_externo,
      activo
    } = req.body;

    const [result] = await db.query(
      `UPDATE clientes
       SET
         nombre = ?,
         cuit_dni = ?,
         email = ?,
         telefono = ?,
         direccion = ?,
         codigo_postal = ?,
         es_externo = ?,
         activo = ?
       WHERE id = ?`,
      [
        nombre,
        cuit_dni,
        email,
        telefono,
        direccion,
        codigo_postal,
        !!es_externo,
        activo,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Cliente no encontrado'
      });
    }

    res.json({
      mensaje: 'Cliente actualizado'
    });

  } catch (err) {
    console.error(
      'Error actualizando cliente:',
      err
    );

    res.status(500).json({
      error: 'Error al actualizar cliente'
    });
  }
}


async function eliminar(req, res) {
  try {
    const db = req.db;

    const [result] = await db.query(
      `UPDATE clientes
       SET activo = FALSE
       WHERE id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Cliente no encontrado'
      });
    }

    res.json({
      mensaje: 'Cliente desactivado'
    });

  } catch (err) {
    console.error(
      'Error eliminando cliente:',
      err
    );

    res.status(500).json({
      error: 'Error al eliminar cliente'
    });
  }
}


module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar
};