import { Fragment, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { exportarExcel } from '../utils/exportarExcel';

export default function Inventario() {
  const [productos, setProductos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const [mostrarMovimiento, setMostrarMovimiento] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [error, setError] = useState('');

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

  async function buscarProductos(filtro = '') {
    try {
      setBuscando(true);

      const { data } = await api.get('/productos', {
        params: filtro.trim() ? { buscar: filtro.trim() } : {},
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
  }, []);

  /*
   * Busca automáticamente mientras el usuario escribe.
   * Espera 300 ms para no hacer una consulta por cada tecla.
   */
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

  /*
   * Cierra las sugerencias al hacer clic fuera del buscador.
   */
  useEffect(() => {
    function cerrarSugerencias(evento) {
      if (
        buscadorRef.current &&
        !buscadorRef.current.contains(evento.target)
      ) {
        setMostrarSugerencias(false);
      }
    }

    document.addEventListener('mousedown', cerrarSugerencias);

    return () => {
      document.removeEventListener('mousedown', cerrarSugerencias);
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

      await buscarProductos(busqueda);
    } catch (err) {
      setError(
        err.response?.data?.error || 'Error al registrar movimiento'
      );
    }
  }


  function exportarInventario() {
    const datos = productos.map((producto) => ({
      SKU: producto.sku || '',
      Nombre: producto.nombre || '',
      Proveedor: producto.proveedor_nombre || '',
      'Stock total': Number(producto.stock_total || 0),
      'Precio de compra': Number(producto.precio_costo || 0),
      'IVA %': Number(producto.iva_porcentaje || 0),
      'Precio de venta': Number(producto.precio_venta || 0),
      Descripción: producto.descripcion || '',
    }));

    exportarExcel(datos, 'Inventario_YC_System');
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

      <p style={{ color: '#6b7280', marginTop: -10 }}>
        Acá ves stock y movimientos. Para dar de alta un artículo nuevo o
        editar sus datos, andá a <strong>Artículos</strong>.
      </p>

      {error && <div className="error">{error}</div>}

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
          style={{ flex: 1, position: 'relative' }}
        >
          <label>Buscar artículo</label>

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onFocus={() => {
              if (sugerencias.length > 0) {
                setMostrarSugerencias(true);
              }
            }}
            placeholder="Escribí nombre, SKU o descripción..."
            autoComplete="off"
          />

          {buscando && busqueda.trim() && (
            <span className="busqueda-cargando">Buscando...</span>
          )}

          {mostrarSugerencias && busqueda.trim() && (
            <div className="producto-sugerencias">
              {sugerencias.length > 0 ? (
                sugerencias.map((producto) => (
                  <button
                    key={producto.id}
                    type="button"
                    className="producto-sugerencia"
                    onClick={() => seleccionarProducto(producto)}
                  >
                    <span className="producto-sugerencia-nombre">
                      {producto.nombre}
                    </span>

                    <span className="producto-sugerencia-detalle">
                      SKU: {producto.sku || 'Sin SKU'}
                      {' · '}
                      Stock: {producto.stock_total ?? 0}
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
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nombre</th>
              <th>Proveedor</th>
              <th>Stock total</th>
              <th>Precio compra (s/IVA)</th>
              <th>IVA</th>
              <th>Precio venta</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {productos.length === 0 && !buscando && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 30 }}>
                  No se encontraron artículos.
                </td>
              </tr>
            )}

            {productos.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>{p.sku}</td>

                  <td>
                    {p.nombre}

                    <div>
                      <button
                        type="button"
                        className="boton boton-secundario"
                        style={{
                          padding: '2px 8px',
                          fontSize: 12,
                          marginTop: 4,
                        }}
                        onClick={() =>
                          setExpandido(expandido === p.id ? null : p.id)
                        }
                      >
                        {expandido === p.id
                          ? 'Ocultar desc.'
                          : 'Ver descripción'}
                      </button>
                    </div>
                  </td>

                  <td>{p.proveedor_nombre || '—'}</td>
                  <td>{p.stock_total}</td>
                  <td>${Number(p.precio_costo).toFixed(2)}</td>
                  <td>{p.iva_porcentaje}%</td>
                  <td>${Number(p.precio_venta).toFixed(2)}</td>

                  <td>
                    <button
                      type="button"
                      className="boton boton-secundario"
                      onClick={() =>
                        setMostrarMovimiento(
                          mostrarMovimiento === p.id ? null : p.id
                        )
                      }
                    >
                      Movimiento
                    </button>
                  </td>
                </tr>

                {expandido === p.id && (
                  <tr>
                    <td colSpan={8} style={{ background: '#f9fafb' }}>
                      <strong>Descripción:</strong>{' '}
                      {p.descripcion || 'Sin descripción cargada.'}
                    </td>
                  </tr>
                )}

                {mostrarMovimiento === p.id && (
                  <tr>
                    <td colSpan={8}>
                      <form
                        onSubmit={(e) => registrarMovimiento(e, p.id)}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-end',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <label>Almacén</label>

                          <select
                            value={movimiento.almacen_id}
                            onChange={(e) =>
                              setMovimiento({
                                ...movimiento,
                                almacen_id: e.target.value,
                              })
                            }
                            required
                          >
                            <option value="">Seleccionar</option>

                            {almacenes.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.nombre}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ flex: 1 }}>
                          <label>Tipo</label>

                          <select
                            value={movimiento.tipo}
                            onChange={(e) =>
                              setMovimiento({
                                ...movimiento,
                                tipo: e.target.value,
                              })
                            }
                          >
                            <option value="entrada">Entrada</option>
                            <option value="salida">Salida</option>
                            <option value="ajuste">Ajuste</option>
                          </select>
                        </div>

                        <div style={{ flex: 1 }}>
                          <label>Cantidad</label>

                          <input
                            type="number"
                            value={movimiento.cantidad}
                            onChange={(e) =>
                              setMovimiento({
                                ...movimiento,
                                cantidad: e.target.value,
                              })
                            }
                            required
                          />
                        </div>

                        <div style={{ flex: 2 }}>
                          <label>Motivo</label>

                          <input
                            value={movimiento.motivo}
                            onChange={(e) =>
                              setMovimiento({
                                ...movimiento,
                                motivo: e.target.value,
                              })
                            }
                          />
                        </div>

                        <button
                          className="boton"
                          style={{ marginBottom: 12 }}
                        >
                          Confirmar
                        </button>
                      </form>
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