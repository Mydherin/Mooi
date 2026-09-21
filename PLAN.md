# Despliegues agénticos privados por sesión

Este archivo es un plan de implementación autocontenido: contiene el contexto, decisiones, contratos, puntos de integración, tareas y criterios de aceptación necesarios para continuar desde cero; leer los archivos indicados antes de editarlos, sin repetir el descubrimiento arquitectónico.

Estado: planificación; no se ha implementado la feature. Fecha: 2026-09-20.

## 1. Objetivo y decisiones de producto

Desde una sesión, «Deploy» pide a un agente con contexto nuevo que identifique si el repositorio es una aplicación web y la levante completamente mediante sus mecanismos documentados, incluyendo servicios auxiliares. El resultado es JSON validado. La aplicación aparece en una pestaña de la sesión y solo se accede mediante Mooi autenticado. «Stop» ejecuta una petición agéntica nueva y verifica la parada. La conversación original conserva cliente, historial, modelo y esfuerzo.

Decisiones propuestas para cerrar los aspectos no explícitos:

- Un despliegue activo por sesión y una operación de despliegue/parada a la vez. Sesiones distintas tienen recursos independientes, aunque apunten al mismo repositorio o rama.
- «Desplegar» significa ejecutar una preview privada en la infraestructura de Mooi; no publicar en proveedores externos.
- Usar el proveedor elegido para la sesión. Actualmente no existe una preferencia global de proveedor: no inventar una segunda selección. Para Claude, política interna fija `claude-sonnet-5` + `high`, también al parar, sin parámetro de API, selector ni variable de entorno. Si la cuenta no tiene acceso, devolver un error explícito, sin degradar a otro modelo.
- Arranque y parada requieren que el chat no tenga un turno activo o una pregunta pendiente. Mientras duren, bloquear nuevos turnos del chat con 409. No interrumpir automáticamente el trabajo del usuario. El estado de conversación y el estado del despliegue siguen siendo diferentes.
- Ejecutar sobre una instantánea del workspace actual, incluidos cambios sin commit y archivos de configuración locales necesarios. No hacer checkout de la rama remota, commit, push ni cambios en el workspace original. Excluir metadatos privados del proveedor, sockets, dispositivos, cachés y enlaces que salgan del repositorio; tratar secretos del proyecto como secretos, nunca como logs. Resolver dependencias de nuevo dentro del entorno. Generar un manifiesto de archivos/hash para identificar la revisión desplegada.
- Al terminar el arranque se puede continuar el chat. Sus cambios no actualizan silenciosamente la instantánea desplegada: mostrar «Cambios posteriores al despliegue» y permitir parar y desplegar otra vez. Primera versión sin reemplazo sin interrupciones.
- Parar conserva los datos privados del despliegue dentro de la sesión para poder volver a levantarlo; cerrar/expirar la sesión elimina también esos datos. Avisar de esta duración en la interfaz. No conectar por defecto bases de datos de producción ni inventar credenciales que falten.
- No detener por navegar a otra pantalla. Mantener el límite de inactividad existente de 180 minutos, contando actividad humana del visor mediante un latido autenticado y limitado. Requests de la app, WebSockets y health checks no renuevan por sí solos la sesión. Cerrar sesión de Mooi revoca acceso; el despliegue se limpia por cierre/expiración de su sesión de trabajo.
- Autonomía limitada al objetivo: instalar dependencias y generar configuración dentro del entorno privado, usar scripts propios y arrancar/parar recursos propios. Si faltan secretos, acceso o soporte del entorno, finalizar con motivo accionable. No dejar preguntas agénticas esperando indefinidamente; devolver `missing_configuration` o `unsupported_repository`.

Decisiones confirmadas por el usuario durante la planificación:

1. Ejecutar procesos en el propio servidor. El agente detecta puertos usados y adapta puertos/configuración al método concreto de cada repositorio. No introducir un contenedor/VM obligatorio por despliegue. Si el repositorio utiliza Docker/Compose como mecanismo nativo, se puede usar ese mecanismo con recursos propios y puertos privados.
2. Exigir Sonnet 5 high; fallar si no está disponible.

La privacidad se apoya en un gateway autenticado y en controles de red del host, no en aislamiento por contenedor. El código de los repositorios ejecuta con los permisos del usuario de servicio: esta feature no convierte el modelo actual en una plataforma segura para ejecutar repositorios hostiles. No mezclar esta limitación con privacidad de acceso: impedir entrada pública directa sigue siendo criterio obligatorio. El preflight debe rechazar despliegues si la infraestructura no permite garantizarlo.

## 2. Situación actual y reglas del repositorio

- Guía principal: `CLAUDE.md`, indicada por `AGENTS.md`. No crear tests en el código fuente. No probar con navegador salvo que el usuario indique `--browser-tests`. Todas las operaciones de desarrollo pasan por el Makefile raíz. Mantener un único README raíz, limitado a instalación y ejecución.
- Antes de implementar hay que pedir al usuario que apruebe este plan. La guía requiere implementar una tarea técnica y preguntar antes de la siguiente, indicando su esfuerzo cognitivo. Marcar tareas al completarlas. Este documento no modifica esa regla.
- Hay numerosos cambios previos staged en backend y frontend. Preservarlos; no reset, limpieza general ni commits indiscriminados.
- `mic-sessions`: Python 3.13, FastAPI, uv, SDK oficial `claude-agent-sdk==0.2.152`, REST y SSE. Dependencias en `pyproject.toml`/`uv.lock`. La instalación local ya expone `ClaudeAgentOptions.output_format`, `effort` y `ResultMessage.structured_output`.
- `features/sessions.py` contiene contratos Pydantic, `Session`, registro en memoria, fold `record`, endpoints, locks, provisión y limpieza. `Session.runtime` es el agente del chat, `operation_lock` serializa admisión, `tasks` rastrea tareas y `EventLog` tiene replay/sync. El bloqueo de admisión no se puede mantener durante toda una operación larga: añadir un indicador de operación activa bajo ese lock.
- `shared/agents.py` contiene `AgentRuntime`, `AgentConfig`, `ProviderDescriptor`, catálogo/factoría y el único import del SDK. Claude crea directorio de configuración, transcript store y cliente propios. `set_configuration` puede reconectar reanudando conversación: no utilizarlo para desplegar. El runtime actual permite herramientas en el host y carga settings/hooks del repositorio: no reutilizar ese modo sin supervisión para previews.
- `shared/workspaces.py` clona en `WORKSPACE_ROOT/sessions/<uuid>/repository`, marca propiedad con `.mooi-session`, elimina al cerrar y reconcilia al arrancar. No hay persistencia ni recuperación del chat tras reinicio.
- `main.py` reconcilia workspaces antes de abrir HTTP y empezar el reaper. Cambiar el orden: limpiar/reconciliar recursos de despliegue antes de eliminar su información o repositorio.
- `shared/auth.py` valida Bearer JWT e introspección de `mic-mooi /me`, cache de 30 s. `shared/mooi.py` obtiene credenciales del usuario. El iframe necesita un acceso dedicado: no admite el Bearer de `sessionsFetch` en su navegación.
- `spa-mooi`: React/TypeScript/Vite/Tailwind/Zustand/Lucide. `WorkspaceHeader.tsx` no monta actualmente Deploy. `deploy/DeployButton.tsx`, `DeployDialog.tsx`, `DeployTargetRow.tsx` y `data/deployTargets.ts` son maqueta con destinos y cifras ficticios; sustituir o eliminar.
- `SessionWorkspace.tsx` usa un booleano para alternar conversación/cambios y mantiene montado el chat. Pasar a tipo de pestaña explícito. `SessionPage.tsx` compone header/chat/workspace y conecta SSE.
- API y estado: `features/sessions/api/sessionsApi.ts`, `hooks/useSession.ts`, `lib/applySessionEvent.ts`, `lib/applySessionToSession.ts`, `lib/openSessionStream.ts`, `stores/sessionsStore.ts` y sus tipos. Actualmente ciertos eventos cambian el chat a ready/waiting; los eventos de despliegue no deben entrar en esos casos.
- Desarrollo: Makefile raíz descubre `*/dev.mk`; `mic-sessions/dev.mk` levanta uvicorn; `make/ports.mk` exporta puertos fijos de Mooi y URLs; `compose.dev.yml` contiene Postgres/pgAdmin de Mooi, que no se reutilizan para proyectos desplegados.
- Mantener arquitectura: una feature Python por archivo, sin imports entre features; solo infraestructura transversal en `shared/`. La orquestación de despliegue vive dentro de `features/sessions.py`, con secciones cohesionadas. No esconder reglas de negocio en shared para reducir líneas. Tipos SPA: un archivo por tipo, sin barrels.

## 3. Arquitectura y aislamiento

Separar tres capas: operación agéntica, supervisor determinista de recursos y gateway privado. El agente decide cómo ejecutar el repositorio; el supervisor controla dónde, qué recursos posee y si realmente funcionan; el gateway controla quién accede. Nunca confiar en una URL/PID libre devuelta por el modelo.

### Ejecutor de procesos nativos

Contrato transversal `ProcessSupervisor` en `shared/execution.py`: create_scope, snapshot, execute, allocate_port, inspect_listeners, probe, logs, stop, destroy, list_owned. Identidad estable `installationId/sessionId/deploymentId/generation`; etiquetas y registro durable fuera del checkout. Operaciones por identificadores internos, nunca matar procesos por nombre o PID sin verificar su identidad.

Implementación inicial: procesos nativos en el servidor, con cwd en la instantánea del workspace y entorno específico de la operación. Sin contenedor ni VM obligatorios. Ejecutar Makefile, scripts y gestores propios del repositorio. Si usa Compose, asignar project name único, overrides privados y etiquetas de ownership; no reutilizar contenedores/volúmenes de otras sesiones ni los de Mooi. No introducir imágenes de herramientas universales: comprobar herramientas reales del servidor y devolver un motivo accionable si falta un runtime que no pueda instalarse en un prefijo privado sin privilegios.

El agente operativo usa el SDK oficial desde mic-sessions, con cliente/contexto nuevo. Proporcionar herramientas MCP de lectura/escritura/ejecución y supervisión propias para que los comandos de arranque queden registrados antes de lanzarse. Ejecutan procesos NATIVOS; son un canal de control y trazabilidad, no una frontera de seguridad del sistema operativo. Deshabilitar herramientas equivalentes que eludan registro de procesos, subagentes y hooks/MCP descubiertos automáticamente para este perfil. Leer explícitamente instrucciones del repositorio. Mantener `setting_sources=[]` y herramientas explícitas sin modificar el perfil de chat existente. Las herramientas de ejecución no heredan PAT, JWT, SERVICE_TOKEN ni configuración de Mooi: construir env de lista permitida más configuración propia del proyecto. El cliente SDK mantiene su credencial en su proceso; no entregarla a las aplicaciones.

En Linux, crear un scope/cgroup por despliegue (systemd de usuario con delegación configurada) para controlar hijos, procesos daemonizados y límites. El entorno local macOS requiere un supervisor de procesos con identidad PID+tiempo de inicio, grupos y seguimiento de descendientes; si un mecanismo daemoniza fuera de esos controles sin handle verificable, rechazarlo como no supervisable. Para Compose usar IDs/labels inspeccionados, nunca inferir identidad por PID de la CLI. Los procesos sobreviven al cliente SDK y al request HTTP; el supervisor los mantiene y registra su salida. No depender de nohup/PID files arbitrarios del agente como única garantía de ownership.

Privacidad de red ANTES del arranque: el servidor expone exclusivamente los puertos de entrada de Mooi/gateway y deniega entradas a puertos de aplicaciones. Requerir política explícita verificada de firewall/security group en producción; para Docker verificar también reglas del forwarding/DOCKER-USER o mecanismo equivalente, porque publicar un contenedor puede saltarse una regla de firewall ingenua. No cambiar automáticamente reglas globales ni SSH. Preflight de instalación documenta y verifica la política; un simple booleano de configuración no constituye evidencia de protección. Si no puede verificarse, deshabilitar deploy con `private_network_unavailable`.

Adicionalmente, agente/supervisor configuran cada listener en loopback (`127.0.0.1`/`::1`) o interfaz privada aprobada. Con Compose, publicaciones explícitas `127.0.0.1:<puerto>:<interno>`; frontend/API accesibles por gateway y DB/cache solo por servicios que las necesitan. Rechazar host networking, publicaciones wildcard y túneles externos para esta operación. Inspeccionar el resultado real después del arranque; la barrera previa evita una ventana de exposición antes de detectar un error. Si el método del repo necesita 0.0.0.0 dentro de su contenedor, permitirlo solo con publicación privada del host. Los procesos nativos deben usar loopback. No afirmar que inspeccionar comandos de shell impide todos los comportamientos de un repositorio arbitrario.

Límites: 2 CPU, 4 GiB RAM y 256 procesos por scope donde el sistema los soporte; límite de espacio de snapshot/datos de 10 GiB, logs acotados; arranque 15 min, parada agéntica 2 min y limpieza forzada 30 s. Si una cuota no puede aplicarse en un SO, informar la capacidad real; los límites de tiempo, log y concurrencia son obligatorios. Configurables de infraestructura por .env; modelo/esfuerzo fijos. Máximo global 4 despliegues y 2 por jugador, además de límites actuales de sesiones. Rechazo al exceder cuota, sin cola sin límite. No instalar dependencias globales ni reemplazar versiones del servidor; usar prefijos y entornos del despliegue.

### Puertos y supervisión

- El agente debe solicitar/verificar cada puerto requerido mediante herramienta del supervisor (el agente solicita la comprobación y recibe ocupación/disponibilidad real del host), indicando servicio y ámbito de red. Registrar todos: frontend, API, DB, cache, workers con listener y HMR.
- Reservar de forma atómica cuando el proceso acepte sockets heredados; cuando no, comprobar bind inmediatamente antes de lanzar, serializar reservas de puertos del host entre todos los despliegues, comprobar propietario del listener después y reintentar con otro puerto ante `EADDRINUSE`. Un check previo no garantiza ausencia de carrera; no presentar esa garantía falsa.
- Los puertos internos de contenedores distintos pueden coincidir; comprobar disponibilidad en su namespace real. Las publicaciones de Compose y TODOS los listeners nativos se comprueban contra el host compartido, incluyendo IPv4/IPv6. Asignar puertos libres fuera de los reservados por Mooi; permitir los preferidos del repo solo si están libres. Actualizar frontend, API, DB, CORS, callbacks y HMR de forma consistente mediante env/argumentos/overrides documentados. No detener un proceso ajeno para recuperar un puerto ni asumir libre un puerto que no pueda inspeccionarse.
- Configurar mediante mecanismos nativos: env, argumentos, overrides generados, configuración de URLs de API/HMR/CORS/hosts. No sustituir un Makefile obligatorio por órdenes manuales. Si un repositorio impone puertos ocupados sin override viable, informar del bloqueo.
- Inventariar recursos antes/después; procesos identificados por handle supervisor y arranque, no por PID suelto reutilizable. Contenedores/redes/volúmenes asociados a ownership.
- El servidor valida que frontend y dependencias obligatorias estén listos: proceso vivo, listener correcto, HTTP readiness específica y comprobaciones propias del repositorio. Un simple HTML 200 o login redirect no prueba que toda la aplicación funcione. El agente declara checks y el supervisor verifica los ejecutables/HTTP dentro del ámbito del despliegue con tiempos limitados.

## 4. Estado, operaciones y JSON

Estado de despliegue: `stopped | starting | running | stopping | failed`. Inicial `stopped` sin deploymentId. La operación tiene `queued | running | succeeded | failed | cancelled`, fase, timestamps, resultado final, trazas limitadas y coste separado del chat. `failed` puede conservar recursos: campo `cleanupRequired` y acción Stop siempre disponible. El acceso a la preview se revoca también al fallar/cancelar/parar, antes de intentar cleanup.

Campos de sesión nuevos: `deployment` (snapshot resumido) y `activeOperation` (id/tipo o null). Modelo interno `Deployment`: id, generation, owner player/session, processScopeId, revisionDigest, state, resources, privateRoutes, lastOperationId, health, timestamps, cleanupRequired. No entregar rutas del filesystem, credenciales ni endpoints internos en DTO públicos.

Resultado final público (Pydantic estricto, `extra=forbid`; JSON Schema generado del mismo contrato):

```json
{
  "schemaVersion": 1,
  "operationId": "uuid",
  "deploymentId": "uuid",
  "action": "deploy",
  "success": true,
  "state": "running",
  "reason": null,
  "preview": {"available": true},
  "services": [{"name": "web", "kind": "frontend", "status": "ready"}],
  "cleanupRequired": false
}
```

En fallo `success=false`, `preview.available=false`, `reason={code,message,retryable}` obligatorio. En parada correcta: `action=stop`, `state=stopped`, preview false. No usar `success` para aceptar solo la intención del agente. Distinguir estado final del recurso del éxito de operación; si una parada agéntica falla pero el supervisor consigue limpiar, responder `success=true`, estado stopped y diagnóstico de fallback separado en la traza. Si queda algún recurso, success false y cleanupRequired true.

Códigos estables: `not_web_application`, `unsupported_repository`, `missing_configuration`, `provider_unavailable`, `model_unavailable`, `deployment_runtime_unavailable`, `private_network_unavailable`, `capacity_exceeded`, `port_unavailable`, `startup_failed`, `health_check_failed`, `invalid_agent_output`, `timeout`, `cancelled`, `cleanup_failed`. Errores de admisión/autenticación usan HTTP normal y no simulan una operación completada.

Resultado agéntico interno separado del DTO: acción, propuesta de éxito, motivo, servicios y referencias a recursos emitidas por herramientas, checks y orden/comandos nativos de parada. `output_format` exige JSON Schema; leer `structured_output`, validar otra vez con Pydantic y referencias del supervisor. No extraer JSON con regex ni ejecutar comandos provenientes del JSON sin pasarlos por el supervisor. El servidor aporta IDs/estado definitivo y elimina información sensible. Como máximo un intento acotado de corrección de formato dentro del mismo contexto de operación; luego fallo y rollback.

Prompt deploy: objetivo, snapshot/path, lectura de instrucciones/docs/manifiestos, detección web, método nativo, descubrimiento de dependencias, comprobación de TODOS los puertos, configuración del gateway, arranque completo, readiness, inventario y contrato JSON. No incluir transcript ni conversación SDK del chat. Prompt stop: operación nueva con instrucciones del repositorio y manifiesto de recursos verificado; no reutilizar la conversación deploy. Pedir parada nativa completa y JSON. El supervisor siempre tiene capacidad de limpieza aun si credencial/proveedor ya no funcionan.

## 5. REST, SSE y concurrencia

Endpoints en `features/sessions.py`, autorización con `get_registry().get_for` en cada acceso:

- `GET /sessions/{id}/deployment`: snapshot + última operación.
- `POST /sessions/{id}/deployment/start`: 202, snapshot + operationId.
- `POST /sessions/{id}/deployment/stop`: 202, snapshot + operationId; parado es éxito idempotente.
- `GET /sessions/{id}/deployment/operations/{operationId}`: progreso o JSON final.
- `POST /sessions/{id}/deployment/operations/{operationId}/cancel`: 202; cancelación espera cierre del agente y cleanup antes de terminar.
- `POST /sessions/{id}/deployment/preview-grants`: emite ticket de un solo uso para iniciar visor, solo running.
- `POST /sessions/{id}/deployment/activity`: latido de usuario propietario, limitado a uno por minuto.

Start/stop llevan `Idempotency-Key`; bajo lock guardar clave, acción, generación y hash de request. Misma clave/cuerpo retorna la operación previa; misma clave/cuerpo distinto 409. Start sobre running devuelve estado actual, no duplica infraestructura. Stop mientras starting se convierte en cancelación/cleanup rastreado; no correr dos agentes simultáneamente. Cierre de sesión domina todas las operaciones. Revalidar generación antes de publicar resultados para descartar mensajes tardíos.

SSE reutiliza stream autorizado y secuencia actual: `deployment.status`, `deployment.progress`, `deployment.result`, `deployment.health`. Cada payload incluye deploymentId, generation y operationId cuando proceda. Trazas saneadas y límites del EventLog; no emitir `assistant.*`, `turn.result` o `session.configuration` del agente operativo al chat. `session.sync` contiene snapshot autoritativo suficiente incluso si se pierde history. UI descarta generaciones/secuencias anteriores. Fallo de preview nunca cambia automáticamente la conversación a failed.

## 6. Visor privado

No servir HTML arbitrario bajo el origen de Mooi: podría acceder a tokens, almacenamiento y APIs del usuario. Gateway en origen separado y distinto por deployment/generation, con DNS/TLS wildcard en producción y resolución local equivalente en desarrollo. Propuesta `https://<deployment>-<generation>.preview.<dominio>`; cookies de Mooi nunca tienen Domain compartido con previews. Restringir el host a IDs registrados, no aceptar destinos desde query/header del cliente.

El transporte del visor necesita ser alcanzable por el navegador, pero ningún contenido de app será público: responder denegado antes de contactar upstream si falta grant válido. Los puertos originales y dependencias permanecen privados. «Solo plataforma» significa acceso autenticado desde el iframe de Mooi; no imposibilidad criptográfica de que el propio usuario autorizado copie lo que ya puede ver.

Bootstrap: la SPA obtiene un ticket opaco, TTL 30 s, un solo uso, ligado a playerId, sid de autenticación, sessionId, deploymentId y generation. Entrega por POST dirigido al iframe en endpoint reservado del gateway; nunca en query, logs, Referer o localStorage. Endpoint no reenvía el ticket a la aplicación. Valida Origin exacto de Mooi y destino iframe, establece cookie host-only HttpOnly Secure SameSite=Strict en producción same-site y redirige a `/`. Cookie aislada de las cookies de la app por nombre reservado; no permitir que upstream la sobrescriba. En local usar dominios same-site explícitos y TLS local o excepción únicamente local documentada. No depender de cookies de terceros cross-site.

Grant con TTL corto (5 min) y renovación desde la plataforma mientras el visor esté visible, mediante nuevo bootstrap. Introspección de identidad con límite de cache 30 s; revocación inmediata local en stop/close y por auth como máximo en ese plazo. Revalidar WebSockets/SSE periódicamente y cerrarlos al revocar. Restricción de navegación principal mediante Fetch Metadata + CSP `frame-ancestors` al origen exacto de Mooi; headers ausentes no se aceptan como prueba de iframe. Estos headers complementan autorización, no la sustituyen.

`shared/preview.py`: proxy HTTP con streaming y backpressure, WebSocket bidireccional, SSE sin buffer, cierre/cancelación, timeouts, tamaño máximo de cabeceras/cuerpo y límites de conexiones. No reenviar Bearer/cookies Mooi/grant al upstream; quitar hop-by-hop headers y reconstruir forwarded headers confiables. Rutas de frontend/API solo desde manifiesto validado; nunca un open proxy ni seguimiento libre de redirects. Validar paths codificados/normalizados, hosts y DNS para evitar SSRF. Excluir DB/cache del routing web.

Usar raíz de origen por preview para assets/rutas absolutas; APIs bajo rutas declaradas, configurable por el agente con mecanismos del repo. Ajustar Vite allowedHosts/HMR, URLs de backend, redirects y cookies según ese origen. No hacer reemplazos textuales de JS/HTML como solución genérica. Reescribir Location y Domain de cookies solo de endpoints registrados. Si la aplicación no admite una configuración compatible, fallo explícito con motivo.

Iframe con `title`, atributo `sandbox` mínimo compatible (`allow-scripts allow-forms allow-same-origin`; origen separado obligatorio), sin top-navigation/popups por defecto, Permissions-Policy restrictiva y no-referrer. CSP de la app conservarla y combinar política de framing de gateway; conflictos como X-Frame-Options se resuelven solo en esta preview autenticada. Permitir recursos externos solo si el caso lo necesita mediante política explícita, sin comprometer acceso a Mooi. No añadir botón «abrir públicamente».

## 7. Ciclo de vida y fiabilidad

- Registro durable de ownership fuera de workspace: escritura atómica, permisos privados, versión y recursos obtenidos del supervisor; nunca confiar en manifests escritos por la app. No persistir PAT/JWT. Se puede usar JSON atómico bajo `WORKSPACE_ROOT/deployments` con lock exclusivo de instancia en esta versión monoproceso.
- Arranque fallido/cancelado: revocar rutas, cerrar agente, detener recursos creados por el intento en orden inverso y conservar diagnóstico limitado. No borrar datos preexistentes de otro despliegue.
- Parada: revocar visor primero, agente nuevo ejecuta método del repo, supervisor verifica ausencia de procesos/listeners/contenedores activos y fuerza cleanup de recursos propios si hace falta. Nada de `pkill`, `killall` o `compose down` globales.
- Cierre/expiración/reemplazo de sesión: marcar closing, rechazar nuevas operaciones, cancelar y esperar tareas, revocar grants, detener despliegue, cerrar runtime del chat y solo entonces eliminar workspace/datos. Actualmente se quita del registro antes de cleanup: conservar tombstone durable y tarea de reintento si cleanup falla.
- Reinicio brusco: las conversaciones actuales no se recuperan; no prometer persistencia nueva. Reconciliar primero ámbitos de procesos/puertos por ownership y leases, destruir huérfanos, después `workspaces.reconcile()`. El supervisor nativo corre como proceso de control separado de uvicorn, gestionado por Makefile/systemd según entorno, con socket local privado y peer autorizado; mantiene un lease renovado por mic-sessions y detiene recursos al expirar aunque uvicorn no vuelva. El control no ejecuta comandos recibidos desde la red pública. Si muere también el supervisor, systemd lo reinicia y reconcilia su journal antes de admitir nuevos recursos; en desarrollo, el siguiente dev-start reconcilia y muestra cualquier limpieza pendiente. Un fallo de reconciliación conserva evidencia y bloquea nuevas admisiones que arriesguen colisiones.
- Watchdog ligero cada 15 s y tres fallos consecutivos antes de declarar unhealthy; no llamar al LLM para polling. Recuperación de fallos transitorios sin nueva operación; caída definitiva cambia estado a failed, revoca visor y ofrece limpiar/reintentar.
- Un worker de mic-sessions en esta versión, igual que hoy. No añadir `uvicorn --workers >1` sobre registro en memoria. Interfaces y ownership dejan preparada extracción a worker/cola y persistencia compartida; escalado horizontal requiere migrar también sesiones/eventos/locks, no solo esta feature. No incluir esa migración en este alcance.

## 8. Integración de interfaz

- `WorkspaceHeader`: montar Deploy real; estados Deploy / Starting… / Stop / Stopping… / Retry y cancelar arranque, con disabled/busy accesibles. El botón no ofrece destinos ficticios ni modelo/esfuerzo.
- `SessionWorkspace`: tipo `conversation | changes | application`; añadir pestaña Application al tener despliegue o diagnóstico. Abrir automáticamente tras éxito solo si el usuario no cambió de pestaña durante el arranque. Mantener chat y borrador montados. Mantener iframe al cambiar de tab, ocultándolo y suspendiendo heartbeat de actividad; destruir al parar/cerrar/cambiar generación.
- Componentes pequeños en `components/deploy` y `components/preview`: acciones, progreso, motivo de fallo, servicios, resultado JSON opcional, toolbar recargar, frame y estado de conexión. Sin presentar comandos/puertos internos en el flujo principal.
- `hooks/useDeployment.ts` y `api/deploymentsApi.ts`; reutilizar sessionsFetch/renovación de auth y tratamiento de errores. Tipos separados para estado, payload, resultado, operación, servicio, grant y pestaña.
- Fold Zustand independiente para eventos deployment; incorporar snapshot en session.sync sin producir mensajes de chat ni alterar su modelo. Resolver resultados HTTP/SSE fuera de orden por seq/generation. Cancelar fetch y bootstrap al desmontar o cambiar de sesión.
- Tratar explícitamente expiración de grant, sesión revocada, iframe sin carga, desconexión SSE y app unhealthy. No interpretar `iframe.onload` como readiness. `postMessage`, si se usa para bootstrap, solo con origin/source exactos y nunca para aceptar un resultado de despliegue de la app.

## 9. Archivos y configuración

Modificar: `mic-sessions/src/mic_sessions/features/sessions.py`, `shared/agents.py`, `shared/env.py`, `shared/auth.py` (helper de introspección reutilizable), `shared/workspaces.py`, `main.py`, `pyproject.toml`, `uv.lock`, `.env.example`, `dev.mk`; SPA archivos indicados arriba y tipos/store; `make/ports.mk`, Makefile y compose de desarrollo cuando corresponda; README raíz.

Crear infraestructura transversal `shared/execution.py` y `shared/preview.py`. Añadir scripts de supervisor nativo en `mic-sessions/runtime/`, sin imports de negocio desde shared. Añadir dependencias de WebSocket/SDK MCP solo si faltan, fijando compatibilidad con el SDK existente. Mantener un único paquete mic-sessions, sin nuevo servicio de negocio Java ni tablas de mic-mooi en esta versión.

Variables nuevas: `DEPLOYMENTS_ENABLED`, `DEPLOYMENT_SUPERVISOR_BACKEND`, `DEPLOYMENT_PRIVATE_BIND_HOST`, `DEPLOYMENT_PORT_RANGE_START`, `DEPLOYMENT_PORT_RANGE_END`, `PREVIEW_BASE_DOMAIN`, `PREVIEW_PLATFORM_ORIGIN`, `PREVIEW_TLS_*`, límites `DEPLOYMENT_MAX_*`, `DEPLOYMENT_*_TIMEOUT_SECONDS`, `DEPLOYMENT_LEASE_SECONDS`. Sin valores secretos reales en examples. URLs de control solo privadas. Feature deshabilitada si infraestructura no está configurada, con motivo visible; no ocultar errores de instalación.

Makefile: integrar preflight runtime/gateway/DNS, arranque, estado y parada ordenada, así como cleanup seguro por installationId. `make dev-start`, `dev-stop`, `dev-status`, `dev-clean` y variantes de mic-sessions cubren toda la infraestructura propia. Añadir targets de verificación puntuales cuando haga falta. La aplicación objetivo también se gestiona mediante el mecanismo de su repo, ejecutado dentro del ámbito del despliegue.

## 10. Tareas técnicas ordenadas

Cada tarea debe terminar con verificación propia, checkbox actualizado y consulta de continuación conforme a CLAUDE.md. No marcar completada por estar diseñada. Los bloques de infraestructura se dividen para no ocultar un subsistema entero en una sola tarea.

- [ ] T01 — Cerrar decisiones de enfoque y fijar contratos Pydantic, DTO, enums y política de proveedor sin activar UI. Verificar compatibilidad SDK/modelo y rechazo de configuración externa. Esfuerzo alto.
- [ ] T02 — Crear supervisor nativo por scope/grupo y preflight de herramientas y privacidad de red en Linux/macOS; soporte del método Compose solo cuando el repo lo requiera. Fallar cerrado si no es viable. Esfuerzo muy alto.
- [ ] T03 — Implementar snapshot, identidad/ownership durable, límites y leases del supervisor. Verificar separación de recursos de dos sesiones y preservación de cambios originales. Esfuerzo alto.
- [ ] T04 — Implementar asignación/verificación de puertos, recursos supervisados, readiness y logs acotados. Verificar colisión y recuperación sin tocar otro proceso. Esfuerzo alto.
- [ ] T05 — Añadir perfil SDK de operación aislada con herramientas supervisadas, modelo fijo y salida estructurada. Verificar que todos los lanzamientos usan el supervisor nativo y que el chat conserva su conversación. Esfuerzo alto.
- [ ] T06 — Implementar orquestación de arranque, estado/admisión/idempotencia, resultado verificado, cancelación y rollback. Esfuerzo alto.
- [ ] T07 — Implementar parada agéntica nueva, fallback supervisor, datos de sesión y resultados honestos ante cleanup incompleto. Esfuerzo alto.
- [ ] T08 — Integrar cierre, reaper, startup reconciliation, tombstones, watchdog y leases; corregir orden de limpieza actual. Esfuerzo alto.
- [ ] T09 — Implementar grants, bootstrap/cookies, autorización/revocación y hosts separados del gateway. Esfuerzo alto.
- [ ] T10 — Implementar proxy HTTP/SSE/WebSocket, rutas autorizadas, cookies/redirects y restricciones de iframe. Verificar stack frontend+API+HMR real. Esfuerzo muy alto.
- [ ] T11 — Exponer REST/SSE/snapshot y fold frontend con API/hook/tipos; verificar reconexión y eventos fuera de orden sin afectar chat. Esfuerzo alto.
- [ ] T12 — Sustituir maqueta Deploy e integrar controles, progreso, diagnóstico y pestaña Application responsive/accesible. Esfuerzo medio.
- [ ] T13 — Completar integración Makefile, entorno local/producción, examples y README conciso de setup, incluyendo duración de datos y DNS/TLS. Esfuerzo medio. Los cambios de ejecución imprescindibles de tareas previas se integran allí mismo, no se posponen a T13.
- [ ] T14 — Validación integrada de aceptación y revisión de acceso/limpieza; registrar evidencias y limitaciones reales en este plan. Esfuerzo alto.

## 11. Verificación y criterios de aceptación

Sin añadir tests al código fuente. Usar comprobaciones estáticas y harness temporales fuera del repo; fixtures efímeros con procesos/servicios reales. SDK real para aceptación final de proveedor; dobles temporales solo para inyectar fallos deterministas y nunca como prueba de integración real. Registrar comandos/resultados saneados aquí. No navegador sin `--browser-tests`; si hace falta validación visual/compatibilidad de cookies, señalarla como pendiente, no inventar resultados.

1. SPA typecheck/build; Python compilación/imports y validación Pydantic/JSON Schema; Makefile preflight/status. Comandos de arranque/parada siempre vía Makefile.
2. Repositorio SPA simple; repo frontend+API+Postgres/Redis por Makefile/Compose; repo no web; repo sin secretos necesarios; repo con varios frontends (elegir documentado o fallo accionable por ambigüedad).
3. Dos sesiones y dos usuarios simultáneos con puertos preferidos iguales. Choque real al bind, no solo mock. DB/cache sin exposición pública; intento de bind wildcard es rechazado/detectado y revertido; la política de red previa impide acceso externo incluso durante el arranque. Comprobar desde un cliente externo al servidor, no solo desde loopback.
4. Pregunta en chat, deploy, stop y pregunta posterior: mismo runtime/transcript del chat, ningún prompt o mensaje operativo mezclado, modelo/effort originales intactos. Historial de deploy ausente en stop; manifiesto operacional presente.
5. Modelo fijo aunque el usuario cambie modelo/esfuerzo del chat o env de catálogo; indisponibilidad del modelo explícita. Cambiar de proveedor sin adapter operativo devuelve unsupported, no usa otro proveedor silenciosamente.
6. JSON inválido, éxito falso con app caída, dependencia sin readiness, agotamiento de cuota, timeout y cancelación producen resultado consistente y limpieza comprobada.
7. Doble clic, reintento de red, start/stop concurrentes, cierre mientras arranca y resultado SDK tardío no duplican recursos ni reviven una generación cerrada.
8. Proxy sirve assets de raíz, rutas profundas, API, redirects autorizados, cookies propias, streaming/SSE y WebSocket/HMR. No depende de puertos localhost del navegador del usuario.
9. Sin grant, otro usuario, ticket repetido/caducado, Host manipulado, URL upstream arbitraria, path encoding y sid revocado son rechazados antes de upstream. Ningún JWT/PAT/ticket en logs, URL o app. El origen de la app no accede a almacenamiento/API autenticada de Mooi.
10. Stop normal, proveedor caído durante stop, proceso daemonizado, cierre, idle reaper, shutdown y muerte brusca: recursos propios detenidos, conexiones cerradas, puertos liberados y workspace eliminado solo cuando sea seguro. Recursos ajenos intactos. Fallo de cleanup permanece rastreable/reintentable.
11. Refresh/replay con historial truncado reconstruye despliegue desde sync. Cambiar de pestaña conserva borrador/chat/preview; cambio de generación elimina cookies/grants/iframe previos. Verificación de comportamiento visual queda pendiente sin autorización de navegador.
12. No declarar feature terminada hasta que privacidad, integración real y limpieza tengan evidencias. Limitaciones de repositorios incompatibles o infraestructura faltante se reflejan como fallos soportados, no éxito parcial.

## 12. Fuentes verificadas durante planificación

- Código local y SDK instalado: `claude-agent-sdk==0.2.152` soporta options de esfuerzo/salida estructurada y resultado estructurado.
- Modelo y esfuerzo: https://platform.claude.com/docs/en/models/sonnet-5/overview — ID `claude-sonnet-5`, esfuerzo `high` soportado. No demuestra acceso de la cuenta del usuario.
- SDK estructurado: https://code.claude.com/docs/en/agent-sdk/structured-outputs — contrato JSON Schema en Agent SDK; no confundir con nombres de campos de Messages API.

Evidencias de implementación: ninguna; esta entrega solo crea el plan.
