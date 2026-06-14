// ScrollEdgeFade — the soft frosted bands at the top and bottom of a scroll
// view, the way iOS large-title screens and tab bars blur the content that
// slides under them. Two translucent BlurView overlays pinned to the top and
// bottom edges, each grounded with a gentle gradient wash so content dissolves
// rather than hard-clipping. Purely decorative: pointerEvents is disabled so
// touches pass straight through to the ScrollView underneath.
//
// Render this as a sibling *after* the ScrollView, inside a flex:1 container.
import React from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { COLORS } from "../utils/colors";

interface ScrollEdgeFadeProps {
  // Safe-area top inset; the top band extends a little past it.
  topInset: number;
  // How far the top band reaches below the safe-area top. Keep it small and
  // Apple-subtle.
  topExtra?: number;
  // Height of the bottom band sitting above the tab bar.
  bottomHeight?: number;
  // BlurView strength. ~20–40 reads as a soft frost without smearing content.
  intensity?: number;
}

// Convert a hex color to rgba with the given alpha (for the grounding washes).
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function ScrollEdgeFade({
  topInset,
  topExtra = 16,
  bottomHeight = 32,
  intensity = 28,
}: ScrollEdgeFadeProps) {
  const topHeight = topInset + topExtra;

  return (
    <>
      {/* Top frosted band — content blurs as it scrolls under the status bar. */}
      <View
        pointerEvents="none"
        style={[styles.band, styles.top, { height: topHeight }]}
      >
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
        {/* Opaque at the very top, dissolving downward so content slides under. */}
        <LinearGradient
          colors={[withAlpha(COLORS.bg, 0.85), withAlpha(COLORS.bg, 0)]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Bottom frosted band — content blurs above the tab bar. */}
      <View
        pointerEvents="none"
        style={[styles.band, styles.bottom, { height: bottomHeight }]}
      >
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
        {/* Transparent up top, grounding into the canvas at the bottom edge. */}
        <LinearGradient
          colors={[withAlpha(COLORS.bg, 0), withAlpha(COLORS.bg, 0.85)]}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
});
