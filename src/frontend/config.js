/*
 *
 *    Copyright IBM Corp. 2023
 *
 */

/**
 * Application Configuration
 */
export const config = {
    api: {
        // Base URL for API endpoints
        // El frontend Node (:3001) proxea /customers, /accounts, /ims/* hacia Java (Open Liberty :9080)
        // El proxy en server.js reenvía esas rutas a API_BASE_URL = http://zosConnect:9080
        // z/OS Connect a su vez usa el httpServiceProvider para llegar a bankofz-modernized/api/v1
        // Para desarrollo local directo (sin Docker): apunta directo al Java backend
        baseUrl: window.location.hostname === 'localhost'
            ? ''        // Rutas relativas → las intercepta el proxy Node en server.js
            : ''        // En Docker también usamos rutas relativas (proxy en Node)
    },
    defaults: {
        sortCode: '123456'
    }
};

// Made with Bob
