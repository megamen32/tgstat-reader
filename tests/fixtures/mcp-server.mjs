import {createInterface} from 'node:readline';
const input=createInterface({input:process.stdin});
input.on('line',line=>{
  const message=JSON.parse(line);
  if(message.id===undefined)return;
  const result=message.method==='initialize'
    ? {protocolVersion:'2024-11-05',capabilities:{},serverInfo:{name:'fixture',version:'1.0'}}
    : {content:[{type:'text',text:message.params.name}]};
  process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,result})+'\n');
});
