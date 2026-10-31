import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio'
import { File,Paths } from 'expo-file-system'
import type { VoicePort } from './voiceController'
export function createVoicePort():VoicePort{
 // Expo exports a native module value with its constructor declared in AudioModule.types.
 // eslint-disable-next-line import/namespace
 const { AudioRecorder: Recorder }=AudioModule;const recorder=new Recorder(RecordingPresets.HIGH_QUALITY)
 let delivered=false,released=false,removed=false,reset=false;let uri:string|null=null;let cleanup:Promise<void>|null=null
 const dispose=()=>{if(cleanup)return cleanup;cleanup=(async()=>{const errors:unknown[]=[]
  if(!removed){try{if(!delivered){uri??=recorder.uri;if(uri?.startsWith(Paths.cache.uri)){const file=new File(uri);if(file.exists)file.delete()}}removed=true}catch(e){errors.push(e)}}
  if(!released){try{recorder.release();released=true}catch(e){errors.push(e)}}
  if(!reset){try{await setAudioModeAsync({allowsRecording:false,shouldPlayInBackground:false});reset=true}catch(e){errors.push(e)}}
  if(errors.length)throw new AggregateError(errors,'Recording cleanup failed; file deletion, recorder release and audio reset were each attempted.')
 })().finally(()=>{cleanup=null});return cleanup}
 return {permission:async()=> (await requestRecordingPermissionsAsync()).granted,prepare:async()=>{await setAudioModeAsync({allowsRecording:true,shouldPlayInBackground:false});await recorder.prepareToRecordAsync()},record:()=>recorder.record(),stop:async()=>{await recorder.stop();uri=recorder.uri;if(!uri)throw Error('No recording was produced.');const file=new File(uri);const size=file.size;const owned=uri;delivered=true;return{name:'voice-message.m4a',uri:owned,mime:'audio/mp4',size,dispose:()=>{if(owned.startsWith(Paths.cache.uri)&&file.exists)file.delete()}}},dispose}
}
