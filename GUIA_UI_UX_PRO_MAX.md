# Guía ui-ux-pro-max (proyecto-torneos)

Skill instalado en `.opencode/skills/` (paquete `ui-ux-pro-max`, + `brand`,
`banner-design`, `design`, `design-system`, `slides`, `ui-styling`).
Se activa solo cuando pides trabajo UI; para forzarlo di
**"usa ui-ux-pro-max"**.

> El skill recomienda; **AGENTS.md + S12 mandan**. No instales
> Phosphor/Heroicons (el proyecto usa `lucide-react`), no inventes
> paleta (tokens Cypher en `globals.css`), sin estilos inline,
> `BottomNav` intocable, toast abajo, `es-CO`.

## Comandos (en Windows usa `python`, no `python3`)

```bash
# Sistema de diseño completo para una página nueva
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<producto> <industria> <claves>" --design-system -p "Nombre"

# Detalle por dominio
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<claves>" --domain <dominio> [-n 5]

# Guía del stack (este proyecto: nextjs)
python .opencode/skills/ui-ux-pro-max/scripts/search.py "<claves>" --stack nextjs
```

Dominios: `product` `style` `color` `typography` `landing` `chart` `ux`
`react` `web` `icons` `google-fonts` `gsap`.

## Receta por caso

| Caso | Comando |
|---|---|
| Pantalla nueva | `--design-system -p "..."` y pide que lo aplique sobre Cypher |
| Componente / bug puntual | `--domain` enfocado (uno por búsqueda, 2-5 términos) |
| Tablas châu / dashboard | `--domain chart` + `--density 8` |
| Accesibilidad | primero `--domain ux` ("error summary validation"), luego stack |
| Iconos | `--domain icons` solo como idea; implementa con `lucide-react` |

Diales opcionales: `--variance 1-10 --motion 1-10 --density 1-10`.
Salida markdown: `-f markdown`. Guardar sistema: `--persist --output-dir .`
→ `design-system/<slug>/MASTER.md` (+ `pages/<pag>.md` por override).

## Pre-entrega (resumen del skill, adaptado)

- Sin emojis como iconos; targets táctiles ≥44px; contraste texto ≥4.5:1.
- Probar 375px + zoom + `prefers-reduced-motion`; nada oculto tras barras fijas.
- Foco visible; color nunca como único indicador; errores de formulario inline.

## Mantenimiento

```bash
uipro update                 # refrescar skill
uipro init --dry-run         # previsualizar sin escribir
uipro uninstall --ai opencode
```
