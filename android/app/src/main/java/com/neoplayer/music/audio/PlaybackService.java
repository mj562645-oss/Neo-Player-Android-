package com.neoplayer.music.audio;

import android.content.Intent;
import android.net.Uri;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/** Native local-file playback. YouTube remains in its official embedded player. */
public class PlaybackService extends MediaSessionService {
    public static final String ACTION_PLAY="com.neoplayer.music.PLAY_LOCAL";
    public static final String ACTION_PAUSE="com.neoplayer.music.PAUSE";
    public static final String ACTION_SEEK="com.neoplayer.music.SEEK";
    public static final String ACTION_STOP="com.neoplayer.music.STOP";
    public static volatile boolean playing=false;
    public static volatile long positionMs=0;
    public static volatile long durationMs=0;
    public static volatile ExoPlayer activePlayer;
    private ExoPlayer player;
    private MediaSession session;
    @Override public void onCreate(){ super.onCreate();
        player=new ExoPlayer.Builder(this).build();
        AudioAttributes audioAttributes=new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build();
        player.setAudioAttributes(audioAttributes,true);
        player.setHandleAudioBecomingNoisy(true);
        activePlayer=player;
        player.addListener(new Player.Listener(){
            @Override public void onIsPlayingChanged(boolean value){ playing=value; }
            @Override public void onPlaybackStateChanged(int state){ durationMs=Math.max(0,player.getDuration()); }
        });
        session=new MediaSession.Builder(this,player).build();
    }
    @Nullable @Override public MediaSession onGetSession(MediaSession.ControllerInfo info){ return session; }
    @Override public int onStartCommand(@Nullable Intent intent,int flags,int startId){
        if(intent!=null){ String action=intent.getAction();
            if(ACTION_PLAY.equals(action)){
                String raw=intent.getStringExtra("uri");
                if(raw!=null){
                    MediaMetadata metadata=new MediaMetadata.Builder().setTitle(intent.getStringExtra("title")).setArtist(intent.getStringExtra("artist")).build();
                    MediaItem item=new MediaItem.Builder().setUri(Uri.parse(raw)).setMediaMetadata(metadata).build();
                    player.setMediaItem(item); player.prepare(); player.seekTo(Math.max(0,intent.getLongExtra("positionMs",0))); player.play();
                }
            } else if(ACTION_PAUSE.equals(action)) player.pause();
            else if(ACTION_SEEK.equals(action)) player.seekTo(Math.max(0,intent.getLongExtra("positionMs",0)));
            else if(ACTION_STOP.equals(action)){ player.stop(); stopSelf(); }
        }
        return super.onStartCommand(intent,flags,startId);
    }
    @Override public void onTaskRemoved(Intent rootIntent){ if(player==null || !player.isPlaying()) stopSelf(); }
    @Override public void onDestroy(){ playing=false; if(session!=null){session.release();session=null;} if(player!=null){player.release();player=null;} activePlayer=null; super.onDestroy(); }
}
