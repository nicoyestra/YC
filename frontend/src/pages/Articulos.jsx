import { Fragment, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { exportarExcel } from '../utils/exportarExcel';

const VACIO = {
  sku: '',
  codigo_barras: '',
  nombre: '',
  descripcion: '',
  proveedor_id: '',
  precio_costo: '',
  precio_venta: '',
  iva_porcentaje: 21,
  stock_minimo: 0,
  unidad_medida: 'unidad',
};

export default function Articulos() {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  const [codigoBusqueda, setCodigoBusqueda] = useState('');
  const [sugerenciasCodigo, setSugerenciasCodigo] = useState([]);
  const [mostrarSugerenciasCodigo, setMostrarSugerenciasCodigo] =
    useState(false);

  const [buscando, setBuscando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [error, setError] = useState('');
  const [expandido, setExpandido] = useState(null);

  const buscadorRef = useRef(null);
  const buscadorCodigoRef = useRef(null);
  const codigoInputRef = useRef(null);

  async function cargarProveedores() {
    try {
      const { data } = await api.get('/compras/proveedores');
      setProveedores(Array.isArray(data) ? data : []);
    } catch {
      setError('No se pudieron cargar los proveedores');
    }
  }

  async function obtenerProductos(filtro = '') {
    const texto = filtro.trim();

    const { data } = await api.get('/productos', {
      params: texto ? { buscar: texto } : {},
    });

    return Array.isArray(data) ? data : [];
  }

  async function cargarProductos(filtro = '') {
    try {
      setBuscando(true);
      setError('');

      const resultados = await obtenerProductos(filtro);
      setProductos(resultados);

      return resultados;
    } catch (err) {
      setProductos([]);
      setError(
        err.response?.data?.error ||
          'No se pudieron cargar los artículos'
      );

      return [];
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => {
    cargarProductos();
    cargarProveedores();
  }, []);

  useEffect(() => {
    const texto = busqueda.trim();

    const temporizador = setTimeout(async () => {
      if (!texto) {
        setSugerencias([]);
        setMostrarSugerencias(false);
        await cargarProductos();
        return;
      }

      try {
        setBuscando(true);

        const resultados = await obtenerProductos(texto);

        setProductos(resultados);
        setSugerencias(resultados.slice(0, 8));
        setMostrarSugerencias(true);
      } catch {
        setProductos([]);
        setSugerencias([]);
        setMostrarSugerencias(true);
      } finally {
        setBuscando(false);
      }
    }, 300);

    return () => clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    const codigo = codigoBusqueda.trim();

    const temporizador = setTimeout(async () => {
      if (!codigo) {
        setSugerenciasCodigo([]);
        setMostrarSugerenciasCodigo(false);
        return;
      }

      try {
        setBuscando(true);
        setError('');

        const resultados = await obtenerProductos(codigo);

        const coincidencias = resultados
          .filter((producto) =>
            String(producto.codigo_barras || '')
              .toLowerCase()
              .includes(codigo.toLowerCase())
          )
          .slice(0, 8);

        setSugerenciasCodigo(coincidencias);
        setMostrarSugerenciasCodigo(true);
      } catch {
        setSugerenciasCodigo([]);
        setMostrarSugerenciasCodigo(true);
      } finally {
        setBuscando(false);
      }
    }, 300);

    return () => clearTimeout(temporizador);
  }, [codigoBusqueda]);

  useEffect(() => {
    function cerrarDesplegables(evento) {
      if (
        buscadorRef.current &&
        !buscadorRef.current.contains(evento.target)
      ) {
        setMostrarSugerencias(false);
      }

      if (
        buscadorCodigoRef.current &&
        !buscadorCodigoRef.current.contains(evento.target)
      ) {
        setMostrarSugerenciasCodigo(false);
      }
    }

    document.addEventListener('mousedown', cerrarDesplegables);

    return () => {
      document.removeEventListener('mousedown', cerrarDesplegables);
    };
  }, []);

  function buscar(e) {
    e.preventDefault();
    cargarProductos(busqueda);
    setMostrarSugerencias(false);
  }

  function seleccionarProducto(producto) {
    setBusqueda(producto.nombre);
    setProductos([producto]);
    setSugerencias([]);
    setMostrarSugerencias(false);
    setExpandido(null);
    setError('');
  }

  function seleccionarPorCodigo(producto) {
    setCodigoBusqueda(producto.codigo_barras || '');
    setBusqueda(producto.nombre);
    setProductos([producto]);
    setSugerencias([]);
    setSugerenciasCodigo([]);
    setMostrarSugerencias(false);
    setMostrarSugerenciasCodigo(false);
    setExpandido(null);
    setError('');
  }

  function limpiarBusqueda() {
    setBusqueda('');
    setSugerencias([]);
    setMostrarSugerencias(false);
    setExpandido(null);
    setError('');
    cargarProductos();
  }

  function limpiarCodigo() {
    setCodigoBusqueda('');
    setSugerenciasCodigo([]);
    setMostrarSugerenciasCodigo(false);
    setError('');

    setTimeout(() => {
      codigoInputRef.current?.focus();
    }, 50);
  }

  async function buscarCodigoExacto() {
    const codigo = codigoBusqueda.trim();

    if (!codigo) return;

    try {
      setBuscando(true);
      setError('');

      const { data } = await api.get(
        `/productos/codigo/${encodeURIComponent(codigo)}`
      );

      seleccionarPorCodigo(data);
    } catch (err) {
      setProductos([]);
      setSugerenciasCodigo([]);
      setMostrarSugerenciasCodigo(false);

      setError(
        err.response?.data?.error ||
          'No se encontró un artículo con ese código de barras'
      );
    } finally {
      setBuscando(false);
    }
  }

  async function crearArticulo(e) {
    e.preventDefault();
    setError('');

    try {
      await api.post('/productos', nuevo);

      setMostrarForm(false);
      setNuevo(VACIO);
      setBusqueda('');
      setCodigoBusqueda('');
      setSugerencias([]);
      setSugerenciasCodigo([]);

      await cargarProductos();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al crear el artículo'
      );
    }
  }

  function exportarArticulos() {
    const datos = productos.map((producto) => ({
      SKU: producto.sku || '',
      'Código de barras': producto.codigo_barras || '',
      Nombre: producto.nombre || '',
      Descripción: producto.descripcion || '',
      Proveedor: producto.proveedor_nombre || '',
      'Precio de compra': Number(producto.precio_costo || 0),
      'Precio de venta': Number(producto.precio_venta || 0),
      'IVA %': Number(producto.iva_porcentaje || 0),
      'Stock actual': Number(producto.stock_total || 0),
      'Stock mínimo': Number(producto.stock_minimo || 0),
    }));

    exportarExcel(datos, 'Articulos_YC_System');
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
        <h1>Artículos</h1>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
           className="boton boton-excel"
            onClick={exportarArticulos}
            disabled={productos.length === 0}
          >
            Exportar Excel
          </button>

          <button
            type="button"
            className="boton"
            onClick={() => {
              setMostrarForm((valor) => !valor);
              setError('');
            }}
          >
            {mostrarForm ? 'Cancelar' : '+ Nuevo artículo'}
          </button>
        </div>
      </div>

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
          style={{
            flex: 1,
            position: 'relative',
          }}
        >
          <label>
            Buscar por SKU, nombre, descripción o código de barras
          </label>

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onFocus={() => {
              if (sugerencias.length > 0) {
                setMostrarSugerencias(true);
              }
            }}
            placeholder="Escribí las primeras letras del artículo..."
            autoComplete="off"
          />

          {buscando && busqueda.trim() && (
            <span className="busqueda-cargando">
              Buscando...
            </span>
          )}

          {mostrarSugerencias && busqueda.trim() && (
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
                      SKU: {producto.sku || 'Sin SKU'}
                      {' · '}
                      Código: {producto.codigo_barras || 'Sin código'}
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
          type="submit"
          className="boton boton-secundario"
          style={{ marginBottom: 12 }}
        >
          Buscar
        </button>
      </form>

      <form
        className="tarjeta"
        onSubmit={(e) => {
          e.preventDefault();
          buscarCodigoExacto();
        }}
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}
      >
        <div
          ref={buscadorCodigoRef}
          className="producto-autocomplete"
          style={{
            flex: 1,
            position: 'relative',
          }}
        >
          <label>Escanear o buscar código de barras</label>

          <input
            ref={codigoInputRef}
            value={codigoBusqueda}
            onChange={(e) =>
              setCodigoBusqueda(e.target.value)
            }
            onFocus={() => {
              if (sugerenciasCodigo.length > 0) {
                setMostrarSugerenciasCodigo(true);
              }
            }}
            placeholder="Escribí las primeras cifras o escaneá el código completo..."
            autoComplete="off"
          />

          {buscando && codigoBusqueda.trim() && (
            <span className="busqueda-cargando">
              Buscando...
            </span>
          )}

          {mostrarSugerenciasCodigo &&
            codigoBusqueda.trim() && (
              <div className="producto-sugerencias">
                {sugerenciasCodigo.length > 0 ? (
                  sugerenciasCodigo.map((producto) => (
                    <button
                      key={producto.id}
                      type="button"
                      className="producto-sugerencia"
                      onClick={() =>
                        seleccionarPorCodigo(producto)
                      }
                    >
                      <span className="producto-sugerencia-nombre">
                        {producto.nombre}
                      </span>

                      <span className="producto-sugerencia-detalle">
                        Código: {producto.codigo_barras || 'Sin código'}
                        {' · '}
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
                      No hay coincidencias por código.
                    </div>
                  )
                )}
              </div>
            )}
        </div>

        {codigoBusqueda && (
          <button
            type="button"
            className="boton boton-secundario"
            style={{ marginBottom: 12 }}
            onClick={limpiarCodigo}
          >
            Limpiar
          </button>
        )}

        <button
          type="submit"
          className="boton boton-secundario"
          style={{ marginBottom: 12 }}
          disabled={buscando}
        >
          {buscando ? 'Buscando...' : 'Buscar exacto'}
        </button>
      </form>

      {mostrarForm && (
        <form className="tarjeta" onSubmit={crearArticulo}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>SKU</label>

              <input
                value={nuevo.sku}
                onChange={(e) =>
                  setNuevo({
                    ...nuevo,
                    sku: e.target.value,
                  })
                }
                required
              />
            </div>

            <div style={{ flex: 1 }}>
              <label>Código de barras</label>

              <input
                value={nuevo.codigo_barras}
                onChange={(e) =>
                  setNuevo({
                    ...nuevo,
                    codigo_barras: e.target.value,
                  })
                }
                placeholder="Escanealo o escribilo"
              />
            </div>
          </div>

          <label>Nombre</label>

          <input
            value={nuevo.nombre}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                nombre: e.target.value,
              })
            }
            required
          />

          <label>Descripción detallada</label>

          <textarea
            rows={3}
            value={nuevo.descripcion}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                descripcion: e.target.value,
              })
            }
            placeholder="Características, medidas, variantes, etc."
          />

          <label>Proveedor habitual</label>

          <select
            value={nuevo.proveedor_id}
            onChange={(e) =>
              setNuevo({
                ...nuevo,
                proveedor_id: e.target.value,
              })
            }
          >
            <option value="">Sin especificar</option>

            {proveedores.map((proveedor) => (
              <option
                key={proveedor.id}
                value={proveedor.id}
              >
                {proveedor.nombre}
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>Precio de compra (sin IVA)</label>

              <input
                type="number"
                step="0.01"
                value={nuevo.precio_costo}
                onChange={(e) =>
                  setNuevo({
                    ...nuevo,
                    precio_costo: e.target.value,
                  })
                }
              />
            </div>

            <div style={{ flex: 1 }}>
              <label>IVA %</label>

              <input
                type="number"
                step="0.01"
                value={nuevo.iva_porcentaje}
                onChange={(e) =>
                  setNuevo({
                    ...nuevo,
                    iva_porcentaje: e.target.value,
                  })
                }
              />
            </div>

            <div style={{ flex: 1 }}>
              <label>Precio de venta</label>

              <input
                type="number"
                step="0.01"
                value={nuevo.precio_venta}
                onChange={(e) =>
                  setNuevo({
                    ...nuevo,
                    precio_venta: e.target.value,
                  })
                }
              />
            </div>

            <div style={{ flex: 1 }}>
              <label>Stock mínimo</label>

              <input
                type="number"
                value={nuevo.stock_minimo}
                onChange={(e) =>
                  setNuevo({
                    ...nuevo,
                    stock_minimo: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <button type="submit" className="boton">
            Guardar artículo
          </button>
        </form>
      )}

      <div className="tarjeta">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Cód. barras</th>
              <th>Nombre</th>
              <th>Proveedor</th>
              <th>Precio venta</th>
              <th>IVA</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {productos.length === 0 && !buscando && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    padding: 30,
                  }}
                >
                  No se encontraron artículos.
                </td>
              </tr>
            )}

            {productos.map((producto) => (
              <Fragment key={producto.id}>
                <tr>
                  <td>{producto.sku}</td>
                  <td>{producto.codigo_barras || '—'}</td>
                  <td>{producto.nombre}</td>
                  <td>{producto.proveedor_nombre || '—'}</td>
                  <td>
                    ${Number(producto.precio_venta || 0).toFixed(2)}
                  </td>
                  <td>{producto.iva_porcentaje}%</td>

                  <td>
                    <button
                      type="button"
                      className="boton boton-secundario"
                      onClick={() =>
                        setExpandido(
                          expandido === producto.id
                            ? null
                            : producto.id
                        )
                      }
                    >
                      {expandido === producto.id
                        ? 'Ocultar'
                        : 'Ver descripción'}
                    </button>
                  </td>
                </tr>

                {expandido === producto.id && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ background: '#f9fafb' }}
                    >
                      <strong>Descripción:</strong>{' '}
                      {producto.descripcion ||
                        'Sin descripción cargada.'}
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
