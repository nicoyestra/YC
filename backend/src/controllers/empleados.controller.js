async function listar(req, res) {
  try {
    const db = req.db;

    const [rows] = await db.query(
      'SELECT * FROM empleados ORDER BY apellido, nombre'
    );

    res.json(rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al listar empleados'
    });
  }
}


async function obtener(req, res) {
  try {
    const db = req.db;

    const [rows] = await db.query(
      'SELECT * FROM empleados WHERE id = ?',
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: 'Empleado no encontrado'
      });
    }

    res.json(rows[0]);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al obtener empleado'
    });
  }
}


async function crear(req, res) {
  try {
    const db = req.db;

    const {
      nombre,
      apellido,
      dni,
      email,
      telefono,
      puesto,
      departamento,
      fecha_ingreso,
      salario
    } = req.body;

    if (
      !nombre ||
      !apellido ||
      !email
    ) {
      return res.status(400).json({
        error:
          'nombre, apellido y email son obligatorios'
      });
    }

    const [result] = await db.query(
      `INSERT INTO empleados
       (
         nombre,
         apellido,
         dni,
         email,
         telefono,
         puesto,
         departamento,
         fecha_ingreso,
         salario
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        apellido,
        dni || null,
        email,
        telefono || null,
        puesto || null,
        departamento || null,
        fecha_ingreso || null,
        salario || null
      ]
    );

    res.status(201).json({
      id: result.insertId,
      nombre,
      apellido
    });

  } catch (err) {
    console.error(err);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error:
          'Ya existe un empleado con ese DNI o email'
      });
    }

    res.status(500).json({
      error: 'Error al crear empleado'
    });
  }
}


async function actualizar(req, res) {
  try {
    const db = req.db;

    const {
      nombre,
      apellido,
      dni,
      email,
      telefono,
      puesto,
      departamento,
      fecha_ingreso,
      salario,
      activo
    } = req.body;

    const [result] = await db.query(
      `UPDATE empleados
       SET
         nombre = ?,
         apellido = ?,
         dni = ?,
         email = ?,
         telefono = ?,
         puesto = ?,
         departamento = ?,
         fecha_ingreso = ?,
         salario = ?,
         activo = ?
       WHERE id = ?`,
      [
        nombre,
        apellido,
        dni,
        email,
        telefono,
        puesto,
        departamento,
        fecha_ingreso,
        salario,
        activo,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Empleado no encontrado'
      });
    }

    res.json({
      mensaje: 'Empleado actualizado'
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al actualizar empleado'
    });
  }
}


async function eliminar(req, res) {
  try {
    const db = req.db;

    const [result] = await db.query(
      `UPDATE empleados
       SET activo = FALSE
       WHERE id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: 'Empleado no encontrado'
      });
    }

    res.json({
      mensaje: 'Empleado dado de baja'
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al eliminar empleado'
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