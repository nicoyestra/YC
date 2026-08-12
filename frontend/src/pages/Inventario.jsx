import { Fragment, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { exportarExcel } from '../utils/exportarExcel';

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [stockPorAlmacen, setStockPorAlmacen] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const [mostrarMovimiento, setMostrarMovimiento] = useState(null);
  const [mostrarTransferencia, setMostrarTransferencia] = useState(null);
  const [error, setError] = useState('');

  const [transferencia, setTransferencia] = useState({
    almacen_origen_id: '',
    almacen_destino_id: '',
    cantidad: '',
    motivo: '',
  });

  const buscadorRef = useRef(null);

  const [movimiento, setMovimiento] = useState({
    almacen_id: '',
    tipo: 'entrada',
    cantidad: '',
    motivo: '',
  });

  async function cargarAlmacenes() {
    try {
      const { data } = await api.get('/inventario/almacenes');
      setAlmacenes(data);
    } catch {
      setError('No se pudieron cargar los almacenes');
    }
  }

  async function cargarStockPorAlmacen() {
    try {
      const { data } = await api.get(
        '/inventario/stock-por-almacen'
      );

      setStockPorAlmacen(data);
    } catch {
      setError('No se pudo cargar el stock por almacén');
    }
  }

  async function buscarProductos(filtro = '') {
    try {
      setBuscando(true);

      const { data } = await api.get('/productos', {
        params: filtro.trim()
          ? { buscar: filtro.trim() }
          : {},
      });

      setProductos(data);

      return data;
    } catch {
      setError('No se pudieron cargar los artículos');
      setProductos([]);

      return [];
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => {
    buscarProductos();
    cargarAlmacenes();
    cargarStockPorAlmacen();
  }, []);

  useEffect(() => {
    const texto = busqueda.trim();

    const temporizador = setTimeout(async () => {
      if (!texto) {
        setSugerencias([]);
        setMostrarSugerencias(false);
        await buscarProductos();
        return;
      }

      const resultados = await buscarProductos(texto);

      setSugerencias(resultados.slice(0, 8));
      setMostrarSugerencias(true);
    }, 300);

    return () => clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    function cerrarSugerencias(evento) {
      if (
        buscadorRef.current &&
        !buscadorRef.current.contains(evento.target)
      ) {
        setMostrarSugerencias(false);
      }
    }

    document.addEventListener(
      'mousedown',
      cerrarSugerencias
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        cerrarSugerencias
      );
    };
  }, []);

  function buscar(e) {
    e.preventDefault();

    buscarProductos(busqueda);
    setMostrarSugerencias(false);
  }

  function seleccionarProducto(producto) {
    setBusqueda(producto.nombre);
    setProductos([producto]);
    setSugerencias([]);
    setMostrarSugerencias(false);
  }

  function limpiarBusqueda() {
    setBusqueda('');
    setSugerencias([]);
    setMostrarSugerencias(false);

    buscarProductos();
  }

  function obtenerStockProducto(productoId) {
    return almacenes.map((almacen) => {
      const registro = stockPorAlmacen.find(
        (stock) =>
          Number(stock.producto_id) === Number(productoId) &&
          Number(stock.almacen_id) === Number(almacen.id)
      );

      return {
        almacen_id: almacen.id,
        almacen_nombre: almacen.nombre,
        cantidad: Number(registro?.cantidad || 0),
      };
    });
  }

  async function registrarMovimiento(e, productoId) {
    e.preventDefault();
    setError('');

    try {
      await api.post('/inventario/movimientos', {
        ...movimiento,
        producto_id: productoId,
      });

      setMostrarMovimiento(null);

      setMovimiento({
        almacen_id: '',
        tipo: 'entrada',
        cantidad: '',
        motivo: '',
      });

      await Promise.all([
        buscarProductos(busqueda),
        cargarStockPorAlmacen(),
      ]);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al registrar movimiento'
      );
    }
  }

  async function transferirStock(e, productoId) {
    e.preventDefault();
    setError('');

    try {
      const { data } = await api.post(
        '/inventario/transferencias',
        {
          producto_id: productoId,
          almacen_origen_id:
            transferencia.almacen_origen_id,
          almacen_destino_id:
            transferencia.almacen_destino_id,
          cantidad: Number(transferencia.cantidad),
          motivo: transferencia.motivo,
        }
      );

      alert(
        data.mensaje ||
          'Transferencia realizada correctamente'
      );

      setMostrarTransferencia(null);

      setTransferencia({
        almacen_origen_id: '',
        almacen_destino_id: '',
        cantidad: '',
        motivo: '',
      });

      await Promise.all([
        buscarProductos(busqueda),
        cargarStockPorAlmacen(),
      ]);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al transferir stock entre almacenes'
      );
    }
  }

  function exportarInventario() {
    const datos = productos.map((producto) => {
      const stockDetalle =
        obtenerStockProducto(producto.id);

      const datosStock = {};

      stockDetalle.forEach((stock) => {
        datosStock[`Stock ${stock.almacen_nombre}`] =
          stock.cantidad;
      });

      return {
        SKU: producto.sku || '',
        Nombre: producto.nombre || '',
        Descripción: producto.descripcion || '',
        Proveedor: producto.proveedor_nombre || '',
        'Stock total': Number(
          producto.stock_total || 0
        ),
        ...datosStock,
        'Precio de compra': Number(
          producto.precio_costo || 0
        ),
        'IVA %': Number(
          producto.iva_porcentaje || 0
        ),
        'Precio de venta': Number(
          producto.precio_venta || 0
        ),
      };
    });

    exportarExcel(
      datos,
      'Inventario_YC_System'
    );
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
        <h1>Inventario</h1>

        <button
          type="button"
          className="boton boton-excel"
          onClick={exportarInventario}
          disabled={productos.length === 0}
        >
          Exportar Excel
        </button>
      </div>

      <p
        style={{
          color: '#6b7280',
          marginTop: -10,
        }}
      >
        Acá ves stock y movimientos. Para dar de alta
        un artículo nuevo o editar sus datos, andá a{' '}
        <strong>Artículos</strong>.
      </p>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <form
        className="tarjeta"
        onSubmit={buscar}
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}
      >
        <div
          ref={buscadorRef}
          className="producto-autocomplete"
          style={{
            flex: 1,
            position: 'relative',
          }}
        >
          <label>Buscar artículo</label>

          <input
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
            onFocus={() => {
              if (sugerencias.length > 0) {
                setMostrarSugerencias(true);
              }
            }}
            placeholder="Escribí nombre, SKU o descripción..."
            autoComplete="off"
          />

          {buscando &&
            busqueda.trim() && (
              <span className="busqueda-cargando">
                Buscando...
              </span>
            )}

          {mostrarSugerencias &&
            busqueda.trim() && (
              <div className="producto-sugerencias">
                {sugerencias.length > 0 ? (
                  sugerencias.map((producto) => (
                    <button
                      key={producto.id}
                      type="button"
                      className="producto-sugerencia"
                      onClick={() =>
                        seleccionarProducto(producto)
                      }
                    >
                      <span className="producto-sugerencia-nombre">
                        {producto.nombre}
                      </span>

                      <span className="producto-sugerencia-detalle">
                        SKU:{' '}
                        {producto.sku || 'Sin SKU'}
                        {' · '}
                        Stock:{' '}
                        {producto.stock_total ?? 0}
                      </span>

                      {producto.descripcion && (
                        <span className="producto-sugerencia-descripcion">
                          {producto.descripcion}
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  !buscando && (
                    <div className="producto-sin-resultados">
                      No se encontraron artículos.
                    </div>
                  )
                )}
              </div>
            )}
        </div>

        {busqueda && (
          <button
            type="button"
            className="boton boton-secundario"
            style={{ marginBottom: 12 }}
            onClick={limpiarBusqueda}
          >
            Limpiar
          </button>
        )}

        <button
          className="boton boton-secundario"
          style={{ marginBottom: 12 }}
        >
          Buscar
        </button>
      </form>

      <div className="tarjeta">
        <div
          style={{
            overflowX: 'auto',
          }}
        >
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Artículo / Descripción</th>
                <th>Proveedor</th>
                <th>Stock</th>
                <th>Precio compra (s/IVA)</th>
                <th>IVA</th>
                <th>Precio venta</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {productos.length === 0 &&
                !buscando && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: 'center',
                        padding: 30,
                      }}
                    >
                      No se encontraron artículos.
                    </td>
                  </tr>
                )}

              {productos.map((p) => {
                const stockDetalle =
                  obtenerStockProducto(p.id);

                return (
                  <Fragment key={p.id}>
                    <tr>
                      <td>{p.sku}</td>

                      <td>
                        <div
                          style={{
                            fontWeight: 600,
                          }}
                        >
                          {p.nombre}
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 12,
                            color: '#64748b',
                            lineHeight: 1.4,
                            maxWidth: 360,
                          }}
                        >
                          {p.descripcion ||
                            'Sin descripción cargada'}
                        </div>
                      </td>

                      <td>
                        {p.proveedor_nombre || '—'}
                      </td>

                      <td>
                        <div
                          style={{
                            fontWeight: 700,
                            marginBottom: 7,
                          }}
                        >
                          Total:{' '}
                          {Number(
                            p.stock_total || 0
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            fontSize: 12,
                          }}
                        >
                          {stockDetalle.map(
                            (stock) => (
                              <div
                                key={
                                  stock.almacen_id
                                }
                                style={{
                                  display: 'flex',
                                  justifyContent:
                                    'space-between',
                                  gap: 12,
                                  minWidth: 150,
                                  color:
                                    stock.cantidad > 0
                                      ? '#334155'
                                      : '#94a3b8',
                                }}
                              >
                                <span>
                                  {
                                    stock.almacen_nombre
                                  }
                                </span>

                                <strong>
                                  {stock.cantidad}
                                </strong>
                              </div>
                            )
                          )}
                        </div>
                      </td>

                      <td>
                        $
                        {Number(
                          p.precio_costo || 0
                        ).toFixed(2)}
                      </td>

                      <td>
                        {p.iva_porcentaje}%
                      </td>

                      <td>
                        $
                        {Number(
                          p.precio_venta || 0
                        ).toFixed(2)}
                      </td>

                      <td>
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          <button
                            type="button"
                            className="boton boton-secundario"
                            onClick={() => {
                              setMostrarMovimiento(
                                mostrarMovimiento ===
                                  p.id
                                  ? null
                                  : p.id
                              );

                              setMostrarTransferencia(
                                null
                              );
                            }}
                          >
                            Movimiento
                          </button>

                          <button
                            type="button"
                            className="boton boton-secundario"
                            onClick={() => {
                              setMostrarTransferencia(
                                mostrarTransferencia ===
                                  p.id
                                  ? null
                                  : p.id
                              );

                              setMostrarMovimiento(
                                null
                              );
                            }}
                          >
                            Transferir
                          </button>
                        </div>
                      </td>
                    </tr>

                    {mostrarMovimiento === p.id && (
                      <tr>
                        <td colSpan={8}>
                          <form
                            onSubmit={(e) =>
                              registrarMovimiento(
                                e,
                                p.id
                              )
                            }
                            style={{
                              display: 'flex',
                              gap: 10,
                              alignItems:
                                'flex-end',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div
                              style={{
                                flex:
                                  '1 1 180px',
                              }}
                            >
                              <label>
                                Almacén
                              </label>

                              <select
                                value={
                                  movimiento.almacen_id
                                }
                                onChange={(e) =>
                                  setMovimiento({
                                    ...movimiento,
                                    almacen_id:
                                      e.target
                                        .value,
                                  })
                                }
                                required
                              >
                                <option value="">
                                  Seleccionar
                                </option>

                                {almacenes.map(
                                  (a) => (
                                    <option
                                      key={a.id}
                                      value={a.id}
                                    >
                                      {a.nombre}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            <div
                              style={{
                                flex:
                                  '1 1 150px',
                              }}
                            >
                              <label>
                                Tipo
                              </label>

                              <select
                                value={
                                  movimiento.tipo
                                }
                                onChange={(e) =>
                                  setMovimiento({
                                    ...movimiento,
                                    tipo:
                                      e.target
                                        .value,
                                  })
                                }
                              >
                                <option value="entrada">
                                  Entrada
                                </option>

                                <option value="salida">
                                  Salida
                                </option>

                                <option value="ajuste">
                                  Ajuste
                                </option>
                              </select>
                            </div>

                            <div
                              style={{
                                flex:
                                  '1 1 130px',
                              }}
                            >
                              <label>
                                Cantidad
                              </label>

                              <input
                                type="number"
                                min="1"
                                value={
                                  movimiento.cantidad
                                }
                                onChange={(e) =>
                                  setMovimiento({
                                    ...movimiento,
                                    cantidad:
                                      e.target
                                        .value,
                                  })
                                }
                                required
                              />
                            </div>

                            <div
                              style={{
                                flex:
                                  '2 1 240px',
                              }}
                            >
                              <label>
                                Motivo
                              </label>

                              <input
                                value={
                                  movimiento.motivo
                                }
                                onChange={(e) =>
                                  setMovimiento({
                                    ...movimiento,
                                    motivo:
                                      e.target
                                        .value,
                                  })
                                }
                              />
                            </div>

                            <button
                              type="submit"
                              className="boton"
                              style={{
                                marginBottom: 12,
                              }}
                            >
                              Confirmar
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}

                    {mostrarTransferencia ===
                      p.id && (
                      <tr>
                        <td colSpan={8}>
                          <form
                            onSubmit={(e) =>
                              transferirStock(
                                e,
                                p.id
                              )
                            }
                            style={{
                              display: 'flex',
                              gap: 10,
                              alignItems:
                                'flex-end',
                              flexWrap: 'wrap',
                            }}
                          >
                            <div
                              style={{
                                flex:
                                  '1 1 180px',
                              }}
                            >
                              <label>
                                Almacén origen
                              </label>

                              <select
                                value={
                                  transferencia.almacen_origen_id
                                }
                                onChange={(e) =>
                                  setTransferencia({
                                    ...transferencia,
                                    almacen_origen_id:
                                      e.target
                                        .value,
                                  })
                                }
                                required
                              >
                                <option value="">
                                  Seleccionar
                                </option>

                                {almacenes.map(
                                  (a) => (
                                    <option
                                      key={a.id}
                                      value={a.id}
                                    >
                                      {a.nombre}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            <div
                              style={{
                                flex:
                                  '1 1 180px',
                              }}
                            >
                              <label>
                                Almacén destino
                              </label>

                              <select
                                value={
                                  transferencia.almacen_destino_id
                                }
                                onChange={(e) =>
                                  setTransferencia({
                                    ...transferencia,
                                    almacen_destino_id:
                                      e.target
                                        .value,
                                  })
                                }
                                required
                              >
                                <option value="">
                                  Seleccionar
                                </option>

                                {almacenes
                                  .filter(
                                    (a) =>
                                      String(
                                        a.id
                                      ) !==
                                      String(
                                        transferencia.almacen_origen_id
                                      )
                                  )
                                  .map((a) => (
                                    <option
                                      key={a.id}
                                      value={a.id}
                                    >
                                      {a.nombre}
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div
                              style={{
                                flex:
                                  '1 1 130px',
                              }}
                            >
                              <label>
                                Cantidad
                              </label>

                              <input
                                type="number"
                                min="1"
                                value={
                                  transferencia.cantidad
                                }
                                onChange={(e) =>
                                  setTransferencia({
                                    ...transferencia,
                                    cantidad:
                                      e.target
                                        .value,
                                  })
                                }
                                required
                              />
                            </div>

                            <div
                              style={{
                                flex:
                                  '2 1 240px',
                              }}
                            >
                              <label>
                                Motivo
                              </label>

                              <input
                                value={
                                  transferencia.motivo
                                }
                                onChange={(e) =>
                                  setTransferencia({
                                    ...transferencia,
                                    motivo:
                                      e.target
                                        .value,
                                  })
                                }
                                placeholder="Ej: Reposición de mostrador"
                              />
                            </div>

                            <button
                              type="submit"
                              className="boton"
                              style={{
                                marginBottom: 12,
                              }}
                            >
                              Confirmar transferencia
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}