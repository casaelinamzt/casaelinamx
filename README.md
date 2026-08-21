# Casa Elina — Sistema de reparto

App para registrar ventas de bebidas, calcular automáticamente el
reparto (insumos / socio operativo / Casa Elina) y llevar el control
de bebidas vendidas. Los usuarios comunes solo capturan ventas; el
Administrador (con PIN) ve el desglose financiero.

Los datos se guardan en una base de datos compartida (Upstash Redis,
plan gratuito) para que todos los dispositivos vean la misma
información en tiempo real.

## Qué necesitas antes de empezar

- Una cuenta gratuita en **GitHub** (github.com)
- Una cuenta gratuita en **Netlify** (netlify.com) — puedes entrar con tu cuenta de GitHub, sin verificación por SMS
- Una cuenta gratuita en **Upstash** (upstash.com) — es la base de datos

## Paso 1: crear la base de datos (Upstash)

1. Entra a https://upstash.com y crea una cuenta gratis.
2. Crea una base de datos nueva de tipo **Redis** (botón "Create Database").
3. Cualquier región funciona; elige la más cercana a México.
4. Una vez creada, entra a la base de datos y busca la sección **REST API**.
5. Copia estos dos valores, los vas a necesitar en el Paso 3:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## Paso 2: subir el proyecto a GitHub

1. Entra a https://github.com y crea un repositorio nuevo (puede ser privado), por ejemplo `casa-elina-sistema`.
2. Sube todos los archivos de esta carpeta a ese repositorio. La forma más fácil sin usar la terminal:
   - En la página del repositorio nuevo, da clic en "uploading an existing file"
   - Arrastra todos los archivos y carpetas de este proyecto (incluyendo las carpetas `src` y `netlify`)
   - Da clic en "Commit changes"

## Paso 3: desplegar en Netlify

1. Entra a https://netlify.com y crea una cuenta (puedes entrar directo con tu cuenta de GitHub, sin pedir verificación por SMS).
2. Da clic en **"Add new site" → "Import an existing project"**.
3. Elige **GitHub** y autoriza el acceso, luego selecciona el repositorio `casa-elina-sistema`.
4. Netlify va a detectar automáticamente la configuración (gracias al archivo `netlify.toml` que ya está en el proyecto: comando de build `npm run build`, carpeta `dist`, funciones en `netlify/functions`). No necesitas cambiar nada ahí.
5. Antes de darle a "Deploy", busca la sección **"Environment variables"** (o entra a "Site configuration → Environment variables" después de crear el sitio) y agrega:
   - `UPSTASH_REDIS_REST_URL` → pega el valor que copiaste en el Paso 1
   - `UPSTASH_REDIS_REST_TOKEN` → pega el valor que copiaste en el Paso 1
6. Da clic en **"Deploy site"**. Espera 1-2 minutos.
7. Cuando termine, Netlify te da un link como `https://casa-elina-sistema.netlify.app` — ese es el link que compartes con tu equipo. Lo puedes personalizar después en "Site configuration → Change site name".

## Listo

Cualquier persona que entre al link, desde cualquier celular, tablet
o computadora, va a ver los mismos datos. El Administrador entra con
el PIN (por default `0000`, cámbialo en Configuración en cuanto
entres).

## Si algo cambia y quieres actualizar el sistema después

Cualquier cambio que subas a la carpeta del proyecto en GitHub se
publica solo en Netlify automáticamente (no hay que repetir el Paso 3).
Si en algún momento quieres que te ayude a hacerle ajustes al
sistema, pídemelo aquí y te dejo los archivos actualizados para volver
a subir.

## Si más adelante prefieres usar Vercel

El proyecto también puede desplegarse en Vercel con muy pocos
cambios (mover `netlify/functions/kv.js` a `api/kv.js` con el
formato de función de Vercel). Si retomas esa opción, dímelo y te
regreso esa versión.
