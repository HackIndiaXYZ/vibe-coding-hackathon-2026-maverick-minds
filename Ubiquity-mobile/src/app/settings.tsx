/**
 * settings.tsx — Connection config persisted via AsyncStorage.
 */
import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Text,
  ScrollView,
  Switch,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useServerConfig } from '@/hooks/use-server-config';
import { TAB_BAR_HEIGHT } from '@/constants/theme';

// ─── Row primitives ───────────────────────────────────────────────────────────

function InputRow({ label, value, onChangeText, onEndEditing, placeholder, keyboardType = 'default', mono = false, last = false }: {
  label: string; value: string; onChangeText: (v: string) => void; onEndEditing?: () => void;
  placeholder?: string; keyboardType?: any; mono?: boolean; last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: last ? 'transparent' : theme.separator }]}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.rowInput,
          {
            color: theme.text,
            fontFamily: mono ? Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) : undefined,
          },
        ]}
      />
    </View>
  );
}

function ToggleRow({ label, value, onValueChange, last = false }: {
  label: string; value: boolean; onValueChange: (v: boolean) => void; last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: last ? 'transparent' : theme.separator }]}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.backgroundSelected, true: theme.accentYellow }}
        thumbColor={theme.backgroundElement}
      />
    </View>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: last ? 'transparent' : theme.separator }]}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: theme.textMuted }]}>{value}</Text>
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.backgroundElement }]}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const theme  = useTheme();
  const insets = useSafeAreaInsets();

  const { hostIp, hostPort, baseUrl, setHostIp, setHostPort } = useServerConfig();

  // Local draft state (committed on blur/button press)
  const [draftIp,   setDraftIp]   = React.useState<string | null>(null);
  const [draftPort, setDraftPort] = React.useState<string | null>(null);

  const [useHttps,     setUseHttps]     = useState(false);
  const [autoConnect,  setAutoConnect]  = useState(false);
  const [cameraId,     setCameraId]     = useState('mobile-cam');
  const [frameInterval, setFrameInterval] = useState('1000');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${baseUrl}/api/files`);
      const data = await res.json();
      setTestResult(data.success ? 'ok' : 'fail');
    } catch {
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 40,
          paddingHorizontal: 16,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page title ── */}
        <Text style={[styles.pageTitle, { color: theme.text }]}>Settings</Text>
        <Text style={[styles.pageSubtitle, { color: theme.text, opacity: 0.6 }]}>
          Home  ›  Settings
        </Text>

        {/* ── Host connection ── */}
        <SectionCard title="Connection">
          <InputRow
            label="IP address"
            value={draftIp ?? hostIp}
            onChangeText={setDraftIp}
            onEndEditing={() => { if (draftIp !== null) { setHostIp(draftIp); setDraftIp(null); } }}
            placeholder="192.168.1.5"
            keyboardType="decimal-pad"
            mono
          />
          <InputRow
            label="Port"
            value={draftPort ?? hostPort}
            onChangeText={setDraftPort}
            onEndEditing={() => { if (draftPort !== null) { setHostPort(draftPort); setDraftPort(null); } }}
            placeholder="8080"
            keyboardType="numeric"
            mono
          />
          <ToggleRow label="Use HTTPS"           value={useHttps}     onValueChange={setUseHttps} />
          <ToggleRow label="Auto-connect on open" value={autoConnect}  onValueChange={setAutoConnect} last />
        </SectionCard>

        {/* Test connection button */}
        <Pressable
          onPress={testConnection}
          disabled={testing}
          style={({ pressed }) => [
            styles.testBtn,
            {
              backgroundColor: testResult === 'ok'
                ? theme.success + '22'
                : testResult === 'fail'
                ? theme.error + '22'
                : theme.backgroundElement,
              borderColor: testResult === 'ok'
                ? theme.success
                : testResult === 'fail'
                ? theme.error
                : theme.borderSubtle,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={[
            styles.testBtnText,
            { color: testResult === 'ok' ? theme.success : testResult === 'fail' ? theme.error : theme.text },
          ]}>
            {testing
              ? 'Testing connection...'
              : testResult === 'ok'
              ? 'Connected — tap to retry'
              : testResult === 'fail'
              ? 'Connection failed — tap to retry'
              : `Test connection  ${hostIp}:${hostPort}`}
          </Text>
        </Pressable>

        {/* ── Surveillance ── */}
        <SectionCard title="Surveillance">
          <InputRow label="Camera ID"           value={cameraId}      onChangeText={setCameraId}      placeholder="mobile-cam" mono />
          <InputRow label="Frame interval (ms)" value={frameInterval} onChangeText={setFrameInterval} placeholder="1000"       keyboardType="numeric" mono last />
        </SectionCard>

        {/* ── About ── */}
        <SectionCard title="About">
          <InfoRow label="App version" value="1.0.0" />
          <InfoRow label="Platform"    value={Platform.OS} />
          <InfoRow label="Server"      value={`${hostIp}:${hostPort}`} />
          <InfoRow label="Build"       value="dev" last />
        </SectionCard>

        {/* ── Danger zone ── */}
        <SectionCard title="Danger zone">
          <Pressable
            style={({ pressed }) => [
              styles.dangerBtn,
              { borderColor: theme.error, backgroundColor: theme.error + '12', opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={() => Alert.alert('Clear vault', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: async () => {
                try {
                  await fetch(`${baseUrl}/delete-all`, { method: 'POST' });
                } catch {}
              }},
            ])}
          >
            <Text style={[styles.dangerBtnText, { color: theme.error }]}>Clear all files from vault</Text>
          </Pressable>
        </SectionCard>

        {/* ── Remote Access VPN ── */}
        <SectionCard title="Remote Access (VPN)">
          <InfoRow label="Tailscale (Recommended)" value="Zero-Config Mesh" />
          <InfoRow label="WireGuard (Self-Hosted)" value="10.0.0.1 Tunnel IP" last />
        </SectionCard>

        <View style={[styles.vpnGuide, { backgroundColor: theme.backgroundElement, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.vpnGuideTitle, { color: theme.text }]}>How to connect remotely (Tailscale)</Text>
          <Text style={[styles.vpnStep, { color: theme.textSecondary }]}>
            1. Install the <Text style={{ fontWeight: '700', color: theme.text }}>Tailscale App</Text> on this phone and on your Host PC.
          </Text>
          <Text style={[styles.vpnStep, { color: theme.textSecondary }]}>
            2. Log in using the same account on both devices.
          </Text>
          <Text style={[styles.vpnStep, { color: theme.textSecondary }]}>
            3. Find your PC's Tailscale IP address in the Tailscale client (starts with <Text style={{ fontWeight: '700', color: theme.text }}>100.x.y.z</Text>).
          </Text>
          <Text style={[styles.vpnStep, { color: theme.textSecondary }]}>
            4. Go to <Text style={{ fontWeight: '700', color: theme.text }}>Connection Settings</Text> above, set the IP Address to that 100.x.y.z IP (Port 8080), and tap Test Connection.
          </Text>

          <Text style={[styles.vpnGuideTitle, { color: theme.text, marginTop: 12 }]}>Alternative: WireGuard</Text>
          <Text style={[styles.vpnStep, { color: theme.textSecondary }]}>
            • Scan the peer QR code in the official WireGuard App, activate the tunnel, and set the IP Address above to <Text style={{ fontWeight: '700', color: theme.text }}>10.0.0.1</Text>.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  pageTitle: {
    fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2,
  },
  pageSubtitle: {
    fontSize: 13, fontWeight: '500', marginBottom: 8,
  },

  sectionCard: {
    borderRadius: 14, overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
  rowInput: {
    fontSize: 15, textAlign: 'right', flex: 1, minWidth: 110, fontWeight: '400',
  },
  rowValue: { fontSize: 14 },

  testBtn: {
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center',
  },
  testBtnText: { fontSize: 14, fontWeight: '600' },

  dangerBtn: {
    margin: 14, paddingVertical: 13, paddingHorizontal: 16,
    borderRadius: 10, borderWidth: 1.5, alignItems: 'center',
  },
  dangerBtnText: { fontSize: 14, fontWeight: '600' },

  vpnGuide: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  vpnGuideTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  vpnStep: {
    fontSize: 13,
    lineHeight: 18,
  },
  vpnCodeRow: {
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
    alignSelf: 'flex-start',
  },
  vpnCode: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13,
    fontWeight: '600',
  },
});
