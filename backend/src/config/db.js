const mysql = require('mysql2/promise');

require('dotenv').config();


// =========================================================
// CONFIGURACIÓN BASE
// =========================================================

const configuracionBase = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
};


// =========================================================
// BASE MAESTRA YC SYSTEM
// =========================================================

const masterPool = mysql.createPool({
  ...configuracionBase,
  database: process.env.MASTER_DB_NAME || 'yc_master',
});


// =========================================================
// POOLS DE EMPRESAS
// =========================================================

// Guardamos los pools ya creados para no abrir uno nuevo
// en cada petición.
const poolsEmpresas = new Map();


function validarNombreBase(dbName) {
  // Seguridad: solamente permitimos nombres de bases
  // con letras, números y guion bajo.
  return /^[a-zA-Z0-9_]+$/.test(dbName);
}


function getEmpresaPool(dbName) {
  if (!dbName) {
    throw new Error(
      'No se indicó la base de datos de la empresa'
    );
  }

  if (!validarNombreBase(dbName)) {
    throw new Error(
      'Nombre de base de datos inválido'
    );
  }

  // Si ya existe el pool, reutilizamos el mismo.
  if (poolsEmpresas.has(dbName)) {
    return poolsEmpresas.get(dbName);
  }

  const nuevoPool = mysql.createPool({
    ...configuracionBase,
    database: dbName,
  });

  poolsEmpresas.set(
    dbName,
    nuevoPool
  );

  return nuevoPool;
}


// =========================================================
// OBTENER EMPRESA DESDE YC_MASTER
// =========================================================

async function obtenerEmpresaPorId(empresaId) {
  const [rows] = await masterPool.query(
    `SELECT
       id,
       codigo,
       razon_social,
       nombre_fantasia,
       db_name,
       estado
     FROM empresas
     WHERE id = ?
     LIMIT 1`,
    [empresaId]
  );

  return rows[0] || null;
}


// =========================================================
// OBTENER POOL DIRECTAMENTE DESDE EMPRESA_ID
// =========================================================

async function getEmpresaPoolPorId(empresaId) {
  const empresa =
    await obtenerEmpresaPorId(empresaId);

  if (!empresa) {
    throw new Error(
      'Empresa no encontrada'
    );
  }

  if (empresa.estado !== 'activa') {
    throw new Error(
      `Empresa en estado "${empresa.estado}"`
    );
  }

  return {
    empresa,
    pool: getEmpresaPool(
      empresa.db_name
    ),
  };
}


const legacyPool = mysql.createPool({
  ...configuracionBase,
  database: process.env.DB_NAME || 'erp_db',
});

// =========================================================
// EXPORTACIONES
// =========================================================

module.exports = legacyPool;

module.exports.masterPool = masterPool;
module.exports.getEmpresaPool = getEmpresaPool;
module.exports.getEmpresaPoolPorId = getEmpresaPoolPorId;
module.exports.obtenerEmpresaPorId = obtenerEmpresaPorId;