async function tgstatCollect({channels, mode='views', startDate, endDate, tableDate='', maxPages=40, maxTablePages=2, deadlineMs=120000}) {
  if(location.hostname!=='tgstat.ru')throw Error('Run inside the TGStat page');
  if(!Array.isArray(channels)||!channels.length||channels.some(c=>!/^\w+$/.test(c)))throw Error('Supply channel usernames without @');
  const started=Date.now(),result={startedAt:new Date().toISOString(),mode,channels:[],errors:[]};
  const check=()=>{if(Date.now()-started>=deadlineMs)throw Error('Collection deadline reached; retain checkpoint');};
  const post=async(channel,path,params)=>{
    check();const token=document.querySelector('meta[name=csrf-token]')?.content;if(!token)throw Error('Missing CSRF meta');
    const r=await fetch(`/channel/@${channel}/stat/${path}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams({_tgstat_csrk:token,...params}),signal:AbortSignal.timeout(15000)});
    if(!r.ok)throw Error(`HTTP ${r.status}`);const j=await r.json();if(j.status!=='ok')throw Error(`TGStat status ${j.status}`);return j;
  };
  for(const channel of channels){
    const out={channel,series:{},pages:[]};result.channels.push(out);
    try {
      if(mode==='views'){
        for(const path of ['posts-views-avg-chart','posts-views-chart','posts-views-adv-chart']){
          const j=await post(channel,path,{interval:'year',group:'day',period:'24h',startTs:'',endTs:''});
          if(!Array.isArray(j.chartData))throw Error('Missing chartData');out.series[path]=j.chartData;
        }
      }else if(mode==='subscribers'){
        let page=0,offset=0,finished=false;const seen=new Set();
        for(let n=0;n<maxPages;n++){
          const cursor=`${page}:${offset}`;if(seen.has(cursor))throw Error('Repeated pagination cursor');seen.add(cursor);
          const j=await post(channel,'subscribers-days',{page,offset});
          const d=new DOMParser().parseFromString(j.htmlHourly||'','text/html');
          const rows=[...d.querySelectorAll('.views-statistics-hours > div')].map(e=>{
            const cell=e.querySelector('.text-right'),span=cell?.querySelector('span');
            const deltaText=cell?.textContent.trim(),sizeText=span?.getAttribute('data-original-title');
            if(!/^scrollNav-\d{10}$/.test(e.id)||!deltaText||sizeText===null||sizeText===undefined)throw Error('Hourly row schema changed');
            const delta=Number(deltaText),size=Number(sizeText);if(!Number.isFinite(delta)||!Number.isFinite(size))throw Error('Non-numeric hourly row');
            return {id:e.id,delta,size};
          });
          if(!rows.length)throw Error('No hourly rows');out.pages.push({page,offset,rows});
          const oldest=rows.map(r=>'20'+r.id.slice(10,12)+'-'+r.id.slice(12,14)+'-'+r.id.slice(14,16)).sort()[0];
          if(!j.hasMore||(startDate&&oldest<startDate)){finished=true;break;}
          page=j.nextPage;offset=j.nextOffset;
        }
        if(!finished)throw Error('Page budget exhausted before coverage boundary');
      }else if(mode==='full'){
        if(typeof tgstatCollectPanels!=='function')throw Error('Load scripts/site-panels.js alongside collect.js for full analytics');
        for(const childMode of ['views','subscribers']){
          check();const child=await tgstatCollect({channels:[channel],mode:childMode,startDate,maxPages,deadlineMs:deadlineMs-(Date.now()-started)});
          Object.assign(out.series,child.channels[0]?.series||{});out.pages.push(...(child.channels[0]?.pages||[]));
          result.errors.push(...child.errors.map(e=>({...e,mode:childMode})));
        }
        check();const extra=await tgstatCollectPanels({channels:[channel],startDate,endDate,tableDate,maxTablePages,deadlineMs:deadlineMs-(Date.now()-started)});
        const panel=extra.channels[0];if(panel){Object.assign(out.series,panel.series);out.seriesKinds=panel.seriesKinds;out.tables=panel.tables;out.panels=panel.panels;out.states=panel.states;}
        result.errors.push(...extra.errors);
      }else throw Error('mode must be views, subscribers or full');
    }catch(e){result.errors.push({channel,error:String(e)});if(Date.now()-started>=deadlineMs)break;}
  }
  result.finishedAt=new Date().toISOString();return result;
}
