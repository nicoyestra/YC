const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/db');
const { estaEnLinea } = require('../services/onlineSessions');


// LISTAR USUARIOS
async function listar(req, res) {
  try {
    const db = req.db;

    const [rows] = await db.query(
      `SELECT
         u.id,
         u.nombre_usuario,
         u.email,
         u.activo,
         u.ultimo_login,
         u.created_at,
         u.rol_id,
         r.nombre AS rol,
         u.empleado_id,
         CONCAT(e.nombre, ' ', e.apellido) AS empleado
       FROM usuarios u
       JOIN roles r
         ON r.id = u.rol_id
       LEFT JOIN empleados e
         ON e.id = u.empleado_id
       ORDER BY u.nombre_usuario`
    );

    const empresaId = Number(req.usuario?.empresa_id);
    res.json(rows.map((u) => ({ ...u, en_linea: estaEnLinea(empresaId, u.email) })));

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Error al listar usuarios'
    });
  }
}


// OPCIONES PARA CREAR / EDITAR USUARIO
async function opciones(req, res) {
  try {
    const db = req.db;

    const [
      [roles],
      [empleados]
    ] = await Promise.all([
      db.query(
        `SELECT
           id,
           nombre,
           descripcion
         FROM roles
         ORDER BY id`
      ),

      db.query(
        `SELECT
           id,
           nombre,
           apellido,
           email
         FROM empleados
         WHERE activo = TRUE
         ORDER BY apellido, nombre`
      )
    ]);

    res.json({
      roles,
      empleados
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error:
        'Error al cargar opciones de usuarios'
    });
  }
}


// CREAR USUARIO
// El usuario debe guardarse tanto en la base de la empresa como en YC MASTER,
// porque el login multiempresa autentica contra yc_master.accesos.
async function crear(req, res) {
  const db = req.db;
  let usuarioTenantId = null;
  let empresaId = Number(req.usuario && req.usuario.empresa_id);
  let emailNormalizado = '';
  let creadoEnTenant = false;

  try {
    const {
      nombre_usuario,
      email,
      password,
      rol_id,
      empleado_id
    } = req.body;

    if (!nombre_usuario || !email || !password || !rol_id) {
      return res.status(400).json({
        error: 'Nombre, email, contraseña y rol son obligatorios'
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.status(400).json({
        error: 'No se pudo identificar la empresa para crear el acceso'
      });
    }

    const nombreNormalizado = String(nombre_usuario).trim();
    emailNormalizado = String(email).trim().toLowerCase();
    const rolIdNumerico = Number(rol_id);

    if (!nombreNormalizado || !emailNormalizado || !Number.isInteger(rolIdNumerico) || rolIdNumerico <= 0) {
      return res.status(400).json({ error: 'Los datos del usuario no son válidos' });
    }

    // Confirmar el rol en la base de la empresa y obtener su nombre para YC MASTER.
    const [roles] = await db.query(
      'SELECT id, nombre FROM roles WHERE id = ? LIMIT 1',
      [rolIdNumerico]
    );
    if (!roles.length) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    // Confirmar que la empresa existe y que el ID corresponde a su base activa.
    const [empresas] = await masterPool.query(
      'SELECT id FROM empresas WHERE id = ? AND estado = \'activa\' LIMIT 1',
      [empresaId]
    );
    if (!empresas.length) {
      return res.status(400).json({ error: 'La empresa no existe o no está activa' });
    }

    const password_hash = await bcrypt.hash(String(password), 10);

    // Primero crear el usuario local.
    const [result] = await db.query(
      `INSERT INTO usuarios
       (nombre_usuario, email, password_hash, rol_id, empleado_id, activo)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [nombreNormalizado, emailNormalizado, password_hash, rolIdNumerico, empleado_id || null]
    );
    usuarioTenantId = result.insertId;
    creadoEnTenant = true;

    try {
      // Crear el acceso central que utiliza /auth/login.
      await masterPool.query(
        `INSERT INTO accesos
         (empresa_id, nombre_usuario, email, password_hash, rol, activo)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [empresaId, nombreNormalizado, emailNormalizado, password_hash, roles[0].nombre]
      );
    } catch (errorMaster) {
      // Evitar que quede un usuario local que después no pueda iniciar sesión.
      if (creadoEnTenant && usuarioTenantId) {
        await db.query('DELETE FROM usuarios WHERE id = ?', [usuarioTenantId]);
      }
      throw errorMaster;
    }

    return res.status(201).json({
      id: usuarioTenantId,
      nombre_usuario: nombreNormalizado,
      email: emailNormalizado,
      empresa_id: empresaId,
      mensaje: 'Usuario creado y habilitado para iniciar sesión'
    });
  } catch (err) {
    console.error('Error al crear usuario y sincronizar acceso central:', err);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'El nombre de usuario o email ya existe. Revisá también los accesos de YC MASTER.'
      });
    }

    return res.status(500).json({
      error: 'No se pudo crear el usuario completo. El sistema intentó evitar que quedara guardado solo en una de las bases.'
    });
  }
}

// ACTUALIZAR USUARIO
async function actualizar(req, res) {
  try {
    const db = req.db;

    const {
      nombre_usuario,
      email,
      rol_id,
      empleado_id
    } = req.body;

    if (
      !nombre_usuario ||
      !email ||
      !rol_id
    ) {
      return res.status(400).json({
        error:
          'Nombre, email y rol son obligatorios'
      });
    }

    const [result] = await db.query(
      `UPDATE usuarios
       SET
         nombre_usuario = ?,
         email = ?,
         rol_id = ?,
         empleado_id = ?
       WHERE id = ?`,
      [
        nombre_usuario.trim(),
        email.trim().toLowerCase(),
        rol_id,
        empleado_id || null,
        req.params.id
      ]
    );

    if (
      result.affectedRows === 0
    ) {
      return res.status(404).json({
        error:
          'Usuario no encontrado'
      });
    }

    res.json({
      mensaje:
        'Usuario actualizado'
    });

  } catch (err) {
    console.error(err);

    if (
      err.code === 'ER_DUP_ENTRY'
    ) {
      return res.status(409).json({
        error:
          'El nombre de usuario o email ya existe'
      });
    }

    res.status(500).json({
      error:
        'Error al actualizar usuario'
    });
  }
}


// ACTIVAR / DESACTIVAR USUARIO
async function cambiarEstado(req, res) {
  try {
    const db = req.db;

    const id =
      Number(req.params.id);

    const {
      activo
    } = req.body;

    if (
      typeof activo !== 'boolean'
    ) {
      return res.status(400).json({
        error:
          'El estado activo es obligatorio'
      });
    }

    if (
      id === Number(req.usuario.id) &&
      !activo
    ) {
      return res.status(400).json({
        error:
          'No podés desactivar tu propio usuario'
      });
    }

    const [result] = await db.query(
      `UPDATE usuarios
       SET activo = ?
       WHERE id = ?`,
      [
        activo,
        id
      ]
    );

    if (
      result.affectedRows === 0
    ) {
      return res.status(404).json({
        error:
          'Usuario no encontrado'
      });
    }

    res.json({
      mensaje:
        activo
          ? 'Usuario activado'
          : 'Usuario desactivado'
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error:
        'Error al cambiar el estado del usuario'
    });
  }
}


// CAMBIAR CONTRASEÑA
// El login valida la contraseña contra yc_master.accesos, por eso
// mantenemos sincronizada la contraseña del usuario de la empresa.
async function cambiarPassword(req, res) {
  let usuarioTenant;
  let passwordHashAnterior;

  try {
    const db = req.db;
    const id = Number(req.params.id);
    const { password } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    if (!password || String(password).length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    const [usuarios] = await db.query(
      `SELECT id, email, password_hash
       FROM usuarios
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    usuarioTenant = usuarios[0];
    passwordHashAnterior = usuarioTenant.password_hash;

    const empresaId = Number(req.usuario && req.usuario.empresa_id);
    if (!Number.isInteger(empresaId) || empresaId <= 0 || !usuarioTenant.email) {
      return res.status(400).json({
        error: 'No se pudo identificar la empresa o el email del usuario'
      });
    }

    // Confirmar que exista el acceso que usa el login antes de cambiar nada.
    const [accesos] = await masterPool.query(
      `SELECT id
       FROM accesos
       WHERE empresa_id = ? AND LOWER(email) = LOWER(?)
       LIMIT 1`,
      [empresaId, usuarioTenant.email]
    );

    if (accesos.length === 0) {
      return res.status(409).json({
        error: 'No se encontró el acceso de este usuario en el sistema principal. No se cambió la contraseña.'
      });
    }

    const password_hash = await bcrypt.hash(String(password), 10);

    const [actualizacionTenant] = await db.query(
      `UPDATE usuarios SET password_hash = ? WHERE id = ?`,
      [password_hash, id]
    );

    if (actualizacionTenant.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    try {
      const [actualizacionAcceso] = await masterPool.query(
        `UPDATE accesos
         SET password_hash = ?
         WHERE empresa_id = ? AND LOWER(email) = LOWER(?)`,
        [password_hash, empresaId, usuarioTenant.email]
      );

      if (actualizacionAcceso.affectedRows === 0) {
        throw new Error('No se actualizó el acceso del sistema principal');
      }
    } catch (errorAcceso) {
      // Si falla el sistema principal, restaurar la contraseña del usuario local.
      await db.query(
        `UPDATE usuarios SET password_hash = ? WHERE id = ?`,
        [passwordHashAnterior, id]
      );
      throw errorAcceso;
    }

    return res.json({ mensaje: 'Contraseña actualizada' });
  } catch (err) {
    console.error('Error al cambiar contraseña:', err.message);
    return res.status(500).json({
      error: 'No se pudo sincronizar la contraseña. No cierres la sesión actual y volvé a intentar.'
    });
  }
}


// ELIMINAR USUARIO
async function eliminar(req, res) {
  try {
    const db = req.db;
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    if (id === Number(req.usuario && req.usuario.id)) {
      return res.status(400).json({ error: 'No podés eliminar tu propio usuario' });
    }

    const [usuarios] = await db.query(
      `SELECT u.id, u.nombre_usuario, r.nombre AS rol
       FROM usuarios u
       LEFT JOIN roles r ON r.id = u.rol_id
       WHERE u.id = ?
       LIMIT 1`,
      [id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = usuarios[0];

    if (String(usuario.rol || '').toLowerCase() === 'admin') {
      const [admins] = await db.query(
        `SELECT COUNT(*) AS cantidad
         FROM usuarios u
         JOIN roles r ON r.id = u.rol_id
         WHERE u.activo = TRUE AND LOWER(r.nombre) = 'admin'`
      );
      if (Number(admins[0].cantidad) <= 1) {
        return res.status(400).json({
          error: 'No podés eliminar al último administrador activo. Desactivá otro usuario o creá otro administrador primero.'
        });
      }
    }

    try {
      const [result] = await db.query(
        `DELETE FROM usuarios WHERE id = ?`,
        [id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      return res.json({ mensaje: 'Usuario eliminado' });
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
        return res.status(409).json({
          error: 'No se puede eliminar este usuario porque tiene registros relacionados. Desactivalo en su lugar.'
        });
      }
      throw err;
    }
  } catch (err) {
    console.error('Error al eliminar usuario:', err.message);
    return res.status(500).json({ error: 'Error al eliminar usuario' });
  }
}

module.exports = {
  listar,
  opciones,
  crear,
  actualizar,
  cambiarEstado,
  cambiarPassword,
  eliminar
};