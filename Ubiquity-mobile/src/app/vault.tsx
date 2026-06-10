/**
 * vault.tsx — Encrypted surveillance footage browser (mobile)
 *
 * Password gate → list of .enc footage → tap to decrypt & play inline.
 * Works via the local cloud HTTP server's /surveillance/* endpoints.
 * The server decrypts using the same PBKDF2 scheme set in the Windows app.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Modal,
  Alert,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { useServerConfig } from "@/hooks/use-server-config";
import { TAB_BAR_HEIGHT } from "@/constants/theme";

const { width: SW } = Dimensions.get("window");

// Lazy-import optional video modules
let VideoView: any = null;
let useVideoPlayer: any = null;
try {
  const expoVideo = require("expo-video");
  VideoView = expoVideo.VideoView;
  useVideoPlayer = expoVideo.useVideoPlayer;
} catch {}

interface FootageFile {
  id: string;
  name: string;
  size: number;
  createdAt: number;
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
function fmtDate(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Lock icon ───────────────────────────────────────────────────────────────

function LockIcon({
  size = 40,
  color = "#1A1400",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: color + "18",
        borderWidth: 2,
        borderColor: color + "40",
      }}
    >
      <Text style={{ fontSize: size * 0.45, color }}>Lock</Text>
    </View>
  );
}

// ─── Password Gate ────────────────────────────────────────────────────────────

function PasswordGate({
  onUnlock,
  baseUrl,
}: {
  onUnlock: (password: string) => void;
  baseUrl: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -8,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -6,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleUnlock = async () => {
    if (!password.trim()) return;
    setChecking(true);
    setError("");
    try {
      const res = await fetch(`${baseUrl}/surveillance/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.valid) {
        onUnlock(password);
      } else {
        setError(data.error || "Incorrect password.");
        setPassword("");
        shake();
      }
    } catch {
      setError("Cannot reach the local server. Make sure it is running.");
      shake();
    } finally {
      setChecking(false);
    }
  };

  return (
    <View
      style={[
        styles.gateRoot,
        { backgroundColor: theme.background, paddingTop: insets.top + 40 },
      ]}
    >
      <View style={styles.gateCenter}>
        <LockIcon size={64} color={theme.text} />
        <Text style={[styles.gateTitle, { color: theme.text }]}>
          Surveillance Vault
        </Text>
        <Text
          style={[styles.gateSubtitle, { color: theme.text, opacity: 0.6 }]}
        >
          Enter your vault password to view encrypted footage
        </Text>

        <Animated.View
          style={[
            styles.gateInputWrap,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          <View
            style={[
              styles.gateInputCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Vault password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={handleUnlock}
              style={[styles.gateInput, { color: theme.text }]}
            />
          </View>
        </Animated.View>

        {error.length > 0 && (
          <Text style={[styles.gateError, { color: theme.error }]}>
            {error}
          </Text>
        )}

        <Pressable
          onPress={handleUnlock}
          disabled={!password.trim() || checking}
          style={({ pressed }) => [
            styles.gateBtn,
            {
              backgroundColor:
                !password.trim() || checking
                  ? theme.backgroundSelected
                  : theme.text,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
        >
          {checking ? (
            <ActivityIndicator size="small" color={theme.backgroundElement} />
          ) : (
            <Text
              style={[styles.gateBtnText, { color: theme.backgroundElement }]}
            >
              Unlock
            </Text>
          )}
        </Pressable>

        <Text style={[styles.gateHint, { color: theme.text, opacity: 0.4 }]}>
          Password is set in the Windows desktop app
        </Text>
      </View>
    </View>
  );
}

// ─── Footage Card ─────────────────────────────────────────────────────────────

function FootageCard({
  file,
  onPlay,
  onDelete,
}: {
  file: FootageFile;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.97,
      damping: 20,
      stiffness: 400,
      useNativeDriver: true,
    }).start();
  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      damping: 20,
      stiffness: 400,
      useNativeDriver: true,
    }).start();

  // Determine original file extension from id
  const extMatch = file.id.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toUpperCase() : "ENC";
  const isVideo = ["MP4", "MOV", "AVI", "MKV", "WEBM", "M4V"].includes(ext);

  return (
    <Animated.View
      style={[
        styles.card,
        { transform: [{ scale }], backgroundColor: theme.backgroundElement },
      ]}
    >
      {/* Thumbnail placeholder */}
      <View
        style={[
          styles.cardThumb,
          { backgroundColor: theme.backgroundSelected },
        ]}
      >
        <View style={[styles.thumbIcon, { borderColor: theme.borderSubtle }]}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: theme.textSecondary,
              letterSpacing: 1,
            }}
          >
            {isVideo ? "VIDEO" : "PHOTO"}
          </Text>
        </View>
        <View style={[styles.encBadge, { backgroundColor: theme.text }]}>
          <Text
            style={[styles.encBadgeText, { color: theme.backgroundElement }]}
          >
            ENCRYPTED
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text
          style={[styles.cardName, { color: theme.text }]}
          numberOfLines={1}
        >
          {file.name}
        </Text>
        <Text style={[styles.cardMeta, { color: theme.textMuted }]}>
          {fmtSize(file.size)} · {fmtDate(file.createdAt)}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <Pressable
          onPress={onPlay}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={({ pressed }) => [
            styles.cardBtn,
            { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text
            style={[styles.cardBtnText, { color: theme.backgroundElement }]}
          >
            ▶ Decrypt & Play
          </Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [
            styles.cardBtnOutline,
            { borderColor: theme.error, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.cardBtnText, { color: theme.error }]}>
            Delete
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ─── Video Player Modal ───────────────────────────────────────────────────────

function VideoPlayerModal({
  visible,
  videoUri,
  onClose,
}: {
  visible: boolean;
  videoUri: string | null;
  onClose: () => void;
}) {
  const theme = useTheme();

  const player = useVideoPlayer ? useVideoPlayer(videoUri ?? '', (p: any) => {
    if (videoUri) { p.loop = false; p.play(); }
  }) : null;


  if (!VideoView || !player) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View
          style={[
            styles.playerBackdrop,
            { backgroundColor: "rgba(0,0,0,0.92)" },
          ]}
        >
          <View
            style={[
              styles.playerCard,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <Text style={[styles.playerNoSupport, { color: theme.text }]}>
              expo-video not available.{"\n"}Install it to play footage in-app.
            </Text>
            <Pressable
              onPress={onClose}
              style={[styles.playerClose, { backgroundColor: theme.text }]}
            >
              <Text
                style={{ color: theme.backgroundElement, fontWeight: "600" }}
              >
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.playerBackdrop, { backgroundColor: "#000" }]}>
        <VideoView
          player={player}
          style={styles.playerVideo}
          allowsFullscreen
          allowsPictureInPicture
          contentFit="contain"
        />
        <Pressable
          onPress={() => {
            player.pause();
            onClose();
          }}
          style={({ pressed }) => [
            styles.playerCloseBtn,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={styles.playerCloseBtnText}>✕ Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VaultScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { baseUrl: BASE_URL } = useServerConfig();

  const [unlocked, setUnlocked] = useState(false);
  const [vaultPassword, setVaultPassword] = useState("");
  const [files, setFiles] = useState<FootageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState<string | null>(null); // file id
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [playerVisible, setPlayerVisible] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/surveillance/list`);
      const data = await res.json();
      if (data.success) setFiles(data.files ?? []);
      else throw new Error(data.error ?? "Server error");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unlocked) loadFiles();
  }, [unlocked, loadFiles]);

  const handleUnlock = (password: string) => {
    setVaultPassword(password);
    setUnlocked(true);
  };

  const handleLock = () => {
    setUnlocked(false);
    setVaultPassword("");
    setFiles([]);
  };

  const handlePlay = async (file: FootageFile) => {
    setDecrypting(file.id);
    try {
      const res = await fetch(`${BASE_URL}/surveillance/decrypt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: file.id, password: vaultPassword }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Decryption failed");
      // Server writes a temp file and returns its local path via a temp URL
      setVideoUri(data.tempUrl);
      setPlayerVisible(true);
    } catch (e: any) {
      Alert.alert("Playback Error", e.message);
    } finally {
      setDecrypting(null);
    }
  };

  const handleDelete = (file: FootageFile) => {
    Alert.alert(
      "Delete footage?",
      `"${file.name}" will be permanently deleted. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await fetch(`${BASE_URL}/surveillance/delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: file.id }),
              });
              loadFiles();
            } catch (e: any) {
              Alert.alert("Delete Error", e.message);
            }
          },
        },
      ],
    );
  };

  // ── Password gate ──
  if (!unlocked)
    return <PasswordGate onUnlock={handleUnlock} baseUrl={BASE_URL} />;

  // ── Unlocked vault ──
  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: 10,
        }}
      >
        <View style={styles.headerRow}>
          <View
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}
          >
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: "rgba(255,255,255,0.25)",
                  opacity: pressed ? 0.5 : 1,
                  marginTop: 4,
                },
              ]}
            >
              <Text
                style={{ color: theme.text, fontSize: 18, fontWeight: "600" }}
              >
                ‹
              </Text>
            </Pressable>
            <View>
              <Text style={[styles.pageTitle, { color: theme.text }]}>
                Vault
              </Text>
              <Text
                style={[styles.breadText, { color: theme.text, opacity: 0.6 }]}
              >
                Camera › Surveillance Vault
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={loadFiles}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: "rgba(255,255,255,0.25)",
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ color: theme.text, fontSize: 16 }}>↺</Text>
            </Pressable>
            <Pressable
              onPress={handleLock}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: "rgba(255,255,255,0.25)",
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={{ color: theme.text, fontSize: 13, fontWeight: "700" }}
              >
                LOCK
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Error */}
      {error && (
        <View
          style={[
            styles.errorCard,
            { backgroundColor: theme.backgroundElement, marginHorizontal: 16 },
          ]}
        >
          <Text style={{ color: theme.error, fontSize: 13, fontWeight: "600" }}>
            {error}
          </Text>
        </View>
      )}

      {/* File list */}
      {loading ? (
        <ActivityIndicator
          color={theme.backgroundElement}
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
            gap: 12,
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View
                style={[styles.emptyIcon, { borderColor: theme.borderSubtle }]}
              >
                <Text
                  style={{
                    color: theme.textMuted,
                    fontSize: 12,
                    fontWeight: "800",
                    letterSpacing: 1,
                  }}
                >
                  NO FOOTAGE
                </Text>
              </View>
              <Text
                style={[styles.emptyTitle, { color: theme.text, opacity: 0.7 }]}
              >
                Vault is empty
              </Text>
              <Text
                style={{
                  color: theme.text,
                  opacity: 0.45,
                  fontSize: 13,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                Record and upload encrypted video from the Camera tab
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View>
              <FootageCard
                file={item}
                onPlay={() => handlePlay(item)}
                onDelete={() => handleDelete(item)}
              />
              {decrypting === item.id && (
                <View style={styles.decryptingOverlay}>
                  <ActivityIndicator color={theme.text} />
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 12,
                      marginTop: 6,
                      fontWeight: "600",
                    }}
                  >
                    Decrypting…
                  </Text>
                </View>
              )}
            </View>
          )}
        />
      )}

      <VideoPlayerModal
        visible={playerVisible}
        videoUri={videoUri}
        onClose={() => {
          setPlayerVisible(false);
          setVideoUri(null);
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Gate
  gateRoot: { flex: 1 },
  gateCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  gateTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 8,
  },
  gateSubtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  gateInputWrap: { width: "100%", marginTop: 8 },
  gateInputCard: {
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    justifyContent: "center",
  },
  gateInput: { fontSize: 16, height: 50, fontWeight: "500" },
  gateError: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  gateBtn: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  gateBtnText: { fontSize: 16, fontWeight: "700" },
  gateHint: { fontSize: 12, textAlign: "center", marginTop: 4 },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  breadText: { fontSize: 13, fontWeight: "500" },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },

  // Error
  errorCard: { padding: 12, borderRadius: 10, marginBottom: 8 },

  // Card
  card: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardThumb: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  thumbIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  encBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  encBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  cardInfo: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  cardName: { fontSize: 14, fontWeight: "700", marginBottom: 3 },
  cardMeta: { fontSize: 12 },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
  },
  cardBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBtnOutline: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBtnText: { fontSize: 13, fontWeight: "700" },

  // Decrypting overlay
  decryptingOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Empty
  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },

  // Player modal
  playerBackdrop: { flex: 1, justifyContent: "center", alignItems: "center" },
  playerCard: {
    width: SW - 48,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  playerNoSupport: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  playerClose: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  playerVideo: { width: SW, aspectRatio: 16 / 9 },
  playerCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  playerCloseBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
