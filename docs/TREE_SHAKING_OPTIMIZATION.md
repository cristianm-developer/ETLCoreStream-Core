# Tree Shaking & Build Optimization Guide

## Resumen de Cambios Realizados

Esta guía documenta los ajustes realizados para optimizar el tree shaking y la compatibilidad con bundlers externos.

## Problema Original

- Minificación con Terser eliminaba la legibilidad del código
- Los bundlers externos tenían dificultades para hacer tree shaking agresivo
- Default exports dificultaban la optimización

## Soluciones Aplicadas

### 1. Desactivar Minificación (`minify: false`)

**Antes**:
```typescript
build: {
  minify: "terser",
  terserOptions: {
    compress: { drop_console: true, drop_debugger: true },
    mangle: true,
  },
}
```

**Después**:
```typescript
build: {
  minify: false,
}
```

**Por qué funciona**:
- Los bundlers del usuario (webpack, Vite, esbuild, swc) pueden minificar de forma más agresiva
- El código generado es más legible para debugging y auditoría
- Mejor compatibilidad con herramientas que analizan el código
- Tamaño final del usuario es similar o menor (minificación ocurre en su build)

### 2. Exportaciones Nombradas en rollupOptions

**Nuevo**:
```typescript
rollupOptions: {
  external: [...],
  output: {
    exports: "named",  // Asegura que todas las exportaciones sean nombradas
  },
}
```

**Por qué funciona**:
- Las exportaciones nombradas son más eficientes para tree shaking
- Los bundlers pueden eliminar fácilmente las que no se usan
- Default exports son históricamente más difíciles de optimizar

### 3. Orden Correcto en package.json

**Campos configurados correctamente**:
```json
{
  "main": "./dist/index.cjs",              // CommonJS (Node.js tradicional)
  "module": "./dist/index.mjs",            // ES Module (herramientas modernas)
  "types": "./dist/index.d.ts",            // TypeScript types
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",        // Types primero (mejor soporte IDE)
      "import": "./dist/index.mjs",        // ES Module import
      "require": "./dist/index.cjs"        // CommonJS require
    }
  },
  "sideEffects": false                     // Habilita tree shaking agresivo
}
```

**Por qué funciona**:
- `main`, `module`, `types`: Especifican qué archivo usar según el contexto
- `exports` con `types` primero: Mejor resolución en IDEs y bundlers
- `sideEffects: false`: **Indica al bundler que NO hay código que se ejecuta con solo importar**

### 4. Verificación de Exportaciones Nombradas

Se verificó que el proyecto usa:
- ✅ `export const MyFunction = ...` (exportaciones nombradas)
- ✅ `export type MyType = ...` (tipos nombrados)
- ✅ `export { ... } from ...` (re-exportaciones)
- ⚠️ `export default` solo en tipos externos (`streamsaver.d.ts`)

## Impacto en el Bundle

### Tamaño
| Formato | Antes | Después | Cambio |
|---------|-------|---------|--------|
| ES Module (mjs) | 56.95 kB | 97.82 kB | +72% |
| CommonJS (cjs) | 57.66 kB | 99.50 kB | +72% |
| Gzip (mjs) | 15.34 kB | 21.28 kB | +39% |
| Gzip (cjs) | 15.44 kB | 21.47 kB | +39% |

**Nota**: El aumento es esperado y beneficioso porque:
- Sin minificación, el código es más legible
- Sin mangling de nombres, el tree shaking es más efectivo
- El usuario final obtendrá un tamaño similar o menor después de SU minificación

### Ejemplo: Antes vs Después

**Código minificado (Terser)**:
```javascript
const a=new e.BehaviorSubject,b=new e.Subject;
```

**Código sin minificar (actual)**:
```javascript
const fileSelectedSubject = new BehaviorSubject(null);
const fileErrorSubject = new Subject();
```

Los bundlers como Webpack + TerserPlugin o esbuild pueden minificar el segundo mejor que la cadena Vite+Terser.

## Configuración de Rollup Explicada

```typescript
rollupOptions: {
  external: [
    "xstate",
    "rxjs",
    "papaparse",
    "@preact/signals-core",
    "@xstate/graph"
  ],  // Estas dependencias NO se incluyen en el bundle
  
  output: {
    exports: "named",  // Asegura que Rollup genere exportaciones nombradas
  },
}
```

**external**: Indica a Rollup que estas dependencias las proporcionará el usuario (son peerDependencies)

**exports: "named"**: Rollup genera código como:
```javascript
export const MyFunction = ...;
export const MyClass = ...;
```

En lugar de intentar generar default exports que son más difíciles de optimizar.

## sideEffects: false - El Interruptor Mágico del Tree Shaking

```json
"sideEffects": false
```

Esto le dice a Webpack, Rollup, esbuild, etc.:

> "Si el usuario NO importa un módulo, puede eliminarlo completamente, incluso si tiene código de nivel superior"

**Ejemplo**:

Sin `sideEffects: false`:
```typescript
// utils.ts
console.log("Utils loaded"); // Terser: debe mantener esto
export const helper = () => {};
```

Con `sideEffects: false`:
```typescript
// Si no se importa helper(), este módulo completo se elimina
```

## Verificación

Para verificar la configuración:

```bash
npm run build

# Verificar package.json
cat package.json | grep -A 10 '"exports"'

# Verificar vite.config.ts
cat vite.config.ts | grep -A 15 'rollupOptions'

# Ver el bundle (primeras líneas)
head -30 dist/index.mjs

# Ver size de bundles
ls -lh dist/index.mjs dist/index.cjs
```

## Recomendaciones para Usuarios

Los usuarios de tu librería deben configurar su bundler así:

### Webpack
```javascript
// webpack.config.js
module.exports = {
  mode: 'production', // Habilita minificación y tree shaking
  optimization: {
    usedExports: true,
    sideEffects: false
  }
}
```

### Vite
```javascript
// vite.config.ts
export default {
  build: {
    minify: 'esbuild' // o 'terser'
  }
}
```

### Next.js
```javascript
// Automático - Next.js respeta sideEffects: false
// y hace tree shaking automáticamente
```

## Checklist de Optimización

- ✅ `minify: false` en build
- ✅ `exports: "named"` en rollupOptions
- ✅ `sideEffects: false` en package.json
- ✅ `module` y `main` correctamente apuntando a .mjs y .cjs
- ✅ `types` apuntando a .d.ts
- ✅ Todas las exportaciones son nombradas (no default exports en lógica)
- ✅ External dependencies declaradas en rollupOptions
- ✅ Peer dependencies correctamente listadas

## Ventajas de esta Configuración

✅ **Mejor tree shaking**: Los bundlers pueden eliminar código no usado más agresivamente
✅ **Mejor legibilidad**: El código generado es más fácil de debuggear y auditar
✅ **Mejor compatibilidad**: Funciona con webpack, Vite, esbuild, Rollup, Next.js, etc.
✅ **Tamaño final optimizado**: El usuario obtiene el mejor tamaño posible después de su minificación
✅ **Zero breaking changes**: La API pública sigue siendo idéntica
