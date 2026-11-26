import { db } from '../firebase-init/firebase-init.js';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const _U = s => String(s ?? '').trim().toUpperCase();
const slugId = s => _U(s).replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const NOMBRE = { SALON: 'Salón', RETIRO: 'Retiro', DELIVERY: 'Delivery' };
const fmtLocal = (d = new Date()) => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const CSS = `
.ad{--card:#202833;--txt:#e9eef4;--tenue:#93a1b3;--acento:#4da3e0;--ok:#56c48f;--aviso:#f0b13c;max-width:70rem;margin:0 auto;padding:1rem;color:var(--txt);font:16px/1.4 system-ui,sans-serif}
.ad h1{margin:.2rem 0 1rem}.ad h2{font-size:1.05rem;color:var(--tenue);margin:0 0 .6rem}.ad button,.ad input,.ad select{font:inherit;border-radius:10px;border:2px solid #34404f;background:#10151c;color:var(--txt);padding:.6rem .8rem}
.ad button{background:var(--acento);color:#06121d;font-weight:700;border:0;cursor:pointer}.ad button.sec{background:#2d3846;color:var(--txt)}.ad .pin{max-width:22rem;margin:12vh auto;text-align:center}.ad .pin input{width:100%;margin:.8rem 0;text-align:center;font-size:1.6rem;letter-spacing:.4rem}
.ad .bar{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem;align-items:end}.ad .bar label{display:block;color:var(--tenue);font-size:.85rem}.ad .err{color:var(--aviso)}
.ad .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.6rem;margin-bottom:1rem}.ad .kpi,.ad .box{background:var(--card);border-radius:12px;padding:.9rem}.ad .kpi b{display:block;font-size:1.5rem}.ad .kpi span{color:var(--tenue)}
.ad .gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(20rem,1fr));gap:.8rem}.ad .row{display:grid;grid-template-columns:9rem 1fr auto;gap:.5rem;align-items:center;margin:.3rem 0}.ad .row i{display:block;height:.9rem;border-radius:6px;background:var(--acento)}
.ad .dias{display:flex;align-items:flex-end;gap:.25rem;height:10rem;overflow-x:auto}.ad .dias div{flex:1;min-width:1.6rem;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;font-size:.7rem;color:var(--tenue)}.ad .dias i{display:block;width:100%;background:var(--ok);border-radius:4px 4px 0 0}
.ad table{width:100%;border-collapse:collapse}.ad td,.ad th{padding:.4rem .3rem;text-align:right;border-bottom:1px solid #2a3340}.ad td:first-child,.ad th:first-child{text-align:left}.ad .off{opacity:.5}
@media print{body{background:#fff!important}#main-nav,.np{display:none!important}.ad{--card:#fff;--txt:#000;--tenue:#444;color:#000}.ad .kpi,.ad .box{border:1px solid #ccc}}`;

export function mount(root) {
  sessionStorage.getItem('admin_t') ? tablero(root) : login(root);
}

async function obtenerPinConfig() {
  const snap = await getDoc(doc(db, 'config', 'seguridad'));
  return snap.exists() ? String(snap.data().pin || '').trim() : '';
}

function resolverNivel(puntos, reglas) {
  const ordenadas = [...reglas].sort((a, b) => (b.xp_min || 0) - (a.xp_min || 0));
  for (const r of ordenadas) {
    if (puntos >= (r.xp_min || 0) && (r.xp_max === null || r.xp_max === undefined || puntos <= r.xp_max)) {
      return r.nivel;
    }
  }
  return '8 BITS';
}

function login(root, aviso = '') {
  root.innerHTML = `<style>${CSS}</style><div class="ad"><div class="pin"><h1>Admin</h1><p style="color:var(--tenue)">Ingresá tu PIN</p>
    <input id="pin" type="password" inputmode="text" autocomplete="off"><p class="err">${esc(aviso)}</p><button id="ok" style="width:100%">Entrar</button></div></div>`;

  const pinInput = root.querySelector('#pin');
  const btnOk = root.querySelector('#ok');

  setTimeout(() => {
    pinInput.focus();
    pinInput.click();
  }, 50);

  const entrar = async () => {
    try {
      const pinGuardado = await obtenerPinConfig();
      const ingresado = pinInput.value.trim();
      if (!pinGuardado && ingresado === '1234') {
        sessionStorage.setItem('admin_t', 'firebase_admin_ok');
        return tablero(root);
      }
      if (pinGuardado && ingresado === pinGuardado) {
        sessionStorage.setItem('admin_t', 'firebase_admin_ok');
        return tablero(root);
      }
      login(root, !pinGuardado ? 'PIN inicial de prueba: 1234 (configurá uno en Seguridad).' : 'PIN incorrecto.');
    } catch {
      login(root, 'No se pudo conectar con Firestore.');
    }
  };

  btnOk.onclick = entrar;
  pinInput.onkeydown = e => {
    if (e.key === 'Enter') entrar();
  };
}

function tablero(root) {
  const hoy = new Date(), iso = d => d.toISOString().slice(0, 10);
  const salir = () => { sessionStorage.removeItem('admin_t'); login(root); };

  root.innerHTML = `<style>${CSS}</style><div class="ad"><div class="bar np"><h1 style="margin:0;flex:1">Admin</h1><button class="sec" id="t1">Reportes</button><button class="sec" id="t2">Catálogo</button><button class="sec" id="t3">Puntos extra</button><button class="sec" id="t4">Repartidores hoy</button><button class="sec" id="t5">Planillas</button><button class="sec" id="t6">Seguridad</button><button class="sec" id="t7">Stock</button><button class="sec" id="t8">Fecha y hora</button><button class="sec" id="out">Salir</button></div><div id="vista"></div></div>`;
  const $ = q => root.querySelector(q), vista = $('#vista');

  $('#out').onclick = salir;
  $('#t1').onclick = () => reportes();
  $('#t2').onclick = catalogo;
  $('#t3').onclick = puntos;
  $('#t4').onclick = repartidores;
  $('#t5').onclick = planillas;
  $('#t6').onclick = seguridad;
  $('#t7').onclick = () => stock();
  $('#t8').onclick = () => hora();

  const barras = (L, fmt) => {
    const mx = Math.max(1, ...L.map(x => x.m));
    return L.map(x => `<div class="row"><span>${esc(x.n)}</span><i style="width:${Math.max(2, x.m / mx * 100)}%"></i><b>${fmt(x.m)}</b></div>`).join('') || '<p style="color:var(--tenue)">Sin datos en este período.</p>';
  };

  const minsEntre = (a, b) => {
    if (!a || !b) return null;
    const t1 = new Date(String(a).replace(' ', 'T')).getTime();
    const t2 = new Date(String(b).replace(' ', 'T')).getTime();
    if (isNaN(t1) || isNaN(t2) || t2 < t1) return null;
    return (t2 - t1) / 60000;
  };

  const prom = arr => {
    const validos = arr.filter(v => v !== null && Number.isFinite(v));
    if (!validos.length) return 0;
    return Math.round((validos.reduce((s, v) => s + v, 0) / validos.length) * 10) / 10;
  };

  async function reportes(f = { desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: iso(hoy), tipo: '', categorias: [] }, listaCategorias = []) {
    vista.innerHTML = '<p>Calculando…</p>';
    try {
      const [tandasSnap, enviosSnap, rendSnap, gastosSnap, repSnap, prodSnap] = await Promise.all([
        getDocs(collection(db, 'tandas')),
        getDocs(collection(db, 'envios')),
        getDocs(collection(db, 'rendiciones')),
        getDocs(collection(db, 'gastos')),
        getDocs(collection(db, 'repartidores_jornada')),
        getDocs(collection(db, 'productos'))
      ]);

      const catsAll = new Set(listaCategorias);
      prodSnap.docs.forEach(d => {
        const cat = d.data().categoria || d.data().cat;
        if (cat) catsAll.add(_U(cat));
      });

      const tandasTodas = tandasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.estado !== 'CANCELADO' && t.estado_cocina !== 'CANCELADA');

      const tandasCobradas = tandasTodas.filter(t => t.cobrada === true || t.estado === 'ENTREGADO');

      const filtradas = tandasCobradas.filter(t => {
        const fechaDia = String(t.hora_envio || t.envio || t.fecha || '').slice(0, 10);
        if (f.desde && fechaDia && fechaDia < f.desde) return false;
        if (f.hasta && fechaDia && fechaDia > f.hasta) return false;
        if (f.tipo && t.tipo !== f.tipo) return false;
        if (f.categorias && f.categorias.length) {
          const itemsCats = (t.items || []).map(i => _U(i.cat || i.categoria || ''));
          if (!itemsCats.some(c => f.categorias.includes(c))) return false;
        }
        return true;
      });

      let ventas = 0, efectivo = 0, transferencia = 0, sinCargo = 0, sinCargoMonto = 0, socioCorresponde = 0;
      const porDia = new Map(), porTipo = new Map(), porCat = new Map();
      const idsFiltrados = new Set(filtradas.map(t => t.id));

      filtradas.forEach(t => {
        const tot = Number(t.total || 0);
        ventas += tot;

        const ef = t.efectivo_monto !== undefined
          ? Number(t.efectivo_monto || 0)
          : (t.metodoPago === 'EFECTIVO' ? tot : (t.metodoPago === 'MIXTO' ? tot / 2 : 0));
        const tr = t.transferencia_monto !== undefined
          ? Number(t.transferencia_monto || 0)
          : (t.metodoPago === 'TRANSFERENCIA' ? tot : (t.metodoPago === 'MIXTO' ? tot / 2 : 0));
        efectivo += ef;
        transferencia += tr;

        if (t.tipo === 'DELIVERY' && (t.envio_sin_cargo === 'SI' || t.envioBonificado)) {
          sinCargo++;
          sinCargoMonto += Number(t.monto_envio_sin_cargo ?? t.costo_envio_repartidor ?? t.envioBase ?? 0);
        }

        const diaKey = String(t.hora_envio || t.envio || t.fecha || '').slice(0, 10) || iso(hoy);
        porDia.set(diaKey, (porDia.get(diaKey) || 0) + tot);

        const tipoKey = t.tipo || 'SALON';
        porTipo.set(tipoKey, (porTipo.get(tipoKey) || 0) + tot);

        const socioTanda = t.parte_socio_total !== undefined
          ? Number(t.parte_socio_total || 0)
          : (t.items || []).reduce((s, i) => s + Number(i.parte_socio || 0) * Number(i.c || 1), 0);
        socioCorresponde += socioTanda;

        (t.items || []).forEach(i => {
          const sub = Number(i.p || 0) * Number(i.c || 1);
          const catKey = _U(i.cat || i.categoria || 'GENERAL');
          catsAll.add(catKey);
          porCat.set(catKey, (porCat.get(catKey) || 0) + sub);
        });
      });

      const gastosDocs = gastosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const socioPagado = gastosDocs
        .filter(g => {
          const gd = String(g.fecha_hora || g.fecha || '').slice(0, 10);
          return g.tipo === 'PAGO_SOCIO' && (!f.desde || !gd || gd >= f.desde) && (!f.hasta || !gd || gd <= f.hasta);
        })
        .reduce((s, g) => s + Number(g.monto || 0), 0);

      const pedidos = filtradas.length;
      const ticket = pedidos ? ventas / pedidos : 0;
      const T = {
        ventas,
        pedidos,
        ticket,
        efectivo,
        transferencia,
        sinCargo,
        sinCargoMonto,
        socio: {
          corresponde: socioCorresponde,
          pagado: socioPagado,
          saldo: socioCorresponde - socioPagado,
          propia: Math.max(0, ventas - socioCorresponde)
        }
      };

      const dias = [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([fKey, m]) => ({ f: fKey, m }));
      const tipos = [...porTipo.entries()].map(([n, m]) => ({ n, m }));
      const categorias = [...porCat.entries()].map(([n, monto]) => ({ n, monto })).sort((a, b) => b.monto - a.monto);

      const tandasEnRango = tandasTodas.filter(t => {
        const fd = String(t.hora_envio || t.envio || t.fecha || '').slice(0, 10);
        return idsFiltrados.has(t.id) || ((!f.desde || !fd || fd >= f.desde) && (!f.hasta || !fd || fd <= f.hasta));
      });
      const enviosDocs = enviosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const tiempos = {
        espera: prom(tandasEnRango.map(t => minsEntre(t.hora_envio || t.envio, t.inicio || t.hora_inicio_prep))),
        prep: prom(tandasEnRango.map(t => minsEntre(t.inicio || t.hora_inicio_prep, t.fin || t.hora_fin_prep))),
        reparto: prom(enviosDocs.filter(e => e.estado_reparto === 'ENTREGADO').map(e => minsEntre(e.hora_tomado, e.hora_entregado)))
      };

      const rendDocs = rendSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const repMap = new Map();
      repSnap.docs.forEach(d => {
        const x = d.data();
        const rDia = String(x.hora_activacion || x.fecha || '').slice(0, 10);
        if (f.desde && rDia && rDia < f.desde) return;
        if (f.hasta && rDia && rDia > f.hasta) return;
        const nom = x.repartidor || x.nombre || d.id;
        const prev = repMap.get(nom) || { n: nom, envios: 0, sc: 0, basico: 0, total: 0, dif: 0 };
        prev.envios += Number(x.envios_entregados ?? x.entregados ?? 0);
        prev.sc += Number(x.envio_sin_cargo_cant ?? 0);
        prev.basico += Number(x.basico_dia ?? x.basico ?? 0);
        prev.total += Number(x.total_a_pagar ?? prev.basico);
        repMap.set(nom, prev);
      });
      rendDocs.forEach(r => {
        const rd = String(r.hora_rendicion || r.fecha || '').slice(0, 10);
        if (f.desde && rd && rd < f.desde) return;
        if (f.hasta && rd && rd > f.hasta) return;
        const entry = repMap.get(r.repartidor);
        if (entry) entry.dif += Number(r.diferencia ?? 0);
      });
      const repartidoresLista = [...repMap.values()];

      const catOpciones = [...catsAll].sort();
      const mx = Math.max(1, ...dias.map(d => d.m));

      vista.innerHTML = `<div class="bar"><div><label>Desde</label><input type="date" id="d" value="${f.desde}"></div><div><label>Hasta</label><input type="date" id="h" value="${f.hasta}"></div>
        <div><label>Tipo de entrega</label><select id="t"><option value="">Todos</option>${Object.keys(NOMBRE).map(k => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${NOMBRE[k]}</option>`).join('')}</select></div>
        <div><label>Categorías (Múltiples)</label><select id="cat" multiple style="height:2.4rem;min-width:10rem">${catOpciones.map(x => `<option value="${esc(x)}" ${(f.categorias || []).includes(x) ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
        <button id="go">Actualizar</button><button class="sec np" id="pdf">Descargar PDF</button><button class="sec np" id="mail">Enviar por correo</button><span id="msg" class="np"></span></div>
        <div class="kpis"><div class="kpi"><span>Ventas</span><b>${pesos(T.ventas)}</b></div><div class="kpi"><span>Pedidos</span><b>${T.pedidos}</b></div><div class="kpi"><span>Ticket promedio</span><b>${pesos(T.ticket)}</b></div>
        <div class="kpi"><span>Efectivo / transferencia</span><b>${pesos(T.efectivo)} / ${pesos(T.transferencia)}</b></div><div class="kpi"><span>Envíos sin cargo</span><b>${T.sinCargo}</b><span>${pesos(T.sinCargoMonto)} desde la caja</span></div>
        <div class="kpi"><span>Corresponde al socio</span><b>${pesos(T.socio.corresponde)}</b><span>Pagado ${pesos(T.socio.pagado)}, saldo ${pesos(T.socio.saldo)}</span></div><div class="kpi"><span>Nuestra parte</span><b>${pesos(T.socio.propia)}</b></div></div>
        <div class="gr"><div class="box"><h2>Ventas por día</h2><div class="dias">${dias.map(d => `<div title="${d.f}: ${pesos(d.m)}"><i style="height:${Math.max(2, d.m / mx * 100)}%"></i>${d.f.slice(8)}/${d.f.slice(5, 7)}</div>`).join('') || '<p style="color:var(--tenue)">Sin datos.</p>'}</div></div>
        <div class="box"><h2>Ventas por tipo de entrega</h2>${barras(tipos.map(x => ({ n: NOMBRE[x.n] || x.n, m: x.m })), pesos)}</div>
        <div class="box"><h2>Ventas por Categoría</h2>${barras(categorias.map(x => ({ n: x.n, m: x.monto })), pesos)}</div>
        <div class="box"><h2>Tiempos promedio</h2><div class="row"><span>Espera en cocina</span><i style="width:${Math.min(100, tiempos.espera * 3)}%"></i><b>${tiempos.espera} min</b></div><div class="row"><span>Preparación</span><i style="width:${Math.min(100, tiempos.prep * 3)}%"></i><b>${tiempos.prep} min</b></div><div class="row"><span>Reparto</span><i style="width:${Math.min(100, tiempos.reparto * 3)}%"></i><b>${tiempos.reparto} min</b></div></div></div>
        <div class="box" style="margin-top:.8rem;overflow-x:auto"><h2>Repartidores (en el período, sin filtrar por tipo ni categoría)</h2><table><tr><th>Nombre</th><th>Envíos</th><th>Sin cargo</th><th>Básico</th><th>Total pagado</th><th>Dif. rendiciones</th></tr>
        ${repartidoresLista.map(x => `<tr><td>${esc(x.n)}</td><td>${x.envios}</td><td>${x.sc}</td><td>${pesos(x.basico)}</td><td>${pesos(x.total)}</td><td>${pesos(x.dif)}</td></tr>`).join('') || '<tr><td colspan="6">Sin datos.</td></tr>'}</table></div>`;

      const filtros = () => {
        const selectCat = $('#cat');
        const catsSel = Array.from(selectCat.selectedOptions).map(opt => opt.value);
        return { desde: $('#d').value, hasta: $('#h').value, tipo: $('#t').value, categorias: catsSel };
      };
      $('#go').onclick = () => reportes(filtros(), catOpciones);
      $('#pdf').onclick = () => window.print();
      $('#mail').onclick = async () => {
        $('#msg').textContent = 'Usá "Descargar PDF" para imprimir/guardar el reporte desde el navegador.';
      };
    } catch (e) {
      vista.innerHTML = `<p class="err">No se pudo leer Firestore (${esc(e.message || 'error')}).</p>`;
    }
  }

  async function catalogo() {
    vista.innerHTML = '<p>Leyendo catálogo…</p>';
    try {
      const snap = await getDocs(collection(db, 'productos'));
      const items = snap.docs.map(d => {
        const x = d.data();
        return {
          id: d.id,
          n: x.nombre || x.n || d.id,
          cat: x.categoria || x.cat || 'GENERAL',
          p: Number(x.precio ?? x.p ?? 0),
          disp: x.disponible !== false && _U(x.disponible) !== 'NO' && x.disp !== false
        };
      });

      vista.innerHTML = `<div class="box"><h2>Disponibilidad de productos</h2><table>
        ${items.map((p, i) => `<tr class="${p.disp ? '' : 'off'}"><td>${esc(p.n)}</td><td>${esc(p.cat)}</td><td>${pesos(p.p)}</td><td><button class="${p.disp ? 'sec' : ''}" data-i="${i}">${p.disp ? 'Desactivar' : 'Activar'}</button></td></tr>`).join('') || '<tr><td colspan="4">Sin productos cargados.</td></tr>'}</table></div>`;

      vista.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
        const p = items[b.dataset.i];
        b.disabled = true;
        await updateDoc(doc(db, 'productos', p.id), { disponible: !p.disp, disp: !p.disp });
        catalogo();
      });
    } catch (e) {
      vista.innerHTML = `<p class="err">No se pudo leer el catálogo (${esc(e.message || 'error')}).</p>`;
    }
  }

  function puntos() {
    vista.innerHTML = `<div class="box"><h2>Etiqueta, participación y logro (puntos extra)</h2><div class="bar"><div><label>Nombre y apellido del cliente</label><input id="n" style="min-width:18rem"></div><button id="b">Buscar cliente</button></div><div id="fl"></div></div>`;
    $('#b').onclick = async () => {
      const nombre = $('#n').value.trim();
      if (!nombre) { $('#fl').innerHTML = '<p class="err">Ingresá un nombre.</p>'; return; }
      const qNorm = _U(nombre);
      const [cliSnap, regSnap, jSnap] = await Promise.all([
        getDocs(collection(db, 'clientes')),
        getDocs(collection(db, 'reglas_nivel')),
        getDocs(query(collection(db, 'jornadas'), where('estado', '==', 'ABIERTA')))
      ]);

      const reglas = regSnap.docs.map(d => {
        const r = d.data();
        return {
          nivel: _U(r.nivel || d.id),
          xp_min: Number(r.xp_min ?? 0),
          xp_max: r.xp_max === null || r.xp_max === undefined || r.xp_max === '' ? null : Number(r.xp_max)
        };
      });
      const jornadaAbierta = jSnap.empty ? null : jSnap.docs[0].id;

      const docMatch = cliSnap.docs.find(d => _U(d.data().nombre || d.data().n || d.id) === qNorm);
      if (!docMatch) {
        $('#fl').innerHTML = '<p style="color:var(--tenue)">No hay clientes con ese nombre.</p>';
        return;
      }

      let x = docMatch.data();
      let ptsActuales = Number(x.puntos ?? x.pts ?? 0);
      let extra = { ...(x.puntos_extra || {}) };

      const pintarCliente = () => {
        $('#fl').innerHTML = `<p>Cliente: <b>${esc(x.nombre || x.n)}</b> — Nivel: <b>${esc(x.nivel || '8 BITS')}</b> — Puntos actuales: <b>${ptsActuales}</b></p>
          <table><tr><th>Etiqueta (+10)</th><th>Participación (+10)</th><th>Logro (+10)</th></tr><tr>
          ${['etiqueta', 'participacion', 'logro'].map(c => `<td><input type="checkbox" data-c="${c}" ${extra[c] ? 'checked' : ''}></td>`).join('')}
          </tr></table>`;

        $('#fl').querySelectorAll('input[type=checkbox]').forEach(chk => {
          chk.onchange = async () => {
            const campo = chk.dataset.c;
            const activado = chk.checked;
            extra = { ...extra, [campo]: activado };
            const delta = activado ? 10 : -10;
            ptsActuales = Math.max(0, ptsActuales + delta);
            const nuevoNivel = resolverNivel(ptsActuales, reglas);
            x = { ...x, puntos: ptsActuales, nivel: nuevoNivel, puntos_extra: extra };

            await updateDoc(doc(db, 'clientes', docMatch.id), {
              puntos_extra: extra,
              puntos: ptsActuales,
              nivel: nuevoNivel,
              actualizadoEn: new Date().toISOString()
            });

            if (activado) {
              await addDoc(collection(db, 'marcas_extra'), {
                fecha_hora: fmtLocal(),
                id_jornada: jornadaAbierta || '',
                nombre_cliente: x.nombre || x.n,
                tipo: _U(campo),
                marcado_por: 'Admin'
              });
            }
            pintarCliente();
          };
        });
      };

      pintarCliente();
    };
  }

  async function repartidores() {
    vista.innerHTML = '<p>Leyendo…</p>';
    try {
      const jSnap = await getDocs(query(collection(db, 'jornadas'), where('estado', '==', 'ABIERTA')));
      if (jSnap.empty) {
        vista.innerHTML = '<div class="box"><p class="err">No hay una jornada abierta.</p></div>';
        return;
      }
      const jId = jSnap.docs[0].id;
      const repSnap = await getDocs(query(collection(db, 'repartidores_jornada'), where('id_jornada', '==', jId)));
      const rows = repSnap.docs.map(d => {
        const x = d.data();
        const basico = Number(x.basico_dia ?? x.basico ?? 0);
        const montoEnv = Number(x.monto_envios ?? 0);
        return {
          id: d.id,
          n: x.repartidor || x.nombre || d.id,
          basico,
          montoEnv,
          total: Number(x.total_a_pagar ?? (basico + montoEnv)),
          pagado: x.pagado === true || x.pagado === 'SI' ? 'SI' : 'NO'
        };
      });

      vista.innerHTML = `<div class="box"><h2>Básico de hoy</h2><table><tr><th>Repartidor</th><th>Básico</th><th>Total del día</th><th></th></tr>
        ${rows.map((row, i) => `<tr><td>${esc(row.n)}</td><td><input type="number" value="${row.basico}" id="b${i}" ${row.pagado === 'SI' ? 'disabled' : ''}></td><td>${pesos(row.total)}</td><td>${row.pagado === 'SI' ? 'Pagado' : `<button data-i="${i}">Guardar</button>`}</td></tr>`).join('') || '<tr><td colspan="4">Todavía no hay repartidores activos en esta jornada.</td></tr>'}</table></div>`;

      vista.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
        const row = rows[b.dataset.i];
        const nuevoBasico = Math.max(0, Number($('#b' + b.dataset.i).value || 0));
        await updateDoc(doc(db, 'repartidores_jornada', row.id), {
          basico_dia: nuevoBasico,
          total_a_pagar: nuevoBasico + row.montoEnv
        });
        repartidores();
      });
    } catch (e) {
      vista.innerHTML = `<div class="box"><p class="err">No se pudo leer: ${esc(e.message || 'error')}</p></div>`;
    }
  }

  async function planillas(aviso = '') {
    const snap = await getDoc(doc(db, 'config', 'planillas'));
    const data = snap.exists() ? snap.data() : {};
    vista.innerHTML = `<div class="box"><h2>Respaldo / Enlaces de Google Sheets</h2>
      <p style="color:var(--tenue)">Tus datos operativos ahora viven en Firestore. Podés guardar acá los enlaces de referencia de tus planillas:</p>
      <label style="color:var(--tenue)">Operacion</label><input id="op" style="width:100%" value="${esc(data.op || '')}" placeholder="Enlace o ID de referencia">
      <label style="color:var(--tenue);display:block;margin-top:.6rem">LISTA OFICIAL</label><input id="lo" style="width:100%" value="${esc(data.lo || '')}" placeholder="Enlace o ID de referencia">
      <div class="bar" style="margin-top:.8rem"><button id="gp">Guardar enlaces</button><span>${esc(aviso)}</span></div></div>`;
    $('#gp').onclick = async () => {
      await setDoc(doc(db, 'config', 'planillas'), { op: $('#op').value.trim(), lo: $('#lo').value.trim(), actualizadoEn: fmtLocal() }, { merge: true });
      planillas('Enlaces guardados en Firestore.');
    };
  }

  async function seguridad() {
    const pinActual = await obtenerPinConfig();
    const base = location.origin + location.pathname.replace(/[^/]*$/, '');
    vista.innerHTML = `<div class="box"><h2>Clave del local y PIN de Admin</h2>
      <p>${pinActual ? 'Hay un PIN configurado en Firestore.' : '<span class="err">Todavía no guardaste un PIN propio (se usa 1234 de prueba).</span>'}</p>
      <div class="bar"><input id="k" style="min-width:18rem" placeholder="Nuevo PIN / clave (mínimo 4 caracteres)"><button class="sec" id="gen">Generar</button><button id="gk">Guardar clave</button></div>
      <div id="enl"></div></div>`;
    $('#gen').onclick = () => $('#k').value = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    $('#gk').onclick = async () => {
      const clave = $('#k').value.trim();
      if (clave.length < 4) { $('#enl').innerHTML = '<p class="err">Ingresá al menos 4 caracteres.</p>'; return; }
      await setDoc(doc(db, 'config', 'seguridad'), { pin: clave, actualizadoEn: fmtLocal() }, { merge: true });
      localStorage.setItem('cdbf_k', clave);
      $('#enl').innerHTML = '<p style="color:var(--ok)">Clave guardada.</p>' + ['cocina', 'cajero', 'delivery', 'admin'].map(a => `<p><b>${a[0].toUpperCase() + a.slice(1)}</b><br><code style="word-break:break-all">${esc(base + a + '.html?k=' + clave)}</code></p>`).join('');
    };
  }

  async function hora(aviso = '') {
    const jSnap = await getDocs(query(collection(db, 'jornadas'), where('estado', '==', 'ABIERTA')));
    const snap = await getDoc(doc(db, 'config', 'hora'));
    const cfg = snap.exists() ? snap.data() : { modo: 'AUTO' };
    const sistema = cfg.modo === 'MANUAL' && cfg.manual ? cfg.manual : fmtLocal();

    vista.innerHTML = `<div class="box"><h2>Fecha y hora del sistema</h2>
      <p>Hora del sistema: <b>${esc(sistema)}</b></p>
      <p style="color:var(--tenue)">Hora de este dispositivo: ${esc(new Date().toLocaleString('es-AR'))}</p>
      <p>Modo actual: <b>${cfg.modo === 'MANUAL' ? 'Manual' : 'Automático'}</b></p>
      ${!jSnap.empty ? '<p class="err">Hay una jornada abierta: para cambiar la hora, primero cerrá la caja.</p>' : ''}
      <div class="bar"><div><label>Modo</label><select id="md"><option value="AUTO">Automático</option><option value="MANUAL">Manual</option></select></div>
        <div><label>Fecha</label><input type="date" id="fd" value="${sistema.slice(0, 10)}"></div><div><label>Hora</label><input type="time" id="hh" value="${sistema.slice(11, 16)}"></div>
        <button id="gh">Guardar</button></div><p id="mh">${esc(aviso)}</p></div>`;

    const sync = () => { const m = $('#md').value === 'MANUAL'; $('#fd').disabled = !m; $('#hh').disabled = !m; };
    $('#md').value = cfg.modo || 'AUTO';
    sync();
    $('#md').onchange = sync;

    $('#gh').onclick = async () => {
      if (!jSnap.empty) { hora('Cerrá la caja antes de cambiar la hora.'); return; }
      const modo = $('#md').value;
      const manual = `${$('#fd').value} ${$('#hh').value}:00`;
      await setDoc(doc(db, 'config', 'hora'), { modo, manual, actualizadoEn: fmtLocal() }, { merge: true });
      hora('Guardado.');
    };
  }

  async function stock(aviso = '') {
    vista.innerHTML = '<p>Leyendo stock…</p>';
    try {
      const [socioSnap, stockSnap] = await Promise.all([
        getDocs(collection(db, 'catalogo_socio')),
        getDocs(collection(db, 'stock_socio'))
      ]);

      const stMap = new Map();
      stockSnap.docs.forEach(d => {
        const x = d.data();
        const nom = _U(x.producto || d.id);
        if (nom) stMap.set(nom, { id: d.id, ...x });
      });

      const nombresSet = new Map();
      socioSnap.docs.forEach(d => {
        const x = d.data();
        const nomProd = String(x.nombre_producto || '').trim();
        if (_U(x.tipo) === 'BEBIDA' && nomProd) {
          nombresSet.set(_U(nomProd), nomProd);
        }
        const ops = Array.isArray(x.descuenta_de)
          ? x.descuenta_de
          : String(x.descuenta_de || '').split('/').map(v => v.trim()).filter(Boolean);
        ops.forEach(op => {
          if (op && !nombresSet.has(_U(op))) nombresSet.set(_U(op), op);
        });
      });
      stockSnap.docs.forEach(d => {
        const x = d.data();
        const nom = String(x.producto || d.id).trim();
        if (nom && !nombresSet.has(_U(nom))) nombresSet.set(_U(nom), nom);
      });

      const items = [...nombresSet.entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([key, nombre]) => {
          const st = stMap.get(key);
          return {
            key,
            docId: st ? st.id : slugId(nombre),
            n: nombre,
            stock: st && st.stock !== '' && st.stock !== null && st.stock !== undefined ? Number(st.stock) : '',
            minimo: st && st.minimo !== '' && st.minimo !== null && st.minimo !== undefined ? Number(st.minimo) : ''
          };
        });

      vista.innerHTML = `<div class="box"><h2>Stock del socio (bebidas e insumos)</h2><table><tr><th>Producto</th><th>Disponible</th><th>Avisar si baja de</th></tr>
        ${items.map((x, i) => `<tr class="${x.stock !== '' && Number(x.stock) <= 0 ? 'off' : ''}"><td>${esc(x.n)}</td><td><input type="number" min="0" id="s${i}" value="${esc(x.stock)}"></td><td><input type="number" min="0" id="m${i}" value="${esc(x.minimo)}"></td></tr>`).join('') || '<tr><td colspan="3">Sin productos configurados.</td></tr>'}</table>
        <div class="bar" style="margin-top:.8rem"><button id="gs">Guardar stock</button><button class="sec" id="rf">Actualizar</button><span>${esc(aviso)}</span></div></div>`;

      $('#rf').onclick = () => stock();
      $('#gs').onclick = async () => {
        const ahora = fmtLocal();
        for (let i = 0; i < items.length; i++) {
          const x = items[i];
          const sVal = $('#s' + i).value;
          const mVal = $('#m' + i).value;
          if (sVal === '' || isNaN(Number(sVal))) continue;
          const nuevo = Math.max(0, Number(sVal));
          const min = mVal === '' || isNaN(Number(mVal)) ? '' : Math.max(0, Number(mVal));
          const ant = x.stock === '' ? null : Number(x.stock);

          await setDoc(doc(db, 'stock_socio', x.docId), {
            producto: x.n,
            stock: nuevo,
            minimo: min,
            actualizado_por: 'Admin',
            fecha_hora: ahora
          }, { merge: true });

          if (ant !== nuevo) {
            await addDoc(collection(db, 'stock_movimientos'), {
              fecha_hora: ahora,
              producto: x.n,
              tipo: ant === null ? 'CARGA' : 'AJUSTE',
              cantidad: nuevo - (ant || 0),
              stock_resultante: nuevo,
              usuario: 'Admin'
            });
          }
        }
        stock('Stock guardado en stock_socio.');
      };
    } catch (e) {
      vista.innerHTML = `<div class="box"><p class="err">No se pudo leer el stock (${esc(e.message || 'error')}).</p></div>`;
    }
  }

  reportes();
}
