# Case study figure sources

The Mermaid sources of the diagrams shown in the case study panels (図), one folder per project id. The live
figures are stored in `projects.media` and rendered by the admin (ADR-0014); these files are the editable
originals, kept here so a diagram can be reviewed in a pull request and pasted back into the admin.

| Project | Figure | Source | Category |
|---|---|---|---|
| siteplus | architecture | [siteplus/architecture.mmd](siteplus/architecture.mmd) | Architecture 構 |
| siteplus | data-model | [siteplus/erd.mmd](siteplus/erd.mmd) | Data model 表 |
| siteplus | survey-flow | [siteplus/flow.mmd](siteplus/flow.mmd) | Flow 流 |
| koi-portfolio | runtime | [koi-portfolio/runtime.mmd](koi-portfolio/runtime.mmd) | Architecture 構 |

Captions, notes and alt text (EN/JA/VI) are in each folder's `captions.md`.

To change a diagram: edit the `.mmd` file here, then paste it into the figure's Mermaid field in the admin
(Projects → the project → Figures) and save. The admin renders the light and dark SVGs, uploads them and checks
them on the server. Screenshots have no source here; they live only in Storage.

SitePlus diagrams were redrawn from the code (the original design documents were lost). The Koi runtime diagram is
the README diagram drawn top to bottom so it reads at panel width.
