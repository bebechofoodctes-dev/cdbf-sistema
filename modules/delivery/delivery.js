import { db, authReady } from '../firebase-init/firebase-init.js';
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const _U = s => String(s ?? '').trim().toUpperCase();
const slugId = s => _U(s).replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pesos = n => '$' + Number(n || 0).toLocaleString('es-AR');
const fmtLocal = (d = new Date()) => {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const hora = s => {
  if (!s) return '--:--';
  const str = String(s);
  const idx = str.indexOf('T') >= 0 ? str.indexOf('T') + 1 : 11;
  return str.slice(idx, idx + 5) || '--:--';
};
const fechaDia = s => {
  const str = String(s || '').trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(str);
  return m ? m[1] : fmtLocal().slice(0, 10);
};
const montoRealEnvio = obj => Number(obj?.costo_envio_repartidor ?? obj?.envioBase ?? obj?.costo_envio ?? obj?.envio ?? 0);

const CSS = `
.dv{--card:#202833;--txt:#e9eef4;--tenue:#93a1b3;--acento:#4da3e0;--ok:#56c48f;--aviso:#f0b13c;max-width:42rem;margin:0 auto;padding:1rem;color:var(--txt);font:17px/1.35 system-ui,sans-serif}
.dv h1,.dv h2{margin:.2rem 0 .8rem}.dv h2{font-size:1.1rem;color:var(--tenue)}.dv button,.dv select,.dv a.bt{font:inherit;font-weight:700;border:0;border-radius:10px;padding:.9rem 1rem;cursor:pointer;background:var(--acento);color:#06121d;width:100%;display:block;text-align:center;text-decoration:none;margin-top:.5rem}
.dv select{background:#10151c;color:var(--txt);border:2px solid #34404f;font-weight:500}.dv .sec{background:#2d3846;color:var(--txt)}.dv .ok{background:var(--ok)}.dv button:disabled{opacity:.45}
.dv .c{background:var(--card);border-radius:12px;padding:.9rem;margin-bottom:.7rem;border-left:6px solid var(--aviso)}.dv .c.listo{border-color:var(--ok)}.dv .c.mio{border-color:var(--acento);box-shadow:0 0 0 2px var(--acento)}
.dv .c small,.dv .tenue{color:var(--tenue)}.dv ul{padding-left:1.1rem;margin:.4rem 0}.dv iframe{width:100%;height:38vh;border:0;border-radius:12px;background:#10151c}
.dv .g{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}.dv .g div{background:var(--card);border-radius:10px;padding:.7rem}.dv .g b{display:block;font-size:1.25rem}.dv .err{color:var(--aviso);min-height:1.3em}
.monto-envio-tag{background:#10151c;padding:.4rem .6rem;border-radius:6px;border:1px solid #34404f;margin-top:.4rem;display:inline-block;font-weight:bold;color:var(--ok)}
.drawer-historial{position:fixed;right:-360px;top:0;width:340px;height:100%;background:#151a22;border-left:2px solid #34404f;box-shadow:-4px 0 15px rgba(0,0,0,.5);transition:right .3s ease;z-index:9999;padding:1rem;display:flex;flex-direction:column;box-sizing:border-box;color:var(--txt)}
.drawer-historial.open{right:0}
.drawer-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid #2a3340;padding-bottom:.5rem}
.drawer-header h3{margin:0;font-size:1.2rem}
.drawer-header button{width:auto;padding:.3rem .7rem;background:#2d3846;color:#fff}
.historial-list{flex-grow:1;overflow-y:auto;margin-top:.5rem}
.historial-fecha{font-size:.85rem;font-weight:700;color:var(--tenue);margin:.8rem 0 .4rem;border-bottom:1px solid #2a3340;padding-bottom:.2rem}
.historial-item{padding:.6rem;border-bottom:1px solid #2a3340;background:#1a232e;border-radius:8px;margin-bottom:.5rem}`;

let ctx, unsubs = [];
function beep() {
  try { ctx ??= new AudioContext(); ctx.resume(); const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = .2; o.start(); o.stop(ctx.currentTime + .25); } catch { /* sin audio */ }
}

function limpiar() {
  unsubs.forEach(fn => { try { fn(); } catch {} });
  unsubs = [];
}

const coords = u => (/(-?\d{1,3}\.\d{3,})[\s,]+(-?\d{1,3}\.\d{3,})/.exec(u || '') || []).slice(1, 3).join(',');
const lugar = p => coords(p.ubi) || p.dir || '';
const wa = tel => { const d = String(tel || '').replace(/\D/g, '').replace(/^0+/, ''); return d.startsWith('54') ? d : '549' + d; };
const primero = s => { const w = String(s || '').trim().split(/\s+/)[0].toLowerCase(); return w.charAt(0).toUpperCase() + w.slice(1); };
const repJornadaId = (jornadaId, nombre) => `${jornadaId}_${slugId(nombre)}`;

export function mount(root) {
  limpiar();
  const nombre = localStorage.getItem('cdbf_repartidor');
  nombre && localStorage.getItem('cdbf_activo') === '1' ? principal(root, nombre) : inicio(root, nombre);
}

async function obtenerJornadaAbierta() {
  await authReady;
  const snap = await getDocs(query(collection(db, 'jornadas'), where('estado', '==', 'ABIERTA')));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function inicio(root, guardado) {
  limpiar();
  root.innerHTML = `<style>${CSS}</style><div class="dv"><h1>Modo delivery</h1><p class="tenue">Cargando repartidores…</p></div>`;
  const box = root.querySelector('.dv');

  let staff = [];
  try {
    await authReady;
    const allSnap = await getDocs(collection(db, 'staff'));
    staff = allSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(x => {
        if (x.activo === false) return false;
        const rolesArr = Array.isArray(x.roles) ? x.roles.map(_U) : [];
        const txt = `${_U(x.rol)} ${_U(x.puesto)} ${rolesArr.join(' ')}`;
        return rolesArr.includes('DELIVERY') || txt.includes('DELIVERY');
      })
      .map(x => ({
        id: x.id,
        n: String(x.nombre || x.n || x.id).trim(),
        basico: Number(x.basico ?? x['sueldo/basico'] ?? 0)
      }));
  } catch (e) {
    box.innerHTML = '<h1>Modo delivery</h1><p class="err"></p>';
    box.querySelector('.err').textContent = 'No se pudo conectar: ' + (e.message || 'error');
    return;
  }

  if (!staff.length) {
    box.innerHTML = '<h1>Modo delivery</h1><p class="err">No hay repartidores cargados en la colección staff.</p>';
    return;
  }

  box.innerHTML = `<h1>Modo delivery</h1><label class="tenue">¿Quién sos?</label>
<select id="sel">${staff.map(s => `<option value="${esc(s.n)}" ${s.n === guardado ? 'selected' : ''}>${esc(s.n)}</option>`).join('')}</select>
<p class="err"></p><button id="on">Activar modo delivery</button>`;

  box.querySelector('#on').onclick = async () => {
    const nombre = box.querySelector('#sel').value;
    const elegido = staff.find(s => s.n === nombre);
    beep();
    try {
      const jornada = await obtenerJornadaAbierta();
      if (!jornada) {
        box.querySelector('.err').textContent = 'El cajero todavía no inició las ventas.';
        return;
      }

      const ahora = fmtLocal();
      const basico = Number(elegido?.basico ?? 0);
      const rjRef = doc(db, 'repartidores_jornada', repJornadaId(jornada.id, nombre));

      await runTransaction(db, async tx => {
        const snap = await tx.get(rjRef);
        if (snap.exists()) {
          const prev = snap.data();
          const basicoActual = Number(prev.basico_dia ?? basico);
          const montoEnvios = Number(prev.monto_envios ?? 0);
          tx.update(rjRef, {
            id_jornada: jornada.id,
            repartidor: nombre,
            hora_desactivacion: '',
            estado: prev.pedido_en_camino ? 'EN_CAMINO' : 'LIBRE',
            basico_dia: basicoActual,
            total_a_pagar: basicoActual + montoEnvios
          });
        } else {
          tx.set(rjRef, {
            id_jornada: jornada.id,
            repartidor: nombre,
            hora_activacion: ahora,
            hora_desactivacion: '',
            estado: 'LIBRE',
            pedido_en_camino: '',
            ultimo_pedido: '',
            basico_dia: basico,
            envios_entregados: 0,
            monto_envios: 0,
            total_a_pagar: basico,
            pagado: 'NO',
            envio_sin_cargo_cant: 0,
            monto_envios_sin_cargo: 0
          });
        }
      });

      await addDoc(collection(db, 'sesiones'), {
        id_sesion: `S-${Date.now()}`,
        rol: 'DELIVERY',
        nombre,
        dispositivo: nombre,
        id_jornada: jornada.id,
        hora_ingreso: ahora,
        hora_egreso: ''
      });

      localStorage.setItem('cdbf_repartidor', nombre);
      localStorage.setItem('cdbf_activo', '1');
      localStorage.setItem('cdbf_jornada', jornada.id);
      try { await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }
      principal(root, nombre);
    } catch (e) {
      box.querySelector('.err').textContent = 'No se pudo activar: ' + (e.message || 'error');
    }
  };
}

async function principal(root, nombre) {
  limpiar();
  await authReady;

  let jornadaId = localStorage.getItem('cdbf_jornada') || '';
  if (!jornadaId) {
    const abierta = await obtenerJornadaAbierta();
    if (!abierta) {
      localStorage.removeItem('cdbf_activo');
      inicio(root, nombre);
      return;
    }
    jornadaId = abierta.id;
    localStorage.setItem('cdbf_jornada', jornadaId);
  }

  root.innerHTML = `<style>${CSS}</style><div class="dv">
<div style="display:flex;justify-content:space-between;align-items:center;">
<h1 style="margin:0">Hola ${esc(nombre)}</h1>
<button class="sec" id="btnHistorialDrawer" style="width:auto;margin:0;padding:.5rem 1rem">📦 Historial</button>
</div>
<h2>Pedidos con envío</h2><div id="ped"></div><p class="err" id="er"></p>
<h2>Mapa</h2><iframe id="mapa" title="Mapa"></iframe>
<h2 style="margin-top:1rem">Tu jornada</h2><div class="g" id="res"></div>
<button class="sec" id="off" style="margin-top:1.5rem">Desactivar modo delivery</button></div>
<div id="drawerHistorial" class="drawer-historial">
<div class="drawer-header">
<h3>Historial de reparto</h3>
<button id="btnCloseHistorial" type="button">✖</button>
</div>
<div id="historialContainer" class="historial-list"><p class="tenue">Cargando historial...</p></div>
</div>`;

  let D = { pedidos: [], resumen: { entregados: 0, basico: 0, envios: 0, total: 0, rendir: 0 }, entregados_lista: [] };
  let vistos = null, sel = null;
  let rjDoc = { basico_dia: 0, envios_entregados: 0, monto_envios: 0, total_a_pagar: 0, envio_sin_cargo_cant: 0, monto_envios_sin_cargo: 0 };
  let tandasMap = new Map();
  let enviosDocs = [];
  let rendicionesDocs = [];

  const $ = q => root.querySelector(q);
  const drawer = $('#drawerHistorial');

  const renderHistorial = () => {
    const container = $('#historialContainer');
    if (!container) return;
    const lista = [...(D.entregados_lista || [])].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    if (!lista.length) {
      container.innerHTML = '<p class="tenue">Sin envíos registrados.</p>';
      return;
    }

    const grupos = new Map();
    lista.forEach(item => {
      const f = item.fecha || fmtLocal().slice(0, 10);
      if (!grupos.has(f)) grupos.set(f, []);
      grupos.get(f).push(item);
    });

    container.innerHTML = [...grupos.entries()].map(([fecha, items]) => `
<div class="historial-fecha">${esc(fecha)}</div>
${items.map(item => `
<div class="historial-item">
<div><strong>${esc(item.cliente)}</strong></div>
<div>Monto del envío: <b>${pesos(item.envio || 0)}</b></div>
</div>
`).join('')}
`).join('');
  };

  if ($('#btnHistorialDrawer')) $('#btnHistorialDrawer').onclick = () => { drawer.classList.add('open'); renderHistorial(); };
  if ($('#btnCloseHistorial')) $('#btnCloseHistorial').onclick = () => drawer.classList.remove('open');

  const mapa = p => {
    sel = p?.id;
    const q = p ? lugar(p) : '';
    if ($('#mapa')) $('#mapa').src = q ? `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed` : 'about:blank';
  };

  const tarjeta = p => {
    const costoEnvio = montoRealEnvio(p);
    const itemsTxt = (p.items || []).map(i => typeof i === 'string' ? i : `${i.c}x ${i.n}${i.op ? ` (${i.op})` : ''}`);
    return `<article class="c ${p.estado === 'EN_CAMINO' ? 'mio' : p.listo ? 'listo' : ''}"><b>${esc(p.cliente)}</b> <small>${esc(p.cuenta || '')}</small>
<ul>${itemsTxt.map(i => `<li>${esc(i)}</li>`).join('')}</ul><div>${esc(p.dir || 'Ubicación en enlace')}</div>
<div class="monto-envio-tag">Monto del envío: ${pesos(costoEnvio)}</div>
<a class="bt sec" target="_blank" rel="noopener" href="https://wa.me/${wa(p.tel)}?text=${encodeURIComponent(`Hola ${primero(p.cliente)}, soy el delivery de BebechoFood&CavaDrinks y estoy llevando tu pedido`)}">WhatsApp a ${esc(primero(p.cliente))}</a><button class="sec" data-m="${esc(p.id)}">Ver en el mapa</button>
${p.estado === 'EN_CAMINO' ? `<button class="ok" data-e="${esc(p.id)}">Entregado</button>`
      : `<button data-t="${esc(p.id)}" ${p.listo ? '' : 'disabled'}>${p.listo ? 'Tomar pedido' : 'En cocina, esperá…'}</button>`}</article>`;
  };

  function pintar() {
    if (!$('#ped')) return;
    const L = [...D.pedidos].sort((a, b) => (b.estado === 'EN_CAMINO') - (a.estado === 'EN_CAMINO'));
    $('#ped').innerHTML = L.length ? L.map(tarjeta).join('') : '<p class="tenue">No hay pedidos con envío por ahora.</p>';
    const R = D.resumen;
    $('#res').innerHTML = [
      ['Envíos hechos', R.entregados],
      ['Básico', pesos(R.basico)],
      ['Por envíos', pesos(R.envios)],
      ['Total del día', pesos(R.total)],
      ['Efectivo a rendir', pesos(R.rendir || 0)]
    ].map(([k, x]) => `<div>${k}<b>${x}</b></div>`).join('');

    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => mapa(D.pedidos.find(p => p.id === b.dataset.m)));
    root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => tomarPedido(b.dataset.t));
    root.querySelectorAll('[data-e]').forEach(b => b.onclick = () => confirm('¿Confirmás que el cliente recibió el pedido?') && entregarPedido(b.dataset.e));
    if (!D.pedidos.some(p => p.id === sel)) mapa(L[0]);
    renderHistorial();
  }

  const recomputarVista = () => {
    if (!$('#ped')) return;
    const todosEnvios = enviosDocs.filter(e => e.estado_reparto !== 'CANCELADO');

    const activos = todosEnvios
      .filter(e => e.estado_reparto === 'PENDIENTE' || (e.estado_reparto === 'EN_CAMINO' && e.repartidor === nombre))
      .map(e => {
        const tanda = e.id_tanda ? tandasMap.get(e.id_tanda) : null;
        const tandasCuenta = [...tandasMap.values()].filter(t =>
          ((e.id_cuenta && t.cuenta === e.id_cuenta) || t.id === e.id_tanda) &&
          t.estado !== 'CANCELADO' && t.estado_cocina !== 'CANCELADA'
        );
        const todasListas = tandasCuenta.length > 0
          ? tandasCuenta.every(t => t.estado === 'LISTA' || t.estado_cocina === 'LISTA' || t.estado === 'ENTREGADO')
          : (tanda ? (tanda.estado === 'LISTA' || tanda.estado_cocina === 'LISTA' || tanda.estado === 'ENTREGADO') : true);

        return {
          id: e.id,
          cuenta: e.id_cuenta || '',
          cliente: e.cliente || 'Cliente',
          dir: e.direccion_texto || '',
          ubi: e.ubicacion_link || e.direccion_texto || '',
          tel: e.telefono_contacto || '',
          items: tanda?.items || [],
          envio: montoRealEnvio(e),
          estado: e.estado_reparto,
          listo: todasListas
        };
      });

    const misEntregados = todosEnvios.filter(e => e.estado_reparto === 'ENTREGADO' && e.repartidor === nombre);
    const rendPendientes = rendicionesDocs
      .filter(r => r.repartidor === nombre && r.estado === 'PENDIENTE')
      .reduce((s, r) => s + Number(r.monto_esperado ?? r.efectivo_a_rendir ?? r.esperado ?? 0), 0);

    const basico = Number(rjDoc.basico_dia ?? 0);
    const entregadosCant = Number(rjDoc.envios_entregados ?? misEntregados.length);
    const montoEnvios = Number(rjDoc.monto_envios ?? misEntregados.reduce((s, e) => s + montoRealEnvio(e), 0));
    const totalDia = Number(rjDoc.total_a_pagar ?? (basico + montoEnvios));

    D = {
      pedidos: activos,
      resumen: {
        entregados: entregadosCant,
        basico,
        envios: montoEnvios,
        total: totalDia,
        rendir: rendPendientes
      },
      entregados_lista: misEntregados.map(e => ({
        cliente: e.cliente || 'Cliente',
        fecha: fechaDia(e.hora_entregado || e.hora_creado),
        envio: montoRealEnvio(e)
      }))
    };

    if (vistos && activos.some(p => p.listo && p.estado === 'PENDIENTE' && !vistos.has(p.id))) beep();
    vistos = new Set(activos.filter(p => p.listo).map(p => p.id));
    pintar();
  };

  async function tomarPedido(idEnvio) {
    $('#er').textContent = '';
    try {
      const jActual = jornadaId || (await obtenerJornadaAbierta())?.id;
      if (!jActual) throw new Error('sin_jornada');
      const rjRef = doc(db, 'repartidores_jornada', repJornadaId(jActual, nombre));
      const envRef = doc(db, 'envios', idEnvio);

      let envData = null;
      await runTransaction(db, async tx => {
        const [rjSnap, envSnap] = await Promise.all([tx.get(rjRef), tx.get(envRef)]);
        if (!rjSnap.exists() || rjSnap.data().hora_desactivacion) throw new Error('modo_inactivo');
        if (!envSnap.exists()) throw new Error('no_existe');
        const e = envSnap.data();
        if (e.estado_reparto !== 'PENDIENTE') throw new Error('ya_tomado');

        const tandasAsociadas = [...tandasMap.values()].filter(t =>
          ((e.id_cuenta && t.cuenta === e.id_cuenta) || t.id === e.id_tanda) &&
          t.estado !== 'CANCELADO' && t.estado_cocina !== 'CANCELADA'
        );
        if (tandasAsociadas.some(t => t.estado !== 'LISTA' && t.estado_cocina !== 'LISTA' && t.estado !== 'ENTREGADO')) {
          throw new Error('no_listo');
        }

        const ahora = fmtLocal();
        envData = e;
        tx.update(envRef, {
          estado_reparto: 'EN_CAMINO',
          repartidor: nombre,
          hora_tomado: ahora
        });
        tx.update(rjRef, {
          estado: 'EN_CAMINO',
          pedido_en_camino: e.cliente || e.id_cuenta || idEnvio
        });
      });

      await addDoc(collection(db, 'eventos'), {
        fecha_hora: fmtLocal(),
        id_jornada: jActual,
        entidad: 'ENVIO',
        id_entidad: idEnvio,
        de_estado: 'PENDIENTE',
        a_estado: 'EN_CAMINO',
        usuario: nombre,
        detalle: envData?.cliente || ''
      });
    } catch (e) {
      $('#er').textContent = {
        ya_tomado: 'Otro repartidor ya tomó ese pedido.',
        no_listo: 'Cocina todavía no lo terminó.',
        modo_inactivo: 'Tu modo delivery está inactivo.',
        sin_jornada: 'No hay una jornada abierta.'
      }[e.message] || 'No se pudo tomar el pedido: ' + (e.message || 'error');
    }
  }

  async function entregarPedido(idEnvio) {
    $('#er').textContent = '';
    try {
      const jActual = jornadaId || (await obtenerJornadaAbierta())?.id;
      if (!jActual) throw new Error('sin_jornada');
      const rjRef = doc(db, 'repartidores_jornada', repJornadaId(jActual, nombre));
      const envRef = doc(db, 'envios', idEnvio);

      let infoEntrega = null;
      await runTransaction(db, async tx => {
        const [rjSnap, envSnap] = await Promise.all([tx.get(rjRef), tx.get(envRef)]);
        if (!envSnap.exists()) throw new Error('no_existe');
        const e = envSnap.data();
        if (e.repartidor !== nombre || e.estado_reparto !== 'EN_CAMINO') throw new Error('estado_invalido');

        const tanda = e.id_tanda ? tandasMap.get(e.id_tanda) : null;
        const efvoRendir = Number(e.efectivo_a_rendir ?? (tanda?.metodoPago === 'EFECTIVO' ? tanda?.total : (tanda?.metodoPago === 'MIXTO' ? tanda?.efectivo_monto : 0)) ?? 0);
        const ahora = fmtLocal();

        tx.update(envRef, {
          estado_reparto: 'ENTREGADO',
          hora_entregado: ahora,
          efectivo_a_rendir: efvoRendir,
          estado_rendicion: efvoRendir > 0 ? 'PENDIENTE' : 'NO_APLICA'
        });

        if (rjSnap.exists()) {
          const rj = rjSnap.data();
          const costoEnv = montoRealEnvio(e);
          const basico = Number(rj.basico_dia ?? 0);
          const envEnt = Number(rj.envios_entregados ?? 0) + 1;
          const montoEnv = Number(rj.monto_envios ?? 0) + costoEnv;
          const esSinCargo = e.envio_sin_cargo === 'SI';
          const scCant = Number(rj.envio_sin_cargo_cant ?? 0) + (esSinCargo ? 1 : 0);
          const scMonto = Number(rj.monto_envios_sin_cargo ?? 0) + (esSinCargo ? costoEnv : 0);

          tx.update(rjRef, {
            estado: 'LIBRE',
            pedido_en_camino: '',
            ultimo_pedido: e.cliente || e.id_cuenta || idEnvio,
            envios_entregados: envEnt,
            monto_envios: montoEnv,
            total_a_pagar: basico + montoEnv,
            envio_sin_cargo_cant: scCant,
            monto_envios_sin_cargo: scMonto
          });
        }

        infoEntrega = { e, tanda, efvoRendir, ahora };
      });

      if (infoEntrega?.tanda?.id) {
        try {
          await updateDoc(doc(db, 'tandas', infoEntrega.tanda.id), {
            estado: 'ENTREGADO',
            cobrada: true,
            cobrada_por: nombre,
            hora_cobro: infoEntrega.ahora,
            entregadoEn: infoEntrega.ahora
          });
        } catch {}
      }

      if (infoEntrega && infoEntrega.efvoRendir > 0) {
        await addDoc(collection(db, 'rendiciones'), {
          id_jornada: jActual,
          id_envio: idEnvio,
          id_cuenta: infoEntrega.e.id_cuenta || '',
          repartidor: nombre,
          cliente: infoEntrega.e.cliente || 'Cliente',
          monto_esperado: infoEntrega.efvoRendir,
          efectivo_a_rendir: infoEntrega.efvoRendir,
          estado: 'PENDIENTE',
          hora_creado: infoEntrega.ahora
        });
      }

      await addDoc(collection(db, 'eventos'), {
        fecha_hora: fmtLocal(),
        id_jornada: jActual,
        entidad: 'ENVIO',
        id_entidad: idEnvio,
        de_estado: 'EN_CAMINO',
        a_estado: 'ENTREGADO',
        usuario: nombre,
        detalle: infoEntrega?.e?.cliente || ''
      });
    } catch (e) {
      $('#er').textContent = 'No se pudo marcar como entregado: ' + (e.message || 'error');
    }
  }

  let jornadaUnsubs = [];
  const limpiarJornadaListeners = () => {
    jornadaUnsubs.forEach(fn => { try { fn(); } catch {} });
    jornadaUnsubs = [];
  };

  const suscribirJornada = (jId) => {
    limpiarJornadaListeners();
    if (!jId) return;

    jornadaUnsubs.push(onSnapshot(doc(db, 'repartidores_jornada', repJornadaId(jId, nombre)), snap => {
      if (!snap.exists() || snap.data()?.hora_desactivacion) {
        localStorage.removeItem('cdbf_activo');
        limpiar();
        mount(root);
        return;
      }
      rjDoc = snap.data();
      recomputarVista();
    }));

    jornadaUnsubs.push(onSnapshot(query(collection(db, 'envios'), where('id_jornada', '==', jId)), snap => {
      enviosDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputarVista();
    }));

    jornadaUnsubs.push(onSnapshot(query(collection(db, 'tandas'), where('id_jornada', '==', jId)), snap => {
      const next = new Map();
      snap.docs.forEach(d => next.set(d.id, { id: d.id, ...d.data() }));
      tandasMap = next;
      recomputarVista();
    }));

    jornadaUnsubs.push(onSnapshot(query(collection(db, 'rendiciones'), where('id_jornada', '==', jId)), snap => {
      rendicionesDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputarVista();
    }));
  };

  suscribirJornada(jornadaId);
  unsubs.push(limpiarJornadaListeners);

  unsubs.push(onSnapshot(query(collection(db, 'jornadas'), where('estado', '==', 'ABIERTA')), snap => {
    if (snap.empty) {
      localStorage.removeItem('cdbf_activo');
      limpiar();
      mount(root);
      return;
    }
    const nuevaJornadaId = snap.docs[0].id;
    if (nuevaJornadaId !== jornadaId) {
      jornadaId = nuevaJornadaId;
      localStorage.setItem('cdbf_jornada', jornadaId);
      suscribirJornada(jornadaId);
    }
    recomputarVista();
  }));

  $('#off').onclick = () => {
    const off = $('#off');
    off.hidden = true;
    off.insertAdjacentHTML('afterend', '<div id="cf" style="margin-top:1.5rem"><p><b>¿Cerrar sesión?</b></p><div class="g"><button id="si" class="ok">Sí</button><button id="no" class="sec">No</button></div></div>');
    const cerrar = () => { $('#cf')?.remove(); off.hidden = false; };
    $('#no').onclick = cerrar;
    $('#si').onclick = async () => {
      if (D.pedidos.some(p => p.estado === 'EN_CAMINO')) {
        cerrar();
        $('#er').textContent = 'Tenés un pedido en camino: entregalo antes de cerrar sesión.';
        return;
      }
      const ahora = fmtLocal();
      const jActual = jornadaId || (await obtenerJornadaAbierta())?.id;
      if (jActual) {
        await setDoc(doc(db, 'repartidores_jornada', repJornadaId(jActual, nombre)), {
          estado: 'INACTIVO',
          hora_desactivacion: ahora
        }, { merge: true });

        const sesSnap = await getDocs(query(collection(db, 'sesiones'), where('id_jornada', '==', jActual), where('nombre', '==', nombre), where('rol', '==', 'DELIVERY')));
        await Promise.all(sesSnap.docs.filter(d => !d.data().hora_egreso).map(d => updateDoc(doc(db, 'sesiones', d.id), { hora_egreso: ahora })));
      }
      localStorage.removeItem('cdbf_activo');
      limpiar();
      inicio(root, nombre);
    };
  };
}
