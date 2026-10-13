// Read-only website panels. Load this alongside collect.js for mode="full".
async function tgstatCollectPanels({channels, startDate, endDate, tableDate='', maxTablePages=2, deadlineMs=120000}) {
  if(location.hostname!=='tgstat.ru')throw Error('Run inside TGStat');
  if(!Array.isArray(channels)||!channels.length||channels.some(c=>!/^\w+$/.test(c)))throw Error('Supply channel usernames without @');
  if(!Number.isInteger(maxTablePages)||maxTablePages<1||maxTablePages>40)throw Error('maxTablePages must be 1..40');
  if(tableDate&&!/^\d{4}-\d{2}-\d{2}$/.test(tableDate))throw Error('tableDate must match a date option shown by the website');
  const started=Date.now(),result={mode:'site',startedAt:new Date().toISOString(),channels:[],errors:[]};
  const check=()=>{if(Date.now()-started>=deadlineMs)throw Error('Collection deadline reached; retain checkpoint');};
  const dom=html=>new DOMParser().parseFromString(html,'text/html');
  const cleanText=html=>{const d=dom(html);d.querySelectorAll('script,style,form,nav,footer').forEach(e=>e.remove());return d.body.textContent.replace(/\s+/g,' ').trim();};
  const restriction=j=>cleanText(j.html||'').split('Узнать про преимущества')[0].slice(0,700)||`TGStat status ${j.status}`;
  const request=async(path,params)=>{
    check();const token=document.querySelector('meta[name=csrf-token]')?.content;if(!token)throw Error('Missing CSRF meta; verify login');
    const body=new URLSearchParams({_tgstat_csrk:token});
    for(const [k,v] of Object.entries(params))for(const value of Array.isArray(v)?v:[v])body.append(k,String(value));
    const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body,signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();
  };
  const chartDefs=[
    ['er','er-chart',{}],['err','err-chart',{}],['citation_index','citation-index-chart',{}],
    ['mentions_and_reposts','quotes-chart',{}],['publication_counts','posts-count-chart',{}],
    ['mean_shares','engagements-chart',{type:'forwards'}],['mean_comments','engagements-chart',{type:'comments'}],['mean_reactions','engagements-chart',{type:'reactions'}],
    ['advertising_12h','posts-views-adv-chart',{period:'12h'}],['advertising_24h','posts-views-adv-chart',{period:'24h'}],
    ['advertising_48h','posts-views-adv-chart',{period:'48h'}],['advertising_72h','posts-views-adv-chart',{period:'72h'}]
  ];
  const tableDefs=[
    ['top_posts','posts-popular-table',{date:tableDate,view:'list',sort:'views'}],
    ['hourly_post_views','posts-views-analyze/list',{date:tableDate,page:1,offset:0}],
    ['advertising_efficiency','ads-efficiency/list',{channelName:'',page:1,offset:0}],
    ['subscriber_attraction','members-attraction-list',{page:1,offset:0}],
    ['citations',null,{'source[]':['channel'],'type[]':['channel','post'],q:'',p_count:50,page:0,offset:0}]
  ];
  const readRows=html=>{
    // API responses contain bare <tr> fragments; parsing them as a body drops cells.
    const fragment=/<tr[\s>]/i.test(html)?`<table><tbody>${html}</tbody></table>`:html;
    const d=dom(fragment);d.querySelectorAll('script,style,form,input').forEach(e=>e.remove());
    const els=[...d.querySelectorAll('tr')];
    const entries=els.length?els:[...d.querySelectorAll('li.js-post-action')];
    const rows=entries.map(e=>({text:e.textContent.replace(/\s+/g,' ').trim(),
      cells:[...e.querySelectorAll('td')].map(c=>c.textContent.replace(/\s+/g,' ').trim()),
      links:[...e.querySelectorAll('a[href]')].map(a=>({label:a.textContent.trim(),url:new URL(a.getAttribute('href'),location.origin).href})).filter(a=>/^https:\/\/(?:tgstat\.ru|t\.me)\//.test(a.url))
    }));
    return {rows,text:rows.length?'':cleanText(html).slice(0,12000)};
  };
  for(const channel of channels){
    const out={channel,series:{},seriesKinds:{},tables:{},panels:{},states:{}};result.channels.push(out);
    const prefix=`/channel/@${channel}/stat/`;
    for(const [key,path,params] of chartDefs){
      try {
        const j=await request(prefix+path,{interval:'year',group:'day',startTs:startDate?Date.parse(startDate+'T00:00:00Z'):'',endTs:endDate?Date.parse(endDate+'T00:00:00Z')-1:'',...params});
        if(j.status!=='ok'){out.states[key]={status:j.status,reason:restriction(j)};continue;}
        if(!Array.isArray(j.chartData))throw Error('Missing chartData');out.series[key]=j.chartData;
        out.seriesKinds[key]=['mentions_and_reposts','publication_counts'].includes(key)?'daily_count':'snapshot';
        out.states[key]={status:'ok',endpoint:prefix+path};
      }catch(e){out.states[key]={status:'error',reason:String(e)};result.errors.push({channel,section:key,error:String(e)});}
      if(Date.now()-started>=deadlineMs)break;
    }
    for(const [key,path,initial] of tableDefs){
      if(Date.now()-started>=deadlineMs)break;
      const endpoint=path?prefix+path:`/quotes/@${channel}/list-params`;
      const table={pages:[],requestedDate:initial.date??null,complete:false};out.tables[key]=table;
      let params={...initial},seen=new Set();
      try {
        for(let n=0;n<maxTablePages;n++){
          const cursor=`${params.page}:${params.offset}`;if(seen.has(cursor))throw Error('Repeated pagination cursor');seen.add(cursor);
          const j=await request(endpoint,params);
          if(j.status!=='ok'){out.states[key]={status:j.status,reason:restriction(j)};break;}
          if(typeof j.html!=='string')throw Error('Missing table HTML');
          const parsed=readRows(j.html);
          table.pages.push({page:params.page??null,offset:params.offset??null,...parsed,postCharts:j.postsCharts??null});
          table.hasMore=Boolean(j.hasMore);out.states[key]={status:'ok',endpoint};
          if(!j.hasMore){table.complete=true;break;}
          if(j.nextPage===undefined||j.nextOffset===undefined)throw Error('Missing next cursor');
          params={...params,page:j.nextPage,offset:j.nextOffset};
        }
        if(table.hasMore&&!table.complete)table.limitReason='page_budget';
      }catch(e){out.states[key]={status:'error',reason:String(e)};result.errors.push({channel,section:key,error:String(e)});}
    }
    for(const page of ['', 'citation-index','posts-chart','audience','invite-links']){
      if(Date.now()-started>=deadlineMs)break;
      const key=page||'summary';
      try {
        check();const r=await fetch(page?prefix+page:prefix.slice(0,-1),{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`HTTP ${r.status}`);
        const d=dom(await r.text());d.querySelectorAll('script,style,form,nav,footer,#sticky-left-column').forEach(e=>e.remove());
        const text=(d.querySelector('#sticky-center-column')||d.body).textContent.replace(/\s+/g,' ').trim();
        const gate=text.match(/(?:необходимо авторизоваться|только подтвержденному[^.]{0,180}владельцу[^.]{0,200})/i);
        out.states[key]={status:gate?'restricted':'ok',url:page?prefix+page:prefix.slice(0,-1),reason:gate?.[0]};
        out.panels[key]={text:gate?'':text.slice(0,24000),readOnly:true};
      }catch(e){out.states[key]={status:'error',reason:String(e)};result.errors.push({channel,section:key,error:String(e)});}
    }
    if(Date.now()-started>=deadlineMs){result.errors.push({channel,error:'Collection deadline reached; remaining sections/channels not collected'});break;}
  }
  result.finishedAt=new Date().toISOString();return result;
}
