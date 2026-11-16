# Звідки ці скіли

Офіційні сторонні скіли, скопійовані без змін. Щоб оновити: замінити папку свіжою з того самого шляху в джерелі й оновити таблицю.

| Скіл | Джерело | Версія | Ліцензія |
| --- | --- | --- | --- |
| `vercel-react-best-practices` | https://github.com/vercel-labs/agent-skills, папка `skills/react-best-practices` | коміт `1a2c79d4e6c4` (2026-10-27) | MIT, зазначено в `SKILL.md` |
| `webapp-testing` | https://github.com/anthropics/skills, папка `skills/webapp-testing` | коміт `1780c5e5a552` (2026-11-14) | Apache-2.0, текст у `webapp-testing/LICENSE.txt` |
| `security-review` | https://github.com/getsentry/skills, папка `skills/security-review` | коміт `a582c51ee29d` (2026-11-14) | Apache-2.0, текст у `security-review/LICENSE` |

## Застереження для `webapp-testing`

- Потрібен Python із Playwright: `pip install playwright` і `playwright install chromium`.
- Наскрізні перевірки не створюють бронювань у Grandes Tour без дозволу власника (правило 3 у `CLAUDE.md`): зупинятися перед підтвердженням бронювання або підміняти перевізника.
