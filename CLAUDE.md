Garantías Express
Este archivo documenta el contexto y las reglas que cualquier asistente o colaborador debe respetar al trabajar sobre este repositorio. Léelo antes de proponer o realizar cambios.
1. Propósito de la aplicación
Garantías Express soporta el proceso integral de garantías de refacciones automotrices de Grupo APYMSA: desde que una sucursal levanta una solicitud de garantía hasta su resolución final mediante dictamen, nota de crédito, retorno, reparación o destrucción.
Cubre recepción en sucursal y Garantías Central, diagnóstico técnico, disposición del producto, custodia y trazabilidad física, reparación y Calidad, incidencias, almacén, tarimas, dictámenes y las vistas del portal Central y Sucursal.
2. Tecnología actual y naturaleza del proyecto
Next.js 16 (App Router), React 19, vinext, Cloudflare Workers, TypeScript 5.9 y Tailwind CSS 4.
Existe soporte declarado para Cloudflare D1 y Drizzle ORM, pero `db/schema.ts` está vacío y `.openai/hosting.json` no tiene D1 ni R2 configurados.
No hay backend, API ni base de datos conectada. La aplicación se concentra en `app/page.tsx` como componente cliente y usa `useState` con datos simulados en memoria.
Los datos no persisten: una recarga restaura los valores semilla. No asumas autenticación real, sincronización entre usuarios o persistencia.
Los módulos conservan datasets independientes. No agregues nuevas fuentes de datos paralelas sin una justificación explícita.
3. Formato y unicidad de folios
Los formatos siguientes son un contrato entre módulos y deben conservarse, incluida su unicidad:
`GE-AAMMDD-####`: folio de solicitud de garantía.
`SMR-AAMMDD-####`: folio de solicitud de reparación.
`PZA-<folio>-##`: identificador de pieza.
No cambies patrón, separadores, orden ni generación de folios sin una tarea explícita. Todo folio nuevo debe ser único dentro de su tipo.
4. Trazabilidad de custodia
La custodia es el eje de trazabilidad física. Los estados reconocidos por `custodyOperation()` son:
Garantías Central.
Con el cliente.
Con Paquetería.
En sucursal.
Con el asesor.
En caja de Garantías.
Sin custodia.
Cada estado determina siguiente acción y SLA. No agregues, elimines, renombres estados ni alteres transiciones sin una tarea explícita y sin verificar el impacto en `CustodyMonitor`, `CustodyBar` y las vistas consumidoras.
5. Reglas críticas de negocio
Incidencias: una incidencia debe resolverse o generar su etiqueta antes de habilitar la recepción del producto asociado.
Recepción: solo procede con cajas y folios habilitados; respeta validaciones de sucursal, caja y folios pendientes.
Recepción — diferencias: al reportar una diferencia, el producto se concentra como incidencia. Se debe generar la etiqueta antes de permitir confirmar su recepción o ejecutar el retorno a sucursal.
Generación de etiquetas: es el evento que habilita pasos posteriores; no debe omitirse ni duplicarse silenciosamente.
Diagnóstico: sigue el criterio técnico existente. En baterías, voltaje en reposo ≥12.60 V equivale a carga completa; <12.20 V requiere carga controlada; bajo carga no debe caer de 9.6 V a 21 °C. La observación de diagnóstico es obligatoria.
Dictamen: debe reflejar resultado, cliente, producto, folio y tipo de bonificación cuando corresponda.
Nota de crédito: Anticipo, Aplicado a factura y Devolución de efectivo determinan la leyenda legal. La devolución de efectivo genera QR de un solo uso y debe validarse contra la identidad del beneficiario antes de aplicarse.
Retornos: requieren selección válida de transportista y guía cuando aplique, más confirmación explícita.
Reparación: solicitudes y piezas deben conservar consistencia entre los folios `SMR-...`, `GE-...` y `PZA-...` de origen.
Calidad: el bloqueo de proveedor o producto requiere autorización expresa de Dirección General; no automatices bloqueos sin ese control.
Almacén y tarimas: una tarima se forma con solicitudes aprobadas y confirmación explícita; conserva la relación entre tarima, piezas y estado de traspaso.
Unicidad al transferirse entre módulos: un folio de garantía o reparación debe existir una sola vez. Al transferirlo entre Solicitudes, Almacén, Reparación, Calidad, Incidencias, Retornos o Tarimas, actualiza su estado y trazabilidad en el registro existente, sin crear duplicados.
Nueva solicitud — sucursal por ClienteID: si `ClienteID` es `1`, la sucursal se selecciona manualmente. Para cualquier otro cliente, la sucursal se asigna automáticamente según el cliente.
Inventario — consultas y salidas: no permitir solicitar, reservar ni dar salida a una cantidad mayor que la existencia disponible. La cancelación de una solicitud debe liberar o restaurar la cantidad previamente reservada.
Ante duda sobre una regla, detente y pregunta antes de modificar el comportamiento.
6. Modales de confirmación
Las acciones críticas —transferencias, disposición, retornos, decisiones de Calidad y resolución de incidencias— deben usar los modales homologados: `askQuestion()` y `QuestionModalHost` para confirmaciones, e `InfoModalHost` para mensajes informativos.
No uses `window.confirm()` ni `window.alert()` en flujos nuevos o modificados.
7. Componentes Legacy/Previous/Prior
El archivo contiene versiones históricas de módulos. No elimines componentes Legacy/Previous/Prior ni realices refactorizaciones masivas, divisiones, renombres o deduplicación como efecto colateral de otra tarea.
Cualquier limpieza requiere una tarea explícita y pruebas que confirmen que la versión activa usada por `Home()` sigue funcionando sin cambios de comportamiento.
8. Build e interfaz visual
Todo cambio debe compilar correctamente usando los scripts aplicables, incluyendo `npm run build` y, cuando existan, `npm run lint` y `npm test`.
Conserva la interfaz basada en tarjetas, bordes y espaciado uniformes, estados visuales claros y modales homologados.
No introduzcas componentes, estilos o patrones de interacción ad-hoc que rompan la consistencia visual existente.
9. Cambios que requieren confirmación explícita
Antes de incorporar los siguientes cambios, pide confirmación explícita y no los implementes por iniciativa propia:
Persistencia real: base de datos, Cloudflare D1/R2, `localStorage` u otra alternativa.
Autenticación o autorización de usuarios y roles.
Servicios externos, APIs, mensajería o proveedores.
Cambios masivos de arquitectura, como dividir el archivo monolítico, migrar el modelo de estado o incorporar una capa de API.
