const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const { masterPool } = require('../config/db');

// =========================================================
// UTILIDADES
// =========================================================

function limpiarTextoBase(valor = '') {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 60);
}

function generarNombreBase(codigo) {
  const limpio = limpiarTextoBase(codigo);

  if (!limpio) {
    throw new Error('No se pudo generar un nombre válido para la base de datos');
  }

  return `yc_${limpio}`;
}

function generarPasswordTemporal() {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function bloque(cantidad) {
    let resultado = '';

    for (let i = 0; i < cantidad; i++) {
      const indice = crypto.randomInt(0, caracteres.length);
      resultado += caracteres[indice];
    }

    return resultado;
  }

  return `YC-${bloque(4)}-${bloque(4)}`;
}

function fechaHoy() {
  return new Date().toISOString().slice(0, 10);
}

function fechaMasDias(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);

  return fecha.toISOString().slice(0, 10);
}

function crearConfiguracionMysql(database = undefined) {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    multipleStatements: true,
  };
}

// =========================================================
// LISTAR EMPRESAS
// =========================================================

async function listarEmpresas(req, res) {
  try {
    const [rows] = await masterPool.query(`
      SELECT
        e.id,
        e.codigo,
        e.razon_social,
        e.nombre_fantasia,
        e.db_name,
        e.estado,

        l.id AS licencia_id,
        l.plan AS licencia_plan,
        l.activa AS licencia_activa,
        l.fecha_inicio,
        l.fecha_vencimiento,
        l.limite_usuarios

      FROM empresas e

      LEFT JOIN licencias l
        ON l.empresa_id = e.id

      ORDER BY e.id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error listando empresas Master:', error);

    res.status(500).json({
      error: 'Error al listar empresas',
    });
  }
}

// =========================================================
// RESUMEN MASTER
// =========================================================

async function resumenMaster(req, res) {
  try {
    const [[empresas]] = await masterPool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(estado = 'activa') AS activas
      FROM empresas
    `);

    const [[licencias]] = await masterPool.query(`
      SELECT COUNT(*) AS total
      FROM licencias
    `);

    const [[masters]] = await masterPool.query(`
      SELECT COUNT(*) AS total
      FROM usuarios_master
      WHERE activo = 1
    `);

    res.json({
      empresas: Number(empresas.total || 0),
      empresas_activas: Number(empresas.activas || 0),
      licencias: Number(licencias.total || 0),
      usuarios_master: Number(masters.total || 0),
    });
  } catch (error) {
    console.error('Error obteniendo resumen Master:', error);

    res.status(500).json({
      error: 'Error al obtener resumen Master',
    });
  }
}

// =========================================================
// CREAR EMPRESA
// =========================================================

async function crearEmpresa(req, res) {
  let conexionServidor = null;
  let conexionEmpresa = null;
  let conexionMaster = null;

  let dbName = null;
  let baseCreada = false;

  try {
    const {
      codigo,
      razon_social,
      nombre_fantasia,
      cuit,
      email,
      telefono,

      plan = 'demo',
      fecha_inicio,
      fecha_vencimiento,
      limite_usuarios,

      admin_nombre_usuario,
      admin_email,
    } = req.body;

    // -----------------------------------------------------
    // VALIDACIONES
    // -----------------------------------------------------

    if (!codigo || !String(codigo).trim()) {
      return res.status(400).json({
        error: 'El código de empresa es obligatorio',
      });
    }

    if (!razon_social || !String(razon_social).trim()) {
      return res.status(400).json({
        error: 'La razón social es obligatoria',
      });
    }

    if (!admin_nombre_usuario || !String(admin_nombre_usuario).trim()) {
      return res.status(400).json({
        error: 'El nombre del usuario administrador es obligatorio',
      });
    }

    if (!admin_email || !String(admin_email).trim()) {
      return res.status(400).json({
        error: 'El email del administrador es obligatorio',
      });
    }

    const planesPermitidos = [
      'demo',
      'basico',
      'profesional',
      'enterprise',
    ];

    if (!planesPermitidos.includes(plan)) {
      return res.status(400).json({
        error: 'El plan indicado no es válido',
      });
    }

    dbName = generarNombreBase(codigo);

    const fechaInicioFinal = fecha_inicio || fechaHoy();
    const fechaVencimientoFinal =
      fecha_vencimiento || fechaMasDias(30);

    // -----------------------------------------------------
    // COMPROBAR DUPLICADOS EN MASTER
    // -----------------------------------------------------

    const [empresaExistente] = await masterPool.query(
      `
        SELECT id
        FROM empresas
        WHERE codigo = ?
           OR db_name = ?
        LIMIT 1
      `,
      [String(codigo).trim(), dbName]
    );

    if (empresaExistente.length > 0) {
      return res.status(409).json({
        error: 'Ya existe una empresa con ese código',
      });
    }

    const [accesoExistente] = await masterPool.query(
      `
        SELECT id
        FROM accesos
        WHERE email = ?
        LIMIT 1
      `,
      [String(admin_email).trim().toLowerCase()]
    );

    if (accesoExistente.length > 0) {
      return res.status(409).json({
        error: 'Ese email ya está registrado en YC System',
      });
    }

    // -----------------------------------------------------
    // CONTRASEÑA TEMPORAL
    // -----------------------------------------------------

    const passwordTemporal = generarPasswordTemporal();

    const passwordHash = await bcrypt.hash(
      passwordTemporal,
      10
    );

    // -----------------------------------------------------
    // LEER TENANT_SCHEMA.SQL
    // -----------------------------------------------------

    const schemaPath = path.join(
      __dirname,
      '../../database/tenant_schema.sql'
    );

    if (!fs.existsSync(schemaPath)) {
      throw new Error(
        `No se encontró tenant_schema.sql en ${schemaPath}`
      );
    }

    const tenantSchema = fs.readFileSync(
      schemaPath,
      'utf8'
    );

    if (!tenantSchema.trim()) {
      throw new Error(
        'tenant_schema.sql está vacío'
      );
    }

    // -----------------------------------------------------
    // CREAR BASE DE DATOS DEL CLIENTE
    // -----------------------------------------------------

    conexionServidor = await mysql.createConnection(
      crearConfiguracionMysql()
    );

    // dbName se genera internamente y ya está sanitizado.
    await conexionServidor.query(
      `CREATE DATABASE \`${dbName}\`
       CHARACTER SET utf8mb4
       COLLATE utf8mb4_unicode_ci`
    );

    baseCreada = true;

    console.log(
      `Base de datos creada: ${dbName}`
    );

    // -----------------------------------------------------
    // CARGAR ESTRUCTURA EN LA NUEVA BASE
    // -----------------------------------------------------

    conexionEmpresa = await mysql.createConnection(
      crearConfiguracionMysql(dbName)
    );

    await conexionEmpresa.query(tenantSchema);

    console.log(
      `Esquema cargado correctamente en ${dbName}`
    );

    // -----------------------------------------------------
    // BUSCAR ROL ADMIN DE LA NUEVA EMPRESA
    // -----------------------------------------------------

    const [roles] = await conexionEmpresa.query(
      `
        SELECT id
        FROM roles
        WHERE nombre = 'admin'
        LIMIT 1
      `
    );

    if (!roles.length) {
      throw new Error(
        'No se encontró el rol admin en la nueva base'
      );
    }

    const rolAdminId = roles[0].id;

    // -----------------------------------------------------
    // CREAR ADMIN EN LA BASE DE LA EMPRESA
    // -----------------------------------------------------

    const [nuevoUsuario] =
      await conexionEmpresa.query(
        `
          INSERT INTO usuarios
          (
            nombre_usuario,
            email,
            password_hash,
            rol_id,
            activo
          )
          VALUES (?, ?, ?, ?, 1)
        `,
        [
          String(admin_nombre_usuario).trim(),
          String(admin_email).trim().toLowerCase(),
          passwordHash,
          rolAdminId,
        ]
      );

    // -----------------------------------------------------
    // REGISTRAR EMPRESA + LICENCIA + ACCESO EN YC_MASTER
    // -----------------------------------------------------

    conexionMaster =
      await masterPool.getConnection();

    await conexionMaster.beginTransaction();

    const [resultadoEmpresa] =
      await conexionMaster.query(
        `
          INSERT INTO empresas
          (
            codigo,
            razon_social,
            nombre_fantasia,
            cuit,
            email,
            telefono,
            db_name,
            estado
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'activa')
        `,
        [
          String(codigo).trim(),
          String(razon_social).trim(),
          nombre_fantasia
            ? String(nombre_fantasia).trim()
            : null,
          cuit
            ? String(cuit).trim()
            : null,
          email
            ? String(email).trim().toLowerCase()
            : null,
          telefono
            ? String(telefono).trim()
            : null,
          dbName,
        ]
      );

    const empresaId =
      resultadoEmpresa.insertId;

    await conexionMaster.query(
      `
        INSERT INTO licencias
        (
          empresa_id,
          plan,
          fecha_inicio,
          fecha_vencimiento,
          activa,
          limite_usuarios
        )
        VALUES (?, ?, ?, ?, 1, ?)
      `,
      [
        empresaId,
        plan,
        fechaInicioFinal,
        fechaVencimientoFinal,
        limite_usuarios
          ? Number(limite_usuarios)
          : null,
      ]
    );

    await conexionMaster.query(
      `
        INSERT INTO accesos
        (
          empresa_id,
          nombre_usuario,
          email,
          password_hash,
          rol,
          activo
        )
        VALUES (?, ?, ?, ?, 'admin', 1)
      `,
      [
        empresaId,
        String(admin_nombre_usuario).trim(),
        String(admin_email).trim().toLowerCase(),
        passwordHash,
      ]
    );

    await conexionMaster.commit();

    // -----------------------------------------------------
    // RESPUESTA
    // -----------------------------------------------------

    return res.status(201).json({
      mensaje:
        'Empresa creada correctamente',

      empresa: {
        id: empresaId,
        codigo: String(codigo).trim(),
        razon_social:
          String(razon_social).trim(),
        nombre_fantasia:
          nombre_fantasia || null,
        db_name: dbName,
        estado: 'activa',
      },

      licencia: {
        plan,
        fecha_inicio: fechaInicioFinal,
        fecha_vencimiento:
          fechaVencimientoFinal,
        limite_usuarios:
          limite_usuarios
            ? Number(limite_usuarios)
            : null,
      },

      administrador: {
        id: nuevoUsuario.insertId,
        nombre_usuario:
          String(admin_nombre_usuario).trim(),
        email:
          String(admin_email)
            .trim()
            .toLowerCase(),

        // Se muestra solamente al momento del alta.
        password_temporal:
          passwordTemporal,
      },
    });
  } catch (error) {
    console.error(
      'Error creando empresa Master:',
      error
    );

    // -----------------------------------------------------
    // ROLLBACK MASTER
    // -----------------------------------------------------

    if (conexionMaster) {
      try {
        await conexionMaster.rollback();
      } catch (rollbackError) {
        console.error(
          'Error haciendo rollback Master:',
          rollbackError
        );
      }
    }

    // -----------------------------------------------------
    // SI ALGO FALLÓ, BORRAMOS LA BASE CREADA
    // PARA NO DEJAR UNA EMPRESA A MEDIAS
    // -----------------------------------------------------

    if (baseCreada && dbName) {
      try {
        if (!conexionServidor) {
          conexionServidor =
            await mysql.createConnection(
              crearConfiguracionMysql()
            );
        }

        await conexionServidor.query(
          `DROP DATABASE IF EXISTS \`${dbName}\``
        );

        console.log(
          `Base incompleta eliminada: ${dbName}`
        );
      } catch (dropError) {
        console.error(
          'No se pudo eliminar la base incompleta:',
          dropError
        );
      }
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error:
          'Ya existe un registro con alguno de esos datos',
      });
    }

    return res.status(500).json({
      error: 'Error al crear la empresa',
      detalle:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  } finally {
    // -----------------------------------------------------
    // CERRAR CONEXIONES
    // -----------------------------------------------------

    if (conexionMaster) {
      conexionMaster.release();
    }

    if (conexionEmpresa) {
      try {
        await conexionEmpresa.end();
      } catch (_) {}
    }

    if (conexionServidor) {
      try {
        await conexionServidor.end();
      } catch (_) {}
    }
  }
}


// =========================================================
// OBTENER DETALLE DE EMPRESA PARA ADMINISTRAR
// =========================================================
async function obtenerEmpresa(req, res) {
  try {
    const empresaId = Number(req.params.id);
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      return res.status(400).json({ error: 'ID de empresa inválido' });
    }

    const [empresas] = await masterPool.query(
      `SELECT id, codigo, razon_social, nombre_fantasia, cuit, email, telefono,
              db_name, estado
       FROM empresas WHERE id = ? LIMIT 1`,
      [empresaId]
    );
    if (!empresas.length) return res.status(404).json({ error: 'No se encontró la empresa' });

    const [licencias] = await masterPool.query(
      `SELECT id, plan, fecha_inicio, fecha_vencimiento, activa, limite_usuarios
       FROM licencias WHERE empresa_id = ? ORDER BY id DESC LIMIT 1`,
      [empresaId]
    );
    const [admins] = await masterPool.query(
      `SELECT id, nombre_usuario, email, activo
       FROM accesos WHERE empresa_id = ? AND rol = 'admin' ORDER BY id ASC LIMIT 1`,
      [empresaId]
    );

    return res.json({ empresa: empresas[0], licencia: licencias[0] || null, administrador: admins[0] || null });
  } catch (error) {
    console.error('Error obteniendo detalle de empresa Master:', error);
    return res.status(500).json({ error: 'No se pudo cargar la empresa' });
  }
}

// =========================================================
// EDITAR DATOS DE EMPRESA Y LICENCIA
// =========================================================
async function actualizarEmpresa(req, res) {
  const empresaId = Number(req.params.id);
  const { razon_social, nombre_fantasia, cuit, email, telefono, estado,
    plan, fecha_inicio, fecha_vencimiento, licencia_activa, limite_usuarios } = req.body;

  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    return res.status(400).json({ error: 'ID de empresa inválido' });
  }
  if (!razon_social || !String(razon_social).trim()) {
    return res.status(400).json({ error: 'La razón social es obligatoria' });
  }
  const estadosPermitidos = ['activa', 'suspendida', 'bloqueada'];
  const planesPermitidos = ['demo', 'basico', 'profesional', 'enterprise'];
  if (!estadosPermitidos.includes(estado)) return res.status(400).json({ error: 'Estado de empresa inválido' });
  if (!planesPermitidos.includes(plan)) return res.status(400).json({ error: 'Plan de licencia inválido' });
  if (!fecha_inicio || !fecha_vencimiento || String(fecha_vencimiento) < String(fecha_inicio)) {
    return res.status(400).json({ error: 'Revisá las fechas de inicio y vencimiento de la licencia' });
  }
  if (![0, 1, '0', '1', true, false].includes(licencia_activa)) {
    return res.status(400).json({ error: 'Estado de licencia inválido' });
  }
  const limite = limite_usuarios === '' || limite_usuarios == null ? null : Number(limite_usuarios);
  if (limite !== null && (!Number.isInteger(limite) || limite < 1)) {
    return res.status(400).json({ error: 'El límite de usuarios debe ser un entero mayor a cero o quedar vacío' });
  }

  let conexion;
  try {
    conexion = await masterPool.getConnection();
    await conexion.beginTransaction();
    const [found] = await conexion.query('SELECT id FROM empresas WHERE id = ? LIMIT 1 FOR UPDATE', [empresaId]);
    if (!found.length) {
      await conexion.rollback();
      return res.status(404).json({ error: 'No se encontró la empresa' });
    }

    await conexion.query(
      `UPDATE empresas SET razon_social = ?, nombre_fantasia = ?, cuit = ?, email = ?, telefono = ?, estado = ? WHERE id = ?`,
      [String(razon_social).trim(), nombre_fantasia ? String(nombre_fantasia).trim() : null,
       cuit ? String(cuit).trim() : null, email ? String(email).trim().toLowerCase() : null,
       telefono ? String(telefono).trim() : null, estado, empresaId]
    );

    const [licencias] = await conexion.query('SELECT id FROM licencias WHERE empresa_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE', [empresaId]);
    if (licencias.length) {
      await conexion.query(
        `UPDATE licencias SET plan = ?, fecha_inicio = ?, fecha_vencimiento = ?, activa = ?, limite_usuarios = ? WHERE id = ?`,
        [plan, fecha_inicio, fecha_vencimiento, licencia_activa ? 1 : 0, limite, licencias[0].id]
      );
    } else {
      await conexion.query(
        `INSERT INTO licencias (empresa_id, plan, fecha_inicio, fecha_vencimiento, activa, limite_usuarios) VALUES (?, ?, ?, ?, ?, ?)`,
        [empresaId, plan, fecha_inicio, fecha_vencimiento, licencia_activa ? 1 : 0, limite]
      );
    }
    await conexion.commit();
    return res.json({ mensaje: 'Empresa y licencia actualizadas correctamente' });
  } catch (error) {
    if (conexion) { try { await conexion.rollback(); } catch (_) {} }
    console.error('Error actualizando empresa Master:', error);
    return res.status(500).json({ error: 'No se pudo guardar la empresa y la licencia' });
  } finally {
    if (conexion) conexion.release();
  }
}

// =========================================================
// RESTABLECER CLAVE DEL ADMINISTRADOR DE UNA EMPRESA
// Actualiza tanto el acceso central como el usuario del tenant.
// =========================================================
async function restablecerPasswordAdmin(req, res) {
  const empresaId = Number(req.params.id);
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    return res.status(400).json({ error: 'ID de empresa inválido' });
  }

  let conexionTenant = null;
  let conexionMaster = null;
  try {
    const [empresas] = await masterPool.query(
      'SELECT id, db_name FROM empresas WHERE id = ? LIMIT 1', [empresaId]
    );
    if (!empresas.length) return res.status(404).json({ error: 'No se encontró la empresa' });
    const [admins] = await masterPool.query(
      `SELECT id, email FROM accesos WHERE empresa_id = ? AND rol = 'admin' ORDER BY id ASC LIMIT 1`, [empresaId]
    );
    if (!admins.length) return res.status(404).json({ error: 'La empresa no tiene un acceso administrador registrado' });

    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordTemporal, 10);
    const dbName = String(empresas[0].db_name || '');
    if (!/^[a-zA-Z0-9_]+$/.test(dbName)) throw new Error('Nombre de base de datos no válido');

    // Actualizar el acceso maestro y el usuario de la base de la empresa.
    conexionMaster = await masterPool.getConnection();
    await conexionMaster.beginTransaction();
    await conexionMaster.query('UPDATE accesos SET password_hash = ?, activo = 1 WHERE id = ?', [passwordHash, admins[0].id]);
    conexionTenant = await mysql.createConnection(crearConfiguracionMysql(dbName));
    const [usuarios] = await conexionTenant.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [admins[0].email]);
    if (!usuarios.length) {
      throw new Error('No se encontró el usuario correspondiente en la base de datos de la empresa');
    }
    await conexionTenant.query('UPDATE usuarios SET password_hash = ?, activo = 1 WHERE id = ?', [passwordHash, usuarios[0].id]);
    await conexionMaster.commit();

    return res.json({ mensaje: 'Clave del administrador restablecida', email: admins[0].email, password_temporal: passwordTemporal });
  } catch (error) {
    if (conexionMaster) { try { await conexionMaster.rollback(); } catch (_) {} }
    console.error('Error restableciendo clave Admin:', error);
    return res.status(500).json({ error: 'No se pudo restablecer la clave del administrador. No se modificó la empresa seleccionada.' });
  } finally {
    if (conexionMaster) conexionMaster.release();
    if (conexionTenant) { try { await conexionTenant.end(); } catch (_) {} }
  }
}

module.exports = {
  listarEmpresas,
  resumenMaster,
  crearEmpresa,
  obtenerEmpresa,
  actualizarEmpresa,
  restablecerPasswordAdmin,
};