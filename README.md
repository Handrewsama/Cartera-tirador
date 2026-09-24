# Cartera del Tirador — PWA modular

## Estructura

```
cartera-tirador/
├── index.html
├── manifest.json
├── service-worker.js
├── css/styles.css
├── js/
│   ├── app.js
│   ├── ui.js
│   ├── db.js
│   ├── files.js
│   ├── notifications.js
│   ├── calendar.js
│   ├── documents.js
│   ├── settings.js
│   └── utils.js
└── icons/icon-180.png, icon-192.png, icon-512.png
```

## Publicar a GitHub Pages

1. Puja **tota la carpeta** mantenint l'estructura.
2. **Settings → Pages → Deploy from a branch → / (root)**.
3. Obre la URL al Safari de l'iPhone.
4. **Compartir → Afegir a pantalla d'inici**.

## Funcionalitats

- **Documents**: llicències, guies d'arma, etc. amb suport multi-imatge.
- **Calendari**: tirades controlades/oficials/categoria i avisos futurs.
- **Recordatoris**: notificacions natives + export .ics per al calendari del telèfon.
- **Carpeta configurable** (Chrome/Edge/Safari 16.4+): tria on es desen les imatges.
- **Backup JSON**: exporta/importa tots els documents i esdeveniments.
- **Alerta de caducitat**: 12 mesos sense tirada → avís vermell.

## Notes

- L'IndexedDB està a la versió 3 (stores: `documents`, `events`, `meta`).
- El Service Worker usa `cartera-tirador-v3`. Si ja tenies instal·lada la v1, es netejarà automàticament.
- Les notificacions requereixen que la PWA estigui instal·lada a la pantalla d'inici (iOS 16.4+).