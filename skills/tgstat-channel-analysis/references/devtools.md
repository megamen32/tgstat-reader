# Подключение к нужному Chrome

Сначала используй доступные Chrome DevTools tools; через GPTAdmin — `discover`, `schema` для точного target, затем `execute`, проверяя завершение background job. Не печатай полные списки чужих URL: они могут содержать токены.

Если соединение ведёт в служебный профиль, а пользователь прямо запросил свой Chrome, официальный Chrome DevTools MCP поддерживает `--autoConnect`. В Chrome должна быть включена штатная remote debugging. Каждый новый debugging session может требовать пользовательского разрешения в Chrome; не нажимай его вместо пользователя и не создавай повторные подключения, пока согласование ожидается.

Для доступного persistent `node_repl` можно загрузить [../scripts/devtools-client.mjs](../scripts/devtools-client.mjs):

```js
var {pathToFileURL} = await import('node:url');
var {resolve} = await import('node:path');
var {startChromeMcp} = await import(pathToFileURL(resolve(SKILL_DIR, 'scripts/devtools-client.mjs')).href);
var chrome = await startChromeMcp({node: NODE_PATH, mcpBin: INSTALLED_CHROME_DEVTOOLS_MCP_BIN});
var pages = await chrome.call('list_pages');
// Inspect only the TGStat row; select its actual pageId.
await chrome.call('select_page', {pageId: TGSTAT_PAGE_ID, bringToFront:false});
```

`SKILL_DIR` — абсолютный путь к установленной папке этого навыка; `NODE_PATH` и `INSTALLED_CHROME_DEVTOOLS_MCP_BIN` найди в установленном официальном пакете/настройках. Не устанавливай новый пакет без необходимости. Совместимость проверена с Chrome DevTools MCP 1.7.0. Не привязывай навык к домашней папке автора, npm-cache hash или старому PID.

Загрузи исходник `collect.js` через `evaluate_script`: оберни содержимое в функцию, вызывающую `tgstatCollect` с параметрами. Если сбор длительный, держи его в `window` и возвращай только прогресс; полный результат сохраняй в JSON. `evaluate_script.filePath` работает только внутри workspace roots конкретного MCP; если путь недоступен, скачай JSON через `Blob`/`a.download`, затем перемести готовую загрузку в выходную папку. Не считай начало загрузки её завершением.

Закрыть только свой MCP child: `await chrome.close()`. Это не закрывает личный Chrome. Не используй `agent_browser_close` для чужого браузера.

Проверенные POST-запросы используют `Content-Type: application/x-www-form-urlencoded` и `X-Requested-With: XMLHttpRequest`:

| Путь после `/channel/@USERNAME/stat/` | Параметры | Результат |
| --- | --- | --- |
| `subscribers-days` | `page`, `offset`, `_tgstat_csrk` | `html`, `htmlHourly`, `hasMore`, `nextPage`, `nextOffset` |
| `posts-views-avg-chart` | `interval=year`, `group=day`, `startTs`, `endTs`, `_tgstat_csrk` | `chartData[].data`: `x` milliseconds, `y`, `tt` |
| `posts-views-chart` | те же | дневные суммарные просмотры |
| `posts-views-adv-chart` | те же + `period=24h` | рекламный охват за 24 часа |

Детализация дня: GET `posts-views-details?ts=UNIX_SECONDS` с XHR header; JSON содержит `status` и `html`. Даты графиков кодируются полуночью UTC как календарные метки; фильтруй по ISO-дате из timestamp, не сдвигай их на предыдущий день из-за часового пояса среды.
