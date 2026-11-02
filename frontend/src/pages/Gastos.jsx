import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const VACIO = {
  categoria: '', tipo_comprobante: 'factura', numero_comprobante: '',
  proveedor_id: '', monto: '', fecha: new Date().toISOString().slice(0, 10),
  fecha_vencimiento: '', descripcion: '', estado_pago: 'pendiente',
  recordatorio_dias: 7,
};
const PAGO_VACIO = { monto: '', fecha: new Date().toISOString().slice(0, 10), medio_pago: '', observaciones: '' };

function dinero(v) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(Number(v || 0));
}
function fechaCorta(v) {
  return v ? String(v).slice(0, 10) : '—';
}
function diasHasta(fecha) {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f = new Date(`${String(fecha).slice(0,10)}T00:00:00`);
  return Math.round((f - hoy) / 86400000);
}

export default function Gastos() {
  const [gastos, setGastos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);
  const [editando, setEditando] = useState(null);
  const [pagoDe, setPagoDe] = useState(null);
  const [pagoSoloLectura, setPagoSoloLectura] = useState(false);
  const [pago, setPago] = useState(PAGO_VACIO);
  const [pagos, setPagos] = useState([]);
  const [filtro, setFiltro] = useState({ desde: '', hasta: '', estado: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cargar(params = filtro) {
    try {
      const query = {};
      if (params.desde) query.desde = params.desde;
      if (params.hasta) query.hasta = params.hasta;
      if (params.estado) query.estado = params.estado;
      const [g, p] = await Promise.all([api.get('/gastos', { params: query }), api.get('/compras/proveedores')]);
      setGastos(Array.isArray(g.data) ? g.data : []);
      setProveedores(Array.isArray(p.data) ? p.data : []);
      setError('');
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudieron cargar los gastos.');
    }
  }
  useEffect(() => { cargar({ desde: '', hasta: '', estado: '' }); }, []);

  const resumen = useMemo(() => gastos.reduce((a, g) => {
    const total = Number(g.monto || 0), pagado = Number(g.total_pagado || 0), saldo = Math.max(0, total - pagado);
    a.total += total; a.pagado += pagado; a.pendiente += saldo;
    if (g.estado_calculado === 'vencido') a.vencido += saldo;
    return a;
  }, { total: 0, pagado: 0, pendiente: 0, vencido: 0 }), [gastos]);

  const recordatorios = gastos.filter(g => Number(g.saldo_pendiente || 0) > 0 && g.fecha_vencimiento)
    .map(g => ({ ...g, dias: diasHasta(g.fecha_vencimiento) }))
    .filter(g => g.dias !== null && g.dias <= Number(g.recordatorio_dias ?? 7))
    .sort((a,b) => a.dias - b.dias);

  function abrirNuevo() { setEditando(null); setNuevo({ ...VACIO }); setMostrarForm(true); setError(''); }
  function abrirEditar(g) {
    setEditando(g.id);
    setNuevo({ categoria: g.categoria || '', tipo_comprobante: g.tipo_comprobante || 'factura',
      numero_comprobante: g.numero_comprobante || '', proveedor_id: g.proveedor_id || '',
      monto: String(g.monto || ''), fecha: fechaCorta(g.fecha), fecha_vencimiento: fechaCorta(g.fecha_vencimiento) === '—' ? '' : fechaCorta(g.fecha_vencimiento),
      descripcion: g.descripcion || '', estado_pago: g.estado_calculado === 'pagado' ? 'pagado' : 'pendiente',
      recordatorio_dias: Number(g.recordatorio_dias ?? 7) });
    setMostrarForm(true); setError('');
  }
  async function guardar(e) {
    e.preventDefault(); setGuardando(true); setError('');
    try {
      if (editando) await api.put(`/gastos/${editando}`, nuevo);
      else await api.post('/gastos', nuevo);
      setMostrarForm(false); setEditando(null); setNuevo({ ...VACIO });
      await cargar();
    } catch (e) { setError(e.response?.data?.error || 'No se pudo guardar el gasto.'); }
    finally { setGuardando(false); }
  }
  async function eliminar(g) {
    if (!window.confirm(`¿Eliminar el gasto "${g.categoria}" por ${dinero(g.monto)}? También se eliminará su historial de pagos.`)) return;
    try { await api.delete(`/gastos/${g.id}`); await cargar(); }
    catch (e) { setError(e.response?.data?.error || 'No se pudo eliminar el gasto.'); }
  }
  async function abrirPago(g, soloLectura = false) {
    setPagoDe(g); setPagoSoloLectura(soloLectura); setPago({ ...PAGO_VACIO, monto: String(g.saldo_pendiente || '') });
    try { const r = await api.get(`/gastos/${g.id}/pagos`); setPagos(r.data || []); }
    catch { setPagos([]); }
  }
  async function guardarPago(e) {
    e.preventDefault(); if (!pagoDe) return; setGuardando(true); setError('');
    try {
      await api.post(`/gastos/${pagoDe.id}/pagos`, pago);
      setPagoDe(null); setPagoSoloLectura(false); setPago({ ...PAGO_VACIO }); await cargar();
    } catch (e) { setError(e.response?.data?.error || 'No se pudo registrar el pago.'); }
    finally { setGuardando(false); }
  }
  const campo = (label, name, type='text', required=false) => (
    <div style={{ flex: 1, minWidth: 180 }}>
      <label>{label}</label>
      <input type={type} value={nuevo[name] ?? ''} required={required}
        onChange={e => setNuevo({ ...nuevo, [name]: e.target.value })} />
    </div>
  );

  return <div>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
      <h1>Centro de costos</h1>
      <button className="boton" onClick={abrirNuevo}>+ Nuevo gasto / cuenta</button>
    </div>
    {error && <div className="error" style={{ margin:'12px 0' }}>{error}</div>}

    {recordatorios.length > 0 && <div className="tarjeta" style={{ marginBottom:16 }}>
      <h3 style={{ marginTop:0 }}>Próximos vencimientos y cuentas atrasadas</h3>
      {recordatorios.map(g => <div key={g.id} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'9px 0', borderBottom:'1px solid #e5e7eb', flexWrap:'wrap' }}>
        <div><strong>{g.categoria}</strong> · {g.proveedor_nombre || 'Sin proveedor'}<div style={{ fontSize:12, color:'#667085' }}>Vence: {fechaCorta(g.fecha_vencimiento)} · {g.dias < 0 ? `Vencido hace ${Math.abs(g.dias)} días` : g.dias === 0 ? 'Vence hoy' : `Vence en ${g.dias} días`}</div></div>
        <strong>{dinero(g.saldo_pendiente)} pendiente</strong>
      </div>)}
    </div>}

    <div className="tarjeta" style={{ display:'flex', gap:18, flexWrap:'wrap', alignItems:'center' }}>
      <div><small>Total de cuentas</small><div style={{ fontSize:22, fontWeight:700 }}>{dinero(resumen.total)}</div></div>
      <div><small>Pagado</small><div style={{ fontSize:22, fontWeight:700, color:'#16803d' }}>{dinero(resumen.pagado)}</div></div>
      <div><small>Saldo pendiente</small><div style={{ fontSize:22, fontWeight:700, color:'#b54708' }}>{dinero(resumen.pendiente)}</div></div>
      <div><small>Vencido</small><div style={{ fontSize:22, fontWeight:700, color:'#b42318' }}>{dinero(resumen.vencido)}</div></div>
    </div>

    <form className="tarjeta" onSubmit={e => { e.preventDefault(); cargar(); }} style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
      <div><label>Desde</label><input type="date" value={filtro.desde} onChange={e=>setFiltro({...filtro,desde:e.target.value})}/></div>
      <div><label>Hasta</label><input type="date" value={filtro.hasta} onChange={e=>setFiltro({...filtro,hasta:e.target.value})}/></div>
      <div><label>Estado</label><select value={filtro.estado} onChange={e=>setFiltro({...filtro,estado:e.target.value})}><option value="">Todos</option><option value="pendiente">Pendiente</option><option value="pagado">Pagado</option><option value="vencido">Vencido</option></select></div>
      <button className="boton boton-secundario">Filtrar</button>
    </form>

    {mostrarForm && <form className="tarjeta" onSubmit={guardar}>
      <h3>{editando ? 'Editar gasto / cuenta' : 'Nuevo gasto / cuenta'}</h3>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>{campo('Categoría / concepto','categoria','text',true)}{campo('Monto total de la cuenta','monto','number',true)}</div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:180 }}><label>Proveedor</label><select value={nuevo.proveedor_id} onChange={e=>setNuevo({...nuevo,proveedor_id:e.target.value})}><option value="">Sin especificar</option>{proveedores.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
        {!editando && <div style={{ flex:1, minWidth:180 }}><label>Estado inicial</label><select value={nuevo.estado_pago} onChange={e=>setNuevo({...nuevo,estado_pago:e.target.value})}><option value="pendiente">Pendiente</option><option value="pagado">Pagado completo</option></select></div>}
      </div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <div style={{ flex:1,minWidth:180 }}><label>Fecha del gasto</label><input type="date" value={nuevo.fecha} required onChange={e=>setNuevo({...nuevo,fecha:e.target.value})}/></div>
        <div style={{ flex:1,minWidth:180 }}><label>Fecha de vencimiento</label><input type="date" value={nuevo.fecha_vencimiento} onChange={e=>setNuevo({...nuevo,fecha_vencimiento:e.target.value})}/></div>
        <div style={{ flex:1,minWidth:150 }}><label>Recordar con anticipación</label><select value={nuevo.recordatorio_dias} onChange={e=>setNuevo({...nuevo,recordatorio_dias:Number(e.target.value)})}><option value={0}>Solo el día del vencimiento</option><option value={3}>3 días antes</option><option value={7}>7 días antes</option><option value={15}>15 días antes</option><option value={30}>30 días antes</option></select></div>
      </div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
        <div style={{ flex:1,minWidth:180 }}><label>Tipo de comprobante</label><select value={nuevo.tipo_comprobante} onChange={e=>setNuevo({...nuevo,tipo_comprobante:e.target.value})}><option value="factura">Factura</option><option value="remito">Remito</option><option value="otro">Otro</option></select></div>
        <div style={{ flex:1,minWidth:180 }}><label>Número de comprobante</label><input value={nuevo.numero_comprobante} onChange={e=>setNuevo({...nuevo,numero_comprobante:e.target.value})}/></div>
      </div>
      <label>Descripción / observaciones</label><textarea rows={2} value={nuevo.descripcion} onChange={e=>setNuevo({...nuevo,descripcion:e.target.value})}/>
      <div style={{ display:'flex', gap:10 }}><button className="boton" disabled={guardando}>{guardando?'Guardando...':'Guardar'}</button><button type="button" className="boton boton-secundario" onClick={()=>{setMostrarForm(false);setEditando(null);}}>Cancelar</button></div>
    </form>}

    {pagoDe && <div className="tarjeta">
      <h3>{pagoSoloLectura ? 'Historial de pagos' : 'Registrar pago'} · {pagoDe.categoria}</h3>
      <p>Saldo pendiente: <strong>{dinero(pagoDe.saldo_pendiente)}</strong></p>
      {!pagoSoloLectura && <form onSubmit={guardarPago}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <div style={{ flex:1,minWidth:180 }}><label>Importe pagado</label><input type="number" min="0.01" max={pagoDe.saldo_pendiente} step="0.01" required value={pago.monto} onChange={e=>setPago({...pago,monto:e.target.value})}/></div>
          <div style={{ flex:1,minWidth:180 }}><label>Fecha de pago</label><input type="date" required value={pago.fecha} onChange={e=>setPago({...pago,fecha:e.target.value})}/></div>
          <div style={{ flex:1,minWidth:180 }}><label>Medio de pago</label><select value={pago.medio_pago} onChange={e=>setPago({...pago,medio_pago:e.target.value})}><option value="">Sin especificar</option><option>Efectivo</option><option>Transferencia</option><option>Débito</option><option>Crédito</option><option>Cheque</option><option>Otro</option></select></div>
        </div>
        <label>Observaciones</label><input value={pago.observaciones} onChange={e=>setPago({...pago,observaciones:e.target.value})}/>
        <button className="boton" disabled={guardando}>{guardando?'Guardando...':'Registrar pago'}</button>
      </form>}
      {pagos.length>0 && <div style={{ marginTop:14 }}><strong>Historial de pagos</strong>{pagos.map(x=><div key={x.id} style={{ padding:'6px 0', borderBottom:'1px solid #eee' }}>{fechaCorta(x.fecha)} · {dinero(x.monto)} · {x.medio_pago || 'Medio no indicado'}{x.observaciones ? ` · ${x.observaciones}` : ''}</div>)}</div>}
      {!pagos.length && <p>No hay pagos registrados todavía.</p>}
      <button type="button" className="boton boton-secundario" onClick={()=>{setPagoDe(null);setPagoSoloLectura(false);}} style={{ marginTop:8 }}>Cerrar</button>
    </div>}

    <div className="tarjeta" style={{ overflowX:'auto' }}>
      <table>
        <thead><tr><th>Fecha</th><th>Vencimiento</th><th>Concepto</th><th>Proveedor</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
          {gastos.map(g=><tr key={g.id}>
            <td>{fechaCorta(g.fecha)}</td><td>{fechaCorta(g.fecha_vencimiento)}</td>
            <td>{g.categoria}<div style={{fontSize:11,color:'#667085'}}>{g.descripcion || ''}</div></td>
            <td>{g.proveedor_nombre || '—'}</td><td>{dinero(g.monto)}</td><td>{dinero(g.total_pagado)}</td><td><strong>{dinero(g.saldo_pendiente)}</strong></td>
            <td><span style={{fontWeight:700,color:g.estado_calculado==='pagado'?'#16803d':g.estado_calculado==='vencido'?'#b42318':'#b54708'}}>{g.estado_calculado==='pagado'?'Pagado':g.estado_calculado==='vencido'?'Vencido':'Pendiente'}</span></td>
            <td style={{whiteSpace:'nowrap'}}><button className="boton boton-secundario" onClick={()=>abrirEditar(g)}>Editar</button>{Number(g.saldo_pendiente)>0 && <button className="boton" style={{marginLeft:5}} onClick={()=>abrirPago(g,false)}>Pagar</button>}<button className="boton boton-secundario" style={{marginLeft:5}} onClick={()=>abrirPago(g,true)}>Historial</button><button className="boton boton-secundario" style={{marginLeft:5}} onClick={()=>eliminar(g)}>Eliminar</button></td>
          </tr>)}
          {!gastos.length && <tr><td colSpan="9" style={{textAlign:'center',padding:24}}>No hay gastos para mostrar.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
