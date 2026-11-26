# Calidad del Aire en la Ciudad de México (RAMA 2015–2023) — Equipo 2

Tablero analítico web interactivo desarrollado para el proyecto final de la asignatura **Análisis y Visualización de Datos (GAD-2401)** del **Tecnológico de Estudios Superiores de Chalco (TecNM / TESCHA)**.

## Integrantes — Equipo 2
- **José Gabriel Juárez Maya** — ETL, modelado de datos, motor estadístico (Spearman/Pearson en DAX y JavaScript) e implementación web.
- **Luis Andrés Nava** — Análisis exploratorio estacional y de atípicos IQR, diseño de visualizaciones, ficha técnica y documentación de límites.

## Pregunta de investigación
> ¿La relación entre ozono ($O_3$) y material particulado fino ($PM_{2.5}$) es monótona, y cómo cambia por estación del año?

## Resultados principales (n = 3,073 días: 2015-01-01 a 2023-05-31)
| Estación del año | n (días) | Spearman (ρ) | Pearson (r) | Diferencia (ρ − r) | Atípicos PM₂.₅ |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Primavera | 828 | +0.4822 | +0.4883 | -0.0061 | 6 |
| Verano | 736 | +0.4149 | +0.4340 | -0.0191 | 0 |
| Otoño | 728 | +0.4271 | +0.3597 | +0.0674 | 5 |
| Invierno | 781 | +0.4475 | +0.3702 | +0.0773 | 40 |
| **Global** | **3,073** | **+0.4630** | **+0.4365** | **+0.0265** | **51** |

- **Límite causal:** Los resultados muestran una asociación monótona positiva moderada, pero **no implican causalidad** entre $O_3$ y $PM_{2.5}$. Variables confusoras meteorológicas (inversión térmica, radiación solar, viento, lluvias) y antropogénicas explican su comportamiento conjunto.

## Estructura del repositorio
```text
├── index.html                  # Tablero interactivo de 4 páginas (rúbrica GAD-2401)
├── styles.css                  # Estilos responsivos de alto contraste
├── app.js                      # Motor estadístico en vivo (Spearman, Pearson, filtros sincronizados y gráficas)
├── data.js                     # Base de datos RAMA preprocesada para ejecución sin backend ni errores CORS
├── data/
│   └── rama_cdmx_2015_2023.csv # Archivo CSV fuente original
└── README.md                   # Documentación del repositorio
```

## Cómo publicarlo en GitHub Pages
1. Crea un repositorio público en GitHub (por ejemplo: `calidad-aire-cdmx-equipo2`).
2. Sube todos los archivos de esta carpeta a la rama `main`.
3. Ve a **Settings → Pages**.
4. En **Build and deployment → Source**, elige **Deploy from a branch**, selecciona `main` y `/ (root)` y haz clic en **Save**.
5. En 1–2 minutos tu tablero estará en vivo en `https://TU_USUARIO.github.io/calidad-aire-cdmx-equipo2/`.

## Fuente de datos
Red Automática de Monitoreo Atmosférico (RAMA), Secretaría del Medio Ambiente de la Ciudad de México — [Datos Abiertos CDMX](https://datos.cdmx.gob.mx/dataset/red-automatica-de-monitoreo-atmosferico).
