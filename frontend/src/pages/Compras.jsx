import { Fragment, useEffect, useState } from 'react';
import api from '../api/client';
import ProductoAutocomplete from '../components/ProductoAutocomplete';

const ITEM_VACIO = {
  producto_id: '',
  cantidad: '',
  precio_unitario: '',
};

const PROVEEDOR_VACIO = {
  nombre: '',
  cuit: '',
  email: '',
  telefono: '',
};

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

export default function Compras() {
  const [proveedores, setProveedores] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);

  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [busquedaOrden, setBusquedaOrden] = useState('');

  const [mostrarFormProveedor, setMostrarFormProveedor] =
    useState(false);
  const [mostrarFormOrden, setMostrarFormOrden] =
    useState(false);

  const [ordenExpandida, setOrdenExpandida] = useState(null);
  const [detalleOrden, setDetalleOrden] = useState(null);

  // { detalle_id: cantidad_a_recibir }
  const [recepcion, setRecepcion] = useState({});

  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const [nuevoProveedor, setNuevoProveedor] =
    useState(PROVEEDOR_VACIO);

  const [nuevaOrden, setNuevaOrden] = useState({
    proveedor_id: '',
    almacen_id: '',
    fecha: hoy(),
    observaciones: '',
    items: [{ ...ITEM_VACIO }],
  });

  async function cargar(
    filtroProveedor = '',
    filtroOrden = ''
  ) {
    try {
      setCargando(true);
      setError('');

      const [provRes, ordRes, prodRes, almRes] =
        await Promise.all([
          api.get('/compras/proveedores', {
            params: filtroProveedor
              ? { buscar: filtroProveedor }
              : {},
          }),
          api.get('/compras/ordenes', {
            params: filtroOrden
              ? { numero: filtroOrden }
              : {},
          }),
          api.get('/productos'),
          api.get('/inventario/almacenes'),
        ]);

      setProveedores(
        Array.isArray(provRes.data) ? provRes.data : []
      );

      setOrdenes(
        Array.isArray(ordRes.data) ? ordRes.data : []
      );

      setProductos(
        Array.isArray(prodRes.data) ? prodRes.data : []
      );

      setAlmacenes(
        Array.isArray(almRes.data) ? almRes.data : []
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'No se pudieron cargar los datos de compras'
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function buscarProveedor(e) {
    e.preventDefault();
    cargar(busquedaProveedor, busquedaOrden);
  }

  function buscarOrden(e) {
    e.preventDefault();
    cargar(busquedaProveedor, busquedaOrden);
  }

  async function crearProveedor(e) {
    e.preventDefault();
    setError('');

    try {
      await api.post(
        '/compras/proveedores',
        nuevoProveedor
      );

      setMostrarFormProveedor(false);
      setNuevoProveedor(PROVEEDOR_VACIO);

      await cargar(
        busquedaProveedor,
        busquedaOrden
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al crear el proveedor'
      );
    }
  }

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
        precio_unitario:
          producto.precio_costo ?? '',
      };
    }

    setNuevaOrden({
      ...nuevaOrden,
      items,
    });
  }

  function agregarItem() {
    setNuevaOrden({
      ...nuevaOrden,
      items: [
        ...nuevaOrden.items,
        { ...ITEM_VACIO },
      ],
    });
  }

  function quitarItem(index) {
    const items = nuevaOrden.items.filter(
      (_, i) => i !== index
    );

    setNuevaOrden({
      ...nuevaOrden,
      items: items.length
        ? items
        : [{ ...ITEM_VACIO }],
    });
  }

  const totalOrden = nuevaOrden.items.reduce(
    (acumulado, item) =>
      acumulado +
      (Number(item.cantidad) || 0) *
        (Number(item.precio_unitario) || 0),
    0
  );

  async function crearOrden(e) {
    e.preventDefault();
    setError('');

    if (
      !nuevaOrden.proveedor_id ||
      !nuevaOrden.almacen_id ||
      !nuevaOrden.fecha
    ) {
      setError(
        'Seleccioná proveedor, almacén y fecha.'
      );
      return;
    }

    const itemInvalido = nuevaOrden.items.some(
      (item) =>
        !item.producto_id ||
        Number(item.cantidad) <= 0 ||
        Number(item.precio_unitario) < 0
    );

    if (itemInvalido) {
      setError(
        'Revisá los productos, las cantidades y los precios.'
      );
      return;
    }

    try {
      const payload = {
        proveedor_id: Number(
          nuevaOrden.proveedor_id
        ),
        almacen_id: Number(
          nuevaOrden.almacen_id
        ),
        fecha: nuevaOrden.fecha,
        observaciones:
          nuevaOrden.observaciones.trim(),
        items: nuevaOrden.items.map((item) => ({
          producto_id: Number(
            item.producto_id
          ),
          cantidad: Number(item.cantidad),
          precio_unitario: Number(
            item.precio_unitario
          ),
        })),
      };

      const { data } = await api.post(
        '/compras/ordenes',
        payload
      );

      setMostrarFormOrden(false);

      setNuevaOrden({
        proveedor_id: '',
        almacen_id: '',
        fecha: hoy(),
        observaciones: '',
        items: [{ ...ITEM_VACIO }],
      });

      await cargar(
        busquedaProveedor,
        busquedaOrden
      );

      alert(
        `Orden creada con el número automático ${data.numero}`
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al crear la orden de compra'
      );
    }
  }

  async function verDetalle(id) {
    if (ordenExpandida === id) {
      setOrdenExpandida(null);
      setDetalleOrden(null);
      setRecepcion({});
      return;
    }

    try {
      setError('');

      const { data } = await api.get(
        `/compras/ordenes/${id}`
      );

      setOrdenExpandida(id);
      setDetalleOrden(data);

      const inicial = {};

      data.detalle.forEach((detalle) => {
        inicial[detalle.id] =
          Number(detalle.cantidad) -
          Number(detalle.cantidad_recibida);
      });

      setRecepcion(inicial);
    } catch (err) {
      setOrdenExpandida(null);
      setDetalleOrden(null);
      setRecepcion({});

      setError(
        err.response?.data?.error ||
          'No se pudo cargar el detalle de la orden'
      );
    }
  }

  async function confirmarRecepcion(ordenId) {
    if (!detalleOrden?.detalle) return;

    setError('');

    try {
      const items = Object.entries(recepcion)
        .map(
          ([
            detalleId,
            cantidadNueva,
          ]) => {
            const detalle =
              detalleOrden.detalle.find(
                (item) =>
                  item.id ===
                  Number(detalleId)
              );

            const yaRecibido = Number(
              detalle?.cantidad_recibida || 0
            );

            return {
              detalle_id: Number(detalleId),
              cantidad_recibida:
                yaRecibido +
                Number(cantidadNueva || 0),
            };
          }
        )
        .filter(
          (item) =>
            Number.isFinite(
              item.cantidad_recibida
            )
        );

      await api.post(
        `/compras/ordenes/${ordenId}/recibir`,
        { items }
      );

      setOrdenExpandida(null);
      setDetalleOrden(null);
      setRecepcion({});

      await cargar(
        busquedaProveedor,
        busquedaOrden
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al registrar la recepción'
      );
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <h1>Compras</h1>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => {
              setMostrarFormProveedor(
                !mostrarFormProveedor
              );
              setError('');
            }}
          >
            {mostrarFormProveedor
              ? 'Cancelar'
              : '+ Proveedor'}
          </button>

          <button
            type="button"
            className="boton"
            onClick={() => {
              setMostrarFormOrden(
                !mostrarFormOrden
              );
              setError('');
            }}
          >
            {mostrarFormOrden
              ? 'Cancelar'
              : '+ Orden de compra'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error">{error}</div>
      )}

      {/* NUEVO PROVEEDOR */}
      {mostrarFormProveedor && (
        <form
          className="tarjeta"
          onSubmit={crearProveedor}
        >
          <label>Nombre</label>

          <input
            value={nuevoProveedor.nombre}
            onChange={(e) =>
              setNuevoProveedor({
                ...nuevoProveedor,
                nombre: e.target.value,
              })
            }
            required
          />

          <label>CUIT</label>

          <input
            value={nuevoProveedor.cuit}
            onChange={(e) =>
              setNuevoProveedor({
                ...nuevoProveedor,
                cuit: e.target.value,
              })
            }
          />

          <label>Email</label>

          <input
            type="email"
            value={nuevoProveedor.email}
            onChange={(e) =>
              setNuevoProveedor({
                ...nuevoProveedor,
                email: e.target.value,
              })
            }
          />

          <label>Teléfono</label>

          <input
            value={nuevoProveedor.telefono}
            onChange={(e) =>
              setNuevoProveedor({
                ...nuevoProveedor,
                telefono: e.target.value,
              })
            }
          />

          <button
            type="submit"
            className="boton"
          >
            Guardar proveedor
          </button>
        </form>
      )}

      {/* NUEVA ORDEN DE COMPRA */}
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
            El número de orden se genera
            automáticamente al guardar.
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
              <label>Proveedor</label>

              <select
                value={
                  nuevaOrden.proveedor_id
                }
                onChange={(e) =>
                  setNuevaOrden({
                    ...nuevaOrden,
                    proveedor_id:
                      e.target.value,
                  })
                }
                required
              >
                <option value="">
                  Seleccionar
                </option>

                {proveedores.map(
                  (proveedor) => (
                    <option
                      key={proveedor.id}
                      value={proveedor.id}
                    >
                      {proveedor.nombre}
                    </option>
                  )
                )}
              </select>
            </div>

            <div
              style={{
                flex: '1 1 240px',
              }}
            >
              <label>Almacén destino</label>

              <select
                value={nuevaOrden.almacen_id}
                onChange={(e) =>
                  setNuevaOrden({
                    ...nuevaOrden,
                    almacen_id:
                      e.target.value,
                  })
                }
                required
              >
                <option value="">
                  Seleccionar
                </option>

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

          <label>
            Observaciones (opcional)
          </label>

          <textarea
            rows={2}
            value={nuevaOrden.observaciones}
            onChange={(e) =>
              setNuevaOrden({
                ...nuevaOrden,
                observaciones:
                  e.target.value,
              })
            }
            placeholder="Ej: entrega parcial, plazo acordado, condiciones..."
          />

          <h4>Ítems</h4>

          {nuevaOrden.items.map(
            (item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-end',
                  flexWrap: 'wrap',
                  marginBottom: 14,
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
                        index,
                        producto
                      )
                    }
                    placeholder="Escribí nombre, SKU o código de barras..."
                  />

                  {item.producto_id && (
                    <div
                      style={{
                        marginTop: 7,
                        color: '#64748b',
                        fontSize: 12,
                      }}
                    >
                      Precio habitual de compra
                      completado automáticamente.
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
                        index,
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
                  <label>
                    Precio unitario
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      item.precio_unitario
                    }
                    onChange={(e) =>
                      actualizarItem(
                        index,
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
                  onClick={() =>
                    quitarItem(index)
                  }
                >
                  Quitar
                </button>
              </div>
            )
          )}

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

          <button
            type="submit"
            className="boton"
            style={{ marginTop: 10 }}
          >
            Crear orden de compra
          </button>
        </form>
      )}

      {/* PROVEEDORES */}
      <div className="tarjeta">
        <h3>Proveedores</h3>

        <form
          onSubmit={buscarProveedor}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
            marginBottom: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <label>Buscar proveedor</label>

            <input
              value={busquedaProveedor}
              onChange={(e) =>
                setBusquedaProveedor(
                  e.target.value
                )
              }
              placeholder="Nombre, CUIT o email..."
              style={{ marginBottom: 0 }}
            />
          </div>

          <button
            type="submit"
            className="boton boton-secundario"
          >
            Buscar
          </button>
        </form>

        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>CUIT</th>
              <th>Email</th>
              <th>Teléfono</th>
            </tr>
          </thead>

          <tbody>
            {proveedores.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    textAlign: 'center',
                    padding: 28,
                    color: '#64748b',
                  }}
                >
                  No hay proveedores para
                  mostrar.
                </td>
              </tr>
            )}

            {proveedores.map(
              (proveedor) => (
                <tr key={proveedor.id}>
                  <td>
                    {proveedor.nombre}
                  </td>
                  <td>
                    {proveedor.cuit || '—'}
                  </td>
                  <td>
                    {proveedor.email || '—'}
                  </td>
                  <td>
                    {proveedor.telefono ||
                      '—'}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* ÓRDENES */}
      <div className="tarjeta">
        <h3>Órdenes de compra</h3>

        <form
          onSubmit={buscarOrden}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
            marginBottom: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <label>
              Buscar por número de orden
            </label>

            <input
              value={busquedaOrden}
              onChange={(e) =>
                setBusquedaOrden(
                  e.target.value
                )
              }
              placeholder="Ej: OC-000012"
              style={{ marginBottom: 0 }}
            />
          </div>

          <button
            type="submit"
            className="boton boton-secundario"
          >
            Buscar
          </button>
        </form>

        {cargando ? (
          <p
            style={{
              color: '#64748b',
            }}
          >
            Cargando órdenes...
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Proveedor</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {ordenes.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'center',
                      padding: 28,
                      color: '#64748b',
                    }}
                  >
                    No hay órdenes para
                    mostrar.
                  </td>
                </tr>
              )}

              {ordenes.map((orden) => (
                <Fragment key={orden.id}>
                  <tr>
                    <td>{orden.numero}</td>
                    <td>
                      {orden.proveedor_nombre}
                    </td>
                    <td>{orden.estado}</td>
                    <td>
                      $
                      {Number(
                        orden.total || 0
                      ).toFixed(2)}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="boton boton-secundario"
                        onClick={() =>
                          verDetalle(orden.id)
                        }
                      >
                        {ordenExpandida ===
                        orden.id
                          ? 'Ocultar'
                          : 'Ver / recibir'}
                      </button>
                    </td>
                  </tr>

                  {ordenExpandida ===
                    orden.id &&
                    detalleOrden && (
                      <tr>
                        <td colSpan={5}>
                          {detalleOrden.observaciones && (
                            <p>
                              <strong>
                                Observaciones:
                              </strong>{' '}
                              {
                                detalleOrden.observaciones
                              }
                            </p>
                          )}

                          <table>
                            <thead>
                              <tr>
                                <th>SKU</th>
                                <th>Producto</th>
                                <th>Pedido</th>
                                <th>Recibido</th>
                                <th>
                                  A recibir ahora
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {detalleOrden.detalle.map(
                                (detalle) => {
                                  const pendiente =
                                    Number(
                                      detalle.cantidad
                                    ) -
                                    Number(
                                      detalle.cantidad_recibida
                                    );

                                  return (
                                    <tr
                                      key={
                                        detalle.id
                                      }
                                    >
                                      <td>
                                        {
                                          detalle.sku
                                        }
                                      </td>

                                      <td>
                                        {
                                          detalle.producto_nombre
                                        }
                                      </td>

                                      <td>
                                        {
                                          detalle.cantidad
                                        }
                                      </td>

                                      <td>
                                        {
                                          detalle.cantidad_recibida
                                        }
                                      </td>

                                      <td>
                                        {pendiente <=
                                        0 ? (
                                          <span
                                            className="badge"
                                            style={{
                                              background:
                                                '#dcfce7',
                                              color:
                                                '#166534',
                                            }}
                                          >
                                            Completo
                                          </span>
                                        ) : (
                                          <input
                                            type="number"
                                            min="0"
                                            max={
                                              pendiente
                                            }
                                            value={
                                              recepcion[
                                                detalle
                                                  .id
                                              ] ?? 0
                                            }
                                            onChange={(
                                              e
                                            ) =>
                                              setRecepcion(
                                                {
                                                  ...recepcion,
                                                  [detalle.id]:
                                                    e
                                                      .target
                                                      .value,
                                                }
                                              )
                                            }
                                            style={{
                                              marginBottom: 0,
                                              width: 100,
                                            }}
                                          />
                                        )}
                                      </td>
                                    </tr>
                                  );
                                }
                              )}
                            </tbody>
                          </table>

                          {orden.estado !==
                            'recibida' &&
                            orden.estado !==
                              'cancelada' && (
                              <button
                                type="button"
                                className="boton"
                                style={{
                                  marginTop: 10,
                                }}
                                onClick={() =>
                                  confirmarRecepcion(
                                    orden.id
                                  )
                                }
                              >
                                Registrar recepción
                                parcial o total
                              </button>
                            )}
                        </td>
                      </tr>
                    )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}