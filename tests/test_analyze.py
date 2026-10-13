"""Fast unit checks: data semantics; expected <2s, maximum 10s."""
import datetime as dt
import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('analyzer', ROOT/'skills/tgstat-channel-analysis/scripts/analyze.py')
analyzer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analyzer)


def point(day, value):
    stamp = dt.datetime.fromisoformat(day).replace(tzinfo=dt.timezone.utc)
    return {'x': int(stamp.timestamp()*1000), 'y': value}


class DataSemantics(unittest.TestCase):
    def test_missing_views_are_not_zero_and_end_is_exclusive(self):
        data = {'channels': [{'channel': 'sample_alpha', 'series': {
            'posts-views-chart': [{'data': [point('2026-01-01', 100), point('2026-01-02', None), point('2026-01-03', 999)]}],
            'posts-views-avg-chart': [{'data': [point('2026-01-01', 50), point('2026-01-02', 60)]}]
        }}]}
        out = analyzer.view_report(data, dt.date(2026, 1, 1), dt.date(2026, 1, 3))['channels'][0]
        self.assertEqual(out['last_month_recorded_views'], 100)
        self.assertEqual(out['periods'][0]['missing_dates'], ['2026-01-02'])
        self.assertEqual(out['current_mean_post_reach'], 60)

    def test_duplicate_hourly_rows_and_counter_inconsistency(self):
        rows = [{'id': 'scrollNav-2601010000', 'size': 990, 'delta': -10},
                {'id': 'scrollNav-2601010100', 'size': 995, 'delta': 5},
                {'id': 'scrollNav-2601010200', 'size': 980, 'delta': -10}]
        data = {'rows': [{'channel': 'sample_beta', 'rows': rows}, {'channel': 'sample_beta', 'rows': rows}]}
        out = analyzer.subscriber_report(data, dt.date(2026, 1, 1), dt.date(2026, 1, 2))['channels'][0]
        self.assertEqual(out['periods'][0]['observed_loss'], 20)
        self.assertEqual(out['periods'][0]['hours_recorded'], 3)
        self.assertEqual(out['periods'][0]['base'], 1000)
        self.assertEqual(out['periods'][0]['loss_pct'], 2)
        self.assertEqual(out['size_mismatches'][0]['difference'], -5)

    def test_short_month_boundary(self):
        self.assertEqual(analyzer.add_month(dt.date(2026, 1, 31)), dt.date(2026, 2, 28))
        self.assertEqual(list(analyzer.intervals(dt.date(2026, 1, 13), dt.date(2026, 3, 13))),
                         [(dt.date(2026, 1, 13), dt.date(2026, 2, 13)), (dt.date(2026, 2, 13), dt.date(2026, 3, 13))])

    def test_portable_manifest_and_adapters(self):
        manifest = json.loads((ROOT/'plugin.json').read_text())
        self.assertEqual(manifest['$schema'], 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json')
        self.assertNotIn('skills', manifest)
        for vendor in ['.codex-plugin', '.claude-plugin']:
            adapter = json.loads((ROOT/vendor/'plugin.json').read_text())
            self.assertEqual(adapter['version'], manifest['version'])
            self.assertTrue((ROOT/adapter['skills']).is_dir())

    def test_site_rates_are_not_summed_and_restrictions_survive(self):
        data = {'channels':[{'channel':'sample_alpha','series':{
            'er':[{'name':'ER','data':[point('2026-01-01','2'),point('2026-01-02','4')]}],
            'mentions_and_reposts':[{'name':'Mentions','data':[point('2026-01-01','5'),point('2026-01-02','7')]}]
        },'seriesKinds':{'er':'snapshot','mentions_and_reposts':'daily_count'},
        'states':{'top_posts':{'status':'restricted','reason':'Premium required'}},
        'tables':{'citations':{'complete':False,'hasMore':True,'pages':[]}}}]}
        out = analyzer.site_report(data,dt.date(2026,1,1),dt.date(2026,1,3))['channels'][0]
        self.assertEqual(out['metrics']['er']['series'][0]['periods'][0]['value'],3)
        self.assertEqual(out['metrics']['mentions_and_reposts']['series'][0]['periods'][0]['value'],12)
        self.assertEqual(out['access']['top_posts']['status'],'restricted')
        self.assertFalse(out['tables']['citations']['complete'])

    def test_unavailable_view_series_produces_partial_report(self):
        out=analyzer.view_report({'channels':[{'channel':'sample_beta','series':{}}]},dt.date(2026,1,1),dt.date(2026,2,1))['channels'][0]
        self.assertFalse(out['complete'])
        self.assertNotIn('mean_monthly_recorded_views',out)


if __name__ == '__main__':
    unittest.main()
