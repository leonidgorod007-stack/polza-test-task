// Минимальный CSV-парсер (RFC 4180): кавычки, экранированные "", запятые
// и переносы строк внутри кавычек. Без внешних зависимостей.
export function parseCSV(text) {
  const rows = [];
  let field = '', row = [], inQuotes = false, i = 0;
  text = text.replace(/^﻿/, ''); // срезаем BOM, если есть
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
