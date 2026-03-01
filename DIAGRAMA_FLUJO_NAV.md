# Diagrama de Flujo - Modelo NAV v2.0

## 📊 Visión General del Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                      WEALTHHUB - MODELO NAV 2.0                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. ACTIVOS (Assets)                                                 │
│  ├── ID, Nombre, Categoría                                          │
│  ├── Participations (Número de participaciones/acciones)            │
│  ├── MeanCost (Coste medio por participación)                       │
│  └── ISIN/Ticker (Para búsqueda automática de precios)             │
│                                                                       │
│  2. HISTÓRICO (History)                                             │
│  ├── Mes (YYYY-MM)                                                  │
│  ├── Participations (Heredado del activo)                           │
│  ├── LiquidNavValue (Precio unitario del mercado)                   │
│  ├── NAV (Cálculo: participations × liquidNavValue)                 │
│  └── Contribution (Inversión/aportación)                            │
│                                                                       │
│  3. CÁLCULO                                                          │
│  └── NAV = Participations × LiquidNavValue                          │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Datos - Día a Día

### Escenario 1: Agregar un Nuevo Activo

```
Usuario: "Quiero agregar Basalto"
             ↓
      Click "+ Nuevo Activo"
             ↓
    Completar Formulario:
    ├── Nombre: "Basalto"
    ├── Categoria: "Fund"
    ├── Participations: 3786.90437
    ├── MeanCost: 10.02
    ├── ISIN: "ES0164691083"
    └── Color: Azul
             ↓
     Click "Crear"
             ↓
   Guardar en Assets:
   {
     id: "asset-basalto",
     name: "Basalto",
     participations: 3786.90437,
     meanCost: 10.02,
     isin: "ES0164691083",
     baseAmount: 37931.26,  // = participations × meanCost
     ...
   }
             ↓
    Crear entrada en Histórico:
    {
      month: "2026-03",
      assetId: "asset-basalto",
      participations: 3786.90437,
      liquidNavValue: 10.02,
      nav: 37931.26,  // = 3786.90437 × 10.02
      meanCost: 10.02,
      ...
    }
             ↓
    ✅ Activo guardado y visible en tabla
```

---

### Escenario 2: Obtener Precios Mensuales

```
Usuario: Click "📊 Obtener Precios"
             ↓
Seleccionar: Mes = Marzo, Año = 2026
             ↓
Backend obtiene precios:
    Basalto:        €10.50 (nuevo liquidativo)
    Vanguard:       €70.00 (nuevo liquidativo)
    Numantia:       €28.00 (nuevo liquidativo)
    Numantia PP:    €13.50 (nuevo liquidativo)
             ↓
Frontend calcula NAV para cada activo:
    
    Basalto:
    NAV = 3786.90437 × €10.50 = €39,762.49
    Cambio: €37,931.26 → €39,762.49 (+€1,831.23)
    
    Vanguard:
    NAV = 181.47 × €70.00 = €12,702.90
    Cambio: €12,022.38 → €12,702.90 (+€680.52)
    
    ... (igual para otros)
             ↓
Actualizar Histórico con nuevas entradas:
    {
      month: "2026-03",
      assetId: "asset-basalto",
      participations: 3786.90437,      ← Del activo
      liquidNavValue: 10.50,            ← Del mercado
      nav: 39762.49,                    ← Calculado
      meanCost: 10.02,                  ← Del activo
      ...
    }
             ↓
Mostrar mensaje:
    
    ✅ Basalto (ES0164691083)
        Participaciones: 3,786.90437
        Liquidativo: €10.50
        NAV: €39,762.49
        Cambio: €37,931.26 → €39,762.49
        Fuente: 🔍 Web Scraper
             ↓
    ✅ Dashboard se actualiza con nuevas métricas
```

---

### Escenario 3: Comprar Más Participaciones

```
Usuario: Compra 100 participaciones de Basalto a €10.80
             ↓
Click "✏️ Editar Basalto"
             ↓
Actualizar Formulario:
    Participations: 3786.90437 → 3886.90437  ✏️
    MeanCost: 10.02 (sin cambios)
             ↓
Click "Actualizar"
             ↓
Asset actualizado:
    {
      participations: 3886.90437,  ← Actualizado
      meanCost: 10.02,              ← Sin cambios
      baseAmount: 40,123.43,        ← Recalculado
    }
             ↓
Próxima descarga de precios:
    (Cuando haga click "Obtener Precios")
             ↓
NAV se recalcula con nuevo número:
    NAV = 3886.90437 × Precio_Actual
    
    Si precio actual = €10.50:
    NAV = 3886.90437 × €10.50 = €40,812.49 ✅
```

---

## 📈 Estructura de Datos

### Asset Object

```javascript
{
  id: "asset-basalto",
  name: "Basalto",
  category: "Fund",
  color: "#6366f1",
  baseAmount: 37931.26,           // NAV actual
  archived: false,
  targetAllocation: 25,
  riskLevel: "Medio",
  isin: "ES0164691083",          // Para búsqueda automática
  ticker: null,
  
  // NUEVOS CAMPOS:
  participations: 3786.90437,    // ⭐ Número de participaciones
  meanCost: 10.02                // ⭐ Coste medio
}
```

### HistoryEntry Object

```javascript
{
  id: "hist-1",
  month: "2026-03",
  assetId: "asset-basalto",
  
  // NUEVOS CAMPOS:
  participations: 3786.90437,    // ⭐ Participaciones en marzo
  liquidNavValue: 10.02,         // ⭐ Precio del fondo en marzo
  
  nav: 37931.26,                 // ⭐ NAV = participations × liquidNavValue
  contribution: 37931.26,
  
  // NUEVO CAMPO:
  meanCost: 10.02                // ⭐ Coste medio en marzo
}
```

---

## 🔢 Cálculos Paso a Paso

### Cálculo de NAV Mensual

```
ENTRADA: 
- Participations = 3786.90437
- LiquidNavValue (precio del mercado) = €10.50

OPERACIÓN:
NAV = 3786.90437 × 10.50

CÁLCULO:
3786.90437 × 10.50 = 39,762.495885

SALIDA:
NAV = €39,762.50 (redondeado)

RESULTADO HISTÓRICO:
{
  month: "2026-03",
  participations: 3786.90437,
  liquidNavValue: 10.50,
  nav: 39762.50,
  meanCost: 10.02
}
```

### Cálculo de Ganancia

```
ENTRADA:
- NAV Anterior (febrero): €37,931.26
- NAV Actual (marzo): €39,762.50

OPERACIÓN:
Ganancia = NAV Actual - NAV Anterior

CÁLCULO:
39762.50 - 37931.26 = 1831.24

SALIDA:
Ganancia = €1,831.24
Porcentaje = (1831.24 / 37931.26) × 100 = 4.83%
```

---

## 🔀 Componentes Involucrados

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Dashboard                                                       │
│  ├── Visualiza NAV total                                        │
│  └── Muestra métricas (ROI, ganancia)                           │
│                                                                   │
│  Assets Page                                                    │
│  ├── Tabla de activos                                           │
│  ├── Formulario (+ Nuevo, Editar)                              │
│  ├── Botón "Obtener Precios"                                    │
│  └── Cálculo: nav = participations × liquidNavValue            │
│                                                                   │
│  History Page                                                   │
│  ├── Registro histórico mensual                                 │
│  ├── Edición de entradas                                        │
│  └── Visualización con nuevos campos                            │
│                                                                   │
│  WealthContext                                                  │
│  ├── Estado global (assets, history)                            │
│  ├── Persistencia (localStorage, GAS)                           │
│  └── Datos iniciales                                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                             ↕ API HTTP
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Models (Pydantic)                                              │
│  ├── Asset (con participations, meanCost)                       │
│  └── HistoryEntry (con participations, liquidNavValue, ...)     │
│                                                                   │
│  Services                                                       │
│  ├── PriceFetcher (obtiene precios del mercado)                │
│  ├── FundScraper (web scraping de fondos)                      │
│  └── Endpoints (GET assets, POST precios)                      │
│                                                                   │
│  Database                                                       │
│  └── Google Apps Script (persistencia)                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📱 Flujo de Pantalla

```
┌──────────────────┐
│   DASHBOARD      │
│  Total NAV       │
│  €92,319.30      │
└────────┬─────────┘
         │ Click "Gestión de Activos"
         ↓
┌──────────────────────────────┐
│    GESTIÓN DE ACTIVOS        │
├──────────────────────────────┤
│ [+ Nuevo Activo]             │
│ [📊 Obtener Precios]         │
│                              │
│ ┌──────────────────────────┐ │
│ │ Basalto      €37,931.26  │ │
│ │ [✏️] [🗑️] [📌]           │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Vanguard     €12,022.38  │ │
│ │ [✏️] [🗑️] [📌]           │ │
│ └──────────────────────────┘ │
│ ... más activos ...          │
└──────┬───────────────────────┘
       │ Click [✏️]
       ↓
┌──────────────────────┐
│  EDITAR ACTIVO       │
├──────────────────────┤
│ Nombre:    Basalto   │
│ Categ:     Fund      │
│ Particip:  3786.9    │ ← NUEVO
│ CosteMed:  10.02     │ ← NUEVO
│ ISIN:      ES016...  │
│                      │
│ [Cancelar] [Actualiz]│
└──────────────────────┘
```

---

## 🎯 Casos de Uso

### Caso 1: Monitoreo Mensual
```
1. Cada mes, click "Obtener Precios Mensuales"
2. Sistema descarga precios actuales
3. NAV se recalcula automáticamente
4. Dashboard muestra nuevas métricas
```

### Caso 2: Nueva Compra
```
1. Compras 200 participaciones de Basalto
2. Click [✏️] en Basalto
3. Cambias Participations: 3786.9 → 3986.9
4. Click "Actualizar"
5. Próxima descarga de precios usa nuevo número
```

### Caso 3: Cierre de Posición
```
1. Vendes todas las participaciones de un fondo
2. Click [✏️] en el fondo
3. Cambias Participations a 0
4. Click "Actualizar"
5. NAV será 0 × Precio = 0 (cerrada)
```

---

**Versión**: 2.0  
**Última actualización**: 1 Marzo 2026  
**Estado**: ✅ Implementado
