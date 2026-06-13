// Owned by Rishith. expo-camera wrapper for the 30-60s video check-in.
// Wesley renders the <CameraView> with the returned ref:
//   const cam = useCamera();
//   <CameraView ref={cam.cameraRef} mode="video" facing="front" style={...} />
//   const uri = await cam.startRecording(60);  // resolves when stopped / maxDuration
//   cam.stopRecording();                        // stop early
import { useCallback, useRef, useState } from "react";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";

export function useCamera() {
  const cameraRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);

  const granted = !!camPerm?.granted && !!micPerm?.granted;

  const requestPermission = useCallback(async () => {
    const c = await requestCamPerm();
    const m = await requestMicPerm();
    return !!c?.granted && !!m?.granted;
  }, [requestCamPerm, requestMicPerm]);

  // Starts recording; the returned promise resolves with the video URI when
  // recording stops (either via stopRecording() or hitting maxDuration).
  const startRecording = useCallback(async (maxDurationSec: number = 60) => {
    if (!cameraRef.current) return null;
    setIsRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: maxDurationSec });
      return video?.uri ?? null;
    } catch {
      return null;
    } finally {
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    cameraRef.current?.stopRecording();
  }, []);

  return {
    cameraRef,
    permission: camPerm,
    micPermission: micPerm,
    granted,
    requestPermission,
    isRecording,
    startRecording,
    stopRecording,
  };
}
