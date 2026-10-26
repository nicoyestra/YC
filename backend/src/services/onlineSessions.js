// Seguimiento en memoria de las sesiones activas. Si el servidor se reinicia,
// los usuarios vuelven a figurar en línea cuando envían su próximo heartbeat.
const sesiones = new Map();
const VENTANA_ACTIVA_MS = 90 * 1000;

function clave(empresaId, email) {
  return `${Number(empresaId)}:${String(email || '').trim().toLowerCase()}`;
}

function marcarEnLinea(empresaId, email) {
  if (!empresaId || !email) return;
  sesiones.set(clave(empresaId, email), Date.now());
}

function marcarDesconectado(empresaId, email) {
  if (!empresaId || !email) return;
  sesiones.delete(clave(empresaId, email));
}

function estaEnLinea(empresaId, email) {
  const k = clave(empresaId, email);
  const ultimaSenal = sesiones.get(k);
  if (!ultimaSenal) return false;
  if (Date.now() - ultimaSenal > VENTANA_ACTIVA_MS) {
    sesiones.delete(k);
    return false;
  }
  return true;
}

module.exports = { marcarEnLinea, marcarDesconectado, estaEnLinea };
