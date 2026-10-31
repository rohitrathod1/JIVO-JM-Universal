import {useEffect,useState,useSyncExternalStore} from 'react'
import {SecretCopyController} from '../modules/passwords/copyController'
import {reportCopy} from '../modules/passwords/api'
import {subscribeSensitiveView} from '../shared/sensitiveLifecycle'
import {Button,Label} from '../ui'
export function SecretCopy({value,entryId,field}:{value:string;entryId:string;field:string}){
 const [copy]=useState(()=>new SecretCopyController({write:text=>navigator.clipboard.writeText(text),report:()=>reportCopy(entryId,field)}));const state=useSyncExternalStore(copy.subscribe,copy.snapshot,copy.snapshot)
 useEffect(()=>{const off=subscribeSensitiveView(copy.setActive);return()=>{off();copy.setActive(false)}},[copy]);const available=typeof navigator!=='undefined'&&!!navigator.clipboard?.writeText
 return <><Label>Copying places this value on the system clipboard. Automatic clipboard clearing is unavailable; replace it after use.</Label><Button title={'Copy '+field} disabled={!available||state.busy} onPress={()=>void copy.copy(value)}/>{!!state.notice&&<Label>{state.notice}</Label>}{!available&&<Label>Clipboard writing is unavailable in this browser context.</Label>}</>
}
