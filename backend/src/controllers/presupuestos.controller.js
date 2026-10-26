
const { masterPool } = require('../config/db');

// El token identifica al usuario central; presupuestos.usuario_id referencia
// el ID local de usuarios dentro de la base de datos de cada empresa.
async function obtenerUsuarioLocalId(conexion, usuario) {
  let email = usuario?.email || null;
  const empresaId = usuario?.empresa_id;
  if (!email && usuario?.id && empresaId) {
    const [accesos] = await masterPool.query(
      'SELECT email FROM accesos WHERE id = ? AND empresa_id = ? LIMIT 1',
      [usuario.id, empresaId]
    );
    if (accesos[0]?.email) email = accesos[0].email;
  }
  if (email) {
    const [rows] = await conexion.query(
      'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) AND activo = 1 LIMIT 1',
      [email]
    );
    if (rows[0]) return rows[0].id;
  }
  const nombre = usuario?.nombre || usuario?.nombre_usuario;
  if (nombre) {
    const [rows] = await conexion.query(
      'SELECT id FROM usuarios WHERE LOWER(nombre_usuario) = LOWER(?) AND activo = 1 LIMIT 1',
      [nombre]
    );
    if (rows[0]) return rows[0].id;
  }
  const error = new Error('No se encontró un usuario local activo para registrar el presupuesto. Revisá que el usuario exista en esta empresa.');
  error.status = 400;
  throw error;
}

const ESTADOS = [
  'borrador',
  'enviado',
  'aceptado',
  'rechazado',
  'vencido'
];


function numero(valor, minimo = 0) {
  const resultado = Number(valor);

  return Number.isFinite(resultado) &&
    resultado >= minimo
    ? resultado
    : null;
}


function redondear(valor) {
  return Math.round(
    (Number(valor) + Number.EPSILON) * 100
  ) / 100;
}


async function generarNumero(conexion) {
  const [rows] = await conexion.query(
    `SELECT numero
     FROM presupuestos
     WHERE numero LIKE 'PRES-%'
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`
  );

  let siguiente = 1;

  if (rows[0]) {
    const ultimo = parseInt(
      String(rows[0].numero).replace(
        'PRES-',
        ''
      ),
      10
    );

    if (!Number.isNaN(ultimo)) {
      siguiente = ultimo + 1;
    }
  }

  return `PRES-${String(siguiente).padStart(6, '0')}`;
}


function calcularItems(items) {
  let subtotal = 0;
  let descuentoTotal = 0;
  let impuestos = 0;
  let total = 0;

  const detalle = items.map(
    (item, indice) => {
      const productoId = numero(
        item.producto_id,
        1
      );

      const cantidad = numero(
        item.cantidad,
        0.001
      );

      const precioUnitario = numero(
        item.precio_unitario,
        0
      );

      const descuentoPorcentaje = numero(
        item.descuento_porcentaje ?? 0,
        0
      );

      const ivaPorcentaje = numero(
        item.iva_porcentaje ?? 21,
        0
      );

      if (
        !productoId ||
        cantidad === null ||
        precioUnitario === null
      ) {
        const error = new Error(
          `Revisá el producto, cantidad y precio del ítem ${indice + 1}`
        );

        error.status = 400;
        throw error;
      }

      if (
        descuentoPorcentaje === null ||
        descuentoPorcentaje > 100
      ) {
        const error = new Error(
          `El descuento del ítem ${indice + 1} debe estar entre 0 y 100`
        );

        error.status = 400;
        throw error;
      }

      if (
        ivaPorcentaje === null ||
        ivaPorcentaje > 100
      ) {
        const error = new Error(
          `El IVA del ítem ${indice + 1} no es válido`
        );

        error.status = 400;
        throw error;
      }

      const subtotalBruto = redondear(
        cantidad * precioUnitario
      );

      const descuentoImporte = redondear(
        subtotalBruto *
        descuentoPorcentaje /
        100
      );

      const subtotalNeto = redondear(
        subtotalBruto -
        descuentoImporte
      );

      const impuestoItem = redondear(
        subtotalNeto *
        ivaPorcentaje /
        100
      );

      const totalItem = redondear(
        subtotalNeto +
        impuestoItem
      );

      subtotal += subtotalBruto;
      descuentoTotal += descuentoImporte;
      impuestos += impuestoItem;
      total += totalItem;

      return {
        producto_id: productoId,
        cantidad,
        precio_unitario: precioUnitario,
        descuento_porcentaje:
          descuentoPorcentaje,
        iva_porcentaje:
          ivaPorcentaje,
        subtotal_bruto:
          subtotalBruto,
        descuento_importe:
          descuentoImporte,
        subtotal_neto:
          subtotalNeto,
        impuestos:
          impuestoItem,
        total:
          totalItem
      };
    }
  );

  return {
    detalle,
    subtotal:
      redondear(subtotal),
    descuento_total:
      redondear(descuentoTotal),
    impuestos:
      redondear(impuestos),
    total:
      redondear(total)
  };
}


// LISTAR PRESUPUESTOS
async function listar(req, res) {
  try {
    const db = req.db;

    const {
      estado,
      cliente_id,
      desde,
      hasta,
      buscar
    } = req.query;

    let sql = `
      SELECT
        p.*,
        c.nombre AS cliente_nombre,
        c.cuit_dni,
        u.nombre_usuario AS usuario_nombre
      FROM presupuestos p
      JOIN clientes c
        ON c.id = p.cliente_id
      LEFT JOIN usuarios u
        ON u.id = p.usuario_id
      WHERE 1=1
    `;

    const params = [];

    if (estado) {
      sql += ' AND p.estado = ?';
      params.push(estado);
    }

    if (cliente_id) {
      sql += ' AND p.cliente_id = ?';
      params.push(cliente_id);
    }

    if (desde) {
      sql += ' AND p.fecha >= ?';
      params.push(desde);
    }

    if (hasta) {
      sql += ' AND p.fecha <= ?';
      params.push(hasta);
    }

    if (buscar) {
      sql += `
        AND (
          p.numero LIKE ?
          OR c.nombre LIKE ?
          OR c.cuit_dni LIKE ?
        )
      `;

      const like = `%${buscar}%`;

      params.push(
        like,
        like,
        like
      );
    }

    sql += ' ORDER BY p.created_at DESC';

    const [rows] = await db.query(
      sql,
      params
    );

    res.json(rows);

  } catch (err) {
    console.error(
      'Error al listar presupuestos:',
      err
    );

    res.status(500).json({
      error:
        'Error al listar presupuestos'
    });
  }
}


// OBTENER PRESUPUESTO
async function obtener(req, res) {
  try {
    const db = req.db;

    const [presupuestos] =
      await db.query(
        `SELECT
           p.*,
           c.nombre AS cliente_nombre,
           c.cuit_dni,
           c.email,
           c.telefono,
           c.direccion,
           c.codigo_postal
         FROM presupuestos p
         JOIN clientes c
           ON c.id = p.cliente_id
         WHERE p.id = ?`,
        [req.params.id]
      );

    if (!presupuestos[0]) {
      return res.status(404).json({
        error:
          'Presupuesto no encontrado'
      });
    }

    const [detalle] =
      await db.query(
        `SELECT
           d.*,
           pr.sku,
           pr.codigo_barras,
           pr.nombre AS producto_nombre,
           pr.descripcion
         FROM detalle_presupuestos d
         JOIN productos pr
           ON pr.id = d.producto_id
         WHERE d.presupuesto_id = ?
         ORDER BY d.id`,
        [req.params.id]
      );

    let empresa = null;
    try {
      const empresaId = req.usuario?.empresa_id;
      if (empresaId) {
        const [empresas] = await masterPool.query(
          `SELECT razon_social, nombre_fantasia, cuit, email, telefono
           FROM empresas WHERE id = ? LIMIT 1`,
          [empresaId]
        );
        empresa = empresas[0] || null;
      }
    } catch (empresaError) {
      console.warn('No se pudieron cargar los datos comerciales de la empresa para imprimir el presupuesto:', empresaError.message);
    }

    res.json({
      ...presupuestos[0],
      detalle,
      empresa
    });

  } catch (err) {
    console.error(
      'Error al obtener presupuesto:',
      err
    );

    res.status(500).json({
      error:
        'Error al obtener el presupuesto'
    });
  }
}


// CREAR PRESUPUESTO
async function crear(req, res) {
  const db = req.db;
  const conexion =
    await db.getConnection();

  let transaccionIniciada = false;

  try {
    const {
      cliente_id,
      fecha,
      valido_hasta,
      observaciones,
      items
    } = req.body;

    if (
      !cliente_id ||
      !fecha ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error:
          'Cliente, fecha y al menos un ítem son obligatorios'
      });
    }

    if (
      valido_hasta &&
      valido_hasta < fecha
    ) {
      return res.status(400).json({
        error:
          'La fecha de validez no puede ser anterior a la fecha del presupuesto'
      });
    }

    const calculos =
      calcularItems(items);

    await conexion.beginTransaction();
    transaccionIniciada = true;

    const numeroPresupuesto =
      await generarNumero(conexion);

    const [resultado] =
      await conexion.query(
        `INSERT INTO presupuestos
         (
           numero,
           cliente_id,
           fecha,
           valido_hasta,
           estado,
           observaciones,
           subtotal,
           descuento_total,
           impuestos,
           total,
           usuario_id
         )
         VALUES (
           ?, ?, ?, ?, 'borrador',
           ?, ?, ?, ?, ?, ?
         )`,
        [
          numeroPresupuesto,
          Number(cliente_id),
          fecha,
          valido_hasta || null,
          observaciones?.trim() || null,
          calculos.subtotal,
          calculos.descuento_total,
          calculos.impuestos,
          calculos.total,
          await obtenerUsuarioLocalId(conexion, req.usuario)
        ]
      );

    for (
      const item of calculos.detalle
    ) {
      await conexion.query(
        `INSERT INTO detalle_presupuestos
         (
           presupuesto_id,
           producto_id,
           cantidad,
           precio_unitario,
           descuento_porcentaje,
           iva_porcentaje,
           subtotal_bruto,
           descuento_importe,
           subtotal_neto,
           impuestos,
           total
         )
         VALUES (
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?
         )`,
        [
          resultado.insertId,
          item.producto_id,
          item.cantidad,
          item.precio_unitario,
          item.descuento_porcentaje,
          item.iva_porcentaje,
          item.subtotal_bruto,
          item.descuento_importe,
          item.subtotal_neto,
          item.impuestos,
          item.total
        ]
      );
    }

    await conexion.commit();
    transaccionIniciada = false;

    res.status(201).json({
      id: resultado.insertId,
      numero: numeroPresupuesto,
      estado: 'borrador',
      ...calculos
    });

  } catch (err) {
    if (transaccionIniciada) {
      try {
        await conexion.rollback();
      } catch (rollbackError) {
        console.error(
          'Error al revertir presupuesto:',
          rollbackError
        );
      }
    }

    console.error(
      'Error al crear presupuesto:',
      err
    );

    res
      .status(err.status || 500)
      .json({
        error:
          err.message ||
          'Error al crear el presupuesto'
      });

  } finally {
    conexion.release();
  }
}


// ACTUALIZAR PRESUPUESTO
async function actualizar(req, res) {
  const db = req.db;
  const conexion =
    await db.getConnection();

  let transaccionIniciada = false;

  try {
    const presupuestoId =
      Number(req.params.id);

    const {
      cliente_id,
      fecha,
      valido_hasta,
      observaciones,
      items
    } = req.body;

    if (
      !cliente_id ||
      !fecha ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error:
          'Cliente, fecha y al menos un ítem son obligatorios'
      });
    }

    if (
      valido_hasta &&
      valido_hasta < fecha
    ) {
      return res.status(400).json({
        error:
          'La fecha de validez no puede ser anterior a la fecha del presupuesto'
      });
    }

    const calculos =
      calcularItems(items);

    await conexion.beginTransaction();
    transaccionIniciada = true;

    const [existentes] =
      await conexion.query(
        `SELECT
           estado,
           orden_venta_id
         FROM presupuestos
         WHERE id = ?
         FOR UPDATE`,
        [presupuestoId]
      );

    if (!existentes[0]) {
      await conexion.rollback();
      transaccionIniciada = false;

      return res.status(404).json({
        error:
          'Presupuesto no encontrado'
      });
    }

    if (
      existentes[0].estado !==
      'borrador'
    ) {
      await conexion.rollback();
      transaccionIniciada = false;

      return res.status(400).json({
        error:
          'Solo se pueden editar presupuestos en borrador'
      });
    }

    if (
      existentes[0].orden_venta_id
    ) {
      await conexion.rollback();
      transaccionIniciada = false;

      return res.status(400).json({
        error:
          'El presupuesto ya fue vinculado a una orden de venta'
      });
    }

    await conexion.query(
      `UPDATE presupuestos
       SET
         cliente_id = ?,
         fecha = ?,
         valido_hasta = ?,
         observaciones = ?,
         subtotal = ?,
         descuento_total = ?,
         impuestos = ?,
         total = ?
       WHERE id = ?`,
      [
        Number(cliente_id),
        fecha,
        valido_hasta || null,
        observaciones?.trim() || null,
        calculos.subtotal,
        calculos.descuento_total,
        calculos.impuestos,
        calculos.total,
        presupuestoId
      ]
    );

    await conexion.query(
      `DELETE FROM detalle_presupuestos
       WHERE presupuesto_id = ?`,
      [presupuestoId]
    );

    for (
      const item of calculos.detalle
    ) {
      await conexion.query(
        `INSERT INTO detalle_presupuestos
         (
           presupuesto_id,
           producto_id,
           cantidad,
           precio_unitario,
           descuento_porcentaje,
           iva_porcentaje,
           subtotal_bruto,
           descuento_importe,
           subtotal_neto,
           impuestos,
           total
         )
         VALUES (
           ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?
         )`,
        [
          presupuestoId,
          item.producto_id,
          item.cantidad,
          item.precio_unitario,
          item.descuento_porcentaje,
          item.iva_porcentaje,
          item.subtotal_bruto,
          item.descuento_importe,
          item.subtotal_neto,
          item.impuestos,
          item.total
        ]
      );
    }

    await conexion.commit();
    transaccionIniciada = false;

    res.json({
      mensaje:
        'Presupuesto actualizado',
      ...calculos
    });

  } catch (err) {
    if (transaccionIniciada) {
      try {
        await conexion.rollback();
      } catch (rollbackError) {
        console.error(
          'Error al revertir presupuesto:',
          rollbackError
        );
      }
    }

    console.error(
      'Error al actualizar presupuesto:',
      err
    );

    res
      .status(err.status || 500)
      .json({
        error:
          err.message ||
          'Error al actualizar el presupuesto'
      });

  } finally {
    conexion.release();
  }
}


// CAMBIAR ESTADO
async function cambiarEstado(req, res) {
  try {
    const db = req.db;

    const {
      estado
    } = req.body;

    if (
      !ESTADOS.includes(estado)
    ) {
      return res.status(400).json({
        error:
          'Estado de presupuesto inválido'
      });
    }

    const [resultado] =
      await db.query(
        `UPDATE presupuestos
         SET estado = ?
         WHERE id = ?`,
        [
          estado,
          req.params.id
        ]
      );

    if (
      resultado.affectedRows === 0
    ) {
      return res.status(404).json({
        error:
          'Presupuesto no encontrado'
      });
    }

    res.json({
      mensaje:
        'Estado actualizado',
      estado
    });

  } catch (err) {
    console.error(
      'Error al cambiar estado del presupuesto:',
      err
    );

    res.status(500).json({
      error:
        'Error al cambiar el estado'
    });
  }
}


module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado
};