const jwt = require('jsonwebtoken');

const {
  getEmpresaPoolPorId,
} = require('../config/db');


// =========================================================
// VERIFICAR TOKEN + RESOLVER EMPRESA
// =========================================================

async function verificarToken(req, res, next) {
  const header = req.headers['authorization'];

  const token =
    header &&
    header.startsWith('Bearer ')
      ? header.split(' ')[1]
      : null;

  if (!token) {
    return res.status(401).json({
      error: 'Token no proporcionado'
    });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // -----------------------------------------------------
    // Guardamos el payload del usuario
    // -----------------------------------------------------

    req.usuario = payload;

    // -----------------------------------------------------
    // Para las rutas normales del ERP necesitamos empresa_id
    // -----------------------------------------------------

    if (!payload.empresa_id) {
      return res.status(403).json({
        error:
          'El token no contiene una empresa asociada'
      });
    }

    // -----------------------------------------------------
    // Resolver empresa y base correspondiente
    // -----------------------------------------------------

    const {
      empresa,
      pool
    } = await getEmpresaPoolPorId(
      payload.empresa_id
    );

    // -----------------------------------------------------
    // Dejamos disponibles empresa y conexión
    // para todos los controllers siguientes
    // -----------------------------------------------------

    req.empresa = empresa;
    req.db = pool;

    next();

  } catch (err) {
    console.error(
      'Error verificando token/empresa:',
      err
    );

    // JWT vencido
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({
        error: 'Token expirado'
      });
    }

    // JWT inválido
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({
        error: 'Token inválido'
      });
    }

    // Empresa suspendida, inexistente o base no accesible
    return res.status(403).json({
      error:
        err.message ||
        'No se pudo validar el acceso a la empresa'
    });
  }
}


// =========================================================
// CONTROL DE ROLES
// =========================================================

function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        error: 'Usuario no autenticado'
      });
    }

    if (
      !rolesPermitidos.includes(
        req.usuario.rol
      )
    ) {
      return res.status(403).json({
        error:
          'No tenés permisos para esta acción'
      });
    }

    next();
  };
}


// =========================================================
// EXPORTACIONES
// =========================================================

module.exports = {
  verificarToken,
  permitirRoles
};