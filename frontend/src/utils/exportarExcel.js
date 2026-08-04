import * as XLSX from 'xlsx';

export function exportarExcel(datos, nombreArchivo = 'exportacion') {
  if (!datos || datos.length === 0) {
    alert('No hay datos para exportar.');
    return;
  }

  const hoja = XLSX.utils.json_to_sheet(datos);

  const libro = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(libro, hoja, 'Datos');

  XLSX.writeFile(libro, `${nombreArchivo}.xlsx`);
}