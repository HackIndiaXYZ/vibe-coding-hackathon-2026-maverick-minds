/**
 * use-server-config.ts
 * Shared hook for reading/writing server connection config via AsyncStorage.
 * Used by explore, camera, chatbot, and settings screens.
 */
import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_IP = "server_host_ip";
const KEY_PORT = "server_host_port";

const DEFAULT_IP = "100.104.163.4";
const DEFAULT_PORT = "8080";

export function useServerConfig() {
  const [hostIp, setHostIpState] = useState(DEFAULT_IP);
  const [hostPort, setHostPortState] = useState(DEFAULT_PORT);
  const [loaded, setLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const ip = await AsyncStorage.getItem(KEY_IP);
        const port = await AsyncStorage.getItem(KEY_PORT);
        if (ip) setHostIpState(ip);
        if (port) setHostPortState(port);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const setHostIp = useCallback(async (val: string) => {
    setHostIpState(val);
    try {
      await AsyncStorage.setItem(KEY_IP, val);
    } catch {}
  }, []);

  const setHostPort = useCallback(async (val: string) => {
    setHostPortState(val);
    try {
      await AsyncStorage.setItem(KEY_PORT, val);
    } catch {}
  }, []);

  const baseUrl = `http://${hostIp}:${hostPort}`;

  return { hostIp, hostPort, baseUrl, loaded, setHostIp, setHostPort };
}
