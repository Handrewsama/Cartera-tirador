/* =========================================================
   CHANGELOG — aquí poses les novetats de cada versió.
   La primera entrada és la versió actual.
   ========================================================= */

export const CHANGELOG = [
  {
    version: 'v6.3',
    date: '2026-09-25',
    title: { es: 'Novedades', ca: 'Novetats' },
    changes: {
      es: [
        'Nuevo logo del Club de Tir Esportiu de Barcelona',
        'Soporte multi-idioma (español / catalán)',
        'Bloqueo con PIN y Face ID / Touch ID',
        'Copia de seguridad automática semanal',
        'Compresión de imágenes configurable',
        'Pantalla de novedades en cada actualización'
      ],
      ca: [
        'Nou logo del Club de Tir Esportiu de Barcelona',
        'Suport multi-idioma (castellà / català)',
        'Bloqueig amb PIN i Face ID / Touch ID',
        'Còpia de seguretat automàtica setmanal',
        'Compressió d\'imatges configurable',
        'Pantalla de novetats a cada actualització'
      ]
    }
  },
  {
    version: 'v6.0',
    date: '2026-09-20',
    title: { es: 'Versión anterior', ca: 'Versió anterior' },
    changes: {
      es: [
        'Importación de calendarios desde PDF, Excel y CSV',
        'Filtros por tipo de tirada y arma',
        'Tipo de evento "Licencia F"'
      ],
      ca: [
        'Importació de calendaris des de PDF, Excel i CSV',
        'Filtres per tipus de tirada i arma',
        'Tipus d\'esdeveniment "Llicència F"'
      ]
    }
  }
];

export function getCurrentVersion() {
  return CHANGELOG[0];
}

export function getVersionByNumber(v) {
  return CHANGELOG.find(e => e.version === v);
}