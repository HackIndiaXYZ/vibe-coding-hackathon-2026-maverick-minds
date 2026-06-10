import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  // Default dark to match web app design language
  const theme = scheme === 'light' ? 'light' : 'dark';
  return Colors[theme];
}
