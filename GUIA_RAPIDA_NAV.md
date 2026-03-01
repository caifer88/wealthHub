# Guía Rápida - Nuevo Motor NAV con Participaciones

## 🚀 Inicio Rápido

### ¿Qué Cambió?

**Antes**: NAV = Precio del activo (incorrecto si tienes múltiples participaciones)  
**Ahora**: NAV = Participaciones × Valor Liquidativo (correcto)

### Ejemplo

**Si tienen 100 participaciones de un fondo a €25 cada una:**
- Antes: NAV = €25 ❌ (solo el precio)
- Ahora: NAV = 100 × €25 = €2,500 ✅ (valor total)

---

## 📋 Pasos de Configuración

### 1️⃣ Ver Tus Activos Actuales

Los siguientes activos ya están configurados con tus datos:

| Activo | Participaciones | Coste Medio |
|--------|-----------------|------------|
| **Basalto** | 3,786.90437 | €10.02 |
| **Vanguard S&P 500** | 181.47 | €66.25 |
| **Numantia** | 603.156901 | €25.97 |
| **Numantia Pensiones** | 2,056.8217 | €12.99 |

### 2️⃣ Obtener Precios Actuales

1. Ve a la pestaña **"Gestión de Activos"**
2. Haz clic en **"📊 Obtener Precios Mensuales"**
3. Selecciona Año y Mes
4. El sistema automáticamente:
   - Obtiene el valor liquidativo actual de cada fondo
   - Multiplica por participaciones
   - Actualiza el NAV

**Resultado:**
```
Basalto (ES0164691083)
    Participaciones: 3,786.90437
    Liquidativo: €10.50
    NAV: €39,761.49
    Cambio: €37,931.26 → €39,761.49
```

### 3️⃣ Agregar Nuevo Activo

1. Haz clic en **"+ Nuevo Activo"**
2. Completa el formulario:
   - **Nombre**: "Mi Fondo XYZ"
   - **Categoría**: "Fund", "Stock", etc.
   - **Color**: Elige uno
   - **Nivel de Riesgo**: Bajo, Medio, Alto
   - **Participaciones**: 250.5 (número exacto)
   - **Coste Medio**: 30.00 (€/participación)
   - **ISIN/Ticker**: Para búsqueda automática de precios (opcional)
3. Haz clic en **"Crear"**

### 4️⃣ Editar Participaciones

Si compras más participaciones:

1. Haz clic en el icono ✏️ al lado del activo
2. Actualiza **"Número de Participaciones"**
3. Actualiza **"Coste Medio"** si cambió
4. Haz clic en **"Actualizar"**

La próxima vez que obtengas precios, el NAV se calculará con el nuevo número.

---

## 📊 Visualización de Datos

### En la Tabla de Activos

```
┌─────────────────────┬──────────────┬─────────────┐
│ Nombre              │ Valor (NAV)  │ % de Cartera│
├─────────────────────┼──────────────┼─────────────┤
│ Basalto             │ €37,931.26   │ 41.0%       │
│ Vanguard S&P 500    │ €12,022.38   │ 13.0%       │
│ Numantia            │ €15,647.22   │ 16.9%       │
│ Numantia Pensiones  │ €26,718.44   │ 28.9%       │
├─────────────────────┼──────────────┼─────────────┤
│ TOTAL               │ €92,319.30   │ 100%        │
└─────────────────────┴──────────────┴─────────────┘
```

### En el Dashboard

- **NAV Total**: Suma de todos los NAVs
- **Ganancia/Pérdida**: Cambios en el valor
- **ROI**: Rentabilidad sobre inversión

---

## 🔄 Cálculos Automáticos

### Cuando Obtienes Precios

El sistema calcula automáticamente:

```
NAV Actualizado = Participaciones × Nuevo Liquidativo

Ejemplo:
- Participaciones: 100
- Antiguo Liquidativo: €25.00
- Antiguo NAV: 100 × €25.00 = €2,500

- Nuevo Liquidativo: €26.50 (mercado)
- Nuevo NAV: 100 × €26.50 = €2,650
- Ganancia: €150
```

### En el Histórico

Se guardan 4 valores clave:

| Campo | Significado |
|-------|------------|
| **liquidNavValue** | Precio unitario del mercado |
| **participations** | Tus participaciones |
| **nav** | Valor total (participations × liquidNavValue) |
| **contribution** | Inversión inicial/aportación |

---

## 💡 Ejemplos Prácticos

### Ejemplo 1: Bitcoin

```
Tienes: 0.5 BTC
Precio Actual: €42,000/BTC
NAV = 0.5 × 42,000 = €21,000

Al día siguiente:
Precio: €43,500/BTC
NAV = 0.5 × 43,500 = €21,750
Ganancia: €750
```

### Ejemplo 2: Fondo de Inversión

```
Tienes: 500 participaciones
Precio (Liquidativo): €30.00
NAV = 500 × 30.00 = €15,000

Compras 100 más (Total: 600)
Precio: €30.50
NAV = 600 × 30.50 = €18,300
```

### Ejemplo 3: Acciones

```
Tienes: 15 acciones
Precio: €120.00
NAV = 15 × 120.00 = €1,800

Compras 10 más (Total: 25)
Precio: €125.00
NAV = 25 × 125.00 = €3,125
```

---

## ⚙️ Campos del Formulario Explicados

### Al Crear/Editar Activo

| Campo | Obligatorio | Ejemplo | Notas |
|-------|------------|---------|-------|
| Nombre | ✅ | "Basalto" | Nombre descriptivo |
| Categoría | ✅ | "Fund" | Tipo de activo |
| Color | - | Azul | Visualización |
| Valor Base | ✅ | 37931.26 | NAV del último mes |
| Nivel Riesgo | - | Medio | Para análisis |
| **Participaciones** | ✅ | 3786.90437 | Número exacto (decimales ok) |
| **Coste Medio** | ✅ | 10.02 | Euro por participación |
| ISIN (fondos) | - | ES0164691083 | Para búsqueda automática |
| Ticker (acciones) | - | AAPL | Para búsqueda automática |

---

## 🔍 Verificar Tus Datos

### Validar que NAV es Correcto

```
Formula: NAV = Participaciones × Precio Unitario

Basalto:
✓ 3,786.90437 × €10.02 = €37,931.26

Vanguard:
✓ 181.47 × €66.25 = €12,022.38

Numantia:
✓ 603.156901 × €25.97 = €15,647.22

Numantia PP:
✓ 2,056.8217 × €12.99 = €26,718.44
```

### Si los Números No Coinciden

1. Ve a **"Gestión de Activos"**
2. Haz clic en ✏️ para editar
3. Verifica:
   - ✓ Participaciones correctas
   - ✓ Coste Medio correcto
   - ✓ Activo no archivado
4. Haz clic en **"Actualizar"**
5. Obtén precios nuevamente

---

## 📌 Cosas Importantes

### ✅ Participaciones

- Pueden tener decimales: `3,786.90437` es válido
- Se conservan en el histórico
- Se usan para calcular NAV correcto

### ✅ Coste Medio

- Es solo informativo
- No afecta el cálculo del NAV
- Útil para seguimiento de rentabilidad

### ✅ Liquidativo

- Es el precio unitario del mercado
- Se obtiene automáticamente de precio-fetcher
- Se usa para calcular NAV actualizado

### ❌ Errores Comunes

**Error 1**: Confundir NAV total con precio unitario  
Solución: NAV = participaciones × precio

**Error 2**: No actualizar participaciones después de comprar más  
Solución: Edita el activo y actualiza el número

**Error 3**: Usar precio antiguo en lugar de precio actual  
Solución: Usa "Obtener Precios Mensuales" para actualizar

---

## 📞 Resumen de Acciones

| Acción | Pasos | Resultado |
|--------|-------|-----------|
| **Ver Activos** | Assets tab | Tabla con NAV actual |
| **Agregar Activo** | "+ Nuevo Activo" → Rellena → "Crear" | Activo creado |
| **Editar Participaciones** | "✏️" → Actualiza número → "Actualizar" | Número guardado |
| **Obtener Precios** | "Obtener Precios" → Selecciona mes → Espera | NAVs actualizados |
| **Ver Histórico** | "Historial" → Selecciona año/mes | Registro histórico |
| **Ver Rentabilidad** | "Dashboard" → Ver métricas | ROI y ganancias |

---

**Para preguntas o problemas, revisa [MODELO_DATOS_NAV.md](./MODELO_DATOS_NAV.md)**

**Última actualización**: 1 Marzo 2026
