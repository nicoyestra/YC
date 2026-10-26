const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  masterPool,
  getEmpresaPoolPorId,
} = require('../config/db');
const { marcarEnLinea, marcarDesconectado } = require('../services/onlineSessions');


// =========================================================
// LOGIN MULTIEMPRESA
// =========================================================

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son requeridos'
      });
    }

    // -----------------------------------------------------
    // 1. Buscar el acceso en YC MASTER
    // -----------------------------------------------------

    const [rows] = await masterPool.query(
      `SELECT
         a.id,
         a.empresa_id,
         a.nombre_usuario,
         a.email,
         a.password_hash,
         a.rol,
         a.activo,

         e.codigo AS empresa_codigo,
         e.razon_social,
         e.nombre_fantasia,
         e.estado AS empresa_estado

       FROM accesos a

       JOIN empresas e
         ON e.id = a.empresa_id

       WHERE a.email = ?

       LIMIT 1`,
      [email]
    );

    const usuario = rows[0];

    if (!usuario || !usuario.activo) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    // -----------------------------------------------------
    // 2. Verificar contraseña
    // -----------------------------------------------------

    const passwordOk = await bcrypt.compare(
      password,
      usuario.password_hash
    );

    if (!passwordOk) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    // -----------------------------------------------------
    // 3. Verificar estado de la empresa
    // -----------------------------------------------------

    if (usuario.empresa_estado !== 'activa') {
      return res.status(403).json({
        error:
          'La empresa se encuentra suspendida o bloqueada. Contactá al administrador de YC System.'
      });
    }

    // -----------------------------------------------------
    // 4. Verificar licencia
    // -----------------------------------------------------

    const [licencias] = await masterPool.query(
      `SELECT
         id,
         plan,
         fecha_inicio,
         fecha_vencimiento,
         activa,
         limite_usuarios

       FROM licencias

       WHERE empresa_id = ?
         AND activa = 1
         AND fecha_inicio <= CURDATE()
         AND fecha_vencimiento >= CURDATE()

       ORDER BY fecha_vencimiento DESC

       LIMIT 1`,
      [usuario.empresa_id]
    );

    const licencia = licencias[0];

    if (!licencia) {
      return res.status(403).json({
        error:
          'La licencia de YC System está vencida o inactiva. Contactá al administrador.'
      });
    }

    // -----------------------------------------------------
    // 5. Verificar que exista y sea accesible
    //    la base correspondiente a la empresa
    // -----------------------------------------------------

    try {
      const { pool } = await getEmpresaPoolPorId(
        usuario.empresa_id
      );

      await pool.query('SELECT 1');
    } catch (errorConexion) {
      console.error(
        'Error accediendo a base de empresa:',
        errorConexion
      );

      return res.status(500).json({
        error:
          'No se pudo acceder a la base de datos de la empresa'
      });
    }

    // -----------------------------------------------------
    // 6. Generar JWT
    //
    // IMPORTANTE:
    // NO enviamos db_name.
    // Solamente empresa_id.
    // -----------------------------------------------------

    const token = jwt.sign(
      {
        id: usuario.id,
        empresa_id: usuario.empresa_id,
        rol: usuario.rol,
        nombre: usuario.nombre_usuario,
        email: usuario.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn:
          process.env.JWT_EXPIRES_IN || '8h'
      }
    );

    // -----------------------------------------------------
    // 7. Registrar último login en master
    // -----------------------------------------------------

    await masterPool.query(
      `UPDATE accesos
       SET ultimo_login = NOW()
       WHERE id = ?`,
      [usuario.id]
    );

    // La pantalla Usuarios lee el último ingreso desde la base de la empresa.
    // Sin esta actualización, el login funcionaba pero figuraba como "Nunca".
    try {
      const { pool } = await getEmpresaPoolPorId(usuario.empresa_id);
      await pool.query(
        `UPDATE usuarios SET ultimo_login = NOW() WHERE LOWER(email) = LOWER(?) LIMIT 1`,
        [usuario.email]
      );
    } catch (errorUltimoIngreso) {
      // No invalidar un inicio de sesión correcto por un fallo secundario de auditoría.
      console.error('No se pudo actualizar el último ingreso en la base de empresa:', errorUltimoIngreso.message);
    }

    marcarEnLinea(usuario.empresa_id, usuario.email);

    // -----------------------------------------------------
    // 8. Respuesta
    // -----------------------------------------------------

    res.json({
      token,

      usuario: {
        id: usuario.id,
        nombre_usuario: usuario.nombre_usuario,
        email: usuario.email,
        rol: usuario.rol,
        empresa_id: usuario.empresa_id
      },

      empresa: {
        id: usuario.empresa_id,
        codigo: usuario.empresa_codigo,
        razon_social: usuario.razon_social,
        nombre:
          usuario.nombre_fantasia ||
          usuario.razon_social
      },

      licencia: {
        plan: licencia.plan,
        fecha_vencimiento:
          licencia.fecha_vencimiento
      }
    });

  } catch (err) {
    console.error('Error login:', err);

    res.status(500).json({
      error: 'Error al iniciar sesión'
    });
  }
}


// =========================================================
// REGISTRAR USUARIO
//
// POR AHORA LO DEJAMOS USANDO LA BASE DE LA EMPRESA.
// Más adelante el Admin Master va a gestionar el alta
// inicial de cada empresa.
// =========================================================

async function registrar(req, res) {
  try {
    const {
      nombre_usuario,
      email,
      password,
      rol_id,
      empleado_id
    } = req.body;

    if (
      !nombre_usuario ||
      !email ||
      !password ||
      !rol_id
    ) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios'
      });
    }

    if (!req.usuario?.empresa_id) {
      return res.status(400).json({
        error: 'No se pudo identificar la empresa'
      });
    }

    const {
      pool,
      empresa
    } = await getEmpresaPoolPorId(
      req.usuario.empresa_id
    );

    const password_hash =
      await bcrypt.hash(password, 10);

    const [rolRows] = await pool.query(
      `SELECT nombre
       FROM roles
       WHERE id = ?
       LIMIT 1`,
      [rol_id]
    );

    if (!rolRows[0]) {
      return res.status(400).json({
        error: 'Rol inválido'
      });
    }

    const rolNombre = rolRows[0].nombre;

    // -----------------------------------------------------
    // Crear usuario en la base propia de la empresa
    // -----------------------------------------------------

    const [result] = await pool.query(
      `INSERT INTO usuarios
       (
         nombre_usuario,
         email,
         password_hash,
         rol_id,
         empleado_id
       )
       VALUES (?, ?, ?, ?, ?)`,
      [
        nombre_usuario,
        email,
        password_hash,
        rol_id,
        empleado_id || null
      ]
    );

    // -----------------------------------------------------
    // Crear acceso central en YC MASTER
    // -----------------------------------------------------

    await masterPool.query(
      `INSERT INTO accesos
       (
         empresa_id,
         nombre_usuario,
         email,
         password_hash,
         rol,
         activo
       )
       VALUES (?, ?, ?, ?, ?, 1)`,
      [
        empresa.id,
        nombre_usuario,
        email,
        password_hash,
        rolNombre
      ]
    );

    res.status(201).json({
      id: result.insertId,
      nombre_usuario,
      email,
      empresa_id: empresa.id
    });

  } catch (err) {
    console.error('Error registrando usuario:', err);

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'El usuario o email ya existe'
      });
    }

    res.status(500).json({
      error: 'Error al registrar usuario'
    });
  }
}


async function heartbeat(req, res) {
  const empresaId = Number(req.usuario?.empresa_id);
  const email = String(req.usuario?.email || '').trim().toLowerCase();
  if (!empresaId || !email) {
    return res.status(401).json({ error: 'La sesión no contiene el email. Cerrá sesión y volvé a ingresar.' });
  }
  marcarEnLinea(empresaId, email);
  return res.json({ ok: true, en_linea: true, servidor_hora: new Date().toISOString() });
}

async function logout(req, res) {
  const empresaId = Number(req.usuario?.empresa_id);
  const email = String(req.usuario?.email || '').trim().toLowerCase();
  marcarDesconectado(empresaId, email);
  return res.json({ ok: true });
}

module.exports = {
  login,
  registrar,
  heartbeat,
  logout
};