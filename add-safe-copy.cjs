const fs=require('fs');
fs.writeFileSync('src/modules/passwords/copyController.ts',`export class SecretCopyController {
 private active=true;private generation=0;private pending=false;private listeners=new Set<()=>void>();private state={busy:false,notice:''};
 constructor(private deps:{write:(value:string)=>Promise<void>;report:()=>Promise<unknown>}){}
 snapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}};private set(busy:boolean,notice=''){this.state={busy,notice};this.listeners.forEach(fn=>fn())}
 setActive=(active:boolean)=>{this.active=active;if(!active){this.generation++;this.set(false)}}
 async copy(value:string){if(!this.active||this.pending)return;this.pending=true;const generation=++this.generation;this.set(true);try{await this.deps.write(value);if(!this.active||generation!==this.generation)return;try{await this.deps.report()}catch{if(this.active&&generation===this.generation)this.set(false,'Copied, but the copy audit could not be confirmed. Clipboard is not automatically cleared.');return}if(this.active&&generation===this.generation)this.set(false,'Copied. Clipboard is not automatically cleared; replace it after use.')}catch{if(this.active&&generation===this.generation)this.set(false,'Could not copy. The clipboard may be unavailable or permission was denied.')}finally{this.pending=false}}
}
`);
fs.writeFileSync('src/modules/passwords/copyController.test.ts',`import {describe,it,expect,vi} from 'vitest'
import {SecretCopyController} from './copyController'
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return{promise,resolve}}
describe('explicit secret copy',()=>{
 it('writes only the requested value, reports success and never schedules clearing',async()=>{vi.useFakeTimers();let clipboard='unrelated';const write=vi.fn(async(v:string)=>{clipboard=v}),report=vi.fn(async()=>{});const c=new SecretCopyController({write,report});await c.copy('synthetic');expect(clipboard).toBe('synthetic');clipboard='other app';c.setActive(false);await vi.advanceTimersByTimeAsync(60000);expect(clipboard).toBe('other app');expect(write).toHaveBeenCalledExactlyOnceWith('synthetic');expect(report).toHaveBeenCalledOnce();vi.useRealTimers()})
 it('inactive view cannot start a write',async()=>{const write=vi.fn(),c=new SecretCopyController({write,report:vi.fn()});c.setActive(false);await c.copy('synthetic');expect(write).not.toHaveBeenCalled()})
 it('suppresses repeated clicks and late audit after blur',async()=>{const d=deferred(),write=vi.fn(()=>d.promise),report=vi.fn();const c=new SecretCopyController({write,report});const pending=c.copy('synthetic');await c.copy('duplicate');c.setActive(false);d.resolve();await pending;expect(write).toHaveBeenCalledOnce();expect(report).not.toHaveBeenCalled();expect(c.snapshot()).toEqual({busy:false,notice:''})})
 it('does not claim copy or audit after a write denial',async()=>{const report=vi.fn(),c=new SecretCopyController({write:async()=>{throw Error('denied')},report});await c.copy('synthetic');expect(report).not.toHaveBeenCalled();expect(c.snapshot().notice).toContain('Could not copy')})
 it('distinguishes copied data from an unconfirmed audit',async()=>{const c=new SecretCopyController({write:async()=>{},report:async()=>{throw Error('denied')}});await c.copy('synthetic');expect(c.snapshot().notice).toContain('copy audit could not be confirmed')})
 it('does not publish success after unmount during audit',async()=>{const d=deferred(),c=new SecretCopyController({write:async()=>{},report:()=>d.promise});const p=c.copy('synthetic');await Promise.resolve();c.setActive(false);d.resolve();await p;expect(c.snapshot().notice).toBe('')})
})
`);
fs.writeFileSync('src/components/SecretCopy.tsx',`import {Label} from '../ui'
export function SecretCopy(_props:{value:string;entryId:string;field:string}){return <Label>Native clipboard copying is unavailable pending a validated adapter.</Label>}
`);
fs.writeFileSync('src/components/SecretCopy.web.tsx',`import {useEffect,useState,useSyncExternalStore} from 'react'
import {SecretCopyController} from '../modules/passwords/copyController'
import {reportCopy} from '../modules/passwords/api'
import {subscribeSensitiveView} from '../shared/sensitiveLifecycle'
import {Button,Label} from '../ui'
export function SecretCopy({value,entryId,field}:{value:string;entryId:string;field:string}){
 const [copy]=useState(()=>new SecretCopyController({write:text=>navigator.clipboard.writeText(text),report:()=>reportCopy(entryId,field)}));const state=useSyncExternalStore(copy.subscribe,copy.snapshot,copy.snapshot)
 useEffect(()=>{const off=subscribeSensitiveView(copy.setActive);return()=>{off();copy.setActive(false)}},[copy]);const available=typeof navigator!=='undefined'&&!!navigator.clipboard?.writeText
 return <><Label>Copying places this value on the system clipboard. Automatic clipboard clearing is unavailable; replace it after use.</Label><Button title={'Copy '+field} disabled={!available||state.busy} onPress={()=>void copy.copy(value)}/>{!!state.notice&&<Label>{state.notice}</Label>}{!available&&<Label>Clipboard writing is unavailable in this browser context.</Label>}</>
}
`);
let s=fs.readFileSync('src/components/VaultPanel.tsx','utf8');s="import { SecretCopy } from './SecretCopy'\n"+s;s=s.replace('Math.min(value.expires_in, 60)','Math.min(value.expires_in, 30)').replace('Hidden automatically within 60 seconds','Hidden automatically within 30 seconds').replace('<Button title="Hide secret" onPress={clear} />','<SecretCopy key={entry.id+secret.field+secretGeneration.current} entryId={entry.id} field={secret.field} value={secret.value}/><Button title="Hide secret" onPress={clear} />');s=s.replace('key={entry.id+secret.field+secretGeneration.current}','key={entry.id+secret.field}');fs.writeFileSync('src/components/VaultPanel.tsx',s);
s=fs.readFileSync('capture-interactions.cjs','utf8').replace(' window.credentialMock=',` window.clipboardMock={value:'unrelated synthetic clipboard',writes:[],deny:false};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{if(window.clipboardMock.deny)throw Error('Synthetic denial');window.clipboardMock.value=value;window.clipboardMock.writes.push(value)},readText:async()=>{throw Error('Tests must not read the OS clipboard')}}});\n window.credentialMock=`);fs.writeFileSync('capture-interactions.cjs',s);
s=fs.readFileSync('mocked-ui.cjs','utf8').replace("if (path === '/api/jp/entries/entry/reveal/')", "if (path === '/api/jp/entries/entry/copy-event/') return send({})\n        if (path === '/api/jp/entries/entry/reveal/')");s=s.replace("      assert.equal(await page.evaluate(() => \nJSON.stringify", "      assert.equal(await page.evaluate(() => \nJSON.stringify");const anchor="      await page.getByText('MOCK_REVEAL_ONLY', { exact: true }).waitFor()";s=s.replace(anchor,anchor+`\n      await page.getByRole('button',{name:'Copy password',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.clipboardMock.value)).toBe('MOCK_REVEAL_ONLY');await page.evaluate(()=>window.clipboardMock.value='new unrelated synthetic clipboard');\n`);s=s.replace("      await page.getByText('MOCK_REVEAL_ONLY', { exact: true }).waitFor({ state: 'hidden' })", "      await page.getByText('MOCK_REVEAL_ONLY', { exact: true }).waitFor({ state: 'hidden' });assert.equal(await page.evaluate(()=>window.clipboardMock.value),'new unrelated synthetic clipboard')");fs.writeFileSync('mocked-ui.cjs',s);
