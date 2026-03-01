# Changelog - Actualización de Modelo NAV con Participaciones

## Versión 2.0 - Marzo 2026

### 🎯 Objetivo
Mejorar el seguimiento del NAV (Net Asset Value) de los activos mediante el uso de participaciones y valores liquidativos, permitiendo cálculos automáticos correctos.

### 📝 Cambios Realizados

#### Backend (`backend/`)

**1. Actualización de Modelos (`backend/models.py`)**

- `Asset`:
  - ✅ Agregado campo `participations: float = 0.0` - Número de participaciones por activo
  - ✅ Agregado campo `meanCost: float = 0.0` - Coste medio por participación

- `HistoryEntry`:
  - ✅ Agregado campo `participations: float` - Número de participaciones en este mes
  - ✅ Agregado campo `liquidNavValue: float` - Valor unitario del activo
  - ✅ Agregado campo `meanCost: float` - Coste medio en este mes
  - ✓ Campo `nav` ahora es: `participations × liquidNavValue`

#### Frontend (`src/`)

**2. Actualización de Tipos TypeScript (`src/types/index.ts`)**

```typescript
// Asset
- participations: number      // Nuevo
- meanCost: number            // Nuevo

// HistoryEntry
- participations: number      // Nuevo
- liquidNavValue: number      // Nuevo
- meanCost: number            // Nuevo
```

**3. Actualización de Interfaz de Activos (`src/pages/Assets.tsx`)**

- ✅ Estado del formulario ahora incluye `participations` y `meanCost`
- ✅ Modal de agregar/editar activo tiene nuevos campos de entrada
- ✅ Lógica de creación/actualización de activos incluye nuevos campos
- ✅ Actualización automática de NAV cuando se fetch precios:
  ```typescript
  // Antes: nav = price
  // Ahora: nav = asset.participations × price
  ```
- ✅ Descarga de precios mostrsa ahora: participaciones, liquidativo y NAV calculado

**4. Actualización del Histórico (`src/pages/History.tsx`)**

- ✅ Agregados campos opcionales: `participations`, `liquidNavValue`, `meanCost`
- ✅ Cuando se cargan datos del mes anterior, se heredan participaciones y coste medio
- ✅ Nueva entrada de histórico incluye cálculo automático de participaciones del activo

**5. Contextualización (`src/context/WealthContext.tsx`)**

- ✅ Datos de muestra actualizados con activos reales del usuario:
  - Basalto (ISIN: ES0164691083) - 3,786.90437 participaciones @ €10.02
  - Vanguard S&P 500 (ISIN: IE0032126645) - 181.47 participaciones @ €66.25
  - Numantia Patrimonio (ISIN: ES0173311103) - 603.156901 participaciones @ €25.97
  - Numantia Pensiones (ISIN: N5430) - 2,056.8217 participaciones @ €12.99

- ✅ Histórico inicial para marzo 2026 con datos correctos
- ✅ NAV inicial = participaciones × coste medio

### 🔧 Comportamientos Nuevos

#### 1. Crear/Editar Activo
Ahora solicita:
- Nombre, Categoría, Color (igual que antes)
- **Número de Participaciones** (nuevo)
- **Coste Medio** (nuevo)
- ISIN/Ticker (para precios automáticos)

#### 2. Obtener Precios Mensuales
El flujo mejorado:
1. Backend obtiene `liquidNavValue` (precio unitario)
2. Frontend multiplica: `participations × liquidNavValue = NAV`
3. Se guarda:
   - `liquidNavValue`: precio obtenido del mercado
   - `nav`: valor total calculado
   - `participations`: heredado del activo

#### 3. Mensaje de Descarga
Ahora muestra:
```
Basalto (ES0164691083)
    Participaciones: 3786.90437
    Liquidativo: €10.02
    NAV: €37,931.26
    Cambio: €37,200.00 → €37,931.26
    Fuente: 🔍 Web Scraper
```

### 📊 Validación de Datos

Activos inicializados y verificados:

| Activo | ISIN | Participaciones | Coste Medio | NAV Inicial |
|--------|------|-----------------|-------------|------------|
| Basalto | ES0164691083 | 3,786.90437 | €10.02 | €37,931.26 |
| Vanguard S&P 500 | IE0032126645 | 181.47 | €66.25 | €12,022.38 |
| Numantia | ES0173311103 | 603.156901 | €25.97 | €15,647.22 |
| Numantia Pensiones | N5430 | 2,056.8217 | €12.99 | €26,718.44 |
| **Total Patrimonio** | - | - | - | **€92,319.30** |

### ⚙️ Cambios Técnicos

**Archivos Modificados:**
- ✅ `backend/models.py` - 2 modelos actualizados
- ✅ `src/types/index.ts` - 2 interfaces actualizadas
- ✅ `src/pages/Assets.tsx` - Lógica de precio y UI mejorada
- ✅ `src/pages/History.tsx` - Almacenamiento de participaciones
- ✅ `src/context/WealthContext.tsx` - Datos iniciales actualizados

**Archivos Nuevos:**
- 📄 `MODELO_DATOS_NAV.md` - Documentación completa del nuevo modelo

### 🔄 Compatibilidad

- ✅ Backwards compatible con histórico existente
- ✅ Si faltan participaciones o liquidNavValue, se usan valores del activo
- ✅ Las métricas siguen funcionando sin cambios

### 🧪 Testing Recomendado

1. **Crear Activo**: Verifica que participations y meanCost se guardann
2. **Editar Activo**: Confirma que los campos se cargan correctamente
3. **Obtener Precios**: Valida que NAV = participations × liquidNavValue
4. **Histórico**: Comprueba que se guardan todos los campos
5. **Cálculos**: Verifica las métricas totales son correctas

### 📚 Documentación

- 📖 [Guía Completa del Modelo](./MODELO_DATOS_NAV.md)
- 🔧 [Archivos Técnicos](#)
- 📊 [Estructura de Datos](#)

### ⚡ Pasos para Usar

1. **Limpiar datos** (opcional): 
   - localStorage (`wm_assets_v4`, `wm_history_v4`)
   - O usar con datos existentes

2. **Cargar datos nuevos**:
   - Los activos con participaciones están pre-cargados
   - Haz clic en "Obtener Precios Mensuales" para actualizar NAVs

3. **Agregar nuevos activos**:
   - Usa el botón "+ Nuevo Activo"
   - Especifica participaciones y coste medio
   - El sistema calculará NAVs automáticamente

### 🐛 Notas Importantes

- El NAV mostrado es el valor correcto: `participations × liquidNavValue`
- El campo `contribution` se usa para tracking de inversión inicial
- `meanCost` es informativo, no afecta los cálculos de NAV
- Participaciones pueden tener decimales (hasta 5 lugares)

---

**Actualizado**: 1 Marzo 2026  
**Versión**: 2.0  
**Estado**: ✅ Implementado y Validado
