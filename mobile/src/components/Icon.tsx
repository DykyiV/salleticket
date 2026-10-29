import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/** The site's icon set (24×24, 2px stroke, lucide-style) for the app. */
const PATHS = {
  ticket: (
    <>
      <Path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <Path d="M13 5v2M13 17v2M13 11v2" />
    </>
  ),
  user: (
    <>
      <Circle cx="12" cy="8" r="5" />
      <Path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  pin: (
    <>
      <Path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <Circle cx="12" cy="10" r="3" />
    </>
  ),
  bus: (
    <>
      <Path d="M8 6v6M15 6v6M2 12h19.6" />
      <Path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
      <Circle cx="7" cy="18" r="2" />
      <Path d="M9 18h5" />
      <Circle cx="16" cy="18" r="2" />
    </>
  ),
  seat: (
    <>
      <Path d="M7 18v-6a5 5 0 1 1 10 0v6" />
      <Path d="M5 21a1 1 0 0 0 1-1v-1a2 2 0 0 0-4 0v1a1 1 0 0 0 1 1zM19 21a1 1 0 0 0 1-1v-1a2 2 0 0 0-4 0v1a1 1 0 0 0 1 1zM5 18h14" />
    </>
  ),
  clock: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 6v6l4 2" />
    </>
  ),
  qr: (
    <>
      <Rect width="5" height="5" x="3" y="3" rx="1" />
      <Rect width="5" height="5" x="16" y="3" rx="1" />
      <Rect width="5" height="5" x="3" y="16" rx="1" />
      <Path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1" />
    </>
  ),
  globe: (
    <>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
    </>
  ),
  search: (
    <>
      <Circle cx="11" cy="11" r="8" />
      <Path d="m21 21-4.3-4.3" />
    </>
  ),
  chevronRight: <Path d="m9 18 6-6-6-6" />,
  arrowRight: <Path d="M5 12h14M12 5l7 7-7 7" />,
  wifiOff: <Path d="M12 20h.01M8.5 16.429a5 5 0 0 1 7 0M5 12.859a10 10 0 0 1 5.17-2.69M19 12.859a10 10 0 0 0-2.007-1.523M2 8.82a15 15 0 0 1 4.177-2.643M22 8.82a15 15 0 0 0-11.288-3.764M2 2l20 20" />,
  logout: <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  check: <Path d="M20 6 9 17l-5-5" />,
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 20, color = "currentColor" }: { name: IconName; size?: number; color?: ColorValue | string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={(color ?? "currentColor") as string} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </Svg>
  );
}
