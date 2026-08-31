# Synap.Frontend

PWA de [Synap](https://github.com/SergioIzq/Synap-Workspace), el "segundo cerebro" personal de Sergio.

Las specs, el diseño técnico y las tareas de este proyecto viven en el repo [Synap-Workspace](https://github.com/SergioIzq/Synap-Workspace) (OpenSpec), no aquí — este repo es solo el código.

## Stack

- Angular 21, standalone components
- PWA (manifest + service worker) — instalable en iPhone vía "Añadir a pantalla de inicio" (Safari no soporta la Web Share Target API, así que la captura desde el share sheet de iOS se hace con un Atajo, no con este mecanismo — ver `design.md` del change `synap-mvp`)

## Estructura

Misma organización que [Kash-Frontend](https://github.com/SergioIzq/Kash-Frontend):

```
src/app/core/               → guards, interceptors (auth/error/loading), models, services/api/
src/app/features/<feature>/ → routes, pages, components, store/<feature>.store.ts (signal store propio de la feature)
```

## Desarrollo local

```bash
npm install
npm start
```

La API por defecto se espera en `http://localhost:8080` (ajustable según el entorno) — levántala desde [Synap-Backend](https://github.com/SergioIzq/Synap-Backend) o con el `docker-compose.yml` del [workspace](https://github.com/SergioIzq/Synap-Workspace).

## Build de producción

```bash
npm run build -- --configuration=production
```

Se sirve con nginx (ver `Dockerfile` y `nginx.conf` en este repo).
