import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import Layout from './components/Layout';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import Articulos from './pages/Articulos';
import Inventario from './pages/Inventario';
import Compras from './pages/Compras';
import Ventas from './pages/Ventas';
import Devoluciones from './pages/Devoluciones';
import Clientes from './pages/Clientes';
import Facturacion from './pages/Facturacion';
import Logistica from './pages/Logistica';
import InventarioDanado from './pages/InventarioDanado';
import Gastos from './pages/Gastos';
import Estadisticas from './pages/Estadisticas';
import RRHH from './pages/RRHH';
import Usuarios from './pages/Usuarios';
import Presupuestos from './pages/Presupuestos';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RutaProtegida>
                <Layout />
              </RutaProtegida>
            }
          >
            <Route index element={<Inicio />} />
            <Route path="articulos" element={<Articulos />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="compras" element={<Compras />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="devoluciones" element={<Devoluciones />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="facturacion" element={<Facturacion />} />
            <Route path="presupuestos" element={<Presupuestos />} />
            <Route path="logistica" element={<Logistica />} />
            <Route path="inventario-danado" element={<InventarioDanado />} />
            <Route path="gastos" element={<Gastos />} />
            <Route path="estadisticas" element={<Estadisticas />} />
            <Route path="rrhh" element={<RRHH />} />
            <Route path="usuarios" element={<Usuarios />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
