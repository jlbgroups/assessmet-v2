import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Mic,
  Wifi,
  Monitor,
  Maximize2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Shield,
  Activity,
  Lock,
  X,
  RefreshCw
} from 'lucide-react';
import { apiFetch, BASE_URL } from '../utils/api';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';

export const SystemCheck: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [examName, setExamName] = useState('');
  const [examId, setExamId] = useState<number | null>(null);

  const [checkInitiated, setCheckInitiated] = useState(false);
  const [showPermissionGuidance, setShowPermissionGuidance] = useState(false);
  const [blockedDeviceType, setBlockedDeviceType] = useState<'camera' | 'microphone' | 'both' | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [screenStatus, setScreenStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [micStatus, setMicStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [faceStatus, setFaceStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [faceMessage, setFaceMessage] = useState('Pre-loading client-side vision model libraries');
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const [browserStatus, setBrowserStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [speedStatus, setSpeedStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [fullscreenStatus, setFullscreenStatus] = useState<'pending' | 'success' | 'failed'>('pending');

  const [latency, setLatency] = useState<number | null>(null);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const eid = localStorage.getItem('active_exam_id');
    const name = localStorage.getItem('active_exam_name');
    if (!eid) {
      navigate('/candidate');
      return;
    }
    setExamId(parseInt(eid));
    setExamName(name || 'Assigned Examination');

    checkBrowser();
    checkLatency();

    const onFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      setFullscreenStatus(isFs ? 'success' : 'failed');
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      stopMedia();
    };
  }, [navigate]);

  const checkBrowser = () => {
    const hasFullscreen = document.fullscreenEnabled || (document as any).webkitFullscreenEnabled;
    const hasUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasAudioContext = !!(window.AudioContext || (window as any).webkitAudioContext);

    if (hasFullscreen && hasUserMedia && hasAudioContext) {
      setBrowserStatus('success');
    } else {
      setBrowserStatus('failed');
    }
  };

  const checkLatency = async () => {
    const start = performance.now();
    try {
      await fetch(`${BASE_URL}/health`);
      const lat = Math.round(performance.now() - start);
      setLatency(lat);
      setSpeedStatus(lat < 1500 ? 'success' : 'failed');
    } catch {
      setSpeedStatus('failed');
    }
  };

  const releaseVideoTrack = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };


  const getUserMediaWithTimeout = (
    constraints: MediaStreamConstraints,
    timeoutMs = 10000
  ): Promise<MediaStream> => {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new DOMException('Timeout starting video source', 'AbortError'));
        }
      }, timeoutMs);

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then(stream => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(stream);
          }
        })
        .catch(err => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
    });
  };


  const waitForVideoReady = (video: HTMLVideoElement, timeoutMs = 8000): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        resolve();
        return;
      }
      let settled = false;
      const onReady = () => {
        if (!settled) { settled = true; cleanup(); resolve(); }
      };
      const timer = setTimeout(() => {
        if (!settled) { settled = true; cleanup(); reject(new Error('Video element timed out becoming ready')); }
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('loadedmetadata', onReady);
      };
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('loadedmetadata', onReady, { once: true });
    });
  };

  const startMedia = async () => {
    setCameraStatus('pending');
    setScreenStatus('pending');
    setMicStatus('pending');
    setFaceStatus('pending');
    setDeviceError(null);

    releaseVideoTrack();

    await new Promise(r => setTimeout(r, 300));

    let isCameraDenied = false;
    let isScreenDenied = false;
    let isMicDenied = false;

    try {
      let videoStream: MediaStream;
      try {
        videoStream = await getUserMediaWithTimeout({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
      } catch (firstErr: any) {
        console.warn('Camera first attempt failed, retrying with minimal constraints:', firstErr);
        videoStream = await getUserMediaWithTimeout({ video: true });
      }

      videoStreamRef.current = videoStream;

      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        try {
          await videoRef.current.play();
        } catch (_) { }

        await waitForVideoReady(videoRef.current);

        setCameraStatus('success');
        runFaceScanning();
      }
    } catch (err: any) {
      console.error('Camera device check failed:', err);
      setCameraStatus('failed');
      setFaceStatus('failed');
      setDeviceError(`Camera Error: ${err.message || err.name}`);
      const isPermissionErr = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || (err.message && /permission/i.test(err.message));
      if (isPermissionErr) {
        isCameraDenied = true;
      }
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = screenStream;
        try {
          await screenVideoRef.current.play();
        } catch (_) { }
      }
      setScreenStatus('success');
    } catch (err: any) {
      console.error('Screen share check failed:', err);
      setScreenStatus('failed');
      setDeviceError(prev => prev ? `${prev} | Screen Error: ${err.message || err.name}` : `Screen Error: ${err.message || err.name}`);
      const isPermissionErr = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || (err.message && /permission/i.test(err.message));
      if (isPermissionErr) {
        isScreenDenied = true;
      }
    }

    try {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      const audioStream = await getUserMediaWithTimeout({ audio: true });
      audioStreamRef.current = audioStream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(audioStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setMicStatus('success');
      startVolumeMeter();
    } catch (err: any) {
      console.error('Microphone device check failed:', err);
      setMicStatus('failed');
      setDeviceError(prev => prev ? `${prev} | Mic Error: ${err.message || err.name}` : `Mic Error: ${err.message || err.name}`);
      const isPermissionErr = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || (err.message && /permission/i.test(err.message));
      if (isPermissionErr) {
        isMicDenied = true;
      }
    }

    if (isCameraDenied || isScreenDenied || isMicDenied) {
      if (isCameraDenied && isMicDenied) {
        setBlockedDeviceType('both');
      } else if (isCameraDenied) {
        setBlockedDeviceType('camera');
      } else {
        setBlockedDeviceType('microphone');
      }
      setShowPermissionGuidance(true);
    }
  };

  const stopMedia = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };


  const startVolumeMeter = () => {
    const bufferLength = analyserRef.current?.frequencyBinCount || 0;
    const dataArray = new Uint8Array(bufferLength);

    const checkVolume = () => {
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setMicVolume(Math.round((average / 128) * 100));
      }
      animationFrameRef.current = requestAnimationFrame(checkVolume);
    };
    checkVolume();
  };

  const runFaceScanning = async () => {
    setFaceStatus('pending');
    setFaceMessage('Loading WASM and model files...');

    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
      );
      setFaceMessage('Initializing face detector...');
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU"
        },
        runningMode: "VIDEO"
      });
      faceDetectorRef.current = detector;

      setFaceMessage('Analyzing camera feed for face...');

      let lastVideoTime = -1;
      let successFrames = 0;

      const detectFrame = () => {
        if (!videoStreamRef.current || !videoRef.current) {
          return;
        }

        const video = videoRef.current;
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;

          try {
            const results = detector.detectForVideo(video, performance.now());
            const detections = results.detections || [];

            if (detections.length === 1) {
              successFrames++;
              setFaceMessage(`Face detected! Keep still (${Math.round((successFrames / 10) * 100)}%)`);
              if (successFrames >= 10) {
                setFaceStatus('success');
                setFaceMessage('Face successfully verified');
                return;
              }
            } else if (detections.length > 1) {
              successFrames = 0;
              setFaceMessage('Warning: Multiple faces detected!');
            } else {
              successFrames = 0;
              setFaceMessage('Searching for face...');
            }
          } catch (err) {
            console.error("Frame detection error:", err);
          }
        }

        animationFrameRef.current = requestAnimationFrame(detectFrame);
      };

      animationFrameRef.current = requestAnimationFrame(detectFrame);

    } catch (err: any) {
      console.error("Failed to initialize FaceDetector:", err);
      setFaceStatus('failed');
      setFaceMessage('Face detector initialization failed');
      setDeviceError(prev => prev ? `${prev} | Face AI Error: ${err.message || err.name}` : `Face AI Error: ${err.message || err.name}`);
    }
  };

  const handleRequestFullscreen = async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen request failed', err);
      setFullscreenStatus('failed');
    }
  };

  const captureFrameFromStream = async (stream: MediaStream, width: number, height: number): Promise<Blob | null> => {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== 'live') {
      return null;
    }

    if (typeof (window as any).MediaStreamTrackProcessor !== 'undefined') {
      try {
        const processor = new (window as any).MediaStreamTrackProcessor({ track: videoTrack });
        const reader = processor.readable.getReader();
        const { value: frame, done } = await reader.read();
        reader.releaseLock();
        if (frame) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
            frame.close();
            return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
          }
          frame.close();
        }
      } catch (err) {
        console.warn('MediaStreamTrackProcessor capture failed, falling back to video element:', err);
      }
    }

    if (typeof (window as any).ImageCapture !== 'undefined') {
      try {
        const capture = new (window as any).ImageCapture(videoTrack);
        const bitmap = await capture.grabFrame();
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          if (typeof bitmap.close === 'function') bitmap.close();
          return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        }
      } catch (err) {
        console.warn('ImageCapture grabFrame failed, falling back to video element:', err);
      }
    }

    return null;
  };

  const uploadCheckScreenshots = async (aid: number, token: string) => {
    if (videoStreamRef.current) {
      try {
        let blob = await captureFrameFromStream(videoStreamRef.current, 640, 480);
        if (!blob && videoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
          }
        }

        if (blob) {
          const formData = new FormData();
          formData.append('attempt_id', String(aid));
          formData.append('exam_session_token', token);
          formData.append('file', blob, 'webcam_check.jpg');
          await fetch(`${BASE_URL}/api/proctoring/screenshot`, {
            method: 'POST',
            body: formData
          });
        }
      } catch (err) {
        console.error('Failed capturing webcam registration snapshot', err);
      }
    }

    if (screenStreamRef.current) {
      try {
        let blob = await captureFrameFromStream(screenStreamRef.current, 800, 600);
        if (!blob && screenVideoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = 800;
          canvas.height = 600;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, canvas.height);
            blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
          }
        }

        if (blob) {
          const formData = new FormData();
          formData.append('attempt_id', String(aid));
          formData.append('exam_session_token', token);
          formData.append('file', blob, 'screenshare_check.jpg');
          await fetch(`${BASE_URL}/api/proctoring/screenshot`, {
            method: 'POST',
            body: formData
          });
        }
      } catch (err) {
        console.error('Failed capturing screenshare registration snapshot', err);
      }
    }
  };

  const handleProceed = async () => {
    if (cameraStatus !== 'success' || screenStatus !== 'success' || micStatus !== 'success' || faceStatus !== 'success' || browserStatus !== 'success' || speedStatus !== 'success' || !isFullscreen) {
      alert('Please pass all hardware and browser checks and enter fullscreen mode before starting the exam.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch(`/api/assessments/${examId}/start`, {
        method: 'POST'
      });

      localStorage.setItem('exam_session_token', response.exam_session_token);
      localStorage.setItem('active_attempt_id', String(response.attempt.id));
      localStorage.setItem('active_snapshot_data', JSON.stringify(response.snapshot_data));

      await uploadCheckScreenshots(response.attempt.id, response.exam_session_token);

      await apiFetch('/api/proctoring/system-check-passed', {
        method: 'POST',
        body: JSON.stringify({
          attempt_id: response.attempt.id,
          exam_session_token: response.exam_session_token
        })
      });

      if (videoStreamRef.current) {
        (window as any).activeWebcamStream = videoStreamRef.current;
        videoStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        (window as any).activeScreenStream = screenStreamRef.current;
        screenStreamRef.current = null;
      }
      if (audioStreamRef.current) {
        (window as any).activeAudioStream = audioStreamRef.current;
        audioStreamRef.current = null;
      }

      navigate('/exam');
    } catch (err: any) {
      alert(err.message || 'Failed to initialize examination session');
    } finally {
      setLoading(false);
    }
  };

  const allPassed =
    cameraStatus === 'success' &&
    screenStatus === 'success' &&
    micStatus === 'success' &&
    faceStatus === 'success' &&
    browserStatus === 'success' &&
    speedStatus === 'success' &&
    isFullscreen;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-6 flex flex-col justify-between">
      <div className="max-w-5xl mx-auto w-full flex justify-between items-center border-b border-slate-900 pb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white tracking-wide text-sm">AssessPro AI</h2>
            <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Device Verification Gateway</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Active Assessment</span>
          <span className="text-xs font-semibold text-indigo-400">{examName}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-1">
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-card p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-indigo-700"></div>

          <div>
            <h3 className="text-sm font-bold text-white mb-1">Live Camera Feed</h3>
            <p className="text-xs text-slate-400">Position your face in the center of the frame</p>
          </div>

          <div className="my-6 aspect-video bg-slate-950 border border-slate-850 rounded-xl relative overflow-hidden flex items-center justify-center">
            {!checkInitiated && (
              <div className="text-center p-5">
                <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
                  Camera, screen sharing, and microphone permissions are required to verify environment security.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCheckInitiated(true);
                    startMedia();
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all shadow-lg shadow-indigo-650/20"
                >
                  Start Device Check
                </button>
              </div>
            )}

            {checkInitiated && (cameraStatus === 'failed' || micStatus === 'failed') && (
              <div className="text-center p-4">
                <p className="text-xs text-rose-450 mb-3 max-w-xs mx-auto font-semibold">
                  Device check failed. Please ensure permissions are granted and devices are not in use by another app.
                </p>
                {deviceError && (
                  <p className="text-[10px] text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/40 font-mono mb-4 max-w-xs mx-auto text-left break-all">
                    {deviceError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={startMedia}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-btn text-xs font-bold transition-all shadow-md shadow-indigo-650/10"
                >
                  Retry Activation
                </button>
              </div>
            )}

            {checkInitiated && cameraStatus === 'pending' && (
              <div className="text-center p-4">
                <span className="w-8 h-8 border-3 border-slate-700 border-t-indigo-500 rounded-full animate-spin block mx-auto mb-3"></span>
                <p className="text-xs text-indigo-300 font-semibold animate-pulse">
                  Please click "Allow" in the browser prompt...
                </p>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraStatus === 'success' ? 'block' : 'hidden'}`}
            />

            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted
              style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '1px', height: '1px', opacity: 0 }}
            />

            {cameraStatus === 'success' && faceStatus !== 'success' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-indigo-400 border-dashed rounded-3xl animate-pulse relative">
                  <div className="absolute top-0 left-0 w-full h-0.5 bg-indigo-400 animate-[bounce_2s_infinite]"></div>
                  <span className="absolute bottom-3 left-0 right-0 text-center text-[10px] font-bold bg-slate-950/80 px-2 py-1 mx-4 rounded-full text-indigo-300">
                    Scanning Face Details...
                  </span>
                </div>
              </div>
            )}

            {faceStatus === 'success' && (
              <div className="absolute top-3 left-3 bg-emerald-500/90 text-white px-2.5 py-1 rounded-full text-[9px] font-bold flex items-center gap-1.5 shadow-md border border-emerald-400/30">
                <CheckCircle2 className="w-3.5 h-3.5" /> Face Detected
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              <span>Microphone Input Level</span>
              <span className={micStatus === 'success' ? 'text-emerald-400 font-bold' : ''}>
                {micStatus === 'success' ? 'Active' : 'Muted'}
              </span>
            </div>
            <div className="h-2 bg-slate-950 border border-slate-850 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${micStatus === 'success' ? micVolume : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-5 flex flex-col justify-between">
          <div className="bg-slate-900 border border-slate-800 rounded-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">Hardware & Environment Checks</h3>

            <div className="divide-y divide-slate-800">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Camera className="w-5 h-5 text-slate-400" />
                  <div>
                    <span className="text-xs font-semibold block text-slate-200">Webcam Feed Connection</span>
                    <span className="text-[10px] text-slate-400">Verifying video capture capabilities</span>
                  </div>
                </div>
                {cameraStatus === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : cameraStatus === 'failed' ? (
                  <XCircle className="w-5 h-5 text-rose-500" />
                ) : checkInitiated ? (
                  <span className="w-5 h-5 border-2 border-slate-650 border-t-indigo-500 rounded-full animate-spin"></span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ready</span>
                )}
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-slate-400" />
                  <div>
                    <span className="text-xs font-semibold block text-slate-200">Screen Sharing Connection</span>
                    <span className="text-[10px] text-slate-400">Verifying screen capture authorization</span>
                  </div>
                </div>
                {screenStatus === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : screenStatus === 'failed' ? (
                  <XCircle className="w-5 h-5 text-rose-500" />
                ) : checkInitiated ? (
                  <span className="w-5 h-5 border-2 border-slate-650 border-t-indigo-500 rounded-full animate-spin"></span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ready</span>
                )}
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-slate-400" />
                  <div>
                    <span className="text-xs font-semibold block text-slate-200">Edge AI Face Landmarks Verification</span>
                    <span className="text-[10px] text-slate-400">{faceMessage}</span>
                  </div>
                </div>
                {faceStatus === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : faceStatus === 'failed' ? (
                  <XCircle className="w-5 h-5 text-rose-500" />
                ) : checkInitiated ? (
                  <span className="w-5 h-5 border-2 border-slate-650 border-t-indigo-500 rounded-full animate-spin"></span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ready</span>
                )}
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Mic className="w-5 h-5 text-slate-400" />
                  <div>
                    <span className="text-xs font-semibold block text-slate-200">Microphone Input Connection</span>
                    <span className="text-[10px] text-slate-400">Listening to environmental sound telemetry</span>
                  </div>
                </div>
                {micStatus === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : micStatus === 'failed' ? (
                  <XCircle className="w-5 h-5 text-rose-500" />
                ) : checkInitiated ? (
                  <span className="w-5 h-5 border-2 border-slate-650 border-t-indigo-500 rounded-full animate-spin"></span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ready</span>
                )}
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-slate-400" />
                  <div>
                    <span className="text-xs font-semibold block text-slate-200">Browser API Compatibility</span>
                    <span className="text-[10px] text-slate-400">Lock, fullscreen, visibility API verification</span>
                  </div>
                </div>
                {browserStatus === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : browserStatus === 'failed' ? (
                  <XCircle className="w-5 h-5 text-rose-500" />
                ) : (
                  <span className="w-5 h-5 border-2 border-slate-650 border-t-indigo-500 rounded-full animate-spin"></span>
                )}
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Wifi className="w-5 h-5 text-slate-400" />
                  <div>
                    <span className="text-xs font-semibold block text-slate-200">Network Latency Audit</span>
                    <span className="text-[10px] text-slate-400">{latency ? `Gateway connection: ${latency} ms latency` : 'Pinging backend command center...'}</span>
                  </div>
                </div>
                {speedStatus === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : speedStatus === 'failed' ? (
                  <XCircle className="w-5 h-5 text-rose-500" />
                ) : (
                  <span className="w-5 h-5 border-2 border-slate-650 border-t-indigo-500 rounded-full animate-spin"></span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-card p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isFullscreen ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                <Maximize2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold block text-white">Strict Fullscreen Enforcement</span>
                <span className="text-[10px] text-slate-400">Lock exam interface before entering</span>
              </div>
            </div>
            {isFullscreen ? (
              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-full text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Fullscreen Locked
              </span>
            ) : (
              <button
                onClick={handleRequestFullscreen}
                className="h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-btn text-[10px] font-bold transition-all shadow-md shadow-amber-550/10"
              >
                Enter Fullscreen
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full border-t border-slate-900 pt-6 flex justify-between items-center shrink-0">
        <button
          onClick={() => {
            stopMedia();
            navigate('/candidate');
          }}
          className="h-10 px-5 border border-slate-800 text-slate-400 rounded-btn text-xs font-semibold hover:bg-slate-900 hover:text-white transition-all"
        >
          Abort Exam
        </button>

        <button
          onClick={handleProceed}
          disabled={!allPassed}
          className={`h-11 px-6 rounded-btn text-xs font-bold transition-all flex items-center gap-2 ${allPassed
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/10'
            : 'bg-slate-900 text-slate-600 border border-slate-850 cursor-not-allowed'
            }`}
        >
          <span>Establish Exam Sandbox</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {showPermissionGuidance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-opacity duration-300 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col transition-all duration-300 transform scale-100 animate-in zoom-in-95">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500"></div>

            <div className="p-6 pb-4 flex justify-between items-start">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    {blockedDeviceType === 'both' && 'Camera and Microphone Blocked'}
                    {blockedDeviceType === 'camera' && 'Camera Access Blocked'}
                    {blockedDeviceType === 'microphone' && 'Microphone Access Blocked'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    AssessPro AI requires access to your {blockedDeviceType === 'both' ? 'camera and microphone' : blockedDeviceType} to secure and verify your environment.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPermissionGuidance(false)}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-4 bg-slate-950/50 border-y border-slate-850/80">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2.5">
                Quick Guide: Enable permissions in browser
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center gap-2.5 select-none relative mb-4">
                <div className="flex gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/40"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/40"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40"></span>
                </div>

                <div className="flex-1 bg-slate-900/80 border border-slate-800/80 rounded-md py-1 px-2.5 flex items-center gap-2 text-xs text-slate-400 font-mono relative overflow-visible">
                  <div className="relative flex items-center gap-1.5">
                    <div className="relative flex items-center">
                      <Lock className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400/10 animate-pulse" />
                      <span className="absolute -inset-1 bg-indigo-500/25 rounded-full animate-ping pointer-events-none"></span>
                    </div>
                    <div className="absolute -bottom-11 -left-2 flex flex-col items-center animate-bounce z-10 pointer-events-none">
                      <span className="w-2 h-2 bg-indigo-650 rotate-45"></span>
                      <span className="text-[9px] bg-indigo-650 text-white font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap -mt-1.5">Click here</span>
                    </div>
                  </div>
                  <span className="text-slate-500 truncate">{window.location.origin}</span>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-300 mt-6">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <div>
                    <span className="font-semibold text-white">Click the Lock icon (🔒)</span> next to the website address in the top left of your browser window.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <div>
                    Locate <span className="font-semibold text-white">Camera</span> and <span className="font-semibold text-white">Microphone</span>, and switch their permissions to <span className="text-emerald-400 font-bold">Allow</span>.
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                  <div>
                    Click <span className="font-semibold text-white">"Try Again"</span> below to re-initialize verification.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 py-4 text-[10px] text-slate-400 border-b border-slate-850 bg-slate-900/30">
              <div className="font-bold uppercase tracking-wider text-slate-500 mb-2">Browser Instructions</div>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                  <span className="block font-bold text-slate-300 mb-0.5">Chrome / Edge</span>
                  Click Lock & toggle switches to Allow.
                </div>
                <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                  <span className="block font-bold text-slate-300 mb-0.5">Firefox</span>
                  Click block icon left of URL & clear block.
                </div>
                <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                  <span className="block font-bold text-slate-300 mb-0.5">Safari</span>
                  Right-click URL bar & select Site Settings.
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-900/80 flex justify-between items-center gap-4">
              <button
                onClick={() => setShowPermissionGuidance(false)}
                className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-semibold transition-all shrink-0"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setShowPermissionGuidance(false);
                  startMedia();
                }}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-650/20 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SystemCheck;
