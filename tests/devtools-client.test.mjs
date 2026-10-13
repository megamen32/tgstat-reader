// Fast unit: missing process global in sandboxed REPL; expected <2s, max 10s.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startChromeMcp} from '../skills/tgstat-channel-analysis/scripts/devtools-client.mjs';

test('MCP adapter works without a global process and serializes calls',{timeout:10000},async()=>{
  const saved=globalThis.process;
  let connecting;
  try {
    globalThis.process=undefined;
    connecting=startChromeMcp({node:saved.execPath,mcpBin:fileURLToPath(new URL('./fixtures/mcp-server.mjs',import.meta.url)),timeoutMs:5000});
  } finally {globalThis.process=saved;}
  const client=await connecting;
  try {
    const results=await Promise.all([client.call('list_pages'),client.call('list_tools')]);
    assert.equal(results[0].content[0].text,'list_pages');
    assert.equal(results[1].content[0].text,'list_tools');
  } finally {await client.close();}
});
