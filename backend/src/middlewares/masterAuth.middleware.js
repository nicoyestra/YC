const jwt = require('jsonwebtoken');

function verificarMaster(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token Master requerido',
      });
    }

    const token = authHeader.split(' ')[1];

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (payload.tipo !== 'master') {
      return res.status(403).json({
        error: 'Acceso exclusivo para usuarios Master',
      });
    }

    req.master = payload;

    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Token Master inválido o vencido',
    });
  }
}

function permitirRolesMaster(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.master) {
      return res.status(401).json({
        error: 'Usuario Master no autenticado',
      });
    }

    if (!rolesPermitidos.includes(req.master.rol)) {
      return res.status(403).json({
        error: 'No tenés permisos para realizar esta acción',
      });
    }

    next();
  };
}

module.exports = {
  verificarMaster,
  permitirRolesMaster,
};