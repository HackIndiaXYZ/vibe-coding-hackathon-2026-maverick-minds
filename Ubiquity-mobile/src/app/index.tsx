import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  Animated,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useTheme } from "@/hooks/use-theme";
import { useServerConfig } from "@/hooks/use-server-config";
import { TAB_BAR_HEIGHT } from "@/constants/theme";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}
function isImage(name: string) {
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(fileExt(name));
}
function isVideo(name: string) {
  return ["mp4", "mov", "avi", "mkv"].includes(fileExt(name));
}
function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Status Pill ─────────────────────────────────────────────────────────────

function StatusPill({ online }: { online: boolean }) {
  const theme = useTheme();
  const bg = online ? theme.success : theme.error;
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: bg + "22", borderColor: bg },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: bg }]} />
      <Text style={[styles.statusText, { color: bg }]}>
        {online ? "Online" : "Offline"}
      </Text>
    </View>
  );
}

// ─── Quick preview card (photo/video tile) ────────────────────────────────────

function MediaTile({ item, theme }: { item: any; theme: any }) {
  const ext = fileExt(item.name);
  const isImg = isImage(item.name);
  const isVid = isVideo(item.name);
  let label = ext.toUpperCase() || "FILE";
  if (isImg) label = "IMG";
  if (isVid) label = "VID";

  return (
    <View
      style={[styles.mediaTile, { backgroundColor: theme.backgroundElement }]}
    >
      <View
        style={[
          styles.mediaTileThumb,
          { backgroundColor: theme.backgroundSelected },
        ]}
      >
        {isVid && (
          <View style={styles.playBadge}>
            <View style={[styles.playTri, { borderLeftColor: theme.text }]} />
          </View>
        )}
        <Text style={[styles.mediaTileExt, { color: theme.textMuted }]}>
          {label}
        </Text>
      </View>
      <Text
        style={[styles.mediaTileName, { color: theme.text }]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
      <Text style={[styles.mediaTileSize, { color: theme.textMuted }]}>
        {formatSize(item.size)}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamLog, setStreamLog] = useState("Ready to stream.");
  const [recentFiles, setRecentFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { baseUrl, hostIp, hostPort } = useServerConfig();

  const checkConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        setConnected(true);
        loadRecent();
      } else throw new Error("Unsuccessful response");
    } catch (e: any) {
      setConnected(false);
      Alert.alert(
        "Connection failed",
        `${e.message}\n\nWould you like to go to settings to configure the host IP and network port?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Go to Settings",
            onPress: () => router.navigate("/settings"),
          },
        ],
      );
    } finally {
      setLoading(false);
    }
  };

  const loadRecent = async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch(`${baseUrl}/`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        // show media files first, last 6
        const all: any[] = data.files ?? [];
        const media = all.filter(
          (f: any) => isImage(f.name) || isVideo(f.name),
        );
        setRecentFiles(media.slice(-6).reverse());
      }
    } catch {
    } finally {
      setLoadingFiles(false);
    }
  };

  const startStreaming = () => {
    setStreaming(true);
    setStreamLog("Initializing...");
    let n = 0;
    streamIntervalRef.current = setInterval(async () => {
      n++;
      try {
        const frame = new Uint8Array([0, 1, 2, n % 256]);
        const res = await fetch(`${baseUrl}/upload-chunk`, {
          method: "POST",
          headers: {
            "X-Camera-Id": "mobile-cam",
            "Content-Type": "application/octet-stream",
          },
          body: frame.buffer,
        });
        const d = await res.json();
        if (d.success) setStreamLog(`Frame #${n} sent`);
      } catch (e: any) {
        setStreamLog(`Error: ${e.message}`);
      }
    }, 1000);
  };

  const stopStreaming = () => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    setStreaming(false);
    setStreamLog("Stream stopped.");
  };

  useEffect(
    () => () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    },
    [],
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 40,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>
            Ubiquity
          </Text>
          <Text style={[styles.pageSubtitle, { color: theme.textMuted }]}>
            Remote cloud &amp; surveillance
          </Text>
        </View>

        {/* ── Connection status card ── */}
        <View
          style={[
            styles.connectCard,
            {
              backgroundColor: theme.backgroundElement,
              borderWidth: 1,
              borderColor: theme.border,
              shadowColor: theme.text,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.04,
              shadowRadius: 12,
              elevation: 2,
            },
          ]}
        >
          <View style={styles.connectRow}>
            <View>
              <Text style={[styles.connectHost, { color: theme.text }]}>
                {hostIp}:{hostPort}
              </Text>
              <Text style={[styles.connectHint, { color: theme.textMuted }]}>
                Change in Settings
              </Text>
            </View>
            <StatusPill online={connected} />
          </View>

          <Pressable
            onPress={checkConnection}
            disabled={loading}
            style={({ pressed }) => [
              styles.connectBtn,
              {
                backgroundColor: theme.cta,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={theme.background} size="small" />
            ) : (
              <Text
                style={[styles.connectBtnText, { color: theme.background }]}
              >
                {connected ? "Reconnect" : "Connect"}
              </Text>
            )}
          </Pressable>
        </View>

        {/* ── Recent media preview ── */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            RECENT MEDIA
          </Text>
          <Link
            href={{ pathname: "/explore", params: { hostIp, hostPort } }}
            asChild
          >
            <Pressable>
              <Text
                style={[styles.sectionAction, { color: theme.textSecondary }]}
              >
                See all ›
              </Text>
            </Pressable>
          </Link>
        </View>

        {loadingFiles ? (
          <ActivityIndicator
            color={theme.text}
            style={{ marginVertical: 20 }}
          />
        ) : recentFiles.length > 0 ? (
          <FlatList
            horizontal
            data={recentFiles}
            keyExtractor={(f) => f.relativePath}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingRight: 20 }}
            renderItem={({ item }) => <MediaTile item={item} theme={theme} />}
            scrollEnabled={true}
            style={{ marginHorizontal: -20, paddingLeft: 20 }}
          />
        ) : (
          <View
            style={[
              styles.emptyPreview,
              {
                backgroundColor: theme.backgroundElement,
                borderWidth: 1.5,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.emptyPreviewText, { color: theme.textMuted }]}>
              {connected ? "No media in vault" : "Connect to see recent files"}
            </Text>
          </View>
        )}

        {/* ── Surveillance card ── */}
        <Text
          style={[
            styles.sectionLabel,
            { color: theme.textMuted, marginTop: 24, marginBottom: 8 },
          ]}
        >
          SURVEILLANCE
        </Text>
        <View
          style={[
            styles.streamCard,
            {
              backgroundColor: theme.backgroundElement,
              borderWidth: 1,
              borderColor: theme.border,
              shadowColor: theme.text,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.04,
              shadowRadius: 12,
              elevation: 2,
            },
          ]}
        >
          <View style={styles.logRow}>
            <View
              style={[
                styles.logDot,
                {
                  backgroundColor: streaming ? theme.success : theme.textMuted,
                },
              ]}
            />
            <Text
              style={[styles.logText, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {streamLog}
            </Text>
          </View>

          <Pressable
            onPress={streaming ? stopStreaming : startStreaming}
            disabled={!connected && !streaming}
            style={({ pressed }) => [
              styles.streamBtn,
              {
                backgroundColor: streaming
                  ? theme.error
                  : connected
                    ? theme.cta
                    : theme.backgroundSelected,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.streamBtnText,
                {
                  color: streaming
                    ? "#fff"
                    : connected
                      ? theme.background
                      : theme.textMuted,
                },
              ]}
            >
              {streaming ? "Stop stream" : "Start stream"}
            </Text>
          </Pressable>

          {!connected && !streaming && (
            <Text style={[styles.disabledHint, { color: theme.textMuted }]}>
              Connect first
            </Text>
          )}
        </View>

        {/* ── Files quick-nav ── */}
        <Text
          style={[
            styles.sectionLabel,
            { color: theme.textMuted, marginTop: 24, marginBottom: 8 },
          ]}
        >
          STORAGE
        </Text>
        <Link
          href={{ pathname: "/explore", params: { hostIp, hostPort } }}
          asChild
        >
          <Pressable
            style={({ pressed }) => [
              styles.navCard,
              {
                backgroundColor: theme.backgroundElement,
                borderWidth: 1,
                borderColor: theme.border,
                shadowColor: theme.text,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.04,
                shadowRadius: 12,
                elevation: 2,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View>
              <Text style={[styles.navCardTitle, { color: theme.text }]}>
                Cloud Files
              </Text>
              <Text style={[styles.navCardSub, { color: theme.textMuted }]}>
                Browse, upload &amp; manage
              </Text>
            </View>
            <Text style={[styles.navCardChev, { color: theme.textMuted }]}>
              ›
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  pageHeader: { paddingVertical: 8, marginBottom: 16 },
  pageTitle: {
    fontSize: 32,
    letterSpacing: -0.5,
    marginBottom: 2,
    fontWeight: "800",
    fontFamily: "VampiroOne",
  },
  pageSubtitle: { fontSize: 13, fontWeight: "500", marginTop: 4 },

  // Connect card
  connectCard: { borderRadius: 16, padding: 16, marginBottom: 24 },
  connectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  connectHost: {
    fontSize: 16,
    letterSpacing: -0.3,
    marginBottom: 2,
    fontWeight: "700",
  },
  connectHint: { fontSize: 12, fontWeight: "500" },
  connectBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  connectBtnText: { fontSize: 15, fontWeight: "700" },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "700" },

  // Section heading
  sectionLabel: {
    fontSize: 13,
    letterSpacing: 0.6,
    marginBottom: 8,
    fontWeight: "700",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionAction: { fontSize: 13, fontWeight: "600" },

  // Media tiles
  mediaTile: { width: 120, borderRadius: 12, overflow: "hidden" },
  mediaTileThumb: {
    width: 120,
    height: 90,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  mediaTileExt: { fontSize: 13, letterSpacing: 1, fontWeight: "700" },
  playBadge: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  playTri: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    marginLeft: 2,
  },
  mediaTileName: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 2,
    fontWeight: "600",
  },
  mediaTileSize: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingBottom: 8,
    fontWeight: "500",
  },

  // Empty preview
  emptyPreview: {
    borderRadius: 16,
    height: 90,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyPreviewText: { fontSize: 13, fontWeight: "500" },

  // Stream card
  streamCard: { borderRadius: 16, padding: 16 },
  logRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 14,
    minHeight: 40,
  },
  logDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  logText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "500" },
  streamBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  streamBtnText: { fontSize: 15, fontWeight: "700" },
  disabledHint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "500",
  },

  // Nav card
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 16,
  },
  navCardTitle: {
    fontSize: 16,
    letterSpacing: -0.3,
    marginBottom: 2,
    fontWeight: "700",
  },
  navCardSub: { fontSize: 13, fontWeight: "500" },
  navCardChev: { fontSize: 28, fontWeight: "300" },
});
