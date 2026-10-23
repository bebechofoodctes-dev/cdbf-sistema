/**
 * app.js
 * ============================================================
 * ENTRY POINT DE LA APLICACIÓN
 *
 * Registra las rutas y arranca el router.
 * Los módulos se cargan de forma lazy (solo cuando se navega a ellos).
 * ============================================================
 */

import { router } from './core/router.js';

// ── Registrar rutas (lazy imports) ───────────────────────────
router
  .register('',         () => Promise.resolve({ mount: _mountHome }))
  .register('cocina',   () => import('./modules/cocina/cocina.js'))
  .register('cajero',   () => import('./modules/cajero/cajero.js'))
  .register('delivery', () => import('./modules/delivery/delivery.js'))
  .register('admin',    () => import('./modules/admin/admin.js'));

// ── Pantalla de bienvenida ────────────────────────────────────
function _mountHome(container) {
  container.innerHTML = `
    <div class="welcome-screen">
      <h1>🍔 Sistema CDBF</h1>
      <p>Sistema de Gestión de Ventas — seleccioná un módulo para empezar</p>
      <div class="module-cards">
        <a href="#/cajero"   class="module-card">🧾 <span>Cajero</span></a>
        <a href="#/cocina"   class="module-card">👨‍🍳 <span>Cocina</span></a>
        <a href="#/delivery" class="module-card">🛵 <span>Delivery</span></a>
        <a href="#/admin"    class="module-card">📊 <span>Admin</span></a>
      </div>
    </div>`;
}

// ── Iniciar ───────────────────────────────────────────────────
router.init();
