# Auditoría de mecánicas de combate

Este inventario contrasta los metadatos de `src/utils/dice.ts` con las rutas de ejecución de `src/App.tsx`, `src/components/CombatPanel.tsx` y `src/components/CombatStatusesUI.tsx`. Las descripciones de esta auditoría no sustituyen a esas funciones.

## Estados elementales

Todas las cargas tienen su propio contador de turnos y el máximo normal es 10 (`MAX_ELEMENTAL_STACKS`; Quemadura también define `MAX_BURN_STACKS = 10`). Al aplicar cargas con el máximo ya alcanzado, `mergeElementalStacks` reemplaza la carga con menor duración solo si la nueva duración es mayor. Al consumir cargas, `consumeElementalStacks` retira primero las que vencen antes.

| Estado | Aplicación automática en un impacto con daño positivo | Duración inicial | Efecto al inicio de turno |
|---|---|---:|---|
| Quemadura | Hechizo reconocido como fuego; una carga por cada dado que obtuvo su valor máximo. | 2 turnos | `1d4` mágico por carga. Puede detonarse. |
| Envenenado | Hechizo reconocido como veneno/ácido/corrosión/esporas; una carga por cada dado en la mitad superior. | 3 turnos | `1d4` mágico por carga. Puede sifonarse. |
| Congelado | Hechizo reconocido como hielo/frío; una carga si al menos un dado quedó en la mitad superior. | 2 turnos | `1d4` mágico por carga por el valor por defecto que aplica el helper, aunque la ruta automática pasa `undefined` como dado. Puede quebrarse. |
| Electrificado | Hechizo reconocido como rayo/electricidad; una carga por impacto con daño positivo. | 3 turnos | Sin daño periódico por defecto. Sirve para la expansión de Antena y la Sobrecarga. |
| Sangrando | Hechizo reconocido como corte/filo/sangrado; una carga por impacto con daño positivo. | 3 turnos | `1d4` físico por carga. Puede desgarrarse. |

Los reconocedores son heurísticas sobre nombre, órdenes y notas de daño (`isFireDamageSpell`, `isPoisonDamageSpell`, etc.), no una clasificación elemental estricta. `rollDamageDice` cuenta resultados máximos y de mitad superior por dado; un crítico automático cuenta todos los dados como máximos.

Además de la aplicación automática, una definición explícita `elementalStatus` puede seleccionar cargas, duración, dado, naturaleza del daño y disparador. En la ruta de ataque, incluso el disparador `always` requiere daño total positivo. La ruta de resolución de un chequeo de estado aplica la definición explícita directamente tras resolver el chequeo, sin reevaluar ese disparador.

El daño periódico usa el dado configurado por carga y la naturaleza almacenada en el estado. El botón «Inicio turno» resuelve un tick; avanzar la ronda también resuelve un tick y reduce la duración de cada carga. Puede prepararse Protección para mitigar el tick mediante el cálculo común de Protección y sus costes existentes.

## Sinergias y reacción especial

Las sinergias manuales se invocan desde el control de combate; un hechizo configurado con `synergyReaction` también puede ejecutarlas tras un impacto o chequeo de estado exitoso. El valor base consume una carga, y la configuración del hechizo puede solicitar una cantidad o todas. Las cargas consumidas son las de menor duración restante.

| Sinergia | Requisito y activación | Efecto y consumo |
|---|---|---|
| Detonar Quemadura | El objetivo debe tener Quemadura; botón manual o reacción configurada. | Consume N cargas y tira `Nd6` mágico explosivo contra el objetivo. |
| Sifón de Envenenado | El objetivo debe tener Envenenado; botón manual o reacción configurada. | Consume N cargas, inflige `Nd4` mágico al objetivo; el lanzador recupera `ceil(total/2)` PV y N Maná solo si lanzador y objetivo son personajes distintos. |
| Fractura Glacial (Quebrar Congelado) | El objetivo debe tener Congelado; botón manual o reacción configurada. | Consume N cargas e inflige `Nd8` físico al objetivo. |
| Sobrecarga de Antena Eléctrica | Debe existir al menos un combatiente con Electrificado; el botón desde cualquier fila la ejecuta sobre todos los combatientes Electrificados. | Consume N cargas de cada estado Electrificado y tira `Nd6` mágico por combatiente. |
| Hemorragia (Desgarrar Sangrado) | El objetivo debe tener Sangrando; botón manual o reacción configurada. | Consume N cargas e inflige `Nd6` físico al objetivo. |

El daño usa el modificador letal/no letal activo del combate, salvo que la función de daño subyacente imponga otra cosa. La ejecución manual de sinergias no consume acciones ni Maná dentro de `executeSynergyReaction`.

**Expansión eléctrica de Antena** es un efecto automático separado de la Sobrecarga: un impacto positivo con electricidad contra un objetivo hace saltar daño a los demás objetivos electrificados vivos, excluyendo al objetivo del impacto y al atacante. Tira `Nd4` mágico según las cargas de cada afectado, no consume esas cargas y no se activa para un impacto que no cause daño. No es la Sobrecarga `Nd6`.

## Estados de control

La agregación de efectos de control se realiza en `getCombatantStatusEffects`; las duraciones suelen venir del hechizo o de la aplicación manual.

| Estado | Efecto observado en el agregador y particularidades |
|---|---|
| Aturdir | Movilidad 0; no actúa, reacciona, ataca ni defiende; los golpes entrantes son críticos automáticos. Por defecto termina al recibir un golpe; se puede configurar por turnos. |
| Cegar | Añade fallos automáticos a ataque y defensa; no afecta a personajes con `immuneToBlind`. El estado puede permanecer aunque sea inmune. |
| Derribar | Registra al objetivo como derribado y añade fallos automáticos a ataque y defensa. Puede levantarse manualmente; no establece movilidad 0 en el agregador. |
| Desarmar | Marca el estado como desarmado y expone la acción para recuperar arma/escudo, que cuesta una acción. No tiene contador de turnos. |
| Empujar | En el impacto quita defensa y termina al siguiente golpe recibido. Al aplicarse normalmente también crea Derribar, salvo que ya se haya incluido; la aplicación manual permite omitir Derribar. |
| Ensordecer | Añade fallos automáticos solo a defensa. |
| Inmovilizar | Movilidad 0; no puede atacar ni defenderse. No impide por sí solo toda acción o reacción. |
| Noquear | Movilidad 0; no actúa, reacciona, ataca, defiende ni lanza magia; los golpes entrantes son críticos automáticos. |
| Ralentizar | Movilidad a la mitad, máximo una acción por turno y fallos automáticos en defensa. |
| Silenciar | Bloquea el lanzamiento/preparación de magia y las reacciones mágicas mediante la restricción de magia. |
| Intimidar | Añade fallos automáticos a ataque e Influencia. |

Los fallos automáticos se suman por estado activo y el valor por estado es al menos 1. Los estados de control desconocidos no tienen efectos de sistema definidos por este agregador; un estado personalizado puede mostrar su descripción sin adquirir una regla nueva.

## Diferencias y límites encontrados

- La referencia anterior afirmaba que todos los elementales tenían «1 carga por defecto» y un fin común. El código permite configuraciones distintas, consumos configurables y cargas con duraciones independientes.
- «Descargar Antena» y «Expansión eléctrica» son reglas distintas: la primera consume cargas y usa d6 sobre todos los Electrificados; la segunda no consume cargas y usa d4 sobre los demás combatientes Electrificados.
- Los reconocedores elementales usan texto: ácido y corrosión pueden activar Envenenado; nombres/órdenes pueden clasificar un ataque como elemental aunque no exista una propiedad explícita de elemento.
- En el ataque normal, las cargas elementales se procesan con el resumen ya modificado por reducción/divisor y se condicionan a daño total positivo. El flujo de impacto en área pasa el resumen bruto. Por tanto, el umbral de daño para aplicar estados no es idéntico entre ambas rutas.
- Avanzar varias rondas en una sola llamada reduce la duración en `delta`, pero el bucle de ronda realiza un solo tick de daño periódico por estado en esa llamada.
- La ejecución manual de una reacción no comprueba ni descuenta acciones o Maná en `executeSynergyReaction`; la interfaz tampoco indica un coste propio de esa acción.
- Las cargas manuales pueden configurar un dado periódico para Electrificado; la aplicación automática por rayo no lo configura y usa `defaultTickDie` (sin dado) al resolverse el turno.
- Empujar y Derribar son registros separados en la aplicación normal. La descripción de Derribar dice que el objetivo cae, pero el agregador no fija su movilidad; el botón «Levantarse» es la interacción explícita disponible.
- `detectSpellSynergy` reconoce explícitamente la configuración y, como compatibilidad textual, solo ciertos términos de Detonar y Sifón. Las otras reacciones requieren configuración explícita o su botón manual.
- Los registros de combate son texto, no contienen referencias estructuradas a las mecánicas. El lector contextual puede enlazar nombres y frases reconocibles; un evento sin nombre o contexto suficiente no permite reconstruir de forma fiable todas sus condiciones.

## Auditoría de las siete plantillas elementales

Las fórmulas directas indicadas son los dados base configurados por plantilla; las rutas existentes de ataque pueden aplicar maestría al daño del hechizo. El daño periódico elemental usa el dado y el tipo de daño del estado, no los dados directos del hechizo.

| Plantilla | Configuración real | Resolución y relación |
|---|---|---|
| Dardo Venenoso | `1d6` mágico; Manipulación; Envenenado, 2 cargas, 3 turnos, `1d4` mágico por carga; disparador de mitad superior. | Solo aplica el estado si el ataque causa daño positivo y el d6 obtiene 4–6. Un resultado 1–3 no añade cargas. Después, cada carga causa un d4 al inicio del turno; Sifón Tóxico puede consumirlas. |
| Llama Incendiaria | `1d6` mágico; Manipulación; Quemadura, 2 cargas, 2 turnos, `1d4` mágico por carga; disparador configurado como siempre. | Aplica las dos cargas con un impacto que conserve daño positivo. El texto anterior decía 3 turnos, pero el estado se configura en 2. Detonar Quemadura puede consumirlas. |
| Lanza de Hielo | `1d6` mágico; Manipulación; Congelado, 1 carga, 2 turnos; disparador de mitad superior; `1d4` mágico periódico por defecto del motor. | Con daño positivo y resultado 4–6 en el d6 aplica Congelado. Si no alcanza ese umbral o el daño queda en cero, no lo aplica. Fractura Glacial puede consumir la carga. |
| Arco Voltaico | `1d6` mágico; Manipulación; Electrificado, 1 carga, 3 turnos; disparador configurado como siempre; sin daño periódico configurado. No configura Sobrecarga. | Con impacto de daño positivo aplica Electrificado. Al atacar con rayo, los demás combatientes vivos Electrificados reciben automáticamente `1d4` mágico por carga, sin consumirla. Sobrecarga de Antena es otra reacción (`1d6` por carga) y debe elegirse aparte. |
| Tajo Sangrante | `1d6` físico; Físico; Sangrando, 1 carga, 3 turnos, `1d4` físico por carga; disparador configurado como siempre. | Con impacto que conserve daño positivo aplica una carga. La carga causa daño al inicio de turno; Hemorragia puede consumirla. |
| Detonar Quemadura | `1d4` mágico directo; Manipulación; configura Detonar Quemadura y consumir 1 carga; no aplica un estado elemental nuevo. | Tras un impacto exitoso intenta detonar Quemadura en el objetivo: añade `1d6` mágico por carga consumida. Si el objetivo no tiene cargas, la reacción no se ejecuta y queda el daño directo del hechizo. También existe el botón manual desde un estado activo. |
| Sifón Tóxico | `1d4` mágico directo; Manipulación; configura Sifón de Envenenado y consumir 1 carga; no aplica un estado elemental nuevo. | Tras un impacto exitoso intenta consumir Envenenado y añade `1d4` mágico por carga. El lanzador recupera `ceil(daño de sifón / 2)` PV y 1 Maná solo si lanzador y objetivo son distintos. Sin Envenenado, no se ejecuta la reacción y queda el daño directo. También existe el botón manual. |

Las rutas de ataque requieren impacto; además, las aplicaciones elementales se condicionan a daño positivo después de las modificaciones en el flujo de ataque normal. Las reacciones configuradas se intentan tras ese impacto; la función no produce reacción si no encuentra cargas disponibles. El modo manual de reacción no gasta acciones ni Maná dentro de su ejecutor.

**Corrección de atributo solicitada:** Dardo Venenoso, Llama Incendiaria, Lanza de Hielo y Arco Voltaico ahora configuran la tirada con Manipulación únicamente; antes sus plantillas sumaban también Físico. Las demás propiedades mecánicas no cambiaron. Además, Llama Incendiaria ahora indica 2 turnos; Detonar Quemadura y Sifón Tóxico distinguen el `1d4` directo del daño adicional de reacción, y Sifón aclara que no recupera recursos cuando lanzador y objetivo son la misma persona. El editor muestra para las diez plantillas la resolución paso a paso, ejemplo, condición de no activación y relaciones, además de los valores configurados actualmente.

## Auditoría de las cinco plantillas de reacción

Las fórmulas de reacción siguientes pertenecen a `executeSynergyReaction`; no son dados directos configurados en el hechizo. Las cinco plantillas usan Manipulación y consumen una carga por defecto. Detonar y Sifón conservan sus dados directos existentes; las tres nuevas no agregan daño directo.

| Plantilla | Configuración de entrada | Efecto de reacción real |
|---|---|---|
| Detonar Quemadura | 4 Maná, `1d4` mágico directo; Manipulación. | Consume 1 carga de Quemadura y añade `1d6` mágico. |
| Sifón Tóxico | 3 Maná, `1d4` mágico directo; Manipulación. | Consume 1 carga de Envenenado y añade `1d4` mágico; si lanzador y objetivo son distintos, recupera `max(1, ceil(daño de sifón / 2))` PV y 1 Maná. |
| Fractura Glacial | 3 Maná, sin dados directos; Manipulación. | Consume 1 carga de Congelado e inflige `1d8` físico. |
| Sobrecarga Eléctrica | 3 Maná, sin dados directos; Manipulación; área `all_electrified`. | La reacción global consume 1 carga de cada combatiente Electrificado e inflige `1d6` mágico por carga consumida. El motor incluye al lanzador si está Electrificado, aunque la selección de objetivos del ataque en área excluya al lanzador. |
| Hemorragia | 3 Maná, sin dados directos; Manipulación. | Consume 1 carga de Sangrando e inflige `1d6` físico; no aplica Sangrando de nuevo. |

Las tres plantillas nuevas resuelven una tirada de entrada con Manipulación, pero sin dados directos: el daño solo aparece si se activa la reacción. El estado requerido debe estar presente al impactar; si faltan cargas, no hay daño de reacción. Sobrecarga conserva el modo multiobjetivo y la resolución por área ejecuta su reacción global una sola vez por hechizo, no una vez por cada blanco.

La instrucción de usar Manipulación en las cinco reacciones prevalece sobre la nota contradictoria que asignaba Influencia a Detonar y Sifón. El motor no da una estadística propia a las reacciones: la estadística configurada pertenece a la tirada de entrada del hechizo.

## Prototipo de disciplinas de conocimiento

El catálogo de conocimiento agrega 52 hechizos de Fuego, Tierra, Roca, Magma, Agua, Hielo, Aire, Rayo y Tormenta usando únicamente campos existentes de `Spell`: dados/daño, estados soportados, estados elementales, áreas seleccionadas, armaduras, defensa, disipación y reacciones. Roca es una especialización enlazada a la disciplina Tierra, no una naturaleza nueva; las demás disciplinas reutilizan naturalezas ya existentes.

La maestría de disciplina (niveles 0–3) y los requisitos de descubrimiento se guardan por separado de `spellMastery` y de `Spell.dependency`. Los requisitos iniciales son afinidad Tierra y Tierra Nv. 3 para Roca; afinidades Fuego/Tierra más Fuego Nv. 2 y Roca Nv. 3 para Magma; afinidad Hielo más Agua Nv. 3 para la ruta de Hielo; afinidad Rayo más Aire Nv. 2 para la ruta de Rayo; y afinidades Aire/Rayo más Aire Nv. 2 y Rayo Nv. 3 para Tormenta. Agua, Hielo, Aire, Rayo y Tormenta siguen siendo naturalezas existentes; sus rutas solo controlan el acceso a cada árbol y el DJ puede ajustarlas o habilitarlas manualmente. El Archivo Arcano muestra las técnicas como nodos conectados por ramas, con una vista alternativa de lista. El DJ puede modificar las rutas, los niveles mínimos por hechizo, deshabilitar contenido, reordenar ramas o conceder/revocar un descubrimiento manual. Estas acciones no aprenden hechizos ni cambian estadísticas; deshabilitar contenido tampoco elimina hechizos ya aprendidos.

La ampliación de Agua usa presión, oleaje con Empujar, defensa por bruma, Inmovilizar y disipación directa de estados perjudiciales. Hielo reutiliza Congelado, el estado Inmovilizar, armaduras elementales y `shatter_frozen`; sus técnicas de ruptura consumen las cargas disponibles y aplican el daño físico por carga ya implementado. Aire y Tormenta usan impactos, Empujar, Desarmar, defensa y estados de control existentes, sin añadir armaduras sólidas, prisiones físicas ni movimiento adicional. Rayo y Tormenta reutilizan Electrificado, las áreas `all_electrified` / `all_enemies` y la reacción `overload_electrified`. Los nueve árboles tienen un nodo culminante que requiere maestría Nv. 3 y conserva el flujo de aprender hechizos: Fuego (oleada `all_enemies` + Quemadura), Tierra (fractura `area_selected` + Derribar), Roca (Derribar + Desarmar por Influencia), Magma (Inmovilizar + Quemadura por Influencia), Agua (disipa todos los debuffs de un objetivo), Hielo (Fractura Glacial), Aire (`all_enemies` + Empujar), Rayo (descarga concentrada que requiere Electrificado) y Tormenta (`all_enemies` + Electrificado). Reacción de Sobrecarga activa la reacción existente mediante el chequeo estándar de Influencia para estados. El prototipo de árboles no añadió órdenes, estados, reacciones ni reglas de combate nuevas.

El combate actual no modela desplazamiento de terreno persistente, cobertura por obstáculos ni movimiento adicional. Por eso el catálogo evita describirlos como efectos automáticos y usa solo resolución de combate disponible; esas capacidades quedan como propuestas separadas para una futura ampliación, no como cambios implícitos al motor.

## Naturalezas de Portales y Explosión

Portales y Explosión están disponibles como naturalezas independientes en creación y adaptación de personajes. Portales se agrupa con Espacio y Fuerza; Explosión tiene órdenes de compresión, presión, detonación y choque, sin asociarse a Fuego. Las órdenes clasifican la forma de la magia: no abren o atraviesan portales, ni desplazan combatientes o detonan efectos automáticamente. Esas acciones requieren hechizos configurados con las mecánicas de combate existentes. La naturaleza Explosión tampoco aplica Quemadura por sí sola; la regla de fuego solo se activa por una configuración o descripción explícitamente ígnea.