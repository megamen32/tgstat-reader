"""Analyze TGStat numeric exports; output JSON only, preserve missing data."""
import argparse
import calendar
import datetime as dt
import json
import statistics


def add_month(date):
    year, month = date.year + (date.month == 12), date.month % 12 + 1
    return date.replace(year=year, month=month, day=min(date.day, calendar.monthrange(year, month)[1]))


def intervals(start, end):
    while start < end:
        nxt = min(add_month(start), end)
        yield start, nxt
        start = nxt


def view_report(data, start, end):
    output = []
    for channel in data['channels']:
        series = channel['series']
        sums = {dt.datetime.fromtimestamp(p['x']/1000, dt.timezone.utc).date(): p['y']
                for p in series['posts-views-chart'][0]['data']}
        reach = series['posts-views-avg-chart'][0]['data']
        valid_reach = [p for p in reach if p['y'] is not None]
        periods = []
        for a, b in intervals(start, end):
            dates = [a + dt.timedelta(days=n) for n in range((b-a).days)]
            missing = [d.isoformat() for d in dates if sums.get(d) is None]
            periods.append({'start': a.isoformat(), 'end_exclusive': b.isoformat(),
                            'days_expected': len(dates), 'days_recorded': len(dates)-len(missing),
                            'missing_dates': missing,
                            'recorded_views': sum(sums[d] for d in dates if sums.get(d) is not None)})
        latest = max(valid_reach, key=lambda p: p['x'])
        output.append({'channel': channel['channel'], 'current_mean_post_reach': latest['y'],
                       'reach_date': dt.datetime.fromtimestamp(latest['x']/1000, dt.timezone.utc).date().isoformat(),
                       'mean_monthly_recorded_views': statistics.mean(p['recorded_views'] for p in periods),
                       'last_month_recorded_views': periods[-1]['recorded_views'], 'periods': periods})
    return {'kind': 'views', 'errors': data.get('errors', []), 'channels': output,
            'gap_checks': data.get('gapChecks', [])}


def subscriber_report(data, start, end):
    pages = data.get('rows')
    if pages is None:
        pages = [dict(p, channel=c['channel']) for c in data['channels'] for p in c['pages']]
    output = []
    for channel in dict.fromkeys(p['channel'] for p in pages):
        unique = {r['id']: r for p in pages if p['channel'] == channel for r in p['rows']}
        rows = sorted((dt.datetime.strptime(key.removeprefix('scrollNav-'), '%y%m%d%H%M'), r)
                      for key, r in unique.items())
        mismatches = [{'timestamp': t.isoformat(), 'difference': r['size']-r['delta']-prev['size']}
                      for (_, prev), (t, r) in zip(rows, rows[1:])
                      if start <= t.date() < end and r['size']-r['delta'] != prev['size']]
        periods = []
        for a, b in intervals(start, end):
            selected = [(t, r) for t, r in rows if a <= t.date() < b]
            if not selected:
                periods.append({'start': a.isoformat(), 'end_exclusive': b.isoformat(), 'error': 'No data'})
                continue
            base = selected[0][1]['size']-selected[0][1]['delta']
            loss = sum(-r['delta'] for _, r in selected if r['delta'] < 0)
            periods.append({'start': a.isoformat(), 'end_exclusive': b.isoformat(),
                            'hours_recorded': len(selected), 'hours_expected': (b-a).days*24,
                            'first_timestamp': selected[0][0].isoformat(), 'last_timestamp': selected[-1][0].isoformat(),
                            'base': base, 'observed_loss': loss, 'loss_pct': 100*loss/base if base else None,
                            'net_size_change': selected[-1][1]['size']-base})
        good = [p for p in periods if 'observed_loss' in p]
        output.append({'channel': channel, 'current_size': rows[-1][1]['size'],
                       'asof': rows[-1][0].isoformat(), 'size_mismatches': mismatches,
                       'mean_monthly_observed_loss': statistics.mean(p['observed_loss'] for p in good) if len(good)==len(periods) else None,
                       'max_monthly_observed_loss': max(good, key=lambda p: p['observed_loss']) if good else None,
                       'periods': periods})
    return {'kind': 'subscribers', 'errors': data.get('errors', []), 'channels': output}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input')
    parser.add_argument('--start', type=dt.date.fromisoformat, required=True)
    parser.add_argument('--end', type=dt.date.fromisoformat, required=True)
    args = parser.parse_args()
    if args.start >= args.end:
        parser.error('start must be before end')
    with open(args.input, encoding='utf-8') as file:
        data = json.load(file)
    is_views = data.get('mode') == 'views' or (data.get('channels') and 'posts-views-chart' in data['channels'][0].get('series', {}))
    report = view_report(data, args.start, args.end) if is_views else subscriber_report(data, args.start, args.end)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
