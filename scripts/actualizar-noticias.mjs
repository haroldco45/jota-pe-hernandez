// Robot de noticias — Jota Pe Hernández · Vibras Positivas HM
// Lo ejecuta GitHub Actions cada 30 minutos. Escribe noticias.json solo si hay cambios.
import { readFile, writeFile } from 'node:fs/promises';

const ARCHIVO = 'noticias.json';
const CONSULTAS = ['"Jota Pe Hernández"', '"JP Hernández" senador', '"Jonathan Pulido" senador'];
const HANDLE = 'JotaPeHernandez';
const MAX_NOTICIAS = 80;
const DIAS_MAX = 45;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

const decodificar = t => (t || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&amp;/g, '&').trim();
const etiqueta = (xml, tag) => decodificar((xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1]);
const clave = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 70);

export function parsearNoticias(xml) {
  return xml.split('<item>').slice(1).map(bloque => {
    const fuente = etiqueta(bloque, 'source');
    let titulo = etiqueta(bloque, 'title');
    if (fuente && titulo.endsWith(' - ' + fuente)) titulo = titulo.slice(0, -(fuente.length + 3));
    const fecha = new Date(etiqueta(bloque, 'pubDate'));
    return { titulo, enlace: etiqueta(bloque, 'link'), fuente, fecha: isNaN(fecha) ? null : fecha.toISOString() };
  }).filter(n => n.titulo && n.enlace && n.fecha);
}

export function parsearVideos(xml) {
  return xml.split('<entry>').slice(1).map(b => ({
    id: etiqueta(b, 'yt:videoId'),
    titulo: etiqueta(b, 'title'),
    fecha: etiqueta(b, 'published'),
  })).filter(v => v.id);
}

async function traer(url, opciones = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CO,es;q=0.9' }, ...opciones });
  if (!r.ok) throw new Error(`${r.status} en ${url}`);
  return r.text();
}

async function buscarNoticias() {
  const todas = [];
  for (const c of CONSULTAS) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(c + ' when:30d')}&hl=es-419&gl=CO&ceid=CO:es-419`;
    try { todas.push(...parsearNoticias(await traer(url))); }
    catch (e) { console.warn('Noticias:', e.message); }
  }
  return todas;
}

async function buscarCanal(previo) {
  if (previo) return previo;
  try {
    const html = await traer(`https://www.youtube.com/@${HANDLE}`, { headers: { 'User-Agent': UA, Cookie: 'CONSENT=YES+1' } });
    return (html.match(/"externalId":"(UC[\w-]{22})"/) || html.match(/channel_id=(UC[\w-]{22})/) || html.match(/"browseId":"(UC[\w-]{22})"/) || [])[1] || null;
  } catch (e) { console.warn('Canal:', e.message); return null; }
}

async function buscarVideos(canal) {
  if (!canal) return [];
  try { return parsearVideos(await traer(`https://www.youtube.com/feeds/videos.xml?channel_id=${canal}`)).slice(0, 8); }
  catch (e) { console.warn('Videos:', e.message); return []; }
}

async function main() {
  let previo = { noticias: [], videos: [] };
  try { previo = JSON.parse(await readFile(ARCHIVO, 'utf8')); } catch {}

  const [nuevas, canal] = await Promise.all([buscarNoticias(), buscarCanal(previo.canal)]);
  const videos = await buscarVideos(canal);

  const limite = Date.now() - DIAS_MAX * 86400000;
  const mapa = new Map();
  for (const n of [...nuevas, ...(previo.noticias || [])]) {
    if (new Date(n.fecha).getTime() < limite) continue;
    const k = clave(n.titulo);
    if (!mapa.has(k)) mapa.set(k, n);
  }
  const noticias = [...mapa.values()].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, MAX_NOTICIAS);

  const contenido = { canal: canal || previo.canal || null, noticias, videos: videos.length ? videos : (previo.videos || []) };
  const { actualizado, ...previoSinFecha } = previo;
  if (JSON.stringify(contenido) === JSON.stringify(previoSinFecha)) {
    console.log('Sin cambios.');
    return;
  }
  await writeFile(ARCHIVO, JSON.stringify({ actualizado: new Date().toISOString(), ...contenido }, null, 2) + '\n');
  console.log(`Guardado: ${noticias.length} noticias, ${contenido.videos.length} videos.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
