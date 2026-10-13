# TGStat analytics expansion map

Documentation reviewed: 2026-10-13. This is a discovery map, not a claim that all adapters are implemented or that the current account has access to every method.

## Two access routes

The existing collector reads website endpoints inside the user's Chrome session. The documented API at `https://api.tgstat.ru/` is a separate service requiring its own token and API plan. Website login/Premium does not prove API entitlement. Never purchase a plan, register callbacks or publish an endpoint as part of read-only discovery.

[Official overview and access model](https://api.tgstat.ru/docs/ru/start/intro.html). FREE API Stat is described as limited to at most two owned channels; arbitrary channels require a paid API plan. Check current quotas before collection.

## Small, useful additions

| Analytics | Documented read endpoint | Data and implementation implications |
| --- | --- | --- |
| Full channel snapshot | [channels/stat](https://api.tgstat.ru/docs/ru/channels/stat.html) | ER, ERR, ERR24, citation index, mentions, forwards, mentioning-channel count, post count, advertising reach 12/24/48h |
| Metadata and discovery | [channels/get](https://api.tgstat.ru/docs/ru/channels/get.html), [channels/search](https://api.tgstat.ru/docs/ru/channels/search.html) | Category, language, country, creation date, verification, source restriction labels; channel search |
| Engagement history | [channels/er](https://api.tgstat.ru/docs/ru/channels/er.html), [channels/err](https://api.tgstat.ru/docs/ru/channels/err.html), [channels/err24](https://api.tgstat.ru/docs/ru/channels/err24.html) | Day/week/month; S and higher. Weekly/monthly values are end-of-period snapshots, not sums or period averages |
| Content inventory | [channels/posts](https://api.tgstat.ru/docs/ru/channels/posts.html) | Post dates, text, media, views, forward/deletion flags. Derive posting frequency and top posts only from adequately covered inventory |
| Individual post analytics | [posts/stat](https://api.tgstat.ru/docs/ru/posts/stat.html) | Views, shares, comments, reactions, forwards, mentions; view-growth history for the first 15 days |
| Distribution network | [channels/mentions](https://api.tgstat.ru/docs/ru/channels/mentions.html), [channels/forwards](https://api.tgstat.ru/docs/ru/channels/forwards.html) | Date-filtered lists, 50 items per request, offset, extended source-channel objects; source rankings and repeat cross-promotion |
| Batch post counters | [posts/stat-multi](https://api.tgstat.ru/docs/ru/posts/stat-multi.html) | Up to 50 post IDs; documented as XL-only. Do not assume bulk access on smaller plans |

`channels/posts` uses `startTime`/`endTime` and max offset 1000, whereas many history methods use `startDate`/`endDate`. Do not reuse parameter names blindly. If a six-month inventory exceeds the offset ceiling, split by non-overlapping time windows, deduplicate by post ID, and retain coverage evidence. Shared-post counters include forwards into personal messages; forwards into other channels are a separate measure.

## Further useful blocks

- Stories: [channels/stories](https://api.tgstat.ru/docs/ru/channels/stories.html), [stories/stat](https://api.tgstat.ru/docs/ru/stories/stat.html), [stories/stat-multi](https://api.tgstat.ru/docs/ru/stories/stat-multi.html). Views, reactions, forwards and hourly growth. Check plan restrictions for bulk requests.
- Topic/brand monitoring: [posts/search](https://api.tgstat.ru/docs/ru/posts/search.html), [words/mentions-by-period](https://api.tgstat.ru/docs/ru/words/mentions-by-period.html), [words/mentions-by-channels](https://api.tgstat.ru/docs/ru/words/mentions-by-channels.html). API Search entitlement; mentions and reach by period/source. Search defaults to ten days and has pagination limits; set periods explicitly.
- Chats: `channels/stat` exposes DAU/WAU/MAU, day/night online counts and message counts. This is a separate chat mode, not a channel metric.
- Real-time callbacks are documented but mutate remote subscriptions and require a separately requested integration and receiving endpoint; not a quick read-only addition.

## Website panels to inspect after verifying login

Routes after `/channel/@USERNAME/stat/`: `citation-index`, `citation`, `engagements`, `posts-views-analyze`, `ads-efficiency`, `members-attraction`, `invite-links`, `posts-popular`, `posts-chart`; some channels also expose `audience`.

These are page routes, not yet verified data endpoints. In discovery, several returned HTTP 200 with a login-required page. First validate authentication and semantic page content; then record actual XHR URLs, request parameters and response schema through DevTools. Owner-only invitations, audience breakdown or ad attribution may require additional permissions or subscription access. Do not infer those permissions from a public channel page.

Suggested order: (1) snapshot/engagement and advertising reach, (2) posts + post counters + posting cadence, (3) mentions/forwards and source rankings, (4) deeper ad and audience panels where access is available. Derived analyses such as median post views, reaction rate per view, best publication times and growth following mentions must state their sample/window and avoid claiming causal attribution from correlation alone.
