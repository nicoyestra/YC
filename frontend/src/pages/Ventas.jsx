import { Fragment, useEffect, useState } from 'react';
import api from '../api/client';
import ProductoAutocomplete from '../components/ProductoAutocomplete';

const ITEM_VACIO = {
  producto_id: '',
  cantidad: '',
  precio_unitario: '',
};

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function Ventas() {
  const [clientes, setClientes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);

  const [mostrarFormOrden, setMostrarFormOrden] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [ordenExpandida, setOrdenExpandida] = useState(null);
  const [detalleOrden, setDetalleOrden] = useState(null);
  const [error, setError] = useState('');
  const [ordenEditandoId, setOrdenEditandoId] = useState(null);
const [disponibilidades, setDisponibilidades] = useState({});

  const [nuevaOrden, setNuevaOrden] = useState({
    cliente_id: '',
    almacen_id: '',
    fecha: hoy(),
    items: [{ ...ITEM_VACIO }],
  });

  async function cargar(estado = '') {
    try {
      const [cliRes, ordRes, prodRes, almRes] = await Promise.all([
        api.get('/ventas/clientes'),
        api.get('/ventas/ordenes', {
          params: estado ? { estado } : {},
        }),
        api.get('/productos'),
        api.get('/inventario/almacenes'),
      ]);

      setClientes(cliRes.data);
      setOrdenes(ordRes.data);
      setProductos(prodRes.data);
      setAlmacenes(almRes.data);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'No se pudieron cargar los datos de ventas'
      );
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function actualizarItem(index, campo, valor) {
    const items = [...nuevaOrden.items];

    items[index] = {
      ...items[index],
      [campo]: valor,
    };

    setNuevaOrden({
      ...nuevaOrden,
      items,
    });
  }

function seleccionarProductoItem(index, producto) {
  const items = [...nuevaOrden.items];

  if (!producto) {
    items[index] = {
      ...items[index],
      producto_id: '',
      precio_unitario: '',
    };
  } else {
    items[index] = {
      ...items[index],
      producto_id: producto.id,
      precio_unitario: producto.precio_venta,
    };

    if (nuevaOrden.almacen_id) {
      consultarDisponibilidad(
        producto.id,
        nuevaOrden.almacen_id
      );
    }
  }

  setNuevaOrden({
    ...nuevaOrden,
    items,
  });
}

  function agregarItem() {
    setNuevaOrden({
      ...nuevaOrden,
      items: [...nuevaOrden.items, { ...ITEM_VACIO }],
    });
  }

  function quitarItem(index) {
    const items = nuevaOrden.items.filter((_, i) => i !== index);

    setNuevaOrden({
      ...nuevaOrden,
      items: items.length ? items : [{ ...ITEM_VACIO }],
    });
  }

function claveDisponibilidad(productoId, almacenId) {
  return `${productoId}-${almacenId}`;
}

async function consultarDisponibilidad(
  productoId,
  almacenId
) {
  if (!productoId || !almacenId) {
    return null;
  }

  try {
    const { data } = await api.get(
      '/inventario/disponibilidad-ventas',
      {
        params: {
          producto_id: Number(productoId),
          almacen_id: Number(almacenId),
          ...(ordenEditandoId
            ? { orden_id: Number(ordenEditandoId) }
            : {}),
        },
      }
    );

    const clave = claveDisponibilidad(
      productoId,
      almacenId
    );

    setDisponibilidades((actual) => ({
      ...actual,
      [clave]: data,
    }));

    return data;
  } catch (err) {
    console.error(
      'Error consultando disponibilidad:',
      err
    );

    return null;
  }
}

function obtenerDisponibilidad(productoId) {
  if (
    !productoId ||
    !nuevaOrden.almacen_id
  ) {
    return null;
  }

  const clave = claveDisponibilidad(
    productoId,
    nuevaOrden.almacen_id
  );

  return disponibilidades[clave] || null;
}

  const totalOrden = nuevaOrden.items.reduce(
    (acumulado, item) =>
      acumulado +
      (Number(item.cantidad) || 0) *
        (Number(item.precio_unitario) || 0),
    0
  );

async function editarOrden(orden) {
  setError('');

  try {
    const { data } = await api.get(`/ventas/ordenes/${orden.id}`);

    setOrdenEditandoId(orden.id);

    setNuevaOrden({
      cliente_id: String(data.cliente_id),
      almacen_id: String(data.almacen_id),
      fecha: String(data.fecha).slice(0, 10),
      items: data.detalle.map((item) => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      })),
    });

    setMostrarFormOrden(true);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  } catch (err) {
    setError(
      err.response?.data?.error ||
        'No se pudo cargar la orden para editar'
    );
  }
}

  async function crearOrden(e) {
    e.preventDefault();
    setError('');

  
    const estabaEditando = Boolean(ordenEditandoId);

    const itemInvalido = nuevaOrden.items.some(
      (item) =>
        !item.producto_id ||
        Number(item.cantidad) <= 0 ||
        Number(item.precio_unitario) < 0
    );

    if (itemInvalido) {
      setError(
        'Revisá los productos, cantidades y precios de la orden.'
      );
      return;
    }
try {
  const payload = {
    ...nuevaOrden,
    cliente_id: Number(nuevaOrden.cliente_id),
    almacen_id: Number(nuevaOrden.almacen_id),
    items: nuevaOrden.items.map((item) => ({
      producto_id: Number(item.producto_id),
      cantidad: Number(item.cantidad),
      precio_unitario: Number(item.precio_unitario),
    })),
  };

  let data;

  if (ordenEditandoId) {
    const respuesta = await api.put(
      `/ventas/ordenes/${ordenEditandoId}`,
      payload
    );

    data = respuesta.data;
  } else {
    const respuesta = await api.post(
      '/ventas/ordenes',
      payload
    );

    data = respuesta.data;
  }

  setMostrarFormOrden(false);
  setOrdenEditandoId(null);

  setNuevaOrden({
    cliente_id: '',
    almacen_id: '',
    fecha: hoy(),
    items: [{ ...ITEM_VACIO }],
  });

  await cargar(filtroEstado);

  if (estabaEditando) {
    alert('Orden de venta actualizada correctamente');
  } else {
    alert(
      `Orden de venta creada con el número automático ${data.numero}`
    );
  }
} catch (err) {
  setError(
    err.response?.data?.error ||
      (estabaEditando
        ? 'Error al actualizar la orden de venta'
        : 'Error al crear la orden de venta')
  );
}}

  
  async function confirmarOrden(id) {
    setError('');

    try {
      await api.post(`/ventas/ordenes/${id}/confirmar`);
      await cargar(filtroEstado);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al confirmar la orden. Revisá el stock disponible.'
      );
    }
  }

async function cancelarOrden(id) {
  setError('');

  try {
    await api.post(`/ventas/ordenes/${id}/cancelar`);
    await cargar(filtroEstado);
  } catch (err) {
    setError(
      err.response?.data?.error ||
      'Error al cancelar la orden.'
    );
  }
}

async function entregarOrden(id) {
  setError('');

  try {
    await api.post(`/ventas/ordenes/${id}/entregar`);
    await cargar(filtroEstado);
  } catch (err) {
    setError(
      err.response?.data?.error ||
      'Error al entregar la orden.'
    );
  }
}




  async function verDetalle(id) {
    if (ordenExpandida === id) {
      setOrdenExpandida(null);
      setDetalleOrden(null);
      return;
    }

    try {
      setOrdenExpandida(id);

      const { data } = await api.get(
        `/ventas/ordenes/${id}`
      );

      setDetalleOrden(data);
    } catch (err) {
      setOrdenExpandida(null);
      setDetalleOrden(null);

      setError(
        err.response?.data?.error ||
          'No se pudo cargar el detalle de la orden'
      );
    }
  }

  function cambiarFiltro(estado) {
    setFiltroEstado(estado);
    cargar(estado);
  }

function obtenerEstadoAbastecimiento(orden) {
  const porcentaje = Number(orden.porcentaje_abastecimiento || 0);

  if (orden.estado === 'cancelada') {
    return {
      texto: 'Cancelada',
      color: '#64748b',
      fondo: '#f1f5f9',
    };
  }

  if (orden.estado === 'confirmada' || orden.estado === 'entregada') {
    return {
      texto: 'Completo',
      color: '#15803d',
      fondo: '#dcfce7',
    };
  }

  if (porcentaje >= 100) {
    return {
      texto: 'Completo',
      color: '#15803d',
      fondo: '#dcfce7',
    };
  }

  if (porcentaje > 0) {
    return {
      texto: 'Parcial',
      color: '#a16207',
      fondo: '#fef9c3',
    };
  }

  return {
    texto: 'Sin stock',
    color: '#b91c1c',
    fondo: '#fee2e2',
  };
}

// Actualiza la disponibilidad cuando cambia el almacén
// o cuando estamos editando otra orden.
useEffect(() => {
  if (!nuevaOrden.almacen_id) {
    return;
  }

  nuevaOrden.items.forEach((item) => {
    if (item.producto_id) {
      consultarDisponibilidad(
        item.producto_id,
        nuevaOrden.almacen_id
      );
    }
  });
}, [
  nuevaOrden.almacen_id,
  ordenEditandoId
]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <h1>Ventas</h1>

        <button
          type="button"
          className="boton"
          onClick={() => {
  setMostrarFormOrden(!mostrarFormOrden);
  setOrdenEditandoId(null);
  setError('');

  setNuevaOrden({
    cliente_id: '',
    almacen_id: '',
    fecha: hoy(),
    items: [{ ...ITEM_VACIO }],
  });
}}
        >
          {mostrarFormOrden
            ? 'Cancelar'
            : '+ Orden de venta'}
        </button>
      </div>

      <p
        style={{
          color: '#6b7280',
          marginTop: -10,
        }}
      >
        La gestión de clientes se encuentra en su propia
        sección. Ingresá a <strong>Clientes</strong> desde el
        menú.
      </p>

      {error && <div className="error">{error}</div>}

      {mostrarFormOrden && (
        <form
          className="tarjeta"
          onSubmit={crearOrden}
        >
          <p
            style={{
              fontSize: 13,
              color: '#6b7280',
              marginTop: 0,
            }}
          >
            El número de orden se genera automáticamente al
            guardar.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                flex: '1 1 240px',
              }}
            >
              <label>Cliente</label>

              <select
                value={nuevaOrden.cliente_id}
                onChange={(e) =>
                  setNuevaOrden({
                    ...nuevaOrden,
                    cliente_id: e.target.value,
                  })
                }
                required
              >
                <option value="">Seleccionar</option>

                {clientes.map((cliente) => (
                  <option
                    key={cliente.id}
                    value={cliente.id}
                  >
                    {cliente.nombre}
                    {cliente.es_externo
                      ? ' (externo)'
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                flex: '1 1 240px',
              }}
            >
              <label>Almacén origen</label>

              <select
                value={nuevaOrden.almacen_id}
                onChange={(e) =>
                  setNuevaOrden({
                    ...nuevaOrden,
                    almacen_id: e.target.value,
                  })
                }
                required
              >
                <option value="">Seleccionar</option>

                {almacenes.map((almacen) => (
                  <option
                    key={almacen.id}
                    value={almacen.id}
                  >
                    {almacen.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                flex: '1 1 200px',
              }}
            >
              <label>Fecha</label>

              <input
                type="date"
                value={nuevaOrden.fecha}
                onChange={(e) =>
                  setNuevaOrden({
                    ...nuevaOrden,
                    fecha: e.target.value,
                  })
                }
                required
              />
            </div>
          </div>

          <h4>Ítems</h4>

                {nuevaOrden.items.map((item, i) => {
  const disponibilidad =
    obtenerDisponibilidad(item.producto_id);

  const disponible =
    disponibilidad?.disponible ?? null;

  const excede =
    disponible !== null &&
    Number(item.cantidad) > disponible;

            return (
              <div
                key={i}
                style={{
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-end',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      flex: '3 1 340px',
                    }}
                  >
                    <label>Producto</label>

                    <ProductoAutocomplete
                      productos={productos}
                      value={item.producto_id}
                      onChange={(producto) =>
                        seleccionarProductoItem(
                          i,
                          producto
                        )
                      }
                      placeholder="Escribí nombre, SKU o código de barras..."
                    />

                    {disponibilidad && (
  <div
    style={{
      marginTop: 8,
      fontSize: 12,
      lineHeight: 1.7,
    }}
  >
    <div style={{ color: '#64748b' }}>
      Stock físico:{' '}
      <strong>
        {disponibilidad.stock_fisico}
      </strong>
    </div>

    <div style={{ color: '#64748b' }}>
      Reservado:{' '}
      <strong>
        {disponibilidad.reservado}
      </strong>
    </div>

    <div
      style={{
        color:
          disponibilidad.disponible > 0
            ? '#15803d'
            : '#dc2626',
        fontWeight: 700,
      }}
    >
      Disponible para esta venta:{' '}
      {disponibilidad.disponible}
    </div>
  </div>
)}

                  </div>

                  <div
                    style={{
                      flex: '1 1 130px',
                    }}
                  >
                    <label>Cantidad</label>

                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) =>
                        actualizarItem(
                          i,
                          'cantidad',
                          e.target.value
                        )
                      }
                      required
                    />
                  </div>

                  <div
                    style={{
                      flex: '1 1 160px',
                    }}
                  >
                    <label>Precio unitario</label>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.precio_unitario}
                      onChange={(e) =>
                        actualizarItem(
                          i,
                          'precio_unitario',
                          e.target.value
                        )
                      }
                      required
                    />
                  </div>

                  <button
                    type="button"
                    className="boton boton-secundario"
                    style={{
                      marginBottom: 12,
                    }}
                    onClick={() => quitarItem(i)}
                  >
                    Quitar
                  </button>
                </div>

                {excede && (
                  <div
                    className="error"
                    style={{
                      marginTop: 4,
                    }}
                  >
                    La cantidad supera el stock disponible (
                    {disponible}). La orden puede guardarse
                    pendiente, pero se validará nuevamente al
                    confirmar.
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className="boton boton-secundario"
            onClick={agregarItem}
          >
            + Agregar ítem
          </button>

          <div
            style={{
              marginTop: 16,
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            Total: ${totalOrden.toFixed(2)}
          </div>

          <p
            style={{
              fontSize: 13,
              color: '#6b7280',
            }}
          >
            La orden queda como <strong>pendiente</strong> y no
            descuenta stock hasta que se confirma.
          </p>

          <button
            type="submit"
            className="boton"
            style={{
              marginTop: 10,
            }}
          >
         {ordenEditandoId
  ? 'Guardar cambios'
  : 'Guardar orden de venta'}
          </button>
        </form>
      )}

      <div className="tarjeta">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h3>Órdenes de venta</h3>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {[
              '',
              'pendiente',
              'confirmada',
              'entregada',
              'cancelada',
            ].map((estado) => (
              <button
                key={estado || 'todas'}
                type="button"
                className={`boton ${
                  filtroEstado === estado
                    ? ''
                    : 'boton-secundario'
                }`}
                onClick={() =>
                  cambiarFiltro(estado)
                }
              >
                {estado || 'Todas'}
              </button>
            ))}
          </div>
        </div>

        <table>
          <thead>
          <tr>
  <th>Número</th>
  <th>Cliente</th>
  <th>Estado</th>
  <th>Abastecimiento</th>
  <th>Total</th>
  <th>Acciones</th>
</tr>
          </thead>

          <tbody>
            {ordenes.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: 'center',
                    padding: 30,
                    color: '#64748b',
                  }}
                >
                  No hay órdenes de venta para mostrar.
                </td>
              </tr>
            )}

            {ordenes.map((orden) => (
              <Fragment key={orden.id}>
                <tr>
                  <td>{orden.numero}</td>

                  <td>
                    {orden.cliente_nombre}
                    {orden.es_externo
                      ? ' (externo)'
                      : ''}
                  </td>

                  <td>{orden.estado}</td>

<td>
  {(() => {
    const abastecimiento = obtenerEstadoAbastecimiento(orden);
    const porcentaje = Math.min(
      100,
      Math.max(0, Number(orden.porcentaje_abastecimiento || 0))
    );

    return (
      <div style={{ minWidth: 130 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 9px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color: abastecimiento.color,
            background: abastecimiento.fondo,
            marginBottom: 6,
          }}
        >
          {abastecimiento.texto}
        </div>

        {orden.estado === 'pendiente' && (
          <>
            <div
              style={{
                width: '100%',
                height: 6,
                background: '#e2e8f0',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${porcentaje}%`,
                  height: '100%',
                  background:
                    porcentaje >= 100
                      ? '#22c55e'
                      : porcentaje > 0
                        ? '#eab308'
                        : '#ef4444',
                  transition: 'width .25s ease',
                }}
              />
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: '#64748b',
              }}
            >
              {porcentaje}% asignado
            </div>
          </>
        )}
      </div>
    );
  })()}
</td>

<td>
  ${Number(orden.total || 0).toFixed(2)}
</td>

                  <td
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      type="button"
                      className="boton boton-secundario"
                      onClick={() =>
                        verDetalle(orden.id)
                      }
                    >
                      {ordenExpandida === orden.id
                        ? 'Ocultar'
                        : 'Ver ítems'}
                    </button>

                  
{orden.estado === 'pendiente' && (
  <>
    <button
      type="button"
      className="boton boton-secundario"
      onClick={() => editarOrden(orden)}
    >
      Editar
    </button>

   <button
  type="button"
  className="boton"
  disabled={Number(orden.porcentaje_abastecimiento || 0) < 100}
  title={
    Number(orden.porcentaje_abastecimiento || 0) < 100
      ? 'La orden todavía tiene productos pendientes de abastecimiento'
      : 'Confirmar orden'
  }
  onClick={() => confirmarOrden(orden.id)}
  style={{
    opacity:
      Number(orden.porcentaje_abastecimiento || 0) < 100
        ? 0.45
        : 1,
    cursor:
      Number(orden.porcentaje_abastecimiento || 0) < 100
        ? 'not-allowed'
        : 'pointer',
  }}
>
  {Number(orden.porcentaje_abastecimiento || 0) < 100
    ? 'Esperando stock'
    : 'Confirmar'}
</button>

    <button
      type="button"
      className="boton boton-secundario"
      style={{
        background: '#dc2626',
        color: '#fff',
      }}
      onClick={() => cancelarOrden(orden.id)}
    >
      Cancelar
    </button>
  </>
)}

{orden.estado === 'confirmada' && (
  <>
    <button
      type="button"
      className="boton"
      style={{
        background: "#16a34a"
      }}
      onClick={() => entregarOrden(orden.id)}
    >
      Entregar
    </button>

    <button
      type="button"
      className="boton boton-secundario"
      style={{
        background: "#dc2626",
        color: "#fff"
      }}
      onClick={() => cancelarOrden(orden.id)}
    >
      Cancelar
    </button>
  </>
)}


                  </td>
                </tr>

                {ordenExpandida === orden.id &&
                  detalleOrden && (
                    <tr>
                      <td colSpan={5}>
                        <table>
                          <thead>
                            <tr>
                              <th>SKU</th>
                              <th>Producto</th>
                              <th>Cantidad</th>
                              <th>Precio unit.</th>
                              <th>Subtotal</th>
                            </tr>
                          </thead>

                          <tbody>
                            {detalleOrden.detalle.map(
                              (detalle) => (
                                <tr key={detalle.id}>
                                  <td>{detalle.sku}</td>

                                  <td>
                                    {
                                      detalle.producto_nombre
                                    }
                                  </td>

                                  <td>
                                    {detalle.cantidad}
                                  </td>

                                  <td>
                                    $
                                    {Number(
                                      detalle.precio_unitario ||
                                        0
                                    ).toFixed(2)}
                                  </td>

                                  <td>
                                    $
                                    {Number(
                                      detalle.subtotal || 0
                                    ).toFixed(2)}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}