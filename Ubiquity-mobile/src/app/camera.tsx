/**
 * Camera screen — full-screen live camera preview with record/photo controls.
 * Uses expo-camera for capture, expo-media-library to save, then
 * offers to upload to the vault server.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { FileSystemUploadType } from 'expo-file-system/legacy';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Alert,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useServerConfig } from '@/hooks/use-server-config';
import { TAB_BAR_HEIGHT } from '@/constants/theme';

// Lazy-import so the app doesn't crash if expo-camera isn't installed yet
let CameraView: any = null;
let useCameraPermissions: any = null;
let useMicrophonePermissions: any = null;
let MediaLibrary: any = null;

try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
  useMicrophonePermissions = cam.useMicrophonePermissions;
} catch {}

try {
  MediaLibrary = require('expo-media-library');
} catch {}

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Record button ─────────────────────────────────────────────────────────────

function RecordBtn({ recording, onPress }: { recording: boolean; onPress: () => void }) {
  const theme = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (recording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [recording]);

  const pressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.92, damping: 20, stiffness: 400, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, damping: 20, stiffness: 400, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }] }}>
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        {/* Outer ring */}
        <View style={[styles.recordRing, { borderColor: 'rgba(255,255,255,0.8)' }]}>
          {/* Inner fill */}
          <View style={[
            styles.recordFill,
            recording
              ? { backgroundColor: '#EF4444', borderRadius: 8, width: 28, height: 28 }
              : { backgroundColor: '#fff', borderRadius: 40 },
          ]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Shutter button (photo) ────────────────────────────────────────────────────

function ShutterBtn({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.88, damping: 20, stiffness: 400, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, damping: 20, stiffness: 400, useNativeDriver: true }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <View style={styles.shutterRing}>
          <View style={styles.shutterFill} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CameraScreen() {
  const theme  = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mode, setMode] = useState<'photo' | 'video'>('video');
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [recording, setRecording] = useState(false);
  const [lastCapture, setLastCapture] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLog, setUploadLog] = useState<string>('');

  const cameraRef = useRef<any>(null);

  const { baseUrl: HOST_URL } = useServerConfig();

  // Permissions
  const [camPermission, requestCamPerm] = useCameraPermissions
    ? useCameraPermissions()
    : [null, async () => {}];

  const [micPermission, requestMicPerm] = useMicrophonePermissions
    ? useMicrophonePermissions()
    : [null, async () => {}];

  const requestAll = useCallback(async () => {
    await requestCamPerm();
    if (requestMicPerm) {
      await requestMicPerm();
    }
    if (MediaLibrary) {
      await MediaLibrary.requestPermissionsAsync();
    }
  }, [requestCamPerm, requestMicPerm]);

  // ── Take photo ──
  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: false });
      setLastCapture(photo.uri);
      if (MediaLibrary) {
        await MediaLibrary.saveToLibraryAsync(photo.uri);
      }
    } catch (e: any) {
      Alert.alert('Photo error', e.message);
    }
  }, []);

  // ── Record video ──
  const toggleRecord = useCallback(async () => {
    if (!cameraRef.current) return;
    if (recording) {
      cameraRef.current.stopRecording();
      setRecording(false);
    } else {
      setRecording(true);
      try {
        const video = await cameraRef.current.recordAsync({ maxDuration: 300 });
        setLastCapture(video.uri);
        if (MediaLibrary) {
          await MediaLibrary.saveToLibraryAsync(video.uri);
        }
      } catch (e: any) {
        // stopRecording resolves this promise normally
      } finally {
        setRecording(false);
      }
    }
  }, [recording]);

  // ── Upload last capture ──
  const uploadCapture = useCallback(async () => {
    if (!lastCapture) return;
    setUploading(true);
    const ext = lastCapture.split('.').pop()?.toLowerCase() ?? 'bin';
    const name = `capture_${Date.now()}.${ext}`;
    try {
      setUploadLog(`Uploading ${name}…`);
      const uploadRes = await FileSystem.uploadAsync(
        `${HOST_URL}/upload`,
        lastCapture,
        {
          headers: {
            'X-File-Name': name,
            'Content-Type': 'application/octet-stream',
          },
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.BINARY_CONTENT,
        }
      );
      const data = JSON.parse(uploadRes.body);
      if (data.success) {
        setUploadLog(`✓ Uploaded to vault as "${name}"`);
        setLastCapture(null);
      } else {
        throw new Error('Upload failed');
      }
    } catch (e: any) {
      setUploadLog(`✕ ${e.message}`);
    } finally {
      setUploading(false);
    }
  }, [lastCapture]);

  // ─── Permission not granted ───────────────────────────────────────────────

  if (!CameraView) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.noPermTitle, { color: theme.text }]}>Camera not available</Text>
        <Text style={[styles.noPermHint, { color: theme.textMuted }]}>
          expo-camera is not installed yet.{'\n'}Restart after install completes.
        </Text>
      </View>
    );
  }

  if (!camPermission?.granted) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: theme.background }]}>
        <Text style={[styles.noPermTitle, { color: theme.text }]}>Camera access needed</Text>
        <Text style={[styles.noPermHint, { color: theme.textMuted }]}>
          Allow camera access to start recording
        </Text>
        <Pressable
          onPress={requestAll}
          style={({ pressed }) => [styles.permBtn, { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[styles.permBtnText, { color: theme.background }]}>Grant Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}>

      {/* ── Full-screen camera ── */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={mode}
      />

      {/* ── Top bar overlay ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        {/* Mode toggle */}
        <View style={styles.modeRow}>
          {(['photo', 'video'] as const).map(m => (
            <Pressable
              key={m}
              onPress={() => !recording && setMode(m)}
              style={[
                styles.modeBtn,
                mode === m && { backgroundColor: 'rgba(255,255,255,0.2)' },
              ]}
            >
              <Text style={[styles.modeBtnText, { color: mode === m ? '#fff' : 'rgba(255,255,255,0.5)' }]}>
                {m === 'photo' ? 'PHOTO' : 'VIDEO'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Right side: Vault + Flip */}
        <View style={styles.topRight}>
          {/* Encrypted Vault button */}
          <Pressable
            onPress={() => router.push('/vault' as any)}
            style={({ pressed }) => [styles.topIconBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.topIconText}>🔒</Text>
          </Pressable>

          {/* Flip camera */}
          <Pressable
            onPress={() => !recording && setFacing(f => f === 'back' ? 'front' : 'back')}
            style={[styles.topIconBtn]}
          >
            <Text style={styles.flipIcon}>⇄</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Last capture thumbnail ── */}
      {lastCapture && (
        <View style={[styles.capturePreviewWrap, { top: insets.top + 60 }]}>
          <Pressable
            onPress={uploadCapture}
            style={({ pressed }) => [styles.capturePreview, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Image source={{ uri: lastCapture }} style={styles.captureThumb} contentFit="cover" />
            <View style={styles.uploadOverlay}>
              <Text style={styles.uploadOverlayText}>{uploading ? '…' : '↑'}</Text>
            </View>
          </Pressable>
        </View>
      )}

      {/* Upload log */}
      {uploadLog.length > 0 && (
        <View style={[styles.uploadLogWrap, { bottom: TAB_BAR_HEIGHT + insets.bottom + 120 }]}>
          <Text style={styles.uploadLogText}>{uploadLog}</Text>
        </View>
      )}

      {/* ── Bottom controls ── */}
      <View style={[styles.controls, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20 }]}>
        {/* Recording time indicator */}
        {recording && (
          <View style={styles.recordingBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
          </View>
        )}

        <View style={styles.controlsRow}>
          {/* Gallery / empty placeholder */}
          <View style={styles.sideControl} />

          {/* Main button */}
          {mode === 'video' ? (
            <RecordBtn recording={recording} onPress={toggleRecord} />
          ) : (
            <ShutterBtn onPress={takePhoto} />
          )}

          {/* Side: empty for balance */}
          <View style={styles.sideControl} />
        </View>

        {/* Caption */}
        <Text style={styles.controlCaption}>
          {recording ? 'Tap to stop' : mode === 'video' ? 'Hold to record · Tap to start' : 'Tap to capture'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 16, padding: 40 },

  noPermTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center' },
  noPermHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  permBtn: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 8 },
  permBtnText: { fontSize: 15, fontWeight: '600' },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  modeRow: { flexDirection: 'row', gap: 4 },
  modeBtn: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20,
  },
  modeBtnText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  topRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  topIconBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18,
  },
  topIconText: { fontSize: 16 },
  flipBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18,
  },
  flipIcon: { fontSize: 18, color: '#fff' },

  // Capture thumbnail
  capturePreviewWrap: { position: 'absolute', left: 20 },
  capturePreview: { position: 'relative' },
  captureThumb: { width: 56, height: 56, borderRadius: 8, borderWidth: 2, borderColor: '#fff' },
  uploadOverlay: {
    position: 'absolute', inset: 0, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  uploadOverlayText: { color: '#fff', fontSize: 20, fontWeight: '700' },

  // Upload log
  uploadLogWrap: {
    position: 'absolute', left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  uploadLogText: { color: '#fff', fontSize: 12, fontWeight: '500' },

  // Controls
  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', gap: 12,
    paddingTop: 20,
    backgroundColor: 'transparent',
  },
  recordingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(239,68,68,0.85)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20,
  },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  recText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  controlsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%', paddingHorizontal: 40,
  },
  sideControl: { flex: 1 },

  // Record button
  recordRing: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 3, justifyContent: 'center', alignItems: 'center',
  },
  recordFill: { width: 56, height: 56, borderRadius: 30 },

  // Shutter button
  shutterRing: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center', alignItems: 'center',
  },
  shutterFill: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },

  controlCaption: {
    color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500', letterSpacing: 0.3,
  },
});
