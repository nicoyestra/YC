import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const VACIO = {
  productos: [],
  clientes: [],
  ventas: [],
  compras: [],
  facturas: [],
};

export default function BuscadorGlobal() {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState(VACIO);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);

  const contenedorRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const termino = texto.trim();

    const timer = setTimeout(async () => {
      if (termino.length < 2) {
        setResultados(VACIO);
        setAbierto(false);
        return;
      }

      try {
        setCargando(true);

        const { data } = await api.get('/busqueda', {
          params: { q: termino },
        });

        setResultados(data);
        setAbierto(true);
      } catch {
        setResultados(VACIO);
        setAbierto(false);
      } finally {
        setCargando(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [texto]);

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

  useEffect(() => {
    function atajo(evento) {
      if (
        (evento.ctrlKey || evento.metaKey) &&
        evento.key.toLowerCase() === 'k'
      ) {
        evento.preventDefault();

        const input =
          contenedorRef.current?.querySelector('input');

        input?.focus();
      }

      if (evento.key === 'Escape') {
        setAbierto(false);
      }
    }

    document.addEventListener('keydown', atajo);

    return () => {
      document.removeEventListener('keydown', atajo);
    };
  }, []);

  function irA(ruta) {
    setAbierto(false);
    setTexto('');
    navigate(ruta);
  }

  const total =
    resultados.productos.length +
    resultados.clientes.length +
    resultados.ventas.length +
    resultados.compras.length +
    resultados.facturas.length;

  return (
    <div className="global-search" ref={contenedorRef}>
      <div className="global-search-input-wrap">
        <span className="global-search-icon">⌕</span>

        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => {
            if (texto.trim().length >= 2) {
              setAbierto(true);
            }
          }}
          placeholder="Buscar en todo el sistema..."
          autoComplete="off"
        />

        <kbd>Ctrl K</kbd>
      </div>

      {abierto && (
        <div className="global-search-popover">
          {cargando ? (
            <div className="global-search-empty">
              Buscando...
            </div>
          ) : total === 0 ? (
            <div className="global-search-empty">
              No se encontraron resultados.
            </div>
          ) : (
            <div className="global-search-results">
              {resultados.productos.length > 0 && (
                <section>
                  <h4>Artículos</h4>

                  {resultados.productos.map((producto) => (
                    <button
                      key={`producto-${producto.id}`}
                      type="button"
                      onClick={() => irA('/articulos')}
                    >
                      <span className="global-result-icon">▦</span>

                      <span>
                        <strong>{producto.nombre}</strong>
                        <small>
                          SKU: {producto.sku || '—'}
                          {' · '}
                          Stock: {producto.stock_total ?? 0}
                        </small>
                      </span>
                    </button>
                  ))}
                </section>
              )}

              {resultados.clientes.length > 0 && (
                <section>
                  <h4>Clientes</h4>

                  {resultados.clientes.map((cliente) => (
                    <button
                      key={`cliente-${cliente.id}`}
                      type="button"
                      onClick={() => irA('/clientes')}
                    >
                      <span className="global-result-icon">♙</span>

                      <span>
                        <strong>{cliente.nombre}</strong>
                        <small>
                          {cliente.cuit_dni || 'Sin CUIT/DNI'}
                          {cliente.email
                            ? ` · ${cliente.email}`
                            : ''}
                        </small>
                      </span>
                    </button>
                  ))}
                </section>
              )}

              {resultados.ventas.length > 0 && (
                <section>
                  <h4>Ventas</h4>

                  {resultados.ventas.map((venta) => (
                    <button
                      key={`venta-${venta.id}`}
                      type="button"
                      onClick={() => irA('/ventas')}
                    >
                      <span className="global-result-icon">↑</span>

                      <span>
                        <strong>{venta.numero}</strong>
                        <small>
                          {venta.cliente_nombre}
                          {' · '}
                          {venta.estado}
                        </small>
                      </span>
                    </button>
                  ))}
                </section>
              )}

              {resultados.compras.length > 0 && (
                <section>
                  <h4>Compras</h4>

                  {resultados.compras.map((compra) => (
                    <button
                      key={`compra-${compra.id}`}
                      type="button"
                      onClick={() => irA('/compras')}
                    >
                      <span className="global-result-icon">↓</span>

                      <span>
                        <strong>{compra.numero}</strong>
                        <small>
                          {compra.proveedor_nombre}
                          {' · '}
                          {compra.estado}
                        </small>
                      </span>
                    </button>
                  ))}
                </section>
              )}

              {resultados.facturas.length > 0 && (
                <section>
                  <h4>Facturas</h4>

                  {resultados.facturas.map((factura) => (
                    <button
                      key={`factura-${factura.id}`}
                      type="button"
                      onClick={() => irA('/facturacion')}
                    >
                      <span className="global-result-icon">▤</span>

                      <span>
                        <strong>{factura.numero}</strong>
                        <small>
                          {factura.cliente_nombre}
                          {' · '}
                          {factura.estado}
                        </small>
                      </span>
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}