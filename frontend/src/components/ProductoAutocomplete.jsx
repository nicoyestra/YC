import { useEffect, useRef, useState } from 'react';

export default function ProductoAutocomplete({
  productos,
  value,
  onChange,
  placeholder = 'Buscar por nombre, SKU o código...',
  mostrarStock = true,
}) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);

  const productoSeleccionado = productos.find(
    (producto) => producto.id === Number(value)
  );

  useEffect(() => {
    if (productoSeleccionado) {
      setTexto(
        `${productoSeleccionado.sku} — ${productoSeleccionado.nombre}`
      );
    } else if (!value) {
      setTexto('');
    }
  }, [value, productoSeleccionado]);

  useEffect(() => {
    function cerrarFuera(evento) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target)
      ) {
        setAbierto(false);
      }
    }

    document.addEventListener('mousedown', cerrarFuera);

    return () => {
      document.removeEventListener('mousedown', cerrarFuera);
    };
  }, []);

  const termino = texto.trim().toLowerCase();

  const resultados = productos
    .filter((producto) => {
      if (!termino) return true;

      return [
        producto.nombre,
        producto.sku,
        producto.codigo_barras,
        producto.descripcion,
      ].some((campo) =>
        String(campo || '').toLowerCase().includes(termino)
      );
    })
    .slice(0, 12);

  function seleccionar(producto) {
    setTexto(`${producto.sku} — ${producto.nombre}`);
    setAbierto(false);
    onChange(producto);
  }

  function cambiarTexto(evento) {
    setTexto(evento.target.value);
    setAbierto(true);

    if (value) {
      onChange(null);
    }
  }

  return (
    <div
      ref={contenedorRef}
      className="producto-autocomplete"
      style={{ position: 'relative' }}
    >
      <input
        type="text"
        value={texto}
        onChange={cambiarTexto}
        onFocus={() => setAbierto(true)}
        placeholder={placeholder}
        autoComplete="off"
      />

      {abierto && (
        <div className="producto-sugerencias">
          {resultados.length > 0 ? (
            resultados.map((producto) => (
              <button
                key={producto.id}
                type="button"
                className="producto-sugerencia"
                onClick={() => seleccionar(producto)}
              >
                <span className="producto-sugerencia-nombre">
                  {producto.nombre}
                </span>

                <span className="producto-sugerencia-detalle">
                  SKU: {producto.sku || 'Sin SKU'}
                  {producto.codigo_barras
                    ? ` · Código: ${producto.codigo_barras}`
                    : ''}
                  {mostrarStock
                    ? ` · Stock: ${producto.stock_total ?? 0}`
                    : ''}
                </span>

                {producto.descripcion && (
                  <span className="producto-sugerencia-descripcion">
                    {producto.descripcion}
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="producto-sin-resultados">
              No se encontraron productos.
            </div>
          )}
        </div>
      )}
    </div>
  );
}