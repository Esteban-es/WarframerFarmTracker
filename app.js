/* =========================================================
   Warframe Farm Tracker - app.js
   JavaScript vanilla + localStorage. Sin dependencias.

   Índice:
   1. Constantes y estado
   2. Utilidades
   3. Persistencia (localStorage)
   4. Gestión de proyectos
   5. Parser de tablas de la wiki
   6. Renderizado
   7. Acciones (contador, piezas, importación, copia)
   8. Modales y toasts
   9. Eventos e inicialización
   ========================================================= */

'use strict';

/* API de traducción: i18n.js en navegador, require en Node (tests). */
const I18N_API =
    typeof I18N !== 'undefined'
        ? I18N
        : typeof require === 'function'
          ? (function () {
                try {
                    return require('./i18n.js');
                } catch (err) {
                    return null;
                }
            })()
          : null;

const t = I18N_API ? I18N_API.t : (key) => key;
const getLang = I18N_API ? I18N_API.getLang : () => 'es';

/* ---------------------------------------------------------
   1. Constantes y estado
   --------------------------------------------------------- */
const STORAGE_KEY = 'warframeFarmTracker.v1';

/** Tipos de rotación contabilizados por proyecto. */
const ROTATION_KEYS = ['A', 'B', 'C'];

/** Estado global: { proyectos: Proyecto[], seleccionado: id|null } */
let state = {
    proyectos: [],
    seleccionado: null
};

/** ¿Está visible el panel de importación (modo "modificar piezas")? */
let importOpen = false;

/** Proyecto pintado la última vez, para resetear el modo al cambiar. */
let lastRenderedProjectId = null;

/**
 * Estructura de un proyecto:
 * {
 *   id, nombre, actividad, intentos (= A+B+C), rotaciones: {A,B,C},
 *   piezas[], fechaCreacion
 * }
 *
 * Estructura de una pieza:
 * {
 *   id, nombre, rotacion, chance, expected, guaranteed, obtained
 * }
 */

/* ---------------------------------------------------------
   2. Utilidades
   --------------------------------------------------------- */
const $ = (sel) => document.querySelector(sel);

/** Identificador único corto. */
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Escapa texto del usuario para insertarlo en innerHTML. */
function esc(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Formatea una fecha ISO a dd/mm/aaaa. */
function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(getLang() === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ---------------------------------------------------------
   3. Persistencia (localStorage)
   --------------------------------------------------------- */
/**
 * Normaliza un proyecto al cargarlo:
 * - Crea el desglose de rotaciones (A/B/C) si no existe.
 * - Migra proyectos antiguos (solo "intentos") usando ese total como rotación A.
 * - Mantiene "intentos" como suma de A+B+C.
 */
function normalizeProject(project) {
    if (!project || typeof project !== 'object') return project;

    if (!project.rotaciones || typeof project.rotaciones !== 'object') {
        const legacy = Number.isFinite(project.intentos) ? project.intentos : 0;
        project.rotaciones = { A: legacy, B: 0, C: 0 };
    }

    for (const key of ROTATION_KEYS) {
        const value = parseInt(project.rotaciones[key], 10);
        project.rotaciones[key] = Number.isFinite(value) && value > 0 ? value : 0;
    }

    project.intentos = totalRotations(project);
    if (!Array.isArray(project.piezas)) project.piezas = [];

    // Tiempo por misión en segundos (0 = sin configurar).
    const time = Number(project.tiempoMision);
    project.tiempoMision = Number.isFinite(time) && time > 0 ? Math.round(time) : 0;

    return project;
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        state = {
            proyectos: Array.isArray(parsed.proyectos) ? parsed.proyectos : [],
            seleccionado: parsed.seleccionado || null
        };
        state.proyectos.forEach(normalizeProject);
        // Si el proyecto seleccionado ya no existe, limpiar la selección.
        if (state.seleccionado && !getSelectedProject()) {
            state.seleccionado = null;
        }
    } catch (err) {
        console.warn('No se pudo leer el estado guardado:', err);
        state = { proyectos: [], seleccionado: null };
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
        console.warn('No se pudo guardar el estado:', err);
    }
}

/* ---------------------------------------------------------
   4. Gestión de proyectos
   --------------------------------------------------------- */
function getSelectedProject() {
    return state.proyectos.find((p) => p.id === state.seleccionado) || null;
}

/** Total de rotaciones realizadas = A + B + C. */
function totalRotations(project) {
    const r = project.rotaciones || {};
    return ROTATION_KEYS.reduce((sum, key) => sum + (r[key] || 0), 0);
}

/** Recalcula el contador global ("intentos") a partir del desglose A/B/C. */
function syncRotationTotals(project) {
    project.intentos = totalRotations(project);
}

/** Desglose de rotaciones listo para pintar: { A, B, C, total }. */
function rotationCounts(project) {
    const r = project.rotaciones || {};
    const counts = { total: project.intentos || 0 };
    for (const key of ROTATION_KEYS) counts[key] = r[key] || 0;
    return counts;
}

function createProject({ nombre, actividad }) {
    const project = {
        id: uid(),
        nombre: nombre.trim(),
        actividad: (actividad || '').trim(),
        intentos: 0,
        rotaciones: { A: 0, B: 0, C: 0 },
        tiempoMision: 0,
        piezas: [],
        fechaCreacion: new Date().toISOString()
    };
    state.proyectos.unshift(project);
    state.seleccionado = project.id;
    saveState();
    return project;
}

function deleteProject(id) {
    state.proyectos = state.proyectos.filter((p) => p.id !== id);
    if (state.seleccionado === id) state.seleccionado = null;
    saveState();
}

function selectProject(id) {
    state.seleccionado = id;
    saveState();
    render();
}

/* ---------------------------------------------------------
   5. Parser de tablas de la wiki
   --------------------------------------------------------- */

/** ¿Es una línea de estadísticas (chance, expected, guaranteed)? */
function isStatLine(line) {
    if (!line) return true;
    return (
        /^\d+(?:[.,]\d+)?\s*%$/.test(line) ||
        /[±~≈]|\+\/-/.test(line) ||
        /rotations?$/i.test(line) ||
        /^\d+\s*±\s*\d+/.test(line)
    );
}

/** Extrae la rotación ("A", "B", "C") de texto como "Misión / A". */
function extractRotation(...texts) {
    for (const t of texts) {
        if (!t) continue;
        const clean = t.trim();
        if (/^[ABC]$/i.test(clean)) return clean.toUpperCase();
        const slash = clean.match(/\/\s*([A-Za-z])\s*$/);
        if (slash) return slash[1].toUpperCase();
        const rot = clean.match(/\b([ABC])\s+Rotations?\b/i);
        if (rot) return rot[1].toUpperCase();
    }
    return '';
}

/** "~ 39 A Rotations" -> 39 */
function parseExpected(text) {
    const m = String(text || '').match(/^\D*(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

/** "271 ± 90 A Rotations" -> 271. Con strict=false acepta cualquier número. */
function parseGuaranteed(text, strict = true) {
    const t = String(text || '').trim();
    if (!t) return null;
    if (strict && !/[±]|\+\/-/.test(t) && !/guarantee/i.test(t)) return null;
    const m = t.match(/^\D*(\d+)/);
    return m ? parseInt(m[1], 10) : null;
}

/** Construye una pieza normalizada desde sus campos sueltos. */
function buildPiece({ nombre, actividad, chance, expectedLine, guaranteedLine, rotacionExtra }) {
    const chanceNorm = String(chance || '').replace(/\s/g, '').replace(',', '.');
    if (!chanceNorm) return null;
    return {
        nombre: String(nombre || '').trim(),
        actividad: String(actividad || '').trim(),
        rotacion: extractRotation(rotacionExtra, actividad, expectedLine, guaranteedLine),
        chance: chanceNorm,
        expected: parseExpected(expectedLine),
        guaranteed: parseGuaranteed(guaranteedLine, false)
    };
}

/**
 * Intenta interpretar una línea que contiene una fila completa de tabla
 * (formato TSV al copiar una tabla de la wiki) o una fila con columnas
 * separadas por espacios dobles.
 * Devuelve null si la línea no es una fila reconocible.
 */
function parseRowLine(rawLine) {
    // Se recorta solo la derecha: un tabulador inicial indica columna vacía.
    const line = String(rawLine || '').replace(/\s+$/, '');
    let fields = null;

    if (line.includes('\t')) {
        fields = line.split('\t');
    } else if (/\d/.test(line) && /\S {2,}\S/.test(line)) {
        fields = line.trim().split(/\s{2,}/);
    }

    if (fields) {
        const cells = fields.map((f) => f.trim());
        const chanceIdx = cells.findIndex((f) => /^\d+(?:[.,]\d+)?\s*%$/.test(f));
        if (chanceIdx !== -1 && cells.length >= 3) {
            const expectedLine = cells[chanceIdx + 1] || '';
            const guaranteedLine = cells[chanceIdx + 2] || '';

            let nombre = '';
            let actividad = '';
            let rotacionExtra = '';

            if (chanceIdx === 0) {
                // Columna de nombre vacía (rowspan): se reutiliza el último nombre.
                actividad = cells[1] || '';
            } else if (chanceIdx === 1) {
                nombre = cells[0];
            } else {
                const prev = cells[chanceIdx - 1];
                if (/^[ABC]$/i.test(prev) && chanceIdx >= 3) {
                    // Columna de rotación separada de la misión.
                    nombre = cells[0];
                    actividad = cells[chanceIdx - 2] || '';
                    rotacionExtra = prev;
                } else {
                    nombre = cells[chanceIdx - 2];
                    actividad = prev;
                }
            }

            const piece = buildPiece({
                nombre,
                actividad,
                chance: cells[chanceIdx],
                expectedLine,
                guaranteedLine,
                rotacionExtra
            });
            if (piece) return piece;
        }
    }

    // Último recurso: fila escrita con un solo espacio como separador.
    const m = line.trim().match(
        /^(.+?)\s+(.+?\/\s*[ABC])\s+(\d+(?:[.,]\d+)?)%\s+(\S[^±]*?)\s+(\d+\s*±\s*\d+.*)$/
    );
    if (m) {
        return buildPiece({
            nombre: m[1],
            actividad: m[2],
            chance: m[3] + '%',
            expectedLine: m[4],
            guaranteedLine: m[5]
        });
    }

    return null;
}

/**
 * Interpreta el texto pegado de la wiki y devuelve piezas:
 * [{ nombre, rotacion, chance, expected, guaranteed }]
 *
 * Formato A (tabla copiada, columnas separadas por tabuladores):
 *   Receiver <TAB> Elite Sanctuary Onslaught / A <TAB> 2.51% <TAB> ~ 39 A Rotations <TAB> 271 ± 90 A Rotations
 *
 * Formato B (bloque multilínea):
 *   Receiver
 *   Elite Sanctuary Onslaught / A
 *   2.51%
 *   ~ 39 A Rotations
 *   271 ± 90 A Rotations
 */
function parseWikiText(raw) {
    const lines = String(raw || '').replace(/\r/g, '').split('\n');
    const result = [];
    const seen = new Set();
    let lastName = '';

    const push = (piece) => {
        if (!piece || !piece.nombre) return;
        // Evitar duplicados de la misma pieza en la misma rotación.
        const key = `${piece.nombre.toLowerCase()}|${piece.rotacion}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push(piece);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // --- Fila de tabla en una sola línea (TSV / columnas) ---
        const row = parseRowLine(lines[i]);
        if (row) {
            if (!row.nombre) row.nombre = lastName;
            if (row.nombre) {
                lastName = row.nombre;
                push(row);
            }
            continue;
        }

        // --- Bloque multilínea clásico ---
        if (!/^\d+(?:[.,]\d+)?\s*%$/.test(line)) continue;

        const chance = line.replace(/\s/g, '').replace(',', '.');

        // Hacia atrás: actividad y nombre
        let j = i - 1;
        while (j >= 0 && !lines[j].trim()) j--;
        if (j < 0) continue;

        let nombre = '';
        let actividad = '';
        const candidate = lines[j].trim();

        if (candidate.includes('/')) {
            let k = j - 1;
            while (k >= 0 && !lines[k].trim()) k--;
            const prev = k >= 0 ? lines[k].trim() : '';
            if (prev && !isStatLine(prev)) {
                actividad = candidate;
                nombre = prev;
            } else {
                nombre = candidate;
            }
        } else if (!isStatLine(candidate)) {
            nombre = candidate;
        }

        if (!nombre) continue;

        // Hacia delante: expected y guaranteed
        let m = i + 1;
        while (m < lines.length && !lines[m].trim()) m++;
        const expectedLine = m < lines.length ? lines[m].trim() : '';

        let n = m + 1;
        while (n < lines.length && !lines[n].trim()) n++;
        const guaranteedLine = n < lines.length ? lines[n].trim() : '';

        push(
            buildPiece({
                nombre,
                actividad,
                chance,
                expectedLine,
                guaranteedLine
            })
        );
    }

    return result;
}

/** Fusiona piezas importadas con las existentes (conserva "obtained"). */
function mergePieces(existing, incoming) {
    const merged = existing.map((p) => ({ ...p }));
    let added = 0;

    for (const piece of incoming) {
        const found = merged.find(
            (p) => p.nombre.toLowerCase() === piece.nombre.toLowerCase() && p.rotacion === piece.rotacion
        );
        if (found) {
            found.chance = piece.chance;
            found.expected = piece.expected;
            found.guaranteed = piece.guaranteed;
            if (piece.actividad) found.actividad = piece.actividad;
        } else {
            merged.push({
                id: uid(),
                nombre: piece.nombre,
                actividad: piece.actividad || '',
                rotacion: piece.rotacion,
                chance: piece.chance,
                expected: piece.expected,
                guaranteed: piece.guaranteed,
                obtained: false
            });
            added++;
        }
    }

    return { pieces: merged, added };
}

/* ---------------------------------------------------------
   5b. Cálculos de farmeo (pendientes, tiempo y ubicaciones)
   --------------------------------------------------------- */

/**
 * Resumen de lo que falta por obtener:
 * - pending: piezas no obtenidas.
 * - expected / guaranteed: rotaciones pendientes totales (por tipo de
 *   rotación se toma la pieza que más pide, ya que se obtienen a la vez).
 */
function pendingStats(project) {
    const counts = rotationCounts(project);
    const pending = project.piezas.filter((p) => !p.obtained);
    const groups = new Map();

    for (const piece of pending) {
        const key = piece.rotacion || 'TOTAL';
        const done = rotationCountFor(piece, counts);
        const group = groups.get(key) || { expected: 0, guaranteed: 0 };
        if (piece.expected) group.expected = Math.max(group.expected, Math.max(0, piece.expected - done));
        if (piece.guaranteed) group.guaranteed = Math.max(group.guaranteed, Math.max(0, piece.guaranteed - done));
        groups.set(key, group);
    }

    let expected = 0;
    let guaranteed = 0;
    for (const group of groups.values()) {
        expected += group.expected;
        guaranteed += group.guaranteed;
    }

    return { pending, expected, guaranteed };
}

/** Ubicación (misión) de la que baja una pieza pendiente. */
function locationFor(part, project) {
    let base = String((part && part.actividad) || (project && project.actividad) || '').trim();
    if (!base) return t('location.none');
    if (part.rotacion && !/\/\s*[ABC]\s*$/i.test(base)) base += ` / ${part.rotacion}`;
    return base;
}

/** Segundos -> "3 h 15 min" / "45 min" / "1 d 4 h". */
function formatDuration(totalSeconds) {
    const minutes = Math.round(Math.max(0, totalSeconds) / 60);
    if (!minutes) return '0 min';
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    const parts = [];
    if (days) parts.push(`${days} d`);
    if (hours) parts.push(`${hours} h`);
    if (mins) parts.push(`${mins} min`);
    return parts.join(' ');
}

/** Estimación en segundos para un número de rotaciones. */
function estimateSeconds(rotations, project) {
    const perMission = project && project.tiempoMision ? project.tiempoMision : 0;
    return perMission ? rotations * perMission : 0;
}

/* ---------------------------------------------------------
   6. Renderizado
   --------------------------------------------------------- */
function render() {
    renderProjectList();
    renderMain();
}

function renderProjectList() {
    const list = $('#project-list');

    if (!state.proyectos.length) {
        list.innerHTML = `<li class="sidebar-empty">${t('sidebar.empty')}</li>`;
        return;
    }

    list.innerHTML = state.proyectos
        .map((p) => {
            const obtained = p.piezas.filter((x) => x.obtained).length;
            const stats = pendingStats(p);
            let timeLine = '';
            let timeClass = '';
            if (p.piezas.length && !stats.pending.length) {
                timeLine = t('status.complete');
                timeClass = ' is-done';
            } else if (stats.pending.length && p.tiempoMision) {
                const base = stats.expected || stats.guaranteed;
                timeLine = `\u2248 ${formatDuration(estimateSeconds(base, p))}`;
            }
            return `
                <li class="project-item ${p.id === state.seleccionado ? 'active' : ''}" data-project="${esc(p.id)}">
                    <span class="project-item-name">${esc(p.nombre)}</span>
                    <span class="project-item-meta">
                        <span>${t('parts.count', { done: obtained, total: p.piezas.length })}</span>
                        <span>${p.intentos} rot.</span>
                    </span>
                    ${timeLine ? `<span class="project-item-time${timeClass}">${timeLine}</span>` : ''}
                </li>`;
        })
        .join('');
}

function renderMain() {
    const project = getSelectedProject();
    const welcome = $('#welcome-view');
    const view = $('#project-view');

    // Al cambiar de proyecto se cierra el modo de importación.
    const currentId = project ? project.id : null;
    if (currentId !== lastRenderedProjectId) {
        lastRenderedProjectId = currentId;
        importOpen = false;
    }

    if (!project) {
        welcome.classList.remove('hidden');
        view.classList.add('hidden');
        return;
    }

    welcome.classList.add('hidden');
    view.classList.remove('hidden');
    renderProject(project);
}

function renderProject(project) {
    // Cabecera
    $('#project-name').textContent = project.nombre;
    const activityEl = $('#project-activity');
    activityEl.textContent = project.actividad || formatDate(project.fechaCreacion);
    activityEl.classList.toggle('hidden', !project.actividad && !project.fechaCreacion);

    // Contador global + desglose por rotación
    const counts = rotationCounts(project);
    $('#counter-value').textContent = counts.total;
    for (const key of ROTATION_KEYS) {
        const el = $(`#rot-value-${key}`);
        if (el) el.textContent = counts[key];
    }

    // Importación: oculta cuando ya hay piezas, salvo en modo edición
    const total = project.piezas.length;
    const showImport = total === 0 || importOpen;
    $('#import-section').classList.toggle('hidden', !showImport);
    const toggleImportBtn = $('#btn-toggle-import');
    toggleImportBtn.classList.toggle('hidden', total === 0);
    toggleImportBtn.textContent = importOpen ? t('parts.hideImport') : t('parts.edit');

    // Resumen y barra de progreso
    const obtained = project.piezas.filter((x) => x.obtained).length;
    const percent = total ? Math.round((obtained / total) * 100) : 0;

    $('#obtained-count').textContent = obtained;
    $('#total-count').textContent = total;
    $('#progress-percent').textContent = `${percent}%`;
    $('#progress-bar').style.width = `${percent}%`;

    // Plan de farmeo: tiempo estimado + ubicaciones pendientes
    const stats = pendingStats(project);
    $('#plan-section').classList.toggle('hidden', total === 0);
    if (total) renderPlan(project, stats);

    // Piezas en dos bloques separados (evita tamaños mezclados en la misma fila)
    const pendingPieces = project.piezas.filter((p) => !p.obtained);
    const obtainedPieces = project.piezas.filter((p) => p.obtained);

    $('#empty-state').classList.toggle('hidden', total > 0);
    $('#pending-block').classList.toggle('hidden', pendingPieces.length === 0);
    $('#obtained-block').classList.toggle('hidden', obtainedPieces.length === 0);
    $('#pending-count').textContent = pendingPieces.length;
    $('#obtained-block-count').textContent = obtainedPieces.length;
    $('#parts-grid').innerHTML = pendingPieces.map((p) => partCardHTML(p, counts, importOpen)).join('');
    $('#obtained-grid').innerHTML = obtainedPieces.map((p) => partCardHTML(p, counts, importOpen)).join('');
}

/** Pinta el plan de farmeo: estimación de tiempo y ubicaciones pendientes. */
function renderPlan(project, stats) {
    const input = $('#mission-time-input');
    if (document.activeElement !== input) {
        input.value = project.tiempoMision ? String(project.tiempoMision / 60) : '';
    }

    $('#estimate-expected').textContent = t('plan.pendingRotations', { n: stats.expected });
    $('#estimate-guaranteed').textContent = t('plan.pendingRotations', { n: stats.guaranteed });

    if (!stats.pending.length) {
        $('#time-expected').textContent = t('plan.completed');
        $('#time-guaranteed').textContent = t('plan.completed');
    } else {
        const expectedSeconds = estimateSeconds(stats.expected, project);
        const guaranteedSeconds = estimateSeconds(stats.guaranteed, project);
        $('#time-expected').textContent = expectedSeconds ? `\u2248 ${formatDuration(expectedSeconds)}` : '—';
        $('#time-guaranteed').textContent = guaranteedSeconds ? `\u2248 ${formatDuration(guaranteedSeconds)}` : '—';
    }

    // Ubicaciones agrupadas de las piezas que faltan
    const groups = new Map();
    for (const piece of stats.pending) {
        const location = locationFor(piece, project);
        if (!groups.has(location)) groups.set(location, []);
        groups.get(location).push(piece);
    }

    $('#location-list').innerHTML = groups.size
        ? [...groups.entries()]
              .map(
                  ([location, pieces]) => `
                <li class="location-item">
                    <span class="location-name">${esc(location)}</span>
                    <span class="location-parts">${pieces.map((p) => esc(p.nombre)).join(', ')} <em>${pieces.length}</em></span>
                </li>`
              )
              .join('')
        : `<li class="location-empty">${t('plan.nothingPending')}</li>`;
}

/**
 * Rotaciones contabilizadas para una pieza: las de su rotación
 * (A/B/C) o el total si la pieza no indica rotación.
 */
function rotationCountFor(part, counts) {
    const own = part.rotacion ? counts[part.rotacion] : null;
    const value = Number.isFinite(own) ? own : counts.total;
    return Number.isFinite(value) ? value : 0;
}

/**
 * Fila de progreso de una meta (expected / guaranteed) según las
 * rotaciones realizadas en el proyecto.
 */
function progressRowHTML(label, goal, done, obtained, variant) {
    if (goal == null || !goal) return '';

    const pct = Math.round((done / goal) * 100);
    const reached = !!obtained || done >= goal;
    const width = reached ? 100 : Math.min(100, pct);
    const status = obtained
        ? t('progress.obtained')
        : done >= goal
          ? t('progress.reached')
          : t('progress.remaining', { n: goal - done });

    return `
        <div class="farm-row ${reached ? 'reached' : ''} ${variant ? 'farm-row--' + variant : ''}">
            <div class="farm-row-head">
                <span class="farm-label">${esc(label)} <b>${goal}</b></span>
                <span class="farm-status">${status}</span>
            </div>
            <div class="farm-track"><div class="farm-fill" style="width:${width}%"></div></div>
            <span class="farm-meta">${t('progress.meta', { done, goal, pct })}</span>
        </div>`;
}

function partCardHTML(part, counts, editMode) {
    const obtained = !!part.obtained;
    const removeBtn = editMode
        ? `<button type="button" class="part-remove" data-remove="${esc(part.id)}" title="${esc(t('part.remove'))}" aria-label="${esc(t('part.removeNamed', { name: part.nombre }))}">\u2715</button>`
        : '';

    // Pieza obtenida: tarjeta compacta (se puede pulsar para desmarcarla)
    if (obtained) {
        return `
        <div class="part-card compact obtained">
            <button
                type="button"
                class="compact-item"
                data-part="${esc(part.id)}"
                aria-pressed="true"
                title="${esc(t('part.unmark'))}">
                <span class="check">\u2713</span>
                <span class="compact-name">${esc(part.nombre)}</span>
                ${part.rotacion ? `<span class="rotation-badge">${esc(part.rotacion)}</span>` : ''}
            </button>
            ${removeBtn}
        </div>`;
    }

    const done = rotationCountFor(part, counts);
    const rows =
        progressRowHTML(t('part.expected'), part.expected, done, false, 'blue') +
        progressRowHTML(t('part.guaranteed'), part.guaranteed, done, false, 'gold');

    return `
        <article class="part-card">
            <div class="part-head">
                <h4 class="part-name">${esc(part.nombre)}</h4>
                <div class="part-head-right">
                    ${part.rotacion ? `<span class="rotation-badge">${esc(part.rotacion)}</span>` : ''}
                    ${removeBtn}
                </div>
            </div>
            <ul class="part-stats">
                <li><span>${t('part.drop')}</span><strong>${esc(part.chance || '—')}</strong></li>
            </ul>
            ${
                rows
                    ? `<div class="farm-progress">
                            <span class="farm-title">${t('part.rotationProgress')}</span>
                            ${rows}
                        </div>`
                    : ''
            }
            <button
                type="button"
                class="obtained-toggle"
                data-part="${esc(part.id)}"
                aria-pressed="false">
                <span class="check">\u2610</span> ${t('part.markObtained')}
            </button>
        </article>`;
}

/** Refresca solo la zona del proyecto seleccionado (ahorra renders completos). */
function refreshSelected() {
    saveState();
    renderProjectList();
    const project = getSelectedProject();
    if (project) renderProject(project);
}

/* ---------------------------------------------------------
   7. Acciones
   --------------------------------------------------------- */

/* --- 7.1 Contadores de rotaciones --- */

/** Vuelta completa: suma/resta 1 a todas las rotaciones (A, B y C). */
function changeLap(delta) {
    const project = getSelectedProject();
    if (!project) return;
    for (const key of ROTATION_KEYS) {
        project.rotaciones[key] = Math.max(0, project.rotaciones[key] + delta);
    }
    syncRotationTotals(project);
    refreshSelected();
}

/** Rotación concreta (A, B o C). */
function changeRotation(rotation, delta) {
    const project = getSelectedProject();
    if (!project || !ROTATION_KEYS.includes(rotation)) return;
    project.rotaciones[rotation] = Math.max(0, project.rotaciones[rotation] + delta);
    syncRotationTotals(project);
    refreshSelected();
}

/* --- 7.2 Piezas --- */
function toggleObtained(partId) {
    const project = getSelectedProject();
    if (!project) return;
    const piece = project.piezas.find((p) => p.id === partId);
    if (!piece) return;
    piece.obtained = !piece.obtained;
    refreshSelected();
}

function removePiece(partId) {
    const project = getSelectedProject();
    if (!project) return;
    const piece = project.piezas.find((p) => p.id === partId);
    project.piezas = project.piezas.filter((p) => p.id !== partId);
    refreshSelected();
    if (piece) showToast(t('toast.pieceRemoved', { name: piece.nombre }), 'success');
}

/* --- 7.3 Importación desde el portapapeles/wiki --- */
function renderImportPreview() {
    const text = $('#import-textarea').value;
    const preview = $('#import-preview');
    const pieces = parseWikiText(text);

    if (!pieces.length) {
        preview.classList.add('hidden');
        return;
    }

    preview.classList.remove('hidden');
    $('#preview-count').textContent = pieces.length;
    $('#preview-list').innerHTML = pieces
        .map(
            (p) => `
            <li class="preview-chip">
                ${esc(p.nombre)}${p.rotacion ? ` <span class="rot">(${esc(p.rotacion)})</span>` : ''}
                <span class="pct">· ${esc(p.chance)}</span>
            </li>`
        )
        .join('');
}

function confirmImport() {
    const project = getSelectedProject();
    if (!project) return;

    const text = $('#import-textarea').value;
    const pieces = parseWikiText(text);

    if (!pieces.length) {
        showToast(t('toast.noPieces'), 'error');
        return;
    }

    const { pieces: merged, added } = mergePieces(project.piezas, pieces);
    project.piezas = merged;

    $('#import-textarea').value = '';
    $('#import-preview').classList.add('hidden');
    importOpen = false;

    refreshSelected();
    showToast(added === 1 ? t('toast.importedOne') : t('toast.importedMany', { n: added }), 'success');
}

/* --- 7.4 Copiar progreso --- */
function buildProgressText(project) {
    const names = project.piezas.map((p) => p.nombre.toLowerCase());
    const lines = [
        project.nombre,
        t('copy.rotations', { n: project.intentos }),
        t('copy.obtained')
    ];

    for (const piece of project.piezas) {
        const repeated = names.filter((n) => n === piece.nombre.toLowerCase()).length > 1;
        const suffix = repeated && piece.rotacion ? ` (${piece.rotacion})` : '';
        lines.push(`${piece.obtained ? '\u2713' : '\u2717'} ${piece.nombre}${suffix}`);
    }

    return lines.join('\n');
}

async function copyProgress() {
    const project = getSelectedProject();
    if (!project) return;

    const text = buildProgressText(project);

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback para navegadores sin API de portapapeles.
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        showToast(t('toast.copied'), 'success');
    } catch (err) {
        console.warn(err);
        showToast(t('toast.copyFailed'), 'error');
    }
}

/* ---------------------------------------------------------
   8. Modales y toasts
   --------------------------------------------------------- */
let toastTimer = null;

function showToast(message, type = '') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
}

function openModal(modalId) {
    $('#modal-overlay').classList.remove('hidden');
    $(modalId).classList.remove('hidden');
}

function closeModals() {
    $('#modal-overlay').classList.add('hidden');
    $('#project-modal').classList.add('hidden');
    $('#delete-modal').classList.add('hidden');
}

function openProjectModal() {
    $('#modal-title').textContent = t('modal.newProject');
    $('#project-form').reset();
    openModal('#project-modal');
    setTimeout(() => $('#project-name-input').focus(), 50);
}

function openDeleteModal() {
    const project = getSelectedProject();
    if (!project) return;
    $('#delete-project-name').textContent = project.nombre;
    openModal('#delete-modal');
}

/* ---------------------------------------------------------
   9. Eventos e inicialización
   --------------------------------------------------------- */
function init() {
    loadState();
    render();

    // Idioma: interruptor ES/EN de la sidebar
    if (I18N_API) {
        const langSwitch = document.querySelector('.lang-switch');
        if (langSwitch) {
            langSwitch.addEventListener('click', (e) => {
                const btn = e.target.closest('.lang-btn[data-lang]');
                if (btn) I18N_API.setLang(btn.getAttribute('data-lang'));
            });
        }

        // Al cambiar de idioma se vuelve a pintar el contenido dinámico.
        if (typeof I18N_API.onChange === 'function') {
            I18N_API.onChange(() => {
                render();
                // El nombre del proyecto vive dentro del texto traducido del modal.
                const deleteModal = $('#delete-modal');
                if (!deleteModal.classList.contains('hidden')) {
                    const project = getSelectedProject();
                    if (project) $('#delete-project-name').textContent = project.nombre;
                }
            });
        }
    }

    // Sidebar: crear y seleccionar proyectos
    $('#btn-new-project').addEventListener('click', openProjectModal);
    $('#btn-create-first').addEventListener('click', openProjectModal);
    $('#project-list').addEventListener('click', (e) => {
        const item = e.target.closest('[data-project]');
        if (item) selectProject(item.dataset.project);
    });

    // Cabecera del proyecto
    $('#btn-back').addEventListener('click', () => {
        state.seleccionado = null;
        saveState();
        render();
    });
    $('#btn-delete-project').addEventListener('click', openDeleteModal);
    $('#btn-copy-progress').addEventListener('click', copyProgress);

    // Contadores de rotaciones
    $('#btn-increment').addEventListener('click', () => changeLap(1)); // vuelta completa
    $('#btn-decrement').addEventListener('click', () => changeLap(-1));
    $('#rotation-counters').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-rot]');
        if (btn) changeRotation(btn.dataset.rot, parseInt(btn.dataset.delta, 10));
    });

    // Importación
    $('#import-textarea').addEventListener('input', renderImportPreview);
    $('#btn-confirm-import').addEventListener('click', confirmImport);
    $('#btn-toggle-import').addEventListener('click', () => {
        importOpen = !importOpen;
        const project = getSelectedProject();
        if (project) renderProject(project);
        if (importOpen) $('#import-textarea').focus();
    });

    // Tiempo por misión (estimación del proyecto)
    $('#mission-time-input').addEventListener('input', (e) => {
        const project = getSelectedProject();
        if (!project) return;
        const minutes = parseFloat(e.target.value);
        project.tiempoMision = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : 0;
        saveState();
        renderProjectList();
        renderPlan(project, pendingStats(project));
    });

    // Piezas (delegación de eventos en toda la sección: pendientes y obtenidas)
    $('#parts-section').addEventListener('click', (e) => {
        const remove = e.target.closest('[data-remove]');
        if (remove) {
            removePiece(remove.dataset.remove);
            return;
        }
        const btn = e.target.closest('[data-part]');
        if (btn) toggleObtained(btn.dataset.part);
    });

    // Modal de proyecto
    $('#project-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const nombre = $('#project-name-input').value.trim();
        if (!nombre) return;
        createProject({ nombre, actividad: $('#project-activity-input').value });
        closeModals();
        render();
        showToast(t('toast.projectCreated'), 'success');
    });
    $('#btn-cancel-modal').addEventListener('click', closeModals);

    // Modal de borrado
    $('#btn-cancel-delete').addEventListener('click', closeModals);
    $('#btn-confirm-delete').addEventListener('click', () => {
        const project = getSelectedProject();
        if (project) {
            deleteProject(project.id);
            closeModals();
            render();
            showToast(t('toast.projectDeleted'), 'success');
        }
    });

    // Cerrar modales con overlay o Escape
    $('#modal-overlay').addEventListener('click', closeModals);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModals();
    });
}

// Arranque (se guarda el texto para poder reutilizarlo en tests de Node).
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseWikiText, mergePieces, buildProgressText, extractRotation };
}
