\# Cartera del Tirador — PWA modular



\## Estructura



```

cartera-tirador/

├── index.html

├── manifest.json

├── service-worker.js

├── README.md

├── css/

│   └── styles.css

├── js/

│   ├── app.js

│   ├── ui.js

│   ├── db.js

│   ├── files.js

│   ├── notifications.js

│   ├── calendar.js

│   ├── documents.js

│   ├── settings.js

│   ├── utils.js

│   └── ocr.js

└── icons/

&#x20;   ├── icon-180.png

&#x20;   ├── icon-192.png

&#x20;   └── icon-512.png

```



\## Publicar a GitHub Pages



1\. Puja \*\*tota la carpeta\*\* mantenint l'estructura.

2\. \*\*Settings → Pages → Deploy from a branch → / (root)\*\*.

3\. Obre la URL al Safari de l'iPhone.

4\. \*\*Compartir → Afegir a pantalla d'inici\*\*.



\## Funcionalitats



\- \*\*Documents\*\*: llicències, guies d'arma, targeta de soci… amb suport multi-imatge.

\- \*\*Calendari\*\*: tirades controlades / oficials / categoria / llicència F / avisos.

\- \*\*Importació OCR\*\*:

&#x20; - 📷 Foto del calendari imprès o captura del PDF

&#x20; - 📋 Enganxar text directament des del PDF o web del club

&#x20; - Previsualització abans de guardar

&#x20; - Detecció automàtica de tipus i arma

\- \*\*Filtres\*\*: per tipus de tirada i per arma (pistola, carabina, escopeta, aire).

\- \*\*Recordatoris\*\*: notificacions natives + export .ics per al calendari del telèfon.

\- \*\*Carpeta configurable\*\* (Chrome / Edge / Safari 16.4+): tria on es desen les imatges.

\- \*\*Backup JSON\*\*: exporta / importa tots els documents i esdeveniments.

\- \*\*Alerta de caducitat\*\*: 12 mesos sense tirada oficial → avís vermell.



\## Format dels calendaris suportats



\### 1. Calendari de llicència F / campionat

```

10 Enero 2026

SOLICITUD LICENCIA armas tipo "F"



17 Enero 2026

FASE CAMPEONATO CATALUÑA: P. Fuego Central y P. Deportiva

```



\### 2. Calendari anual de graella

```

11-ene  18-ene  25-ene  ...

C TENDIDO     S  S  S  S  CB

P STANDARD    S  S  S  S  CB

```



> ⚠️ El parser de graella és heurístic: si el text extret no conserva les columnes, els codis es distribueixen uniformement per les dates. Revisa sempre la previsualització.



\## Notes tècniques



\- IndexedDB versió 3 (stores: `documents`, `events`, `meta`).

\- Service Worker: `cartera-tirador-v4`.

\- Tesseract.js es carrega des de CDN la primera vegada que es fa servir l'OCR (\~10 MB) i queda a la caché del navegador.

\- Les notificacions requereixen la PWA instal·lada a la pantalla d'inici (iOS 16.4+).



\## Consells d'ús



\- Per al PDF del club, el mode \*\*📋 Enganxar text\*\* és més fiable que la foto.

\- Selecciona el text del PDF amb Safari, copia'l i enganxa'l a l'app.

\- Després d'importar, revisa la previsualització i desmarca el que no interessi.

