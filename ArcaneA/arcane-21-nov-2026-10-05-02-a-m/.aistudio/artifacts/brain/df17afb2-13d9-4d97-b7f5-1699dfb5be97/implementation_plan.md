# Archivo Arcano — Grimorio de Hechizos No Aprendidos y Catálogo Adaptable

Creación de una nueva sección independiente en la barra superior (**Archivo Arcano**) que centraliza todos los hechizos no aprendidos y no aprendibles del personaje activo, mueve la tríada de **Foco Arcano** al estado de "no aprendidos" por defecto e incorpora **10 hechizos base adaptables** listos para moldearse automáticamente al elemento o naturaleza del mago al aprenderlos.

## Revisión del usuario y decisiones confirmadas

> [!IMPORTANT]
> Se actualizaron el balance de **Manto** (`2 maná`), el daño de **Juicio** (`1d4 mágico` + *Noquear*) y la tabla completa de **Maestría** para los 13 hechizos del catálogo. Confirmá el plan para pasar a la implementación.

- **Ubicación confirmada**: Nueva pestaña en la barra superior llamada **Archivo Arcano** (junto a *Grimorio*, *Combate*, *Personajes y PNJs* y *Fórmula y Copia*).
- **Flujo de aprendizaje confirmado**: Al aprender un hechizo adaptable del catálogo, el sistema lo **adapta automáticamente al elemento/naturaleza del personaje activo** (nombre, órdenes, elemento de armadura, nota de daño y estado elemental afín) antes de añadirlo a su grimorio.
- **Contenido visible confirmado**: Muestra el **catálogo base no aprendido** (los 3 de *Foco Arcano* + los 10 nuevos adaptables) junto con **todos los demás hechizos no aprendidos** del personaje activo (y los hechizos exclusivos de otros personajes marcados como no aprendibles/bloqueados para referencia).
- **Ajustes de balance y maestría incorporados**:
  - **Manto de [Elemento]** baja a **2 de maná** (3 turnos) para ser un habilitador ágil de cadena.
  - **Juicio de [Elemento]** pasa a infligir **`1d4` de daño mágico** además de intentar **Noquear** (1t por Influencia), y se configura **sin maestría** para equilibrar el alto impacto de *Noquear*.
  - Se definió explícitamente qué hechizos **admiten maestría** y cuáles quedan **sin maestría** (visible también en cada ficha del Archivo Arcano).

---

## 1. Visión general y concepto central

- **Qué resuelve**: Evita saturar el grimorio inicial de cada mago con hechizos avanzados que aún no conoce, brindando un espacio separado estilo "tienda / biblioteca de técnicas" donde explorar, filtrar y desbloquear nuevos hechizos conforme avanza la campaña.
- **Quién lo usa**: Jugadores que suben de nivel o descubren nuevas técnicas para su mago, y el Director de Juego para consultar hechizos no aprendidos, dependencias, reglas de maestría y plantillas adaptables a cualquier naturaleza.
- **Valor principal**: Permite que los 10 hechizos adaptables sirvan tanto para un piromante como para un mago de hielo, rayo, flora, luz, sombra o sonido sin tener que reescribirlos a mano desde cero.

---

## 2. Experiencia de usuario y diseño visual

### Flujos clave del usuario

1. **Acceso directo desde la barra superior**: El usuario hace clic en **Archivo Arcano** en la barra superior (navegación limpia en una sola línea).
2. **Exploración y filtrado**:
   - Selector de vista segmentado: **Todos** · **Adaptables (10)** · **Foco Arcano (3)** · **Otros no aprendidos** · **No aprendibles / Exclusivos**.
   - Filtro por categoría (*Daño*, *Defensa*, *Buff*, *Debuff*, *Curación*, *Con dependencia*, *En área*) y búsqueda en vivo por nombre, orden o estado.
   - Indicador del **personaje activo y su elemento/naturaleza** en la cabecera de la sección, con un selector opcional de afinidad para previsualizar en tiempo real cómo se adaptan los 10 hechizos (por defecto toma la naturaleza del personaje activo).
3. **Aprender y adaptar en un clic**:
   - En cada hechizo adaptable, el usuario ve el título previsualizado con su elemento (ej. *Égida de Fuego*, *Tormenta de Rayo*, *Prisión de Flora*), costo de maná, daño/efecto, dependencia (si tiene), **estado de maestría** (`Admite maestría` o `Sin maestría`) y órdenes resultantes.
   - Acción principal: **Aprender adaptado** → crea la versión adaptada en el grimorio del personaje activo (remapeando el nombre de la dependencia si aplica), lo marca como aprendido y registra un aviso discreto de confirmación. Si el hechizo depende de otro adaptable todavía no aprendido, se ofrece además **Aprender cadena** para desbloquear requisito + técnica juntos.
   - Acción secundaria opcional: **Personalizar en editor** → abre la versión preadaptada en el Editor de Grimorio por si el jugador o DJ quiere ajustar dados, maná o maestría antes de guardarlo.
   - En hechizos no adaptables (como los 3 de *Foco Arcano* o básicos sin aprender): botón directo **Aprender** que los agrega a `knownSpells` del personaje activo.
   - En hechizos exclusivos de otro personaje: se muestran en estado **No aprendible (Exclusivo de [Nombre])** sin botón de aprendizaje directo.

### Identidad visual y disciplina de interfaz

- **Coherencia con Arcane**: Reutiliza las variables del tema activo (`--arc-canvas`, `--arc-surface`, `--arc-input`, `--arc-border`, `--arc-text`, `--arc-muted`, `--arc-accent`, `--arc-action`) y la pareja tipográfica del sistema (`font-display` + cuerpo legible + `font-mono-num` tabular).
- **Superficies planas de una sola elevación**: Lista con divisores finos de `1px` sin tarjetas anidadas ni bordes izquierdos gruesos.
- **Metadatos limpios sin cápsulas estáticas**: Tipo de hechizo, maná, duración, daño, maestría y dependencia se muestran como texto estructurado separado por `·`, reservando estilos de botón solo para filtros interactivos y acciones.

---

## 3. Catálogo diseñado y reglas de Maestría (3 de Foco Arcano + 10 adaptables)

### Criterio de Maestría (coherente con las reglas actuales de Arcane)

- **Admite maestría (`noMastery: false`)**: Ataques mágicos y técnicas tácticas de control repetibles cuya potencia o precisión refleja la práctica del mago (progresión de dados de daño y/o bonos configurados en *Fórmula y Copia*).
- **Sin maestría (`noMastery: true`)**: Buffs puros de preparación y armaduras numéricas fijas (igual que *Protección*, *Reforzar Hechizo* y *Hechizo Veloz*), curaciones (igual que *Curar Heridas Leves*), y remates de control extremo (**Aturdir** / **Noquear**) cuyo impacto ya es decisivo sin escalar dados ni éxitos gratuitos.

### A. Hechizos de Foco Arcano (movidos a "No aprendidos" por defecto)

| # | Hechizo | Tipo / Costo | Maestría | Mecánica y dependencias |
| :- | :--- | :--- | :--- | :--- |
| 1 | **Foco Arcano** | Buff · 2 maná · 3t | **Sin maestría** | Buff puro de preparación que habilita hechizos dependientes. |
| 2 | **Descarga Focalizada** | Ataque · 2 maná · `2d6` | **Con maestría** | Requiere *Foco Arcano* activo y **lo mantiene encendido**. Escala dados de daño con práctica. |
| 3 | **Estallido Conmocionante** | Debuff mayor · 3 maná · Aturdir (1 golpe) | **Sin maestría** | Requiere *Foco Arcano* y **lo consume**. Control duro (*Aturdir*) sin escalado de maestría por equilibrio. |

### B. 10 Hechizos Base Adaptables a Elemento / Naturaleza

| # | Plantilla adaptable | Tipo / Costo | Maestría | Mecánica y dependencias |
| :- | :--- | :--- | :--- | :--- |
| 1 | **Égida de [Elemento]** | Buff · Armadura · 4 maná · 3t | **Sin maestría** | Armadura superior a la base: reduce **5 de daño** hasta **4 golpes** con elemento adaptado al mago. Valor fijo sin escalado. |
| 2 | **Ruptura de Égida** | Ataque en área · 3 maná · `2d6` | **Con maestría** | **Depende de `Égida de [Elemento]`** (**consume** la armadura). Onda en área con **Empujar** (y Derribar); su daño escala con maestría. |
| 3 | **Manto de [Elemento]** | Buff de combate · **2 maná** · 3t | **Sin maestría** | Buff ágil que envuelve al lanzador en su elemento durante 3 turnos. Habilitador base de *Lanza Perforante* y *Juicio*. |
| 4 | **Lanza Perforante de [Elemento]** | Ataque · 3 maná · `2d6 + 2` · +1 éxito | **Con maestría** | **Depende de `Manto de [Elemento]`** (**mantiene** el buff). Impacto de precisión con estado elemental afín; técnica principal que escala con maestría. |
| 5 | **Juicio de [Elemento]** | Ataque + Debuff mayor · 5 maná · **`1d4`** + Noquear (1t) | **Sin maestría** | **Depende de `Manto de [Elemento]`** (**consume** el buff). Inflige **`1d4` mágico** e intenta **Noquear** (1t por Influencia). Sin maestría para mantener balanceado *Noquear*. |
| 6 | **Prisión de [Elemento]** | Debuff control · 3 maná · Inmovilizar (2t) | **Con maestría** | Retiene al objetivo aplicando **Inmovilizar** por Influencia durante 2 turnos. Puede beneficiarse de especialización/maestría en control. |
| 7 | **Sentencia sobre Atrapado** | Ataque ejecutor · 3 maná · `3d6` | **Con maestría** | **Depende de estado `Inmovilizar` en el objetivo** (**consume** al usar). Remate concentrado de alto daño elemental que escala con maestría. |
| 8 | **Tormenta de [Elemento]** | Ataque en área · 5 maná · `2d6` | **Con maestría** | **Daño en área** libre (Radio 20 pies) sobre múltiples enemigos con afinidad elemental del lanzador; escala dados con maestría. |
| 9 | **Choque Desarmador de [Elemento]** | Debuff táctico · 2 maná · Desarmar + Ensordecer | **Con maestría** | Intenta **Desarmar** al rival (1 acción para recuperar) y aplicar **Ensordecer** (+1 fallo auto. en defensa). Técnica de duelo mejorable por maestría. |
| 10 | **Pulso Regenerador de [Elemento]** | Curación · 3 maná · `2d4 + 1` PV | **Sin maestría** | Curación avanzada canalizada desde la afinidad del lanzador. Sin maestría (consistente con *Curar Heridas Leves*). |

> **Resumen rápido de Maestría (13 hechizos del catálogo)**:
> - **7 con maestría**: *Descarga Focalizada*, *Ruptura de Égida*, *Lanza Perforante*, *Prisión*, *Sentencia sobre Atrapado*, *Tormenta* y *Choque Desarmador*.
> - **6 sin maestría**: *Foco Arcano*, *Estallido Conmocionante*, *Égida*, *Manto*, *Juicio* (por *Noquear*) y *Pulso Regenerador*.

---

## 4. Decisiones clave de producto y trade-offs

- **Adaptación mediante clon personalizado del personaje**:
  - *Enfoque elegido*: Al pulsar **Aprender adaptado**, se genera una copia concreta del personaje con su elemento aplicado (por ejemplo, *Égida de Fuego* con `armorElement: 'Fuego'`, órdenes ígneas y estado *Quemadura* si es ofensivo de fuego), manteniendo intacta la plantilla en el Archivo Arcano para el resto de personajes.
  - *Prevención de duplicados*: Se guarda `catalogTemplateId` en la copia aprendida para detectar si ese personaje ya desbloqueó la técnica.
- **Resolución de *Juicio de [Elemento]* en combate**:
  - Al tener `effectType: 'damage'` (`1d4` mágico) junto con `statuses: ['Noquear']`, al impactar en combate inflige el daño de `1d4` y dispara el chequeo de Influencia correspondiente para intentar *Noquear*, manteniendo el flujo ya integrado en Arcane.
- **Migración limpia para partidas existentes**:
  - Retirar los 3 hechizos de *Foco Arcano* de la lista inicial de magos nuevos y evitar que se auto-agreguen al restaurar básicos, dejándolos disponibles como no aprendidos en el Archivo Arcano (y respetando a cualquier personaje que ya los tenga aprendidos manualmente).

---

## 5. Arquitectura técnica y estrategia de datos *(Referencia técnica)*

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Barra Superior: Arcane v1.7.0                                              │
│ [Grimorio]  [Archivo Arcano]  [Combate]  [Personajes y PNJs]  [Fórmula]    │
└───────────────────┬────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Vista Archivo Arcano (Catálogo de Hechizos No Aprendidos)                  │
│  ├─ Cabecera: Personaje activo + Afinidad/Elemento (selector preview)      │
│  ├─ Filtros: [Todos | Adaptables (10) | Base (3) | Otros | Exclusivos]     │
│  │           + Categoría + Buscador                                        │
│  └─ Lista de hechizos con previsualización elemental y estado de maestría  │
└───────────┬──────────────────────────┬─────────────────────────┬───────────┘
            │                          │                         │
            ▼                          ▼                         ▼
  [Aprender adaptado]          [Aprender directo]      [Personalizar en editor]
            │                          │                         │
            ▼                          ▼                         ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────────────┐
│ Motor de Adaptación   │  │ Agrega spellId a      │  │ Prellena Editor con  │
│ - Sustituye [Elemento]│  │ character.knownSpells │  │ copia adaptada y     │
│ - Ajusta órdenes,     │  │ (Foco Arcano, etc.)   │  │ navega a Grimorio    │
│   armadura y estado   │  └───────────────────────┘  └──────────────────────┘
│ - Remapea dependencia │
│   al nombre adaptado  │
│ - Preserva noMastery  │
└───────────┬───────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Estado Global + Persistencia Local                                         │
│  - spells[] (hechizos básicos, catálogo no aprendido y copias de cada PJ)  │
│  - characters[].knownSpells[]                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### Modelo de datos y mapeo de interacciones

- **Extensión mínima de `Spell`**:
  - `unlearnedByDefault?: boolean` — marca hechizos que pertenecen al catálogo oficial no aprendido (los 3 de *Foco Arcano* y los 10 adaptables).
  - `isAdaptableTemplate?: boolean` — indica que la entrada del catálogo se adapta al elemento/naturaleza del personaje al aprenderla.
  - `adaptableElementRole?: 'attack' | 'armor' | 'buff' | 'control' | 'heal'` — guía la inyección de órdenes afines, elemento de armadura y estado elemental.
  - `catalogTemplateId?: string` — referencia guardada en la copia aprendida para saber qué plantilla del catálogo ya aprendió ese personaje.
  - `catalogChainGroup?: string` — etiqueta opcional de cadena (*Foco Arcano*, *Égida Elemental*, *Manto Elemental*, *Prisión y Sentencia*) para agrupar y facilitar el aprendizaje encadenado.
- **Maestría (`noMastery`)**: Reutiliza exactamente el campo existente `noMastery?: boolean` y `spellSupportsMastery()`, aplicando `noMastery: true` en los 6 hechizos fijos/remates mayores y `noMastery: false` en los 7 hechizos escalables.
- **Sincronización de versión**: Al implementar esta mejora, se actualizará la versión visible en la barra superior a `v1.7.0`.