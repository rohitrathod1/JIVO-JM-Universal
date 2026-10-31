import { beforeEach,describe,expect,it,vi } from 'vitest'
import { createVoicePort } from './voice'
const mock=vi.hoisted(()=>({deleted:vi.fn(),release:vi.fn(),mode:vi.fn(),size:10}))
vi.mock('expo-audio',()=>({AudioModule:{AudioRecorder:class{uri='file:///cache/recording.m4a';prepareToRecordAsync=vi.fn();record=vi.fn();stop=vi.fn();release=mock.release}},RecordingPresets:{HIGH_QUALITY:{}},requestRecordingPermissionsAsync:async()=>({granted:true}),setAudioModeAsync:mock.mode}))
vi.mock('expo-file-system',()=>({Paths:{cache:{uri:'file:///cache/'}},File:class{exists=true;get size(){return mock.size}delete(){mock.deleted()}}}))
beforeEach(()=>{vi.resetAllMocks();mock.mode.mockResolvedValue(undefined);mock.size=10})
describe('actual native voice adapter cleanup',()=>{
 it('attempts release and audio reset despite deletion failure; retry only unfinished cleanup',async()=>{mock.deleted.mockImplementationOnce(()=>{throw Error('delete')});const port=createVoicePort();await expect(port.dispose()).rejects.toThrow('each attempted');expect(mock.release).toHaveBeenCalledOnce();expect(mock.mode).toHaveBeenCalledWith({allowsRecording:false,shouldPlayInBackground:false});await port.dispose();expect(mock.deleted).toHaveBeenCalledTimes(2);expect(mock.release).toHaveBeenCalledOnce()})
 it('aggregates deletion, release and audio-mode failures independently',async()=>{mock.deleted.mockImplementationOnce(()=>{throw Error('delete')});mock.release.mockImplementationOnce(()=>{throw Error('release')});mock.mode.mockRejectedValueOnce(Error('mode'));const port=createVoicePort();await expect(port.dispose()).rejects.toMatchObject({errors:expect.arrayContaining([expect.any(Error),expect.any(Error),expect.any(Error)])});expect(mock.deleted).toHaveBeenCalledOnce();expect(mock.release).toHaveBeenCalledOnce();expect(mock.mode).toHaveBeenCalledOnce();await port.dispose()})
 it('keeps delivered recording cleanup owned by the returned asset',async()=>{const port=createVoicePort();const file=await port.stop();await port.dispose();expect(mock.deleted).not.toHaveBeenCalled();await file.dispose?.();expect(mock.deleted).toHaveBeenCalledOnce()})
})
