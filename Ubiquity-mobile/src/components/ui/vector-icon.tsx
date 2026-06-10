import React from 'react';
import { View } from 'react-native';

interface VectorIconProps {
  name: 'home' | 'explore' | 'folder' | 'file' | 'camera' | 'cloud' | 'refresh' | 'upload' | 'delete' | 'back' | 'chevron-right' | 'server';
  color: string;
  size?: number;
}

export function VectorIcon({ name, color, size = 20 }: VectorIconProps) {
  const innerSize = size;
  
  if (name === 'folder') {
    return (
      <View style={{ width: innerSize, height: innerSize * 0.8, justifyContent: 'flex-end' }}>
        {/* Folder tab */}
        <View style={{ width: innerSize * 0.45, height: innerSize * 0.25, backgroundColor: color, borderTopLeftRadius: 3, borderTopRightRadius: 3, marginLeft: 1 }} />
        {/* Folder body */}
        <View style={{ width: innerSize, height: innerSize * 0.65, backgroundColor: color, borderRadius: 4 }} />
      </View>
    );
  }
  
  if (name === 'file') {
    return (
      <View style={{ width: innerSize * 0.75, height: innerSize, borderWidth: 2, borderColor: color, borderRadius: 3, padding: 2, justifyContent: 'space-between' }}>
        <View style={{ height: 2, backgroundColor: color, width: '70%' }} />
        <View style={{ height: 2, backgroundColor: color, width: '50%' }} />
        <View style={{ height: 2, backgroundColor: color, width: '80%' }} />
      </View>
    );
  }

  if (name === 'camera') {
    return (
      <View style={{ width: innerSize * 1.1, height: innerSize, justifyContent: 'center', alignItems: 'center' }}>
        {/* Flash/top element */}
        <View style={{ width: innerSize * 0.3, height: innerSize * 0.15, backgroundColor: color, borderTopLeftRadius: 2, borderTopRightRadius: 2, marginBottom: -1 }} />
        {/* Camera body */}
        <View style={{ width: innerSize * 1.1, height: innerSize * 0.7, backgroundColor: color, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
          {/* Lens */}
          <View style={{ width: innerSize * 0.35, height: innerSize * 0.35, borderRadius: 999, backgroundColor: '#fcfbf8', borderWidth: 2, borderColor: color }} />
        </View>
      </View>
    );
  }

  if (name === 'cloud') {
    return (
      <View style={{ width: innerSize, height: innerSize * 0.8, position: 'relative', justifyContent: 'flex-end', alignItems: 'center' }}>
        {/* Cloud bumps */}
        <View style={{ position: 'absolute', left: innerSize * 0.1, bottom: 0, width: innerSize * 0.5, height: innerSize * 0.5, borderRadius: 999, backgroundColor: color }} />
        <View style={{ position: 'absolute', right: innerSize * 0.1, bottom: 0, width: innerSize * 0.4, height: innerSize * 0.4, borderRadius: 999, backgroundColor: color }} />
        <View style={{ position: 'absolute', left: innerSize * 0.25, top: innerSize * 0.1, width: innerSize * 0.5, height: innerSize * 0.5, borderRadius: 999, backgroundColor: color }} />
        <View style={{ width: innerSize * 0.8, height: innerSize * 0.35, backgroundColor: color, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }} />
      </View>
    );
  }

  if (name === 'refresh') {
    return (
      <View style={{ width: innerSize, height: innerSize, borderWidth: 2, borderColor: color, borderRadius: 999, borderTopColor: 'transparent', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ position: 'absolute', top: -1, right: innerSize * 0.15, width: 0, height: 0, borderStyle: 'solid', borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color, transform: [{ rotate: '45deg' }] }} />
      </View>
    );
  }

  if (name === 'upload') {
    return (
      <View style={{ width: innerSize, height: innerSize, justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ width: innerSize * 0.7, height: 2, backgroundColor: color, marginTop: innerSize - 2 }} />
        <View style={{ position: 'absolute', top: 0, bottom: 4, width: 2, backgroundColor: color, alignItems: 'center' }}>
          <View style={{ position: 'absolute', top: 0, width: 0, height: 0, borderStyle: 'solid', borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color, transform: [{ rotate: '180deg' }] }} />
        </View>
      </View>
    );
  }

  if (name === 'delete') {
    return (
      <View style={{ width: innerSize * 0.8, height: innerSize, justifyContent: 'center', alignItems: 'center' }}>
        {/* Lid */}
        <View style={{ width: innerSize * 0.7, height: 2, backgroundColor: color, marginBottom: 1 }} />
        {/* Bin body */}
        <View style={{ width: innerSize * 0.55, height: innerSize * 0.75, borderWidth: 2, borderColor: color, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderTopWidth: 0, paddingHorizontal: 2, justifyContent: 'space-around', flexDirection: 'row' }}>
          <View style={{ width: 1.5, height: '70%', backgroundColor: color }} />
          <View style={{ width: 1.5, height: '70%', backgroundColor: color }} />
        </View>
      </View>
    );
  }

  if (name === 'back') {
    return (
      <View style={{ width: innerSize, height: innerSize, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: innerSize * 0.5, height: innerSize * 0.5, borderLeftWidth: 3, borderTopWidth: 3, borderColor: color, transform: [{ rotate: '-45deg' }] }} />
      </View>
    );
  }

  if (name === 'chevron-right') {
    return (
      <View style={{ width: innerSize, height: innerSize, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: innerSize * 0.4, height: innerSize * 0.4, borderRightWidth: 3, borderTopWidth: 3, borderColor: color, transform: [{ rotate: '45deg' }] }} />
      </View>
    );
  }

  if (name === 'server') {
    return (
      <View style={{ width: innerSize, height: innerSize, justifyContent: 'space-around', paddingVertical: 1 }}>
        <View style={{ height: innerSize * 0.25, borderWidth: 2, borderColor: color, borderRadius: 2, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
          <View style={{ width: 3, height: 3, borderRadius: 999, backgroundColor: color }} />
        </View>
        <View style={{ height: innerSize * 0.25, borderWidth: 2, borderColor: color, borderRadius: 2, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
          <View style={{ width: 3, height: 3, borderRadius: 999, backgroundColor: color }} />
        </View>
        <View style={{ height: innerSize * 0.25, borderWidth: 2, borderColor: color, borderRadius: 2, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
          <View style={{ width: 3, height: 3, borderRadius: 999, backgroundColor: color }} />
        </View>
      </View>
    );
  }

  // Fallback to simple circle
  return (
    <View style={{ width: innerSize, height: innerSize, borderRadius: size / 2, backgroundColor: color }} />
  );
}
