import { useEffect, useState } from 'react';
import api from '../api/client';

export default function Inicio() {
  const [bajoStock, setBajoStock] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get('/productos/bajo-stock')
      .then((res) => setBajoStock(res.data))
      .catch(() => setBajoStock([]))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div>
      <h1>Panel principal</h1>
      <div className="tarjeta">
        <h3>Alertas de stock bajo</h3>
        {cargando ? (
          <p>Cargando...</p>
        ) : bajoStock.length === 0 ? (
          <p>No hay productos por debajo del stock mínimo.</p>
        ) : (
          <table>
            <thead>
              <tr><th>SKU</th><th>Producto</th><th>Stock actual</th><th>Stock mínimo</th></tr>
            </thead>
            <tbody>
              {bajoStock.map((p) => (
                <tr key={p.id}>
                  <td>{p.sku}</td>
                  <td>{p.nombre}</td>
                  <td><span className="badge">{p.stock_actual}</span></td>
                  <td>{p.stock_minimo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
