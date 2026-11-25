package com.neoplayer.music;

import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.neoplayer.music.audio.PlaybackService;
import java.io.*;

@CapacitorPlugin(name="NativeAudio")
public class NativeAudioPlugin extends Plugin {
 @PluginMethod public void saveAudio(PluginCall call){
  String data=call.getString("base64"), id=call.getString("trackId"), name=call.getString("fileName","audio.bin");
  if(data==null||id==null){call.reject("base64 and trackId are required");return;}
  getBridge().execute(()->{try{
   byte[] bytes=Base64.decode(data,Base64.DEFAULT); File dir=new File(getContext().getFilesDir(),"neoplayer_audio"); if(!dir.exists()&&!dir.mkdirs())throw new IOException("Cannot create audio directory");
   String safe=id.replaceAll("[^A-Za-z0-9_-]","_"); int dot=name.lastIndexOf('.'); String ext=dot>0?name.substring(dot+1).replaceAll("[^A-Za-z0-9]","").toLowerCase():"bin";
   File out=new File(dir,safe+"."+ext), tmp=new File(dir,safe+".tmp"); try(FileOutputStream stream=new FileOutputStream(tmp)){stream.write(bytes);stream.getFD().sync();}
   if(out.exists()&&!out.delete())throw new IOException("Cannot replace existing audio file"); if(!tmp.renameTo(out))throw new IOException("Cannot finalize audio file");
   JSObject result=new JSObject(); result.put("uri",Uri.fromFile(out).toString()); result.put("size",out.length()); call.resolve(result);
  }catch(Exception e){call.reject("Native audio storage failed: "+e.getMessage(),e);}});
 }
 @PluginMethod public void playLocal(PluginCall call){
  String uri=call.getString("uri"); if(uri==null){call.reject("uri required");return;}
  Intent i=new Intent(getContext(),PlaybackService.class).setAction(PlaybackService.ACTION_PLAY).putExtra("uri",uri).putExtra("title",call.getString("title","Unknown title")).putExtra("artist",call.getString("artist","Unknown artist")).putExtra("positionMs",call.getLong("positionMs",0L));
  try{androidx.core.content.ContextCompat.startForegroundService(getContext(),i);call.resolve();}catch(Exception e){call.reject("Could not start playback service: "+e.getMessage(),e);}
 }
 @PluginMethod public void pause(PluginCall call){command(PlaybackService.ACTION_PAUSE,0,call);}
 @PluginMethod public void seek(PluginCall call){command(PlaybackService.ACTION_SEEK,call.getLong("positionMs",0L),call);}
 @PluginMethod public void stop(PluginCall call){command(PlaybackService.ACTION_STOP,0,call);}
 private void command(String action,long pos,PluginCall call){try{Intent i=new Intent(getContext(),PlaybackService.class).setAction(action).putExtra("positionMs",pos);getContext().startService(i);call.resolve();}catch(Exception e){call.reject(e.getMessage(),e);}}
 @PluginMethod public void getStatus(PluginCall call){JSObject o=new JSObject();o.put("isPlaying",PlaybackService.playing);o.put("positionMs",PlaybackService.activePlayer==null?0:Math.max(0,PlaybackService.activePlayer.getCurrentPosition()));o.put("durationMs",PlaybackService.activePlayer==null?0:Math.max(0,PlaybackService.activePlayer.getDuration()));call.resolve(o);}
}
