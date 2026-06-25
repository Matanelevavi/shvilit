import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet } from 'react-native';

export function VideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; p.play(); });
  return (
    <VideoView
      player={player}
      style={styles.video}
      nativeControls
      allowsFullscreen
      contentFit="contain"
    />
  );
}

const styles = StyleSheet.create({
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 14, overflow: 'hidden' },
});
