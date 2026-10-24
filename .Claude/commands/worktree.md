---
description: Crea un git worktree en .trees/[nombre] y ejecuta el requerimiento ahí, aislado del código principal
argument-hint: <requerimiento a implementar>
---

Requerimiento: $ARGUMENTS

1. Deduce un nombre corto en kebab-case (2-4 palabras, sin espacios ni acentos) que describa el requerimiento.
2. Desde la raíz del repo, ejecuta: `git worktree add .trees/<nombre>`
   - Si `.trees/<nombre>` o la rama `<nombre>` ya existe, agrega un sufijo (`-2`) y reintenta.
3. Ejecuta TODO el requerimiento dentro de `.trees/<nombre>`:
   - Usa rutas absolutas hacia ese worktree en Read/Edit/Write.
   - Para Bash/PowerShell, usa `git -C .trees/<nombre> ...` o rutas absolutas.
   - NO modifiques archivos del checkout principal.
4. Haz commit de los cambios en la rama del worktree (no hagas push ni merge salvo que se pida).
5. Al terminar, reporta: nombre del worktree, ruta, rama y resumen de cambios.
