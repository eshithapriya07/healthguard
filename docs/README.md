# HealthGuard — Documentation

Evaluation package for **HealthGuard – Online Health Monitoring & Early Alert System**.

| Document | Description |
|----------|-------------|
| [`function_point_analysis.md`](function_point_analysis.md) | Full Function Point count: EI / EO / EQ / ILF / EIF with DET–FTR justification, UFP = **335**, 14 General System Characteristics (TDI = 45), VAF = **1.10**, Adjusted FP = **368.5**, effort ≈ **13.8 person-months** and its mapping onto the 12-week plan |
| [`uml/`](uml/) | 11 PlantUML sources with rendered **PNG** and **SVG** for every diagram |
| [`../README.md`](../README.md) | Setup, demo credentials, feature list and API reference |

---

## UML diagrams

| # | Diagram | Source | Rendered |
|---|---------|--------|----------|
| 1 | Use Case (4 actors: patient, caregiver, doctor, admin) | [`01-use-case.puml`](uml/01-use-case.puml) | `healthguard-usecase.png/svg` |
| 2 | Class diagram (11 domain classes, attributes, methods, multiplicities) | [`02-class.puml`](uml/02-class.puml) | `healthguard-class.png/svg` |
| 3 | ER diagram (matches `database/schema.sql`, 15 tables) | [`03-er.puml`](uml/03-er.puml) | `healthguard-er.png/svg` |
| 4a | Sequence — login → language selection → dashboard | [`04a-sequence-login.puml`](uml/04a-sequence-login.puml) | `seq-login.png/svg` |
| 4b | Sequence — add reading → validation → store → threshold → alert → notification | [`04b-sequence-reading.puml`](uml/04b-sequence-reading.puml) | `seq-reading.png/svg` |
| 4c | Sequence — chatbot query in Hindi/English | [`04c-sequence-chatbot.puml`](uml/04c-sequence-chatbot.puml) | `seq-chatbot.png/svg` |
| 4d | Sequence — patient shares a report with a caregiver | [`04d-sequence-share.puml`](uml/04d-sequence-share.puml) | `seq-share.png/svg` |
| 5 | Activity — User → UI → Application Logic → Database → Dashboard/Alert/Report | [`05-activity.puml`](uml/05-activity.puml) | `healthguard-activity.png/svg` |
| 6 | State — Alert lifecycle **and** Reminder lifecycle | [`06-state.puml`](uml/06-state.puml) | `healthguard-state-alert.*`, `healthguard-state-reminder.*` |
| 7 | Component — UI, application layer, data layer, notifications, chatbot/AI, translations | [`07-component.puml`](uml/07-component.puml) | `healthguard-component.png/svg` |
| 8 | Deployment — browser, web/app server, MySQL server, external services | [`08-deployment.puml`](uml/08-deployment.puml) | `healthguard-deployment.png/svg` |

### Re-rendering the diagrams

With PlantUML installed:

```bash
plantuml -tsvg -tpng docs/uml/*.puml
```

In a sandbox without Graphviz, PlantUML's built-in layout engine works as well:

```bash
java -jar plantuml.jar -tsvg -Playout=smetana -o "$PWD/docs/uml" docs/uml/*.puml
```

(The diagrams in this repository were rendered with PlantUML 1.2024.7 + Temurin JRE 17;
the JRE, `plantuml.jar` and the font configuration used for rendering live under `tools/`.)

### Conventions used

* Use case and sequence diagrams use the four application roles as actors/participants.
* Bilingual messages (`*_en` / `*_hi`) appear in the sequence and state diagrams because every
  alert, reminder and chatbot reply is stored in both languages.
* Every diagram carries the medical-safety note where the UI shows the disclaimer.
