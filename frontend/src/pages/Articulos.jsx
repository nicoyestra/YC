import { Fragment, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { exportarExcel } from '../utils/exportarExcel';
import * as XLSX from 'xlsx';

const VACIO = {
  sku: '',
  codigo_barras: '',
  nombre: '',
  descripcion: '',
  categoria_id: '',
  proveedor_id: '',
  precio_costo: '',
  precio_venta: '',
  iva_porcentaje: 21,
  stock_minimo: 0,
  unidad_medida: 'unidad',
  activo: 1,
};

export default function Articulos() {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [preciosOferta, setPreciosOferta] = useState([]);
  const [filtroOfertas, setFiltroOfertas] = useState('todos');
  const [filtroProveedor, setFiltroProveedor] = useState('todos');
  const [productoComparar, setProductoComparar] = useState(null);

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
  const [editandoId, setEditandoId] = useState(null);
  const [error, setError] = useState('');
  const [expandido, setExpandido] = useState(null);
  const [mostrarImportacion, setMostrarImportacion] = useState(false);
  const [tipoImportacion, setTipoImportacion] = useState('catalogo');
  const [archivoImportacion, setArchivoImportacion] = useState(null);
  const [filasImportacion, setFilasImportacion] = useState([]);
  const [resumenImportacion, setResumenImportacion] = useState('');
  const [procesandoImportacion, setProcesandoImportacion] = useState(false);
  const [modoPruebaImportacion, setModoPruebaImportacion] = useState(true);

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

  async function cargarPreciosOferta() {
    try {
      const { data } = await api.get('/productos/precios-oferta');
      setPreciosOferta(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('No se pudieron cargar los precios de oferta', err);
      setPreciosOferta([]);
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
    cargarPreciosOferta();
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

  function limpiarFormulario() {
    setNuevo(VACIO);
    setEditandoId(null);
    setMostrarForm(false);
  }

  function abrirNuevoArticulo() {
    if (mostrarForm && !editandoId) {
      limpiarFormulario();
      return;
    }

    setNuevo(VACIO);
    setEditandoId(null);
    setError('');
    setMostrarForm(true);
  }

  async function editarArticulo(producto) {
    setError('');

    try {
      const { data } = await api.get(`/productos/${producto.id}`);

      setNuevo({
        sku: data.sku || '',
        codigo_barras: data.codigo_barras || '',
        nombre: data.nombre || '',
        descripcion: data.descripcion || '',
        categoria_id: data.categoria_id || '',
        proveedor_id: data.proveedor_id || '',
        precio_costo: data.precio_costo ?? '',
        precio_venta: data.precio_venta ?? '',
        iva_porcentaje: data.iva_porcentaje ?? 21,
        stock_minimo: data.stock_minimo ?? 0,
        unidad_medida: data.unidad_medida || 'unidad',
        activo: data.activo ?? 1,
      });

      setEditandoId(producto.id);
      setMostrarForm(true);
      setExpandido(null);

      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al cargar el artículo para editar'
      );
    }
  }

  async function guardarArticulo(e) {
    e.preventDefault();
    setError('');

    try {
      if (editandoId) {
        await api.put(`/productos/${editandoId}`, {
          ...nuevo,
          activo: nuevo.activo ?? 1,
        });
      } else {
        await api.post('/productos', nuevo);
      }

      limpiarFormulario();
      setBusqueda('');
      setCodigoBusqueda('');
      setSugerencias([]);
      setSugerenciasCodigo([]);

      await cargarProductos();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          (editandoId
            ? 'Error al actualizar el artículo'
            : 'Error al crear el artículo')
      );
    }
  }


  function normalizarEncabezado(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  async function prepararArchivoImportacion(archivo, tipo = tipoImportacion) {
    setError('');
    setFilasImportacion([]);
    setResumenImportacion('');
    if (!archivo) return;
    try {
      const buffer = await archivo.arrayBuffer();
      const libro = XLSX.read(buffer, { type: 'array' });
      const preferida = tipo === 'oferta'
        ? libro.SheetNames.find((n) => /oferta/i.test(n)) || libro.SheetNames[0]
        : libro.SheetNames.find((n) => /catalogo habitual/i.test(n)) || libro.SheetNames[0];
      const hoja = libro.Sheets[preferida];
      const datos = XLSX.utils.sheet_to_json(hoja, { defval: '', raw: false });
      if (!datos.length) throw new Error('La hoja seleccionada está vacía.');
      const filas = datos.map((fila) => {
        const m = {};
        Object.entries(fila).forEach(([k, v]) => { m[normalizarEncabezado(k)] = v; });
        const get = (...keys) => {
          for (const key of keys) {
            const v = m[normalizarEncabezado(key)];
            if (v !== undefined && v !== '') return v;
          }
          return '';
        };
        const codigo = get('Codigo', 'Codigo oferta', 'Codigo normalizado', 'SKU', 'Articulo');
        const precio = tipo === 'oferta'
          ? get('Costo neto oferta', 'Precio neto', 'Lista s/IVA', 'Precio')
          : get('Costo neto lista', 'Lista s/IVA', 'Precio neto', 'Precio');
        return {
          codigo: String(codigo ?? '').trim(),
          codigo_normalizado: String(get('Codigo normalizado') || codigo || '').trim(),
          nombre: String(get('Descripcion', 'Modelo descripcion', 'Nombre', 'Modelo') || '').trim(),
          Marca: String(get('Marca') || '').trim(),
          Modelo: String(get('Modelo', 'Modelo descripcion') || '').trim(),
          Caracteristicas: String(get('Caracteristicas', 'Observaciones', 'Carroceria', 'Compatibilidades') || '').trim(),
          precio_neto: Number(String(precio).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')),
          IVA_pct: Number(get('IVA pct', 'IVA') || 21),
          origen: String(get('Origen') || (tipo === 'oferta' ? 'OFERTA FUYAO' : 'Catálogo CHM'))
        };
      }).filter((x) => x.codigo && x.nombre && Number.isFinite(x.precio_neto) && x.precio_neto >= 0);
      if (!filas.length) throw new Error(`No encontré filas válidas en la hoja "${preferida}". Usá el archivo preparado para YC System, con columnas de código, descripción y precio neto.`);
      const claves = new Set();
      const unicas = [];
      let duplicadas = 0;
      filas.forEach((fila) => {
        const clave = fila.codigo_normalizado.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (claves.has(clave)) { duplicadas++; return; }
        claves.add(clave);
        unicas.push(fila);
      });
      setArchivoImportacion(archivo);
      setFilasImportacion(unicas);
      setResumenImportacion(`Hoja: ${preferida}. ${filas.length} filas válidas; ${unicas.length} códigos únicos; ${duplicadas} duplicados omitidos en la vista previa.`);
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo Excel.');
    }
  }

  async function ejecutarImportacion() {
    if (!filasImportacion.length) return;
    setProcesandoImportacion(true);
    setError('');
    try {
      const filasParaEnviar = modoPruebaImportacion ? filasImportacion.slice(0, 5) : filasImportacion;
      const { data } = await api.post('/productos/importar', { tipo: tipoImportacion, filas: filasParaEnviar });
      setResumenImportacion(`${data.mensaje}: ${data.creados} nuevos, ${data.actualizados} existentes, ${data.ofertas_guardadas} precios de oferta guardados y ${data.omitidas} filas omitidas. El stock no se modificó.`);
      setFilasImportacion([]);
      setArchivoImportacion(null);
      await cargarProductos();
    } catch (err) {
      setError(err.response?.data?.detalle || err.response?.data?.error || 'Falló la importación.');
    } finally {
      setProcesandoImportacion(false);
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

  const productosVisibles = productos.filter((producto) => {
    const ofertasProducto = preciosOferta.filter((o) => Number(o.producto_id) === Number(producto.id));
    const tieneOferta = ofertasProducto.length > 0;
    if (filtroOfertas === 'con_oferta' && !tieneOferta) return false;
    if (filtroOfertas === 'sin_oferta' && tieneOferta) return false;
    if (filtroProveedor !== 'todos') {
      const coincideHabitual = String(producto.proveedor_id || '') === filtroProveedor;
      const coincideOferta = ofertasProducto.some((o) => String(o.proveedor_id || '') === filtroProveedor);
      if (!coincideHabitual && !coincideOferta) return false;
    }
    return true;
  });

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
          <button type="button" className="boton boton-secundario" onClick={() => setMostrarImportacion((v) => !v)}>
            {mostrarImportacion ? 'Cerrar importación' : 'Importar Excel'}
          </button>
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
            onClick={abrirNuevoArticulo}
          >
            {mostrarForm && !editandoId
              ? 'Cancelar'
              : '+ Nuevo artículo'}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {mostrarImportacion && (
        <section className="tarjeta" style={{ marginBottom: 16 }}>
          <h2>Importar catálogo de proveedor</h2>
          <p>Importá el Excel preparado para YC System. La importación no modifica existencias ni precios de venta.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            <div>
              <label>Tipo de lista</label>
              <select value={tipoImportacion} onChange={(e) => {
                const tipo = e.target.value;
                setTipoImportacion(tipo);
                if (archivoImportacion) prepararArchivoImportacion(archivoImportacion, tipo);
              }}>
                <option value="catalogo">Catálogo habitual CHM</option>
                <option value="oferta">Oferta FUYAO (precio separado)</option>
              </select>
            </div>
            <div style={{ minWidth: 260, flex: 1 }}>
              <label>Archivo Excel (.xlsx / .xls)</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => prepararArchivoImportacion(e.target.files?.[0])} />
            </div>
          </div>
          {resumenImportacion && <p style={{ marginTop: 12 }}>{resumenImportacion}</p>}
          {filasImportacion.length > 0 && (
            <>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                <input type="checkbox" checked={modoPruebaImportacion} onChange={(e) => setModoPruebaImportacion(e.target.checked)} />
                Modo de prueba: importar solamente los primeros 5 artículos
              </label>
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table>
                  <thead><tr><th>Código</th><th>Artículo</th><th>Precio neto</th><th>IVA %</th></tr></thead>
                  <tbody>
                    {filasImportacion.slice(0, 8).map((fila, i) => (
                      <tr key={`${fila.codigo}-${i}`}>
                        <td>{fila.codigo}</td><td>{fila.nombre}</td><td>${fila.precio_neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td><td>{fila.IVA_pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>Vista previa de hasta 8 filas. {modoPruebaImportacion ? `Modo de prueba: se enviarán ${Math.min(5, filasImportacion.length)} artículos.` : `Se enviarán ${filasImportacion.length} códigos únicos.`} No se cargarán unidades en stock.</p>
              <button type="button" className="boton" onClick={ejecutarImportacion} disabled={procesandoImportacion}>
                {procesandoImportacion ? 'Importando...' : `Confirmar importación (${modoPruebaImportacion ? Math.min(5, filasImportacion.length) : filasImportacion.length})`}
              </button>
            </>
          )}
        </section>
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
        <form className="tarjeta" onSubmit={guardarArticulo}>
          <h3>{editandoId ? 'Editar artículo' : 'Nuevo artículo'}</h3>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label>SKU</label>

              <input
                value={nuevo.sku}
                disabled={Boolean(editandoId)}
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

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 12,
              flexWrap: 'wrap',
            }}
          >
            <button type="submit" className="boton">
              {editandoId ? 'Guardar cambios' : 'Guardar artículo'}
            </button>

            <button
              type="button"
              className="boton boton-secundario"
              onClick={limpiarFormulario}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <section className="tarjeta" style={{ marginBottom: 16, display: 'flex', gap: 14, alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, flex: 1 }}>
          <label htmlFor="filtro-ofertas">Mostrar artículos</label>
          <select id="filtro-ofertas" value={filtroOfertas} onChange={(e) => setFiltroOfertas(e.target.value)} style={{ width: '100%', minHeight: 42 }}>
            <option value="todos">Todos los artículos</option>
            <option value="con_oferta">Solo artículos con oferta de proveedor</option>
            <option value="sin_oferta">Artículos sin oferta</option>
          </select>
        </div>
        <div style={{ minWidth: 220, flex: 1 }}>
          <label htmlFor="filtro-proveedor">Filtrar por proveedor</label>
          <select id="filtro-proveedor" value={filtroProveedor} onChange={(e) => setFiltroProveedor(e.target.value)} style={{ width: '100%', minHeight: 42 }}>
            <option value="todos">Todos los proveedores</option>
            {proveedores.map((proveedor) => <option key={proveedor.id} value={String(proveedor.id)}>{proveedor.nombre}</option>)}
          </select>
        </div>
        <div style={{ color: '#475569', paddingBottom: 8 }}>
          Mostrando <strong>{productosVisibles.length}</strong> de {productos.length} artículos · <strong>{productos.filter((p) => preciosOferta.some((o) => Number(o.producto_id) === Number(p.id))).length}</strong> con oferta
        </div>
      </section>

      <div className="tarjeta">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Cód. barras</th>
              <th>Nombre</th>
              <th>Proveedor</th>
              <th>Costo habitual (con IVA)</th>
              <th>Oferta proveedor (con IVA)</th>
              <th>Precio venta</th>
              <th>IVA</th>
              <th>Comparar</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {productosVisibles.length === 0 && !buscando && (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    textAlign: 'center',
                    padding: 30,
                  }}
                >
                  No se encontraron artículos.
                </td>
              </tr>
            )}

            {productosVisibles.map((producto) => (
              <Fragment key={producto.id}>
                <tr>
                  <td>{producto.sku}</td>
                  <td>{producto.codigo_barras || '—'}</td>
                  <td>{producto.nombre}</td>
                  <td>{producto.proveedor_nombre || '—'}</td>
                  <td>
                    <div>${Number(producto.precio_costo || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>(neto)</small></div>
                    <strong>${(Number(producto.precio_costo || 0) * (1 + Number(producto.iva_porcentaje || 0) / 100)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    <small> (con IVA)</small>
                  </td>
                  <td>
                    {preciosOferta.filter((o) => Number(o.producto_id) === Number(producto.id)).length ? (
                      <div style={{ minWidth: 150 }}>
                        {preciosOferta.filter((o) => Number(o.producto_id) === Number(producto.id)).map((o) => (
                          <div key={o.id} style={{ marginBottom: 6 }}>
                            <strong>{o.proveedor_nombre}</strong>
                            <div>${Number(o.precio_neto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>(neto)</small></div>
                            <strong>${(Number(o.precio_neto || 0) * (1 + Number(producto.iva_porcentaje || 0) / 100)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>(con IVA)</small></strong>
                          </div>
                        ))}
                      </div>
                    ) : <span style={{ color: '#6b7280' }}>Sin oferta</span>}
                  </td>
                  <td>
                    ${Number(producto.precio_venta || 0).toFixed(2)}
                  </td>
                  <td>{producto.iva_porcentaje}%</td>
                  <td><button type="button" className="boton boton-secundario" onClick={() => setProductoComparar(producto)}>Comparar proveedores</button></td>

                  <td>
                    <div
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

                      <button
                        type="button"
                        className="boton boton-secundario"
                        onClick={() => editarArticulo(producto)}
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>

                {expandido === producto.id && (
                  <tr>
                    <td
                      colSpan={10}
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

      {productoComparar && (() => {
        const producto = productoComparar;
        const iva = Number(producto.iva_porcentaje || 0);
        const ofertas = preciosOferta.filter((o) => Number(o.producto_id) === Number(producto.id));
        const fmt = (n) => `$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const costoHabitual = Number(producto.precio_costo || 0);
        const opciones = [
          { proveedor: producto.proveedor_nombre || 'Proveedor habitual', neto: costoHabitual, total: costoHabitual * (1 + iva / 100), tipo: 'Habitual' },
          ...ofertas.map((o) => ({ proveedor: o.proveedor_nombre || 'Proveedor de oferta', neto: Number(o.precio_neto || 0), total: Number(o.precio_neto || 0) * (1 + iva / 100), tipo: o.origen || 'Oferta' }))
        ].filter((o, i, arr) => i === 0 || !(o.proveedor === arr[0].proveedor && o.neto === arr[0].neto));
        const minimo = opciones.length > 1 ? Math.min(...opciones.map((o) => o.total)) : null;
        return (
          <div role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setProductoComparar(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <section role="dialog" aria-modal="true" aria-label="Comparación de proveedores" className="tarjeta" style={{ width: 'min(900px, 100%)', maxHeight: '85vh', overflow: 'auto', padding: 24, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
                <div><h2 style={{ marginTop: 0 }}>Comparar proveedores</h2><strong>{producto.nombre}</strong><div style={{ color: '#64748b', marginTop: 4 }}>Código: {producto.sku}</div></div>
                <button type="button" className="boton boton-secundario" onClick={() => setProductoComparar(null)}>Cerrar</button>
              </div>
              <p style={{ color: '#475569' }}>Comparación con IVA incluido al {iva}%. La oferta se muestra solo si está guardada para este mismo artículo/código.</p>
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%' }}><thead><tr><th>Proveedor</th><th>Tipo de precio</th><th>Neto</th><th>Total con IVA</th><th>Comparación</th></tr></thead><tbody>
                {opciones.map((o, i) => <tr key={`${o.proveedor}-${o.tipo}-${i}`}><td><strong>{o.proveedor}</strong></td><td>{o.tipo}</td><td>{fmt(o.neto)}</td><td><strong>{fmt(o.total)}</strong></td><td>{minimo !== null && o.total === minimo ? <strong style={{ color: '#15803d' }}>Menor precio</strong> : minimo !== null ? fmt(o.total - minimo) + ' más caro' : 'Sin otro precio para comparar'}</td></tr>)}
              </tbody></table></div>
              {ofertas.length === 0 && <p style={{ marginTop: 16, color: '#b45309' }}>Este artículo no tiene una oferta vinculada. Probá buscar el código en la lista de ofertas o verificá que coincida con el código CHM.</p>}
            </section>
          </div>
        );
      })()}
    </div>
  );
}