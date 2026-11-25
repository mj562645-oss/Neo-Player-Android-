import { Capacitor, registerPlugin } from '@capacitor/core';
export interface NativeAudioStatus { isPlaying: boolean; positionMs: number; durationMs: number; }
export interface NativeAudioPlugin {
 saveAudio(options:{trackId:string;fileName:string;base64:string}):Promise<{uri:string;size:number}>;
 playLocal(options:{uri:string;title:string;artist:string;positionMs?:number}):Promise<void>;
 pause():Promise<void>; seek(options:{positionMs:number}):Promise<void>; stop():Promise<void>; getStatus():Promise<NativeAudioStatus>;
}
const NativeAudio=registerPlugin<NativeAudioPlugin>('NativeAudio');
export const isNativeAudioAvailable=()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android';
export default NativeAudio;
