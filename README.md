# TGStat Reader

An [Agent Plugins 1.0](https://agent-plugins.org/specification) package for reading Telegram channel analytics from TGStat with Chrome DevTools. Includes a reusable Agent Skill, a browser-side API collector, an offline analyzer, and a small official Chrome DevTools MCP client adapter.

**Any channel usernames can be supplied at runtime. There is no built-in channel list.** No account credentials, cookies, personal exports or machine-specific paths are included.

## What it reports

- Current subscriber count and snapshot time.
- Observed audience loss: negative hourly changes, average and maximum monthly loss, and monthly percentages.
- Current average post reach and optional 24-hour advertising reach.
- Total recorded views per month, summed from the daily series.
- Missing dates and inconsistencies between changes and subscriber counts.

Observed hourly loss is not a count of unique unsubscribers: arrivals within the same hour mask departures, and repeat subscriptions can be counted again. Monthly views include views received by older posts during that month and are not unique viewers. The skill preserves these distinctions in its reports.

## Install

Repository: **https://github.com/megamen32/tgstat-reader**

- Agent Plugins 1.0 clients: install this repository or the release ZIP using the client's plugin installer. Root `plugin.json` and `skills/` follow the portable specification.
- Codex and Claude clients with legacy plugin loading: compatibility manifests and single-plugin marketplaces are included under `.codex-plugin/` and `.claude-plugin/`.
- Skill-only clients: copy `skills/tgstat-channel-analysis/` into the client's documented skill directory.

Client support and installer syntax vary; this package does not claim every agent implements Agent Plugins 1.0. It does not automatically install or launch a browser, replace a shared MCP gateway, or register a credential-bearing service.

Prerequisites: an existing Chrome DevTools MCP connection to the intended Chrome profile, access to TGStat, Python 3.9+ for the analyzer, and Node.js if the optional MCP helper is used. Chrome may request consent for a new debugging session. Some TGStat panels may require an authenticated account or a paid plan; the skill does not buy access.

## Use

Ask your agent:

> Use $tgstat-channel-analysis to compare the Telegram channels I provide for the last six months: current audience, monthly observed loss, loss percentages, ordinary views per post, and total monthly views.

Supply channel URLs or usernames and the desired dates. The skill uses the API requests made by TGStat's own panels, inside the authorized same-origin browser session. These are website endpoints, not TGStat's commercial public API; they may change.

The collector takes explicit runtime parameters:

```js
await tgstatCollect({channels: suppliedUsernames, mode: 'views'});
await tgstatCollect({channels: suppliedUsernames, mode: 'subscribers', startDate: requestedStartDate});
```

For offline analysis:

```sh
python3 skills/tgstat-channel-analysis/scripts/analyze.py export.json --start YYYY-MM-DD --end YYYY-MM-DD
```

The end date is exclusive. View collection currently requests one year of daily history; dates outside available coverage are reported as missing. Choose calendar months or consecutive monthly intervals explicitly.

## Validation

```sh
python3 -m unittest discover -s tests -v
node --check skills/tgstat-channel-analysis/scripts/collect.js
node --check skills/tgstat-channel-analysis/scripts/devtools-client.mjs
```

Tests are fast unit checks (expected under 2 seconds, maximum 10 seconds). They detect duplicate subscriber rows, missing-date handling, month boundaries and inconsistent source counters. Release verification has a 180-second total budget; no nightly or unbounded browser suite is needed for this package.

Initial collector behavior was checked against live TGStat panels through the official Chrome DevTools MCP; the published offline tests use synthetic channel names and numbers only.

## License

MIT. This project is independent of TGStat and Telegram.
