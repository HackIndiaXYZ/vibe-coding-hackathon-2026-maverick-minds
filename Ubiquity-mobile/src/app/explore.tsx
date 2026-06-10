/**
 * explore.tsx — Cloud file explorer
 * Design: amber bg page, white card surfaces, 3-col folder grid, clean rows.
 *
 * Features:
 * · Folder navigation (breadcrumbs, back)
 * · 3-col icon grid (default) + list view toggle
 * · Long-press context menu: Rename · Delete · Duplicate · Copy · Select
 * · Image/video thumbnail previews
 * · Multi-select mode (long-press)
 * · Operations: Copy · Paste · Rename · Duplicate · Delete
 * · Upload from files or camera roll
 * · Media long-press preview sheet
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import * as FileSystem from "expo-file-system/legacy";
import { FileSystemUploadType } from "expo-file-system/legacy";
import {
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  View,
  TextInput,
  Text,
  Modal,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/use-theme";
import { useServerConfig } from "@/hooks/use-server-config";
import { TAB_BAR_HEIGHT } from "@/constants/theme";

// Lazy pickers
let DocumentPicker: any = null;
let ImagePicker: any = null;
try {
  DocumentPicker = require("expo-document-picker");
} catch { }
try {
  ImagePicker = require("expo-image-picker");
} catch { }

const { width: SW, height: SH } = Dimensions.get("window");
const GRID_GAP = 12;
const GRID_COLS = 3;
const GRID_CELL = (SW - 32 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

// Lazy-import optional video modules
let VideoView: any = null;
let useVideoPlayer: any = null;
try {
  const expoVideo = require("expo-video");
  VideoView = expoVideo.VideoView;
  useVideoPlayer = expoVideo.useVideoPlayer;
} catch { }

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileItem {
  name: string;
  size: number;
  isDirectory: boolean;
  relativePath: string;
  modifiedAt?: number;
}

interface ClipboardEntry {
  item: FileItem;
  op: "copy";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXT = (n: string) => n.split(".").pop()?.toLowerCase() ?? "";
const IMG_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "heic",
  "heif",
  "avif",
]);
const VID_EXTS = new Set(["mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp"]);
const isImg = (n: string) => IMG_EXTS.has(EXT(n));
const isVid = (n: string) => VID_EXTS.has(EXT(n));
const isMedia = (n: string) => isImg(n) || isVid(n);

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
function fmtDate(ms?: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function resolveName(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 1;
  while (existingNames.has(`${base} (${i})${ext}`)) i++;
  return `${base} (${i})${ext}`;
}

// ─── Folder Icon ─────────────────────────────────────────────────────────────

function FolderIcon({
  color = "#F5A623",
  size = 36,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <View
      style={{ width: size, height: size * 0.82, justifyContent: "flex-end" }}
    >
      {/* Tab */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 2,
          width: size * 0.42,
          height: size * 0.22,
          backgroundColor: color,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 5,
        }}
      />
      {/* Body */}
      <View
        style={{
          width: size,
          height: size * 0.68,
          backgroundColor: color,
          borderRadius: 6,
        }}
      />
    </View>
  );
}

// ─── File type color ──────────────────────────────────────────────────────────

function getExtColor(extStr: string, theme: any): string {
  const e = extStr.toLowerCase();
  if (e === "pdf") return "#E74C3C";
  if (["doc", "docx", "txt", "rtf"].includes(e)) return "#3498DB";
  if (["zip", "rar", "7z", "tar"].includes(e)) return "#E67E22";
  if (["mp3", "wav", "aac", "flac"].includes(e)) return "#9B59B6";
  if (["js", "ts", "tsx", "json", "html", "css"].includes(e)) return "#27AE60";
  return theme.accentYellow;
}

// ─── Rename Modal ─────────────────────────────────────────────────────────────

function RenameModal({
  visible,
  initial,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  initial: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState(initial);
  useEffect(() => {
    if (visible) setValue(initial);
  }, [visible, initial]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={[styles.renameBackdrop, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.renameCard,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <Text style={[styles.renameTitle, { color: theme.text }]}>
            Rename
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            selectTextOnFocus
            style={[
              styles.renameInput,
              {
                color: theme.text,
                borderColor: theme.borderSubtle,
                backgroundColor: theme.background,
              },
            ]}
          />
          <View style={styles.renameBtns}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.renameBtn,
                {
                  backgroundColor: theme.backgroundSelected,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[styles.renameBtnText, { color: theme.textSecondary }]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => value.trim() && onConfirm(value.trim())}
              style={({ pressed }) => [
                styles.renameBtn,
                { backgroundColor: theme.text, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text
                style={[
                  styles.renameBtnText,
                  { color: theme.backgroundElement },
                ]}
              >
                Rename
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Context Menu Sheet ───────────────────────────────────────────────────────

interface ContextAction {
  label: string;
  icon: string;
  onPress: () => void;
  danger?: boolean;
}

function ContextMenuSheet({
  visible,
  item,
  onClose,
  actions,
}: {
  visible: boolean;
  item: FileItem | null;
  onClose: () => void;
  actions: ContextAction[];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 300,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity,
            backgroundColor: theme.overlay,
            justifyContent: "flex-end",
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.ctxSheet,
            {
              backgroundColor: theme.backgroundElement,
              paddingBottom: insets.bottom + 8,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* File name header */}
          <View
            style={[styles.ctxHeader, { borderBottomColor: theme.separator }]}
          >
            <View
              style={[
                styles.ctxFileIcon,
                {
                  backgroundColor: item.isDirectory
                    ? theme.accentYellow + "22"
                    : theme.backgroundSelected,
                },
              ]}
            >
              {item.isDirectory ? (
                <Text style={{ fontSize: 18 }}>📁</Text>
              ) : (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: theme.textSecondary,
                  }}
                >
                  {EXT(item.name).toUpperCase().slice(0, 4) || "FILE"}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.ctxFileName, { color: theme.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={[styles.ctxFileMeta, { color: theme.textMuted }]}>
                {item.isDirectory ? "Folder" : fmtSize(item.size)}
              </Text>
            </View>
          </View>

          {/* Actions */}
          {actions.map((action, i) => (
            <Pressable
              key={action.label}
              onPress={() => {
                onClose();
                setTimeout(action.onPress, 160);
              }}
              style={({ pressed }) => [
                styles.ctxAction,
                {
                  backgroundColor: pressed
                    ? theme.backgroundSelected
                    : "transparent",
                  borderBottomColor:
                    i < actions.length - 1 ? theme.separator : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.ctxActionIcon,
                  { color: action.danger ? theme.error : theme.text },
                ]}
              >
                {action.icon}
              </Text>
              <Text
                style={[
                  styles.ctxActionLabel,
                  { color: action.danger ? theme.error : theme.text },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Media Preview Sheet ──────────────────────────────────────────────────────

function MediaPreviewModal({
  visible,
  file,
  baseUrl,
  onClose,
}: {
  visible: boolean;
  file: FileItem | null;
  baseUrl: string;
  onClose: () => void;
}) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(60)).current;

  // Hooks must be called before early returns
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          stiffness: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 60,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const uri = file ? `${baseUrl}/${file.relativePath}` : '';
  const player = useVideoPlayer ? useVideoPlayer(uri, (p: any) => {
    if (uri) { p.loop = false; p.play(); }
  }) : null;

  if (!file) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity,
            backgroundColor: theme.overlay,
            justifyContent: "flex-end",
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.previewSheet,
            {
              backgroundColor: theme.backgroundElement,
              transform: [{ translateY }],
            },
          ]}
        >
          <View
            style={[styles.dragHandle, { backgroundColor: theme.borderSubtle }]}
          />
          <View style={[styles.previewMedia, { backgroundColor: "#000" }]}>
            {isImg(file.name) ? (
              <Image
                source={{ uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : isVid(file.name) ? (
              VideoView && player ? (
                <VideoView
                  player={player}
                  style={styles.previewVideo}
                  allowsFullscreen
                  allowsPictureInPicture
                  contentFit="contain"
                />
              ) : (
                <View style={styles.previewCenter}>
                  <Text style={{ fontSize: 44, color: "#fff" }}>▶</Text>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 12,
                      marginTop: 8,
                    }}
                  >
                    Video preview
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.previewCenter}>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 28,
                    fontWeight: "700",
                    letterSpacing: 3,
                  }}
                >
                  .{EXT(file.name) || "file"}
                </Text>
              </View>
            )}
          </View>
          <View
            style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 }}
          >
            <Text
              style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}
              numberOfLines={2}
            >
              {file.name}
            </Text>
            <Text
              style={{ color: theme.textMuted, fontSize: 12, marginTop: 3 }}
            >
              {fmtSize(file.size)}
              {file.modifiedAt ? `  ·  ${fmtDate(file.modifiedAt)}` : ""}
            </Text>
          </View>
          <View
            style={[styles.previewActions, { borderTopColor: theme.separator }]}
          >
            <Pressable
              style={({ pressed }) => [
                styles.previewBtn,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              onPress={() => {
                if (player) player.pause();
                onClose();
              }}
            >
              <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
                Close
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─── Grid Cell ────────────────────────────────────────────────────────────────

function GridCell({
  item,
  baseUrl,
  selected,
  selectMode,
  onPress,
  onLongPress,
}: {
  item: FileItem;
  baseUrl: string;
  selected: boolean;
  selectMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.94,
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

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const extStr = EXT(item.name).toUpperCase().slice(0, 4) || "FILE";
  const extColor = getExtColor(EXT(item.name), theme);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, styles.gridCell]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        delayLongPress={350}
        style={[
          styles.gridCellInner,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: selected ? theme.accentYellow : "transparent",
            borderWidth: selected ? 2 : 0,
          },
        ]}
      >
        {/* Checkbox overlay */}
        {selectMode && (
          <View
            style={[
              styles.checkbox,
              {
                borderColor: selected ? theme.accentYellow : theme.borderSubtle,
                backgroundColor: selected
                  ? theme.accentYellow
                  : "rgba(0,0,0,0.04)",
              },
            ]}
          >
            {selected && (
              <Text
                style={{ color: theme.text, fontSize: 10, fontWeight: "800" }}
              >
                ✓
              </Text>
            )}
          </View>
        )}

        {/* Icon area */}
        <View style={styles.gridIconArea}>
          {item.isDirectory ? (
            <FolderIcon color={theme.accentYellow} size={36} />
          ) : (isImg(item.name) || isVid(item.name)) && !imgError ? (
            <View
              style={[
                styles.gridThumb,
                { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <Image
                source={{ uri: `${baseUrl}/${item.relativePath}` }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
              {!imgLoaded && (
                <ActivityIndicator size="small" color={theme.textMuted} />
              )}
              {isVid(item.name) && (
                <View style={styles.vidBadge}>
                  <Text style={{ color: "#fff", fontSize: 9 }}>▶</Text>
                </View>
              )}
            </View>
          ) : (
            <View
              style={[styles.extBadge, { backgroundColor: extColor + "22" }]}
            >
              <Text style={[styles.extText, { color: extColor }]}>
                {extStr}
              </Text>
            </View>
          )}
        </View>

        {/* Label */}
        <Text
          style={[styles.gridCellLabel, { color: theme.text }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {!item.isDirectory && (
          <Text style={[styles.gridCellMeta, { color: theme.textMuted }]}>
            {fmtSize(item.size)}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function ListRow({
  item,
  baseUrl,
  selected,
  selectMode,
  onPress,
  onLongPress,
}: {
  item: FileItem;
  baseUrl: string;
  selected: boolean;
  selectMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.984,
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

  const [imgError, setImgError] = useState(false);
  const extStr = EXT(item.name).toUpperCase().slice(0, 4) || "FILE";
  const extColor = getExtColor(EXT(item.name), theme);

  return (
    <Animated.View
      style={{ transform: [{ scale }], marginHorizontal: 16, marginBottom: 8 }}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        delayLongPress={350}
        style={[
          styles.listRow,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: selected ? theme.accentYellow : "transparent",
            borderWidth: selected ? 2 : 0,
          },
        ]}
      >
        {/* Checkbox */}
        {selectMode && (
          <View
            style={[
              styles.checkbox,
              {
                borderColor: selected ? theme.accentYellow : theme.borderSubtle,
                backgroundColor: selected
                  ? theme.accentYellow
                  : "rgba(0,0,0,0.04)",
                marginRight: 10,
              },
            ]}
          >
            {selected && (
              <Text
                style={{ color: theme.text, fontSize: 10, fontWeight: "800" }}
              >
                ✓
              </Text>
            )}
          </View>
        )}

        {/* Icon */}
        <View style={styles.listIconWrap}>
          {item.isDirectory ? (
            <FolderIcon color={theme.accentYellow} size={28} />
          ) : (isImg(item.name) || isVid(item.name)) && !imgError ? (
            <View
              style={[
                styles.listThumb,
                { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <Image
                source={{ uri: `${baseUrl}/${item.relativePath}` }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
                onError={() => setImgError(true)}
              />
            </View>
          ) : (
            <View
              style={[
                styles.listExtBadge,
                { backgroundColor: extColor + "22" },
              ]}
            >
              <Text style={[styles.extText, { color: extColor, fontSize: 9 }]}>
                {extStr}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.listInfo}>
          <Text
            style={[styles.listName, { color: theme.text }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text style={[styles.listMeta, { color: theme.textMuted }]}>
            {item.isDirectory ? "Folder" : fmtSize(item.size)}
            {item.modifiedAt ? `  ·  ${fmtDate(item.modifiedAt)}` : ""}
          </Text>
        </View>

        {/* Chevron */}
        {item.isDirectory && !selectMode && (
          <Text
            style={{ color: theme.textMuted, fontSize: 18, paddingRight: 4 }}
          >
            ›
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Ops Toolbar (multi-select mode) ─────────────────────────────────────────

function OpsToolbar({
  count,
  onCopy,
  onRename,
  onDuplicate,
  onDelete,
  onCancel,
  tabBarHeight,
}: {
  count: number;
  onCopy: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCancel: () => void;
  tabBarHeight: number;
}) {
  const theme = useTheme();
  const ops = [
    { label: "Copy", icon: "📋", onPress: onCopy },
    { label: "Rename", icon: "✏️", onPress: onRename },
    { label: "Dupe", icon: "⎘", onPress: onDuplicate },
    { label: "Delete", icon: "🗑", onPress: onDelete, danger: true },
  ];
  return (
    <View
      style={[
        styles.opsBar,
        {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.separator,
          bottom: tabBarHeight,
          zIndex: 1000,
        },
      ]}
    >
      <View style={styles.opsLeft}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={[styles.opsCancel, { color: theme.textSecondary }]}>
            ✕
          </Text>
        </Pressable>
        <Text style={[styles.opsCount, { color: theme.text }]}>
          {count} selected
        </Text>
      </View>
      <View style={styles.opsRight}>
        {ops.map((op) => (
          <Pressable
            key={op.label}
            onPress={op.onPress}
            style={({ pressed }) => [
              styles.opsBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={styles.opsBtnIcon}>{op.icon}</Text>
            <Text
              style={[
                styles.opsBtnLabel,
                { color: op.danger ? theme.error : theme.textMuted },
              ]}
            >
              {op.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { baseUrl: BASE_URL } = useServerConfig();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<ClipboardEntry[]>([]);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");
  // Context menu
  const [contextItem, setContextItem] = useState<FileItem | null>(null);
  const [contextVisible, setContextVisible] = useState(false);

  const pathStr = currentPath.join("/");
  const existingNames = useMemo(
    () => new Set(files.map((f) => f.name)),
    [files],
  );
  const filtered = useMemo(
    () =>
      files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase())),
    [files, search],
  );

  // Load files
  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = pathStr
        ? `${BASE_URL}/${pathStr.split("/").map(encodeURIComponent).join("/")}`
        : `${BASE_URL}/`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      if (data.success) {
        const items: FileItem[] = data.files ?? [];
        items.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(items);
      } else throw new Error("Server error");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [pathStr]);

  useEffect(() => {
    loadFiles();
    setSelectedKeys(new Set());
    setSelectMode(false);
  }, [loadFiles]);

  // Navigation
  const enterFolder = (item: FileItem) => {
    setCurrentPath((prev) => [...prev, item.name]);
    setSearch("");
  };
  const goBack = () => setCurrentPath((prev) => prev.slice(0, -1));
  const goToIndex = (idx: number) =>
    setCurrentPath((prev) => prev.slice(0, idx + 1));

  // Selection
  const enterSelectMode = (item: FileItem) => {
    setSelectMode(true);
    setSelectedKeys(new Set([item.relativePath]));
  };
  const toggleSelect = (item: FileItem) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(item.relativePath)) next.delete(item.relativePath);
      else next.add(item.relativePath);
      return next;
    });
  };
  const cancelSelect = () => {
    setSelectMode(false);
    setSelectedKeys(new Set());
  };
  const selectedItems = files.filter((f) => selectedKeys.has(f.relativePath));

  const handlePress = (item: FileItem) => {
    if (selectMode) {
      toggleSelect(item);
      return;
    }
    if (item.isDirectory) {
      enterFolder(item);
      return;
    }
    if (isMedia(item.name)) {
      setPreviewFile(item);
      setPreviewVisible(true);
    }
  };

  // Context menu
  const openContextMenu = (item: FileItem) => {
    if (selectMode) {
      toggleSelect(item);
      return;
    }
    setContextItem(item);
    setContextVisible(true);
  };
  const closeContextMenu = () => setContextVisible(false);

  const buildContextActions = (item: FileItem): ContextAction[] => [
    {
      label: "Rename",
      icon: "✏️",
      onPress: () => setRenameTarget(item),
    },
    {
      label: "Duplicate",
      icon: "⎘",
      onPress: async () => {
        const newName = resolveName(item.name, existingNames);
        try {
          const res = await fetch(`${BASE_URL}/copy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              srcName: item.name,
              destName: newName,
              path: pathStr,
            }),
          });
          const data = await res.json();
          if (!data.success) throw new Error("Duplicate failed");
          loadFiles();
        } catch (e: any) {
          Alert.alert("Duplicate Error", e.message);
        }
      },
    },
    {
      label: "Copy",
      icon: "📋",
      onPress: () => {
        setClipboard([{ item, op: "copy" as const }]);
        Alert.alert("Copied", `"${item.name}" copied to clipboard.`);
      },
    },
    {
      label: "Select multiple",
      icon: "☑️",
      onPress: () => enterSelectMode(item),
    },
    {
      label: "Delete",
      icon: "🗑",
      danger: true,
      onPress: () => {
        Alert.alert(`Delete "${item.name}"?`, "This cannot be undone.", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await fetch(`${BASE_URL}/delete`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: item.name, path: pathStr }),
                });
              } catch { }
              loadFiles();
            },
          },
        ]);
      },
    },
  ];

  // Operations
  const handleCopy = () => {
    if (!selectedItems.length) return;
    setClipboard(selectedItems.map((item) => ({ item, op: "copy" as const })));
    Alert.alert("Copied", `${selectedItems.length} item(s) copied.`);
    cancelSelect();
  };

  const handlePaste = async () => {
    if (!clipboard.length) return;
    for (const { item } of clipboard) {
      const newName = resolveName(item.name, existingNames);
      try {
        const res = await fetch(`${BASE_URL}/copy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            srcName: item.name,
            destName: newName,
            path: pathStr,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error("Paste failed");
      } catch (e: any) {
        Alert.alert("Paste Error", e.message);
        return;
      }
    }
    Alert.alert("Pasted", `${clipboard.length} item(s) pasted.`);
    loadFiles();
  };

  const handleRenameConfirm = async (newName: string) => {
    if (!renameTarget) return;
    const resolved =
      renameTarget.name === newName
        ? newName
        : resolveName(newName, existingNames);
    try {
      const res = await fetch(`${BASE_URL}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldName: renameTarget.name,
          newName: resolved,
          path: pathStr,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRenameTarget(null);
        loadFiles();
      } else throw new Error(data.message ?? "Rename failed");
    } catch (e: any) {
      Alert.alert("Rename Error", e.message);
    }
  };

  const handleRenamePress = () => {
    if (selectedItems.length !== 1) {
      Alert.alert("Select one file", "Choose exactly one file to rename.");
      return;
    }
    setRenameTarget(selectedItems[0]);
    cancelSelect();
  };

  const handleDuplicate = async () => {
    if (!selectedItems.length) return;
    let names = new Set(existingNames);
    cancelSelect();
    for (const item of selectedItems) {
      const newName = resolveName(item.name, names);
      names.add(newName);
      try {
        const res = await fetch(`${BASE_URL}/copy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            srcName: item.name,
            destName: newName,
            path: pathStr,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error("Duplicate failed");
      } catch (e: any) {
        Alert.alert("Duplicate Error", e.message);
        return;
      }
    }
    loadFiles();
  };

  const handleMultiDelete = () => {
    const count = selectedItems.length;
    Alert.alert(
      `Delete ${count} item${count > 1 ? "s" : ""}?`,
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            cancelSelect();
            for (const item of selectedItems) {
              try {
                await fetch(`${BASE_URL}/delete`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: item.name, path: pathStr }),
                });
              } catch { }
            }
            loadFiles();
          },
        },
      ],
    );
  };

  const uploadFile = async (uri: string, proposedName: string) => {
    const finalName = resolveName(proposedName, existingNames);
    if (finalName !== proposedName) {
      await new Promise<void>((resolve) =>
        Alert.alert(
          "Name conflict",
          `"${proposedName}" already exists. File will be saved as "${finalName}".`,
          [{ text: "OK", onPress: () => resolve() }],
        ),
      );
    }
    setUploading(true);
    try {
      const res = await FileSystem.uploadAsync(`${BASE_URL}/upload`, uri, {
        headers: {
          "X-File-Name": finalName,
          "X-File-Path": pathStr,
          "Content-Type": "application/octet-stream",
        },
        httpMethod: "POST",
        uploadType: FileSystemUploadType.BINARY_CONTENT,
      });
      const data = JSON.parse(res.body);
      if (data.success) {
        Alert.alert("Uploaded", `"${finalName}" saved.`);
        loadFiles();
      } else throw new Error("Upload failed");
    } catch (e: any) {
      Alert.alert("Upload Error", e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = () => {
    Alert.alert("Upload to vault", "Choose source", [
      {
        text: "Any file",
        onPress: async () => {
          if (!DocumentPicker) {
            Alert.alert("Not available");
            return;
          }
          try {
            const result = await DocumentPicker.getDocumentAsync({
              copyToCacheDirectory: true,
              multiple: false,
            });
            if (result.canceled || !result.assets?.length) return;
            const a = result.assets[0];
            await uploadFile(a.uri, a.name);
          } catch (e: any) {
            Alert.alert("Picker error", e.message);
          }
        },
      },
      {
        text: "Photo / Video",
        onPress: async () => {
          if (!ImagePicker) {
            Alert.alert("Not available");
            return;
          }
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Permission denied");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            quality: 0.9,
          });
          if (result.canceled || !result.assets?.length) return;
          const a = result.assets[0];
          const ext = a.uri.split(".").pop() ?? "jpg";
          await uploadFile(a.uri, `photo_${Date.now()}.${ext}`);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const folderCount = files.filter((f) => f.isDirectory).length;
  const fileCount = files.filter((f) => !f.isDirectory).length;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* ── Top area: title + search ── */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 10,
        }}
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          {currentPath.length > 0 ? (
            <Pressable
              onPress={goBack}
              hitSlop={12}
              style={({ pressed }) => [
                styles.backBtn,
                {
                  opacity: pressed ? 0.5 : 1,
                  backgroundColor: "rgba(255,255,255,0.25)",
                },
              ]}
            >
              <Text
                style={{ color: theme.text, fontSize: 18, fontWeight: "600" }}
              >
                ‹
              </Text>
            </Pressable>
          ) : (
            <View />
          )}

          <View style={styles.headerActions}>
            {/* Layout toggle */}
            <Pressable
              onPress={() =>
                setLayoutMode((m) => (m === "grid" ? "list" : "grid"))
              }
              hitSlop={12}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  opacity: pressed ? 0.5 : 1,
                  backgroundColor: "rgba(255,255,255,0.25)",
                },
              ]}
            >
              <Text style={{ color: theme.text, fontSize: 16 }}>
                {layoutMode === "grid" ? "☰" : "⊞"}
              </Text>
            </Pressable>
            {/* Reload */}
            <Pressable
              onPress={loadFiles}
              hitSlop={12}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  opacity: pressed ? 0.5 : 1,
                  backgroundColor: "rgba(255,255,255,0.25)",
                },
              ]}
            >
              <Text style={{ color: theme.text, fontSize: 16 }}>↺</Text>
            </Pressable>
          </View>
        </View>

        {/* Page title */}
        <Text style={[styles.pageTitle, { color: theme.text }]}>
          {currentPath.length > 0
            ? currentPath[currentPath.length - 1]
            : "Documents"}
        </Text>

        {/* Breadcrumb */}
        {currentPath.length > 0 && (
          <View style={styles.breadRow}>
            <Pressable onPress={() => setCurrentPath([])}>
              <Text
                style={[styles.breadCrumb, { color: theme.text, opacity: 0.6 }]}
              >
                Home
              </Text>
            </Pressable>
            {currentPath.map((seg, i) => (
              <View
                key={i}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <Text
                  style={[styles.breadSep, { color: theme.text, opacity: 0.4 }]}
                >
                  {" "}
                  ›{" "}
                </Text>
                <Pressable
                  onPress={() => i < currentPath.length - 1 && goToIndex(i)}
                >
                  <Text
                    style={[
                      styles.breadCrumb,
                      {
                        color: theme.text,
                        opacity: i === currentPath.length - 1 ? 1 : 0.6,
                      },
                    ]}
                  >
                    {seg}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {currentPath.length === 0 && (
          <View style={styles.breadRow}>
            <Text
              style={[styles.breadCrumb, { color: theme.text, opacity: 0.6 }]}
            >
              Home
            </Text>
            <Text
              style={[styles.breadSep, { color: theme.text, opacity: 0.4 }]}
            >
              {" "}
              ›{" "}
            </Text>
            <Text style={[styles.breadCrumb, { color: theme.text }]}>
              Documents
            </Text>
          </View>
        )}

        {/* Search bar — white card */}
        <View
          style={[
            styles.searchCard,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <Text
            style={{ color: theme.textMuted, fontSize: 16, marginRight: 8 }}
          >
            ⌕
          </Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search files..."
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={12}>
              <Text style={{ color: theme.textMuted, fontSize: 14 }}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Meta counts ── */}
      {!loading && !error && (
        <View style={[styles.metaRow, { paddingHorizontal: 16 }]}>
          <Text style={[styles.metaText, { color: theme.text, opacity: 0.7 }]}>
            All Files{" "}
            {filtered.length > 0
              ? fmtSize(files.reduce((s, f) => s + f.size, 0))
              : "—"}
          </Text>
          {folderCount > 0 && (
            <Text
              style={[styles.metaText, { color: theme.text, opacity: 0.7 }]}
            >
              {folderCount} folder{folderCount !== 1 ? "s" : ""} · {fileCount}{" "}
              file{fileCount !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
      )}

      {/* ── Error ── */}
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

      {/* ── File list ── */}
      {loading ? (
        <ActivityIndicator
          color={theme.backgroundElement}
          size="large"
          style={{ marginTop: 60 }}
        />
      ) : layoutMode === "grid" ? (
        <FlatList
          key="grid"
          data={filtered}
          keyExtractor={(item) => item.relativePath}
          numColumns={GRID_COLS}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 80,
            paddingTop: 8,
          }}
          columnWrapperStyle={{ gap: GRID_GAP, marginBottom: GRID_GAP }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <FolderIcon color="rgba(255,255,255,0.4)" size={48} />
              <Text
                style={[styles.emptyTitle, { color: theme.text, opacity: 0.7 }]}
              >
                {search
                  ? "No results"
                  : currentPath.length > 0
                    ? "Empty folder"
                    : "Vault is empty"}
              </Text>
              <Text
                style={{
                  color: theme.text,
                  opacity: 0.5,
                  fontSize: 13,
                  marginTop: 4,
                  textAlign: "center",
                }}
              >
                {search
                  ? `Nothing matches "${search}"`
                  : "Upload a file to get started"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <GridCell
              item={item}
              baseUrl={BASE_URL}
              selected={selectedKeys.has(item.relativePath)}
              selectMode={selectMode}
              onPress={() => handlePress(item)}
              onLongPress={() => openContextMenu(item)}
            />
          )}
        />
      ) : (
        <FlatList
          key="list"
          data={filtered}
          keyExtractor={(item) => item.relativePath}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 80,
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <FolderIcon color="rgba(255,255,255,0.4)" size={48} />
              <Text
                style={[styles.emptyTitle, { color: theme.text, opacity: 0.7 }]}
              >
                {search ? "No results" : "Vault is empty"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ListRow
              item={item}
              baseUrl={BASE_URL}
              selected={selectedKeys.has(item.relativePath)}
              selectMode={selectMode}
              onPress={() => handlePress(item)}
              onLongPress={() => openContextMenu(item)}
            />
          )}
        />
      )}

      {/* ── Ops toolbar or Upload FAB ── */}
      {selectMode ? (
        <OpsToolbar
          count={selectedKeys.size}
          onCopy={handleCopy}
          onRename={handleRenamePress}
          onDuplicate={handleDuplicate}
          onDelete={handleMultiDelete}
          onCancel={cancelSelect}
          tabBarHeight={TAB_BAR_HEIGHT + insets.bottom}
        />
      ) : (
        <Pressable
          onPress={handleUpload}
          disabled={uploading}
          style={({ pressed }) => [
            styles.fab,
            {
              bottom: TAB_BAR_HEIGHT + insets.bottom + 16,
              backgroundColor: theme.backgroundElement,
              opacity: uploading ? 0.7 : pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          {uploading ? (
            <ActivityIndicator color={theme.text} size="small" />
          ) : (
            <Text style={[styles.fabText, { color: theme.text }]}>
              + Upload
            </Text>
          )}
        </Pressable>
      )}

      {/* ── Modals ── */}
      <MediaPreviewModal
        visible={previewVisible}
        file={previewFile}
        baseUrl={BASE_URL}
        onClose={() => setPreviewVisible(false)}
      />
      <RenameModal
        visible={!!renameTarget}
        initial={renameTarget?.name ?? ""}
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenameTarget(null)}
      />
      <ContextMenuSheet
        visible={contextVisible}
        item={contextItem}
        onClose={closeContextMenu}
        actions={contextItem ? buildContextActions(contextItem) : []}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },

  // Title / breadcrumb
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  breadRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  breadCrumb: { fontSize: 13, fontWeight: "500" },
  breadSep: { fontSize: 13 },

  // Search
  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, height: 44, fontWeight: "500" },

  // Meta
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 2,
  },
  metaText: { fontSize: 12, fontWeight: "600" },

  // Error
  errorCard: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },

  // Grid
  gridCell: { width: GRID_CELL },
  gridCellInner: {
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: GRID_CELL,
  },
  gridIconArea: {
    marginBottom: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  gridThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  extBadge: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  extText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  vidBadge: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  gridCellLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
  gridCellMeta: { fontSize: 10, marginTop: 2, textAlign: "center" },

  // List
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  listIconWrap: {
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  listThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  listExtBadge: {
    width: 36,
    height: 36,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  listInfo: { flex: 1 },
  listName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  listMeta: { fontSize: 11 },

  // Checkbox
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 10,
  },

  // Empty
  emptyWrap: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", marginTop: 8 },

  // FAB upload pill
  fab: {
    position: "absolute",
    right: 20,
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  fabText: { fontSize: 14, fontWeight: "700" },

  // Ops toolbar
  opsBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 56,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    // bottom & zIndex set dynamically in component
  },
  opsLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  opsCancel: { fontSize: 18, fontWeight: "400" },
  opsCount: { fontSize: 13, fontWeight: "600" },
  opsRight: { flexDirection: "row", gap: 4 },
  opsBtn: { alignItems: "center", paddingHorizontal: 8, paddingVertical: 6 },
  opsBtnIcon: { fontSize: 18 },
  opsBtnLabel: { fontSize: 10, marginTop: 2, letterSpacing: 0.3 },

  // Context menu sheet
  ctxSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  ctxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ctxFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  ctxFileName: { fontSize: 15, fontWeight: "700" },
  ctxFileMeta: { fontSize: 12, marginTop: 2 },
  ctxAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ctxActionIcon: { fontSize: 18, width: 28, textAlign: "center" },
  ctxActionLabel: { fontSize: 15, fontWeight: "500" },

  // Preview sheet
  previewSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    maxHeight: SH * 0.85,
  },
  dragHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 4,
  },
  previewMedia: { width: "100%", height: SW * 0.8, maxHeight: SH * 0.5 },
  previewImage: { width: "100%", height: "100%" },
  previewVideo: { width: "100%", height: "100%" },
  previewCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  previewActions: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewBtn: { flex: 1, paddingVertical: 16, alignItems: "center" },

  // Rename modal
  renameBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  renameCard: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  renameTitle: { fontSize: 17, fontWeight: "700" },
  renameInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  renameBtns: { flexDirection: "row", gap: 10 },
  renameBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  renameBtnText: { fontSize: 14, fontWeight: "600" },
});