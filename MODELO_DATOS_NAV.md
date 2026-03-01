# Modelo de Datos Mejorado - NAV con Participaciones

## Resumen de Cambios

El sistema ahora trackea el número de **participaciones** (o acciones) de cada activo junto con el **valor liquidativo** (precio por participación) para calcular correctamente el NAV total.

## Estructura de Datos

### Activo (Asset)

```typescript
interface Asset {
  id: string;
  name: string;
  category: string;
  color: string;
  baseAmount: number;        // NAV actual del activo
  archived: boolean;
  targetAllocation?: number;
  riskLevel?: string;
  isin?: string;             // Identificador ISIN para fondos
  ticker?: string;           // Ticker para acciones y crypto
  participations: number;    // 🆕 Número de participaciones/acciones
  meanCost: number;          // 🆕 Coste medio por participación
}
```

### Entrada de Histórico (HistoryEntry)

```typescript
interface HistoryEntry {
  id: string;
  month: string;             // Formato: YYYY-MM
  assetId: string;
  participations: number;    // 🆕 Número de participaciones en este mes
  liquidNavValue: number;    // 🆕 Valor liquidativo (precio por participación)
  nav: number;               // NAV total = participaciones × liquidNavValue
  contribution: number;      // Cantidad invertida
  meanCost: number;          // 🆕 Coste medio en este mes
}
```

## Cálculo del NAV

### Fórmula Correcta

```
NAV Total = Número de Participaciones × Valor Liquidativo
```

### Ejemplo

**Basalto (Fondo)**
- Participaciones: 3,786.90437
- Valor Liquidativo: €10.02
- NAV = 3,786.90437 × 10.02 = €37,931.26

**Vanguard S&P 500**
- Participaciones: 181.47
- Valor Liquidativo: €66.25
- NAV = 181.47 × 66.25 = €12,022.38

## Flujo de Datos

### 1. Crear/Editar Activo

Al crear un nuevo activo, especifica:
- **Nombre**: Nombre del activo (Ej: "Basalto")
- **Participaciones**: Cantidad de acciones/participaciones (Ej: 3,786.90437)
- **Coste Medio**: Coste medio por participación (Ej: €10.02)
- **ISIN/Ticker**: Identificador para obtener precios automáticos

### 2. Obtener Precios (Fetch Monthly)

Cuando hace clic en **"Obtener Precios Mensuales"**:

1. El backend obtiene el **valor liquidativo** (precio actual) de cada activo
2. El frontend multiplica: `participaciones × liquidNavValue = NAV`
3. Se crea un nuevo registro histórico con:
   - `liquidNavValue`: Precio unitario obtenido del mercado
   - `nav`: NAV calculado (participaciones × liquidNavValue)
   - `participations`: Se copia del activo actual

### 3. Historial Mensual

Cada mes se registra:
```json
{
  "month": "2026-03",
  "assetId": "asset-basalto",
  "participations": 3786.90437,
  "liquidNavValue": 10.02,
  "nav": 37931.26,
  "contribution": 37931.26,
  "meanCost": 10.02
}
```

## Bitcoin y Criptomonedas

El mismo algoritmo aplica a Bitcoin:

```
NAV de Bitcoin = Balance BTC × Precio actual del BTC en EUR
```

**Ejemplo**:
- Balance: 0.5 BTC
- Precio actual: €42,000/BTC
- NAV = 0.5 × 42,000 = €21,000

Para Bitcoin, `participations` = Balance en BTC

## Actualización Automática de NAV

### Caso 1: Cambio de Precio (Liquidativo)

Cuando el precio del liquidativo sube de €10.02 a €10.50:
```
Participaciones: 3,786.90437 (sin cambios)
Antiguo NAV: 3,786.90437 × 10.02 = €37,931.26
Nuevo NAV: 3,786.90437 × 10.50 = €39,762.49
Ganancia: €1,831.23
```

### Caso 2: Aumento de Posición

Cuando añades más participaciones:
1. Actualiza **Participaciones** en el formulario del activo
2. Actualiza **Coste Medio** si cambia
3. La próxima vez que obtienes precios, se calcula el NAV con el nuevo número de participaciones

## Datos Actuales Inicializados

El sistema viene pre-cargado con tus fondos:

### 1. **Basalto**
- ISIN: ES0164691083
- Participaciones: 3,786.90437
- Coste Medio: €10.02
- NAV Inicial: €37,931.26

### 2. **Vanguard U.S. 500 Stock Index Fund EUR Acc**
- ISIN: IE0032126645
- Participaciones: 181.47
- Coste Medio: €66.25
- NAV Inicial: €12,022.38

### 3. **Renta 4 Multigestión Numantia Patrimonio Global**
- ISIN: ES0173311103
- Participaciones: 603.156901
- Coste Medio: €25.97
- NAV Inicial: €15,647.22

### 4. **Numantia Pensiones PP**
- ISIN: N5430
- Participaciones: 2,056.8217
- Coste Medio: €12.99
- NAV Inicial: €26,718.44

---

## Cambios en el Código

### Backend (`models.py`)

```python
class HistoryEntry(BaseModel):
    id: str
    month: str
    assetId: str
    participations: float          # NUEVO
    liquidNavValue: float          # NUEVO
    nav: float                     # NAV = participations × liquidNavValue
    contribution: float
    meanCost: float                # NUEVO
```

### Frontend (`src/types/index.ts`)

```typescript
export interface Asset {
  // ... campos existentes ...
  participations: number;          // NUEVO
  meanCost: number;                // NUEVO
}

export interface HistoryEntry {
  // ... campos existentes ...
  participations: number;          // NUEVO
  liquidNavValue: number;          // NUEVO
  meanCost: number;                // NUEVO
}
```

### Lógica de Precios (`src/pages/Assets.tsx`)

Cuando se obtienen precios del backend:

```typescript
const newHistoryEntries = result.prices.map((price) => {
  const asset = assets.find(a => a.id === price.assetId)
  const participations = asset?.participations || 0
  const liquidNavValue = price.price
  const nav = participations * liquidNavValue  // ✨ Cálculo correcto
  
  return {
    id: generateUUID(),
    month: monthStr,
    assetId: price.assetId,
    participations: participations,
    liquidNavValue: liquidNavValue,
    nav: nav,
    contribution: nav,
    meanCost: asset?.meanCost || 0
  }
})
```

## Ventajas del Nuevo Modelo

✅ **NAV Correcto**: Refleja el valor real de la posición  
✅ **Automático**: Se actualiza con cada obtención de precios  
✅ **Histórico**: Mantiene registro de participaciones y precios por mes  
✅ **Flexible**: Soporta fondos, acciones, Bitcoin y activos diversos  
✅ **Transparente**: Separa precio unitario (liquidativo) del valor total

## Pasos Siguientes

1. **Revisar Datos**: Comprueba que tus participaciones y costes medios están correctos
2. **Obtener Precios**: Haz clic en "Obtener Precios Mensuales" para actualizar NAVs
3. **Seguimiento**: El histórico mostrará cómo evolucionan tus posiciones con los precios del mercado

---

**Versión**: 2.0 (Modelo de Participaciones)  
**Última Actualización**: Marzo 2026
