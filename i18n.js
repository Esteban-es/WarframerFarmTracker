/* =========================================================
   Warframe Farm Tracker - i18n.js
   Traducciones ES/EN + interruptor de idioma. Sin dependencias.

   Expone globalmente el objeto I18N (y module.exports en Node).

   Uso en HTML:
     data-i18n="clave"                       -> textContent
     data-i18n-html="clave"                  -> innerHTML (texto de la clave)
     data-i18n-attr="aria-label:clave;title:clave2" -> atributos

   Uso en JS:
     I18N.t('clave', { n: 3 })               -> 'clave' con {n} sustituido
     I18N.getLang() / I18N.setLang('en') / I18N.toggleLang()
     I18N.onChange(fn)                       -> al cambiar de idioma
   ========================================================= */

(function (global) {
    'use strict';

    const LANG_STORAGE_KEY = 'warframeFarmTracker.lang';

    const STRINGS = {
        es: {
            /* Sidebar / navegación */
            'nav.newProject': '+ Nuevo Proyecto',
            'nav.langGroup': 'Idioma',

            /* Bienvenida */
            'welcome.title': 'Bienvenido, Tenno',
            'welcome.text': 'Crea un nuevo proyecto o selecciona uno existente para comenzar a trackear tus farmeos.',
            'welcome.cta': 'Crear mi primer proyecto',
            'sidebar.empty': 'Aún no hay proyectos',

            /* Cabecera del proyecto */
            'project.back': 'Volver a proyectos',
            'project.copyProgress': 'Copiar Progreso',
            'project.delete': 'Eliminar',

            /* Contador de rotaciones */
            'counter.rotationsDone': 'Rotaciones realizadas',
            'counter.fullLap': 'Vuelta completa',
            'counter.fullLapHint': 'Afecta a A, B y C',
            'counter.subtractLap': 'Restar una vuelta',
            'counter.addLap': 'Sumar una vuelta',
            'counter.rotMinus.A': 'Restar rotación A',
            'counter.rotPlus.A': 'Sumar rotación A',
            'counter.rotMinus.B': 'Restar rotación B',
            'counter.rotPlus.B': 'Sumar rotación B',
            'counter.rotMinus.C': 'Restar rotación C',
            'counter.rotPlus.C': 'Sumar rotación C',

            /* Plan de farmeo */
            'plan.estimatedTime': 'Tiempo estimado',
            'plan.minutesPerMission': 'Minutos por misión',
            'plan.expected': 'Esperado',
            'plan.guaranteed': 'Garantizado',
            'plan.hint': 'Calculado con las rotaciones que faltan por completar.',
            'plan.pendingLocations': 'Ubicaciones pendientes',
            'plan.pendingRotations': '{n} rotaciones pendientes',
            'plan.completed': '✓ Completado',
            'plan.nothingPending': '✓ No queda nada pendiente',
            'location.none': 'Sin ubicación',

            /* Importación */
            'import.title': 'Importar piezas desde Wiki',
            'import.hint': 'Pega el contenido copiado de la wiki de Warframe (tablas de drop)',
            'import.detected': 'Piezas detectadas:',
            'import.confirm': 'Confirmar Importación',

            /* Piezas */
            'parts.title': 'Piezas',
            'parts.obtainedOf': 'Obtenidas:',
            'parts.edit': 'Modificar piezas',
            'parts.hideImport': 'Ocultar importación',
            'parts.pending': 'Pendientes',
            'parts.obtained': 'Obtenidas',
            'parts.empty': 'No hay piezas aún. Pega la tabla de la wiki en el importador.',
            'parts.count': '{done}/{total} piezas',

            /* Estados */
            'status.complete': '✓ Completo',
            'progress.obtained': '✓ Obtenido',
            'progress.reached': 'Alcanzado',
            'progress.remaining': 'Faltan {n}',
            'progress.meta': '{done} / {goal} rotaciones · {pct}%',

            /* Tarjeta de pieza */
            'part.remove': 'Eliminar pieza',
            'part.removeNamed': 'Eliminar pieza {name}',
            'part.unmark': 'Desmarcar como obtenido',
            'part.expected': 'Esperado',
            'part.guaranteed': 'Garantizado',
            'part.drop': 'Prob.',
            'part.rotationProgress': 'Progreso de rotaciones',
            'part.markObtained': 'Obtenido',

            /* Modales */
            'modal.newProject': 'Nuevo Proyecto',
            'modal.projectName': 'Nombre del Proyecto *',
            'modal.namePlaceholder': 'Ej: Lato Vandal, Khora, Sporothrix',
            'modal.activity': 'Actividad (opcional)',
            'modal.activityPlaceholder': 'Ej: Elite Sanctuary Onslaught, Arbitrations',
            'modal.deleteProject': 'Eliminar Proyecto',
            'modal.deleteConfirm': '¿Estás seguro de que quieres eliminar <strong id="delete-project-name"></strong>? Esta acción no se puede deshacer.',
            'common.cancel': 'Cancelar',
            'common.save': 'Guardar',
            'common.delete': 'Eliminar',

            /* Toasts */
            'toast.pieceRemoved': 'Pieza "{name}" eliminada.',
            'toast.noPieces': 'No se detectaron piezas en el texto.',
            'toast.importedOne': '1 pieza importada.',
            'toast.importedMany': '{n} piezas importadas.',
            'toast.copied': 'Progreso copiado al portapapeles.',
            'toast.copyFailed': 'No se pudo copiar el progreso.',
            'toast.projectCreated': 'Proyecto creado.',
            'toast.projectDeleted': 'Proyecto eliminado.',

            /* Copiar progreso (portapapeles) */
            'copy.rotations': 'Rotaciones: {n}',
            'copy.obtained': 'Obtenidas:'
        },

        en: {
            /* Sidebar / navigation */
            'nav.newProject': '+ New Project',
            'nav.langGroup': 'Language',

            /* Welcome */
            'welcome.title': 'Welcome, Tenno',
            'welcome.text': 'Create a new project or select an existing one to start tracking your farms.',
            'welcome.cta': 'Create my first project',
            'sidebar.empty': 'No projects yet',

            /* Project header */
            'project.back': 'Back to projects',
            'project.copyProgress': 'Copy Progress',
            'project.delete': 'Delete',

            /* Rotation counter */
            'counter.rotationsDone': 'Rotations completed',
            'counter.fullLap': 'Full lap',
            'counter.fullLapHint': 'Affects A, B and C',
            'counter.subtractLap': 'Subtract one lap',
            'counter.addLap': 'Add one lap',
            'counter.rotMinus.A': 'Subtract rotation A',
            'counter.rotPlus.A': 'Add rotation A',
            'counter.rotMinus.B': 'Subtract rotation B',
            'counter.rotPlus.B': 'Add rotation B',
            'counter.rotMinus.C': 'Subtract rotation C',
            'counter.rotPlus.C': 'Add rotation C',

            /* Farm plan */
            'plan.estimatedTime': 'Estimated time',
            'plan.minutesPerMission': 'Minutes per mission',
            'plan.expected': 'Expected',
            'plan.guaranteed': 'Guaranteed',
            'plan.hint': 'Calculated with the rotations still pending.',
            'plan.pendingLocations': 'Pending locations',
            'plan.pendingRotations': '{n} rotations pending',
            'plan.completed': '✓ Completed',
            'plan.nothingPending': '✓ Nothing left pending',
            'location.none': 'No location',

            /* Import */
            'import.title': 'Import parts from Wiki',
            'import.hint': 'Paste the content copied from the Warframe wiki (drop tables)',
            'import.detected': 'Parts detected:',
            'import.confirm': 'Confirm Import',

            /* Parts */
            'parts.title': 'Parts',
            'parts.obtainedOf': 'Obtained:',
            'parts.edit': 'Edit parts',
            'parts.hideImport': 'Hide import',
            'parts.pending': 'Pending',
            'parts.obtained': 'Obtained',
            'parts.empty': 'No parts yet. Paste the wiki table into the importer.',
            'parts.count': '{done}/{total} parts',

            /* Status */
            'status.complete': '✓ Complete',
            'progress.obtained': '✓ Obtained',
            'progress.reached': 'Reached',
            'progress.remaining': '{n} remaining',
            'progress.meta': '{done} / {goal} rotations · {pct}%',

            /* Part card */
            'part.remove': 'Remove part',
            'part.removeNamed': 'Remove part {name}',
            'part.unmark': 'Unmark as obtained',
            'part.expected': 'Expected',
            'part.guaranteed': 'Guaranteed',
            'part.drop': 'Drop',
            'part.rotationProgress': 'Rotation progress',
            'part.markObtained': 'Obtained',

            /* Modals */
            'modal.newProject': 'New Project',
            'modal.projectName': 'Project Name *',
            'modal.namePlaceholder': 'e.g. Lato Vandal, Khora, Sporothrix',
            'modal.activity': 'Activity (optional)',
            'modal.activityPlaceholder': 'e.g. Elite Sanctuary Onslaught, Arbitrations',
            'modal.deleteProject': 'Delete Project',
            'modal.deleteConfirm': 'Are you sure you want to delete <strong id="delete-project-name"></strong>? This action cannot be undone.',
            'common.cancel': 'Cancel',
            'common.save': 'Save',
            'common.delete': 'Delete',

            /* Toasts */
            'toast.pieceRemoved': 'Part "{name}" removed.',
            'toast.noPieces': 'No parts detected in the text.',
            'toast.importedOne': '1 part imported.',
            'toast.importedMany': '{n} parts imported.',
            'toast.copied': 'Progress copied to clipboard.',
            'toast.copyFailed': 'Could not copy the progress.',
            'toast.projectCreated': 'Project created.',
            'toast.projectDeleted': 'Project deleted.',

            /* Copy progress (clipboard) */
            'copy.rotations': 'Rotations: {n}',
            'copy.obtained': 'Obtained:'
        }
    };

    /** Idioma actual: 'es' | 'en'. */
    let currentLang = (function detectLang() {
        try {
            const saved = localStorage.getItem(LANG_STORAGE_KEY);
            if (saved && STRINGS[saved]) return saved;
        } catch (err) {
            /* localStorage no disponible (Node / modo privado). */
        }
        // En navegador se sigue el idioma del sistema; fuera de él, español.
        if (typeof window === 'undefined') return 'es';
        const browser = (typeof navigator !== 'undefined' && navigator.language) || 'es';
        return browser.toLowerCase().startsWith('es') ? 'es' : 'en';
    })();

    /** Suscriptores al cambio de idioma. */
    const langListeners = new Set();

    /** Traduce una clave interpolando parámetros: t('clave', { n: 3 }). */
    function t(key, params) {
        const dict = STRINGS[currentLang] || STRINGS.es;
        let text = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
        if (params) {
            for (const name of Object.keys(params)) {
                text = text.split('{' + name + '}').join(String(params[name]));
            }
        }
        return text;
    }

    function getLang() {
        return currentLang;
    }

    /** Aplica las traducciones al DOM estático (data-i18n / data-i18n-attr / data-i18n-html). */
    function apply() {
        if (typeof document === 'undefined') return;

        document.documentElement.lang = currentLang;

        for (const el of document.querySelectorAll('[data-i18n]')) {
            el.textContent = t(el.getAttribute('data-i18n'));
        }

        for (const el of document.querySelectorAll('[data-i18n-html]')) {
            el.innerHTML = t(el.getAttribute('data-i18n-html'));
        }

        for (const el of document.querySelectorAll('[data-i18n-attr]')) {
            for (const pair of el.getAttribute('data-i18n-attr').split(';')) {
                const idx = pair.indexOf(':');
                if (idx === -1) continue;
                const attr = pair.slice(0, idx).trim();
                const key = pair.slice(idx + 1).trim();
                if (attr && key) el.setAttribute(attr, t(key));
            }
        }

        for (const btn of document.querySelectorAll('.lang-btn[data-lang]')) {
            const active = btn.getAttribute('data-lang') === currentLang;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', String(active));
        }
    }

    /** Cambia el idioma, lo persiste y notifica. */
    function setLang(lang) {
        if (!STRINGS[lang] || lang === currentLang) return;
        currentLang = lang;
        try {
            localStorage.setItem(LANG_STORAGE_KEY, lang);
        } catch (err) {
            /* Ignorado: el cambio sigue vigente en memoria. */
        }
        apply();
        for (const fn of langListeners) fn(lang);
    }

    function toggleLang() {
        setLang(currentLang === 'es' ? 'en' : 'es');
    }

    /** Registra un callback a ejecutar tras cada cambio de idioma. */
    function onChange(fn) {
        langListeners.add(fn);
    }

    const I18N = { t, getLang, setLang, toggleLang, onChange, apply };

    // Traduce el DOM estático al cargar (los scripts van al final del body).
    apply();

    global.I18N = I18N;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = I18N;
    }
})(typeof window !== 'undefined' ? window : globalThis);
