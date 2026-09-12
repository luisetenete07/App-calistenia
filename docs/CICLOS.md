# Planificación por ciclos

Cómo se planifica una temporada en UDECA, qué decide la app y qué decide el
entrenador.

---

## 1 · Los tres niveles

| Nivel | Qué es | Quién lo crea |
| --- | --- | --- |
| **Macrociclo** | La temporada entera. Contiene bloques. | El plan, de una vez |
| **Mesociclo** | Un bloque (acumulación, intensificación…). Contiene semanas. | El plan, de una vez |
| **Microciclo** | Una semana, de lunes a domingo. | El plan, de una vez |

Todo vive en la colección `trainingCycles`. Lo que los une es `parentId`: un
meso cuelga de su macro y un micro de su meso. `orderIndex` es su posición
dentro del padre (bloque 2, semana 3).

`parentId` es **opcional**: los ciclos sueltos —los que ya existían y los que se
crean a mano desde "Ciclo suelto"— no tienen padre y siguen funcionando como
siempre. Nada de esto es obligatorio: un entrenador que no planifique no ve
ningún cambio.

---

## 2 · Crear un plan

`components/CyclePlanSheet.tsx` → `lib/cyclePlan.ts` (`buildPlan`) →
`createCyclePlan` en `lib/firestore/cycles.ts`.

El entrenador elige una estructura (o la monta a mano), la fecha de inicio y
cuántos entrenos por semana. La app crea el macro, un meso por bloque y un micro
por semana, con las fechas ya encajadas.

Esto es lo que hace que la planificación se use: montar doce semanas a mano son
dieciséis formularios, y nadie los rellena dos veces. Así son treinta segundos, y
después se puede tocar cualquier ciclo por separado.

**Se escribe en un solo lote** (`writeBatch`). Los ids se generan antes de
escribir, porque un hijo necesita el id de su padre y en un lote no se puede leer
lo que se acaba de escribir. En un lote entra todo o no entra nada: nunca queda
un macrociclo a medio poblar porque se fuera la conexión.

### Dos decisiones que sostienen el resto

**El microciclo es una semana natural, de lunes a domingo.** No porque no existan
micros de diez días, sino porque el alumno vive en semanas: un calendario que
empieza en martes no se entiende de un vistazo. Quien necesite otra cosa crea un
ciclo suelto con las fechas que quiera.

**Saltarse un entreno no mueve el plan.** Las fechas son las que puso el
entrenador; lo que cambia es el cumplimiento que se ve en el calendario. Un plan
que se desplaza solo deja de ser un plan a la tercera semana, y además haría
imposible comparar dos alumnos con el mismo bloque.

### Programar cada semana

`components/WeekPlanSheet.tsx` → `lib/weekPlan.ts` → el campo `weekPlan` del
microciclo.

La rutina dice **qué** se hace (ejercicios, orden, descansos, superseries) y no
cambia. El microciclo dice **cuánto** se hace esa semana: 4×8 la primera, 5×8 la
tercera, la mitad en la de descarga. Era lo único que un entrenador escribía en
columnas distintas de su hoja y lo único que la app no sabía guardar.

Se resuelve **al leer, no al escribir** (`applyWeekPlan`): la rutina nunca se
modifica. Si el plan se borra o el entrenador cambia de idea, el alumno se queda
con su rutina intacta y no con los restos de la última semana programada.

El punto de partida es "duplicar y ajustar": lo que se puso la semana anterior
y, la primera vez, lo que dice la rutina. **No hay reglas automáticas** del tipo
"+1 repetición por semana": se rompen en cuanto alguien se lesiona o se salta
una semana, y entonces uno se pelea con el sistema en vez de con el
entrenamiento.

Lo que el alumno ve al entrenar son ya esos números — es lo que hace que esto no
sea decorativo.

### La semana de descarga

Marcada con `isDeload`, se pinta distinta y **pide un entreno menos** (nunca
menos de dos). Si la descarga pidiera lo mismo que una semana normal, el
cumplimiento saldría mal justo cuando el alumno está haciendo lo correcto.

---

## 3 · El calendario

`lib/cyclePlan.ts` → `planCalendar()` y `planSummary()`, pintados por
`components/PlanCalendar.tsx`.

Una fila por semana, agrupadas por bloque, con los siete días (relleno = entrenó)
y el cumplimiento de la semana (`hechos / previstos`). Ver catorce semanas
seguidas y dónde se cayó el alumno es lo que permite corregir a tiempo, que es
para lo que se planifica; una lista de ciclos con fechas no dice nada.

Detalles que importan:

- El recorrido va **semana a semana desde el macro**, no por la lista de micros.
  Así, una semana sin microciclo creado sale igualmente en su sitio en vez de
  dejar un hueco en mitad del calendario.
- Solo entra lo que cuelga de **ese** plan (`descendantIds`): dos macrociclos
  seguidos no se mezclan.
- El cumplimiento del resumen solo cuenta las semanas **cerradas y la actual**:
  incluir las futuras dejaría a todo el mundo al 20 % el primer día.

El alumno ve lo mismo resumido en su inicio: bloque, "semana 6 de 12" contada
sobre el plan entero (no sobre el bloque, que dice menos) y el aviso de descarga.

---

## 4 · La vista general del bloque

`lib/blockView.ts` → `components/BlockOverview.tsx`. Sale en tres sitios: la
ficha del ciclo, el progreso del alumno que ve el entrenador y el progreso que
ve el propio alumno o atleta.

Contesta de una vez a las tres preguntas que un entrenador se hace y que la app
no respondía en ninguna pantalla: **volumen** (las celdas), **equilibrio** (las
filas) y **frecuencia** (la última fila). Antes, las series por grupo estaban en
la pantalla del alumno, las marcas en la del coach, la frecuencia no la
calculaba nadie, y nada estaba atado al bloque: había que sumarlo de cabeza, que
es exactamente lo que una hoja de cálculo te daba hecho.

### De dónde sale "lo previsto"

Si esa semana está **programada** (§2), el número es exacto: el que escribió el
entrenador.

Si no lo está, se saca de la rutina **por sesión**: series de cada grupo entre
los días que no son de descanso, multiplicado por los entrenos previstos de esa
semana. Hacerlo por sesión y no por semana tiene una consecuencia buena: en una
semana de descarga, con menos entrenos previstos, lo previsto baja solo. Es una
aproximación, y se nota: sin programar, todas las semanas piden lo mismo.

Si la rutina va **a sensaciones**, no hay previsión que enseñar y solo se
muestra lo hecho. Inventar una meta para poder pintar un porcentaje sería
mentir.

### Lo que no se cuenta

Las semanas que **aún no han empezado** no entran en el cumplimiento y en la
tabla enseñan solo lo previsto. Contarlas dejaba a cualquiera al 25 % el primer
lunes del bloque, que es la forma más rápida de que nadie vuelva a mirar ese
número.

### Los avisos

Como mucho **dos problemas y una buena noticia**. Con más, se convierte en una
lista que nadie lee y el que importaba queda enterrado.

| Aviso | Cuándo |
| --- | --- |
| Grupo a cero | Programado (≥ 4 series) y sin tocar en todo el bloque. Todos los grupos en un solo aviso. |
| Desequilibrio | Lo **previsto** reparte 1,6 a 1 o peor entre empuje y tirón. |
| Se salta el patrón | El plan está equilibrado pero lo hecho no, y no hay ninguna semana caída que lo explique. |
| La descarga no descargó | Una semana de descarga ya cerrada con tanto volumen como la anterior. |
| Semana caída | Una semana cerrada con la mitad o menos de los entrenos previstos. |
| Progresión | El ejercicio que más ha subido (mínimo tres sesiones). |

Ninguno es opinable, y es a propósito: **un aviso que un entrenador serio
considera una tontería quema la confianza en todos los demás**. Por eso el
desequilibrio se mide sobre lo previsto —lo que el entrenador controla— y no
sobre lo hecho: si el plan está bien y falla la adherencia, el problema es otro
y se dice con otras palabras, o no se dice si ya está reportado como semana
caída. Sería el mismo aviso dos veces.

### La intensidad

Debajo de la tabla, el **RIR reportado** de cada semana y, más pequeño, el que
se pidió. En rojo cuando entrena a más de un punto por debajo de lo programado;
menos que eso es ruido, no una señal.

Se pregunta **al terminar cada ejercicio** (`components/SelectorDeEsfuerzo.tsx`),
no por serie: por serie es lo que hace un laboratorio, por ejercicio es lo que un
entrenador usa, y es un toque en vez de cuatro. Se puede desmarcar volviendo a
pulsar, porque un dato que no se puede corregir es un dato que la gente deja de
meter.

**En un plan personalizado, la escala la elige el entrenador**: RIR, porcentaje
o sus propias etiquetas, y una sola pregunta al terminar la sesión en vez de una
por ejercicio, o ninguna (ver `lib/planPersonalizado.ts`). El campo `rir` del
registro solo se escribe cuando la escala ES un RIR: un porcentaje guardado ahí
haría falsas todas las medias de esta pantalla, que es peor que no tener media.

**Solo se le pregunta a quien sabe contestarlo**: a los atletas siempre (se
autoentrenan) y a los alumnos que su entrenador marque, desde la ficha del
alumno (`UserProfile.trackRir`). A quien empieza, el RIR no le suena: lo
rellenaría al azar, y un dato inventado es peor que no tener dato.

Ese interruptor lo escribe **solo el entrenador**: las reglas se lo prohíben al
propio alumno. Si pudiera quitárselo, el entrenador seguiría creyendo que ese
dato existe y se le quedaría la intensidad en blanco sin saber por qué.

---

## 5 · Plantillas: el mismo método en varios alumnos

`lib/planTemplates.ts` → `lib/firestore/planTemplates.ts` → colección
`planTemplates`.

Es el mismo argumento de §2, un nivel más arriba. Montar doce semanas dejó de
ser dieciséis formularios, pero con cinco alumnos vuelven a ser **sesenta hojas
de programación**. Un entrenador que trabaja con el mismo método en varias
personas no puede escribirlo cinco veces: lo escribe una y lo aplica.

- **Guardar un plan como plantilla** (desde la ficha del macro o del bloque):
  se lleva la estructura, las descargas, las metas y **los números de cada
  semana**.
- **Aplicarla** desde "Nuevo plan": las plantillas propias salen arriba del
  todo, antes que las de fábrica.
- **Aplicar una semana a varios alumnos** desde la hoja de programación. Los
  ejercicios son los de la biblioteca del entrenador, la misma para todos sus
  alumnos, así que los números viajan sin traducir nada. A quien no tenga esa
  semana en su plan **se le salta y se dice**; no se le inventa un ciclo.
- **Progresión sugerida**: "+1 rep" donde el objetivo es un número exacto. Un
  rango ("8-12") o un texto ("AMRAP") no se tocan, porque ahí el número no
  significa lo que parece. Es una sugerencia que se pinta para corregirla, no
  una regla que se aplique sola.

**Una plantilla no lleva fechas.** Se guardan nombres y números; el calendario
se calcula entero al aplicarla, desde el lunes que elija el entrenador. Un plan
de septiembre aplicado en enero con sus fechas de septiembre no sería un plan,
sería un archivo.

Las plantillas son **privadas del entrenador**: ni sus alumnos las ven. Lo que
el alumno necesita ver es su plan, no el molde.

---

## 6 · Borrar

Borrar un ciclo con hijos borra **el plan entero** (`deleteCycles` con
`descendantIds`), y el aviso dice cuántos ciclos se llevará por delante. Los
`workoutLogs` **no se tocan nunca**: la pertenencia se calcula por fechas, así
que el historial del alumno sobrevive a cualquier replanificación.

---

## 7 · Comprobaciones

```bash
node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-cycle-plan.mjs
node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-block-view.mjs
node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-week-plan.mjs
node --experimental-strip-types --import ./scripts/_ts-hook.mjs scripts/check-plan-templates.mjs
```

(El gancho de `scripts/_ts-hook.mjs` solo resuelve las extensiones de los
imports; el código de la app no las lleva, ni debe.)

**`check-cycle-plan`** comprueba el cálculo de fechas: que el plan se alinee al
lunes, que los bloques encajen sin huecos ni solapes, que la descarga caiga
donde toca, que el árbol se reconstruya bien —incluidos los ciclos huérfanos— y
que dos planes seguidos no se mezclen. Son fechas, que es justo donde los fallos
no se ven: un plan con una semana de más parece correcto en pantalla y
descuadra el mes siguiente.

**`check-block-view`** comprueba los números y, sobre todo, los avisos: que
salgan cuando deben y —lo que más importa— **que no salgan cuando no deben**.

**`check-plan-templates`** comprueba que la plantilla conserve la estructura y
que **ninguna fecha** se cuele en ella, incluido el viaje de ida y vuelta
(plan → plantilla → plan).

**`check-week-plan`** comprueba la programación semanal, que es lo que el alumno
ve al entrenar: un fallo aquí no se queda en una pantalla fea, le hace hacer
otras series de las que le tocan. Incluye que la rutina original **no** se
modifique nunca y que la semana pasada no se cuele en la de hoy.
