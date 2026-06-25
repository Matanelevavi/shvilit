import React from 'react';
import { View, StyleSheet } from 'react-native';

export function VideoPlayer({ uri }: { uri: string }) {
  return (
    <View style={styles.wrap}>
      {React.createElement('video', {
        src: uri,
        controls: true,
        autoPlay: true,
        playsInline: true,
        style: {
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          borderRadius: 14,
          display: 'block',
        },
      } as any)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 14, overflow: 'hidden' },
});
