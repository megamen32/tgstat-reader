import {spawn} from 'node:child_process';

export async function startChromeMcp({node, mcpBin, timeoutMs=60000}) {
  if (!node || !mcpBin) throw new Error('Provide installed Node and official chrome-devtools-mcp binary paths');
  const child=spawn(node,['--max-old-space-size=256',mcpBin,'--autoConnect','--no-usage-statistics','--redactNetworkHeaders'],{stdio:['pipe','pipe','pipe']});
  let seq=0,buffer='',queue=Promise.resolve();
  const pending=new Map();
  const failAll=e=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(e);}pending.clear();};
  child.on('error',failAll);
  child.on('exit',code=>failAll(new Error(`Chrome MCP exited: ${code}`)));
  child.stderr.on('data',()=>{});
  child.stdout.on('data',b=>{
    buffer+=b.toString();
    if(buffer.length>16*1024*1024){failAll(new Error('MCP response limit exceeded'));child.kill();return;}
    const lines=buffer.split('\n');buffer=lines.pop();
    for(const line of lines){
      let j;try{j=JSON.parse(line);}catch{continue;}
      const p=pending.get(j.id);if(!p)continue;
      pending.delete(j.id);clearTimeout(p.timer);
      j.error?p.reject(new Error(j.error.message||'MCP error')):p.resolve(j.result);
    }
  });
  const rpc=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${method} timed out; no automatic reconnect`));child.kill();},timeoutMs);
    pending.set(id,{resolve,reject,timer});
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
  });
  try {
    await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'tgstat-channel-analysis',version:'1.0'}});
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  } catch(e) {child.kill();throw e;}
  return {
    call(name,args={}){const next=queue.then(()=>rpc('tools/call',{name,arguments:args}));queue=next.catch(()=>{});return next;},
    async close(){failAll(new Error('Client closed'));child.stdin.end();if(child.exitCode===null)child.kill();}
  };
}
