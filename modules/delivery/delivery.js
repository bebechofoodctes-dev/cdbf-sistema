import { api } from '../../core/api.js';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pesos = n => '$' + Number(n).toLocaleString('es-AR');
const CSS = `
.dl-app { --card: #202833; --txt: #e9eef4; --tenue: #93a1b3; --acento: #4da3e0; --exito: #56c48f; --alerta: #f0b13c; --rojo: #e63946; min-height: 100vh; color: var(--txt); font: 16px/1.4 system-ui, sans-serif; background: #10151c; padding: 1rem; box-sizing: border-box; }
.dl-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a3340; padding-bottom: 0.8rem; margin-bottom: 1rem; }
.dl-header h1 { font-size: 1.4rem; margin: 0; color: var(--acento); }
.dl-header button { width: auto; padding: 0.5rem 1rem; background: #2d3846; color: var(--txt); border: 0; border-radius: 8px; font-weight: 700; cursor: pointer; }
.dl-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.dl-card { background: var(--card); border-radius: 12px; padding: 1rem; border-left: 5px solid var(--alerta); display: flex; flex-direction: column; gap: 0.6rem; position: relative; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
.dl-card.LISTO { border-color: var(--exito); animation: pulseCard 1.5s infinite; }
.dl-card.EN_CAMINO { border-color: var(--acento); }
.dl-card-title { display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem; }
.dl-badge { background: #2d3846; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.8rem; }
.dl-envio-box { background: #151a22; padding: 0.6rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #34404f; }
.dl-envio-monto { font-size: 1.1rem; font-weight: bold; color: var(--exito); }
.dl-dir-link { color: var(--acento); text-decoration: none; font-weight: bold; display: flex; align-items: center; gap: 0.4rem; background: #1a232e; padding: 0.5rem; border-radius: 6px; border: 1px solid #2a3340; word-break: break-all; }
.dl-btn { font: inherit; font-weight: 700; border: 0; border-radius: 8px; padding: 0.8rem; cursor: pointer; background: var(--acento); color: #06121d; width: 100%; text-align: center; }
.dl-btn.exito { background: var(--exito); color: #06121d; }
.dl-btn.rojo { background: var(--rojo); color: #fff; }
.dl-modal-overlay { position: fixed; top:0; left:0; width:100vw; height:100vh; background: rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:9999; }
.dl-modal { background: var(--card); padding: 1.5rem; border-radius: 12px; max-width: 320px; width: 90%; text-align: center; border: 1px solid #34404f; }
.dl-modal h3 { margin-top:0; color: var(--txt); }
.dl-modal-btns { display: flex; gap: 0.8rem; margin-top: 1rem; }
@keyframes pulseCard { 0% { box-shadow: 0 0 0 0 rgba(86, 196, 143, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(86, 196, 143, 0); } 100% { box-shadow: 0 0 0 0 rgba(86, 196, 143, 0); } }
`;
let audioCtx = null;
let loopInterval = null;
let vibratorInterval = null;
let activeLoop = false;
function startLoopAlert() {
if (activeLoop) return;
activeLoop = true;
const playBeep = () => {
try {
audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
if (audioCtx.state === 'suspended') audioCtx.resume();
const osc = audioCtx.createOscillator();
const gain = audioCtx.createGain();
osc.type = 'sine';
osc.frequency.setValueAtTime(880, audioCtx.currentTime);
gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
osc.connect(gain);
gain.connect(audioCtx.destination);
osc.start();
osc.stop(audioCtx.currentTime + 0.3);
} catch (e) {}
};
loopInterval = setInterval(playBeep, 800);
if ('vibrate' in navigator) {
vibratorInterval = setInterval(() => {
navigator.vibrate([300, 200, 300]);
}, 1000);
}
}
function stopLoopAlert() {
activeLoop = false;
if (loopInterval) { clearInterval(loopInterval); loopInterval = null; }
if (vibratorInterval) { clearInterval(vibratorInterval); vibratorInterval = null; }
if ('vibrate' in navigator) navigator.vibrate(0);
}
function normalizarTexto(txt) {
return String(txt ?? '')
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.trim();
}
function generarLinkMapa(direccionTexto, ubicacionLink) {
if (ubicacionLink && (ubicacionLink.startsWith('http://') || ubicacionLink.startsWith('https://'))) {
return ubicacionLink;
}
const query = encodeURIComponent(normalizarTexto(direccionTexto));
return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
export function mount(root) {
const ses = JSON.parse(sessionStorage.getItem('delivery') || 'null');
ses ? panel(root, ses) : login(root);
}
async function login(root) {
root.innerHTML = `<style>${CSS}</style>
<div class="dl-app">
<div style="max-width:24rem; margin:10vh auto; background:var(--card); padding:2rem; border-radius:12px;">
<h1 style="margin-top:0;">Acceso Repartidor</h1>
<label style="display:block; margin:1rem 0 0.4rem; color:var(--tenue);">Ingresá tu nombre</label>
<input id="repNom" style="width:100%; padding:0.8rem; border-radius:8px; border:1px solid #34404f; background:#10151c; color:#fff; box-sizing:border-box;" placeholder="Nombre completo">
<p id="err" style="color:var(--alerta); min-height:1.2em;"></p>
<button id="btnLogin" class="dl-btn" style="margin-top:1rem;">Ingresar al Panel</button>
</div>
</div>`;
root.querySelector('#btnLogin').onclick = async () => {
const nom = root.querySelector('#repNom').value.trim();
if (!nom) { root.querySelector('#err').textContent = 'Por favor, ingresá tu nombre.'; return; }
const s = { nombre: nom };
sessionStorage.setItem('delivery', JSON.stringify(s));
panel(root, s);
};
}
async function panel(root, ses) {
let timerSync = null;
let modalConfirmacion = null;
root.innerHTML = `<style>${CSS}</style>
<div class="dl-app">
<div class="dl-header">
<h1>Delivery: ${esc(ses.nombre)}</h1>
<button id="btnLogout">Salir</button>
</div>
<div id="gridPedidos" class="dl-grid"><p style="color:var(--tenue);">Cargando pedidos asignados...</p></div>
</div>
<div id="modalBox"></div>`;
root.querySelector('#btnLogout').onclick = () => {
stopLoopAlert();
clearInterval(timerSync);
sessionStorage.removeItem('delivery');
login(root);
};
const solicitarConfirmacion = (pedidoId, callback) => {
stopLoopAlert();
const box = root.querySelector('#modalBox');
box.innerHTML = `
<div class="dl-modal-overlay">
<div class="dl-modal">
<h3>¿Comenzar reparto?</h3>
<p style="color:var(--tenue); font-size:0.95rem;">Vas a tomar el pedido #${esc(pedidoId)}.</p>
<div class="dl-modal-btns">
<button id="btnCancelModal" class="dl-btn rojo">Cancelar</button>
<button id="btnConfirmModal" class="dl-btn exito">Sí, comenzar</button>
</div>
</div>
</div>`;
box.querySelector('#btnCancelModal').onclick = () => { box.innerHTML = ''; };
box.querySelector('#btnConfirmModal').onclick = () => {
box.innerHTML = '';
callback();
};
};
const renderizarTarjetas = (pedidos) => {
const grid = root.querySelector('#gridPedidos');
if (!pedidos || !pedidos.length) {
grid.innerHTML = '<p style="color:var(--tenue); grid-column:1/-1;">No tenés pedidos asignados en este momento.</p>';
stopLoopAlert();
return;
}
let hayPedidoListo = false;
grid.innerHTML = pedidos.map(p => {
const estadoClase = p.estado || 'RECIBIDA';
if (estadoClase === 'LISTO') hayPedidoListo = true;
const costoEnvio = Number(p.costo_envio || p.envio || 0);
const esGratis = p.envio_sin_cargo === 'SI' || p.envioBonificado;
const textoEnvio = esGratis ? '<span style="color:var(--exito);">Sin cargo</span>' : pesos(costoEnvio);
const linkMapa = generarLinkMapa(p.direccion_texto || p.direccion, p.ubicacion_link);
const dirLimpia = esc(p.direccion_texto || p.direccion || 'Sin dirección registrada');
return `
<div class="dl-card ${estadoClase}">
<div class="dl-card-title">
<span>Pedido #${esc(p.id)}</span>
<span class="dl-badge">${esc(p.estado || 'EN ESPERA')}</span>
</div>
<div>
<strong style="font-size:1.1rem; color:#fff;">${esc(p.cliente || 'Cliente')}</strong><br>
<small style="color:var(--tenue);">Tel: ${esc(p.telefono || 'N/D')}</small>
</div>
<a href="${linkMapa}" target="_self" class="dl-dir-link">
📍 ${dirLimpia}
</a>
<div class="dl-envio-box">
<span>Monto de Envío:</span>
<span class="dl-envio-monto">${textoEnvio}</span>
</div>
<div style="display:flex; justify-space-between; align-items:center; font-size:1.1rem; font-weight:bold; margin-top:0.2rem;">
<span>Total a cobrar:</span>
<span style="color:var(--alerta);">${pesos(p.total || 0)}</span>
</div>
${estadoClase === 'LISTO' ? `<button class="dl-btn exito btn-tomar" data-id="${esc(p.id)}"> Tomar Pedido y Salir</button>` : ''}
${estadoClase === 'EN_CAMINO' ? `<button class="dl-btn btn-entregar" data-id="${esc(p.id)}"> Marcar como Entregado</button>` : ''}
</div>`;
}).join('');
if (hayPedidoListo) {
startLoopAlert();
} else {
stopLoopAlert();
}
grid.querySelectorAll('.btn-tomar').forEach(b => {
b.onclick = () => {
solicitarConfirmacion(b.dataset.id, async () => {
const r = await api('tomar_pedido_delivery', { id: b.dataset.id, repartidor: ses.nombre });
if (r.error) alert('No se pudo iniciar el reparto: ' + r.error);
cargar();
});
};
});
grid.querySelectorAll('.btn-entregar').forEach(b => {
b.onclick = async () => {
if (!confirm('¿Confirmás que el pedido fue entregado y cobrado?')) return;
const r = await api('entregar_pedido_delivery', { id: b.dataset.id, repartidor: ses.nombre });
if (r.error) alert('No se pudo registrar la entrega: ' + r.error);
cargar();
};
});
};
const cargar = async () => {
const r = await api('datos_delivery', { repartidor: ses.nombre });
if (!r.error) {
renderizarTarjetas(r.pedidos || []);
}
};
timerSync = setInterval(cargar, 4000);
cargar();
}
