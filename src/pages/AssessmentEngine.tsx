import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Play,
  ShieldAlert,
  Terminal
} from 'lucide-react';
import { apiFetch, BASE_URL } from '../utils/api';
import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';
import Editor from '@monaco-editor/react';

export const AssessmentEngine: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [examName, setExamName] = useState('');
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [examSessionToken, setExamSessionToken] = useState('');
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [visited, setVisited] = useState<number[]>([]);
  const [marked, setMarked] = useState<number[]>([]);

  const [faceStatus, setFaceStatus] = useState<'Face Active' | 'No Face' | 'Multiple Faces'>('Face Active');
  const [voiceVolume, setVoiceVolume] = useState(15);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);

  const [runOutputs, setRunOutputs] = useState<Record<string, string>>({});
  const [runningCode, setRunningCode] = useState(false);

  const [violationCount, setViolationCount] = useState(0);
  const answersRef = useRef(answers);
  const attemptIdRef = useRef<number | null>(null);
  const examSessionTokenRef = useRef<string>('');

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const recordViolation = () => {
    setViolationCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 3) {
        setTimeout(() => {
          alert('Your examination session has been automatically submitted because you have accumulated 3 security violations.');
          handleSubmitExam();
        }, 100);
      }
      return newCount;
    });
  };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<any>(null);
  const captureIntervalRef = useRef<any>(null);
  const faceDetectionFrameIdRef = useRef<number | null>(null);
  const currentVolumeIntervalRef = useRef<any>(null);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedLanguages, setSelectedLanguages] = useState<Record<string, string>>({});
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const aid = localStorage.getItem('active_attempt_id');
    const token = localStorage.getItem('exam_session_token');
    const snapshotStr = localStorage.getItem('active_snapshot_data');
    const name = localStorage.getItem('active_exam_name');

    if (!aid || !token || !snapshotStr) {
      navigate('/candidate');
      return;
    }

    if ((window as any).proctoringCleanupTimeout) {
      clearTimeout((window as any).proctoringCleanupTimeout);
      (window as any).proctoringCleanupTimeout = null;
    }

    setAttemptId(parseInt(aid));
    setExamSessionToken(token);
    attemptIdRef.current = parseInt(aid);
    examSessionTokenRef.current = token;
    setExamName(name || 'Examination Session');

    const snapshot = JSON.parse(snapshotStr);
    setQuestions(snapshot.questions || []);

    const durationSec = (snapshot.duration_minutes || 60) * 60;
    setTimeLeft(durationSec);

    const savedAnswers = localStorage.getItem(`answers_attempt_${aid}`);
    if (savedAnswers) {
      setAnswers(JSON.parse(savedAnswers));
    }

    setVisited([0]);
    setLoading(false);

    startProctoringCamera(parseInt(aid), token);

    connectProctoringWebSocket(parseInt(aid), token);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logTabSwitchViolation(parseInt(aid), token);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs) {
        logViolationEvent(parseInt(aid), token, 'fullscreen_exit', 'medium', 'Candidate exited fullscreen mode.');
        setTimeout(() => {
          captureAndUploadScreenshare(parseInt(aid), token, 'fullscreen');
          captureAndUploadWebcam(parseInt(aid), token, 'fullscreen');
        }, 500);
        recordViolation();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    startAutoSavers(parseInt(aid), token);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);

      (window as any).proctoringCleanupTimeout = setTimeout(() => {
        stopProctoring();
        (window as any).proctoringCleanupTimeout = null;
      }, 250);
    };
  }, [navigate]);

  useEffect(() => {
    if (timeLeft <= 0 && !loading) {
      handleSubmitExam();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, loading]);

  const loadDraft = async (qId: number, lang: string) => {
    if (!attemptId) return;
    const cacheKey = `${qId}_${lang}`;
    try {
      const res = await apiFetch(`/api/code/draft/${attemptId}/${qId}/${lang}`);
      if (res && res.source_code !== undefined) {
        setDrafts(prev => ({ ...prev, [cacheKey]: res.source_code }));
        handleCodeAnswerUpdate(qId, res.source_code, lang);
      }
    } catch (err) {
      const q = questions.find(x => x.id === qId);
      let fallbackCode = '';
      if (q) {
        fallbackCode = q.starter_code?.[lang] || q.boilerplate?.[lang] || '';
      }
      if (!fallbackCode) {
        if (lang === 'python') fallbackCode = 'def solution(n):\n    # Write your code here\n    pass';
        else if (lang === 'javascript') fallbackCode = 'function solution(n) {\n    // Write your code here\n}';
        else if (lang === 'cpp') fallbackCode = '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}';
        else if (lang === 'java') fallbackCode = 'public class Solution {\n    public static void main(String[] args) {\n        // Write your code here\n    }\n}';
      }
      setDrafts(prev => ({ ...prev, [cacheKey]: fallbackCode }));
      handleCodeAnswerUpdate(qId, fallbackCode, lang);
    }
  };

  const handleCodeAnswerUpdate = (qId: number, code: string, lang: string) => {
    const qIdStr = String(qId);
    setAnswers(prev => {
      const updated = {
        ...prev,
        [qIdStr]: { source_code: code, language: lang }
      };
      localStorage.setItem(`answers_attempt_${attemptId}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleCodeChange = (value: string | undefined) => {
    const val = value || '';
    const q = questions[currentIndex];
    if (!q) return;
    const allowedLangs = q.allowed_languages || ['python'];
    const lang = selectedLanguages[String(q.id)] || allowedLangs[0] || 'python';
    const cacheKey = `${q.id}_${lang}`;

    setDrafts(prev => ({ ...prev, [cacheKey]: val }));
    handleCodeAnswerUpdate(q.id, val, lang);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await apiFetch('/api/code/save', {
          method: 'POST',
          body: JSON.stringify({
            attempt_id: attemptId,
            question_id: q.id,
            language: lang,
            source_code: val
          })
        });
      } catch (err) {
        console.error('Failed to auto-save code draft:', err);
      }
    }, 2000);
  };

  const logTelemetryEvent = async (eventType: string, pasteLength?: number) => {
    const q = questions[currentIndex];
    if (!q || !attemptId) return;
    try {
      await apiFetch('/api/code/telemetry/event', {
        method: 'POST',
        body: JSON.stringify({
          attempt_id: attemptId,
          question_id: q.id,
          event_type: eventType,
          paste_length: pasteLength
        })
      });
    } catch (err) {
      console.error('Failed to log telemetry event:', err);
    }
  };

  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const pastedText = e.clipboardData.getData('text') || '';
    if (pastedText.length > 0) {
      logTelemetryEvent('paste', pastedText.length);
    }
  };

  useEffect(() => {
    const q = questions[currentIndex];
    if (attemptId && q && q.type === 'coding') {
      const qIdStr = String(q.id);
      const allowedLangs = q.allowed_languages || ['python'];
      const lang = selectedLanguages[qIdStr] || allowedLangs[0] || 'python';
      if (!selectedLanguages[qIdStr]) {
        setSelectedLanguages(prev => ({ ...prev, [qIdStr]: lang }));
      }
      const cacheKey = `${q.id}_${lang}`;
      if (drafts[cacheKey] === undefined) {
        loadDraft(q.id, lang);
      }
    }
  }, [currentIndex, attemptId, questions, selectedLanguages]);


  const startProctoringCamera = async (aid: number, token: string) => {
    if (currentVolumeIntervalRef.current) {
      clearInterval(currentVolumeIntervalRef.current);
      currentVolumeIntervalRef.current = null;
    }

    try {
      let cameraStream = (window as any).activeWebcamStream;
      const isStreamActive = cameraStream && cameraStream.getTracks().some((t: any) => t.readyState === 'live');

      if (!isStreamActive) {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });
      }

      cameraStreamRef.current = cameraStream;
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
        try {
          await videoRef.current.play();
        } catch (err) {
          console.error('Error playing camera feed', err);
        }
      }
      if (videoRef.current) {
        runContinuousFaceDetection(videoRef.current, aid, token);
      }
    } catch (err) {
      console.error('Camera streaming failed during proctoring', err);
    }

    try {
      let screenStream = (window as any).activeScreenStream;
      const isStreamActive = screenStream && screenStream.getTracks().some((t: any) => t.readyState === 'live');

      if (!isStreamActive) {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
      }

      screenStreamRef.current = screenStream;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = screenStream;
        try {
          await screenVideoRef.current.play();
        } catch (err) {
          console.error('Error playing screenshare feed', err);
        }
      }
    } catch (err) {
      console.error('Screen sharing streaming failed during proctoring', err);
    }

    try {
      let audioStream = (window as any).activeAudioStream;
      const isStreamActive = audioStream && audioStream.getTracks().some((t: any) => t.readyState === 'live');

      if (!isStreamActive) {
        audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
      }

      audioStreamRef.current = audioStream;
    } catch (err) {
      console.error('Microphone streaming failed during proctoring', err);
    }

    const volumeInterval = setInterval(() => {
      setVoiceVolume(Math.floor(Math.random() * 20) + 5);
    }, 500);

    currentVolumeIntervalRef.current = volumeInterval;
  };

  const runContinuousFaceDetection = async (video: HTMLVideoElement, aid: number, token: string) => {
    if (faceDetectionFrameIdRef.current) {
      cancelAnimationFrame(faceDetectionFrameIdRef.current);
      faceDetectionFrameIdRef.current = null;
    }
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
      );
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU"
        },
        runningMode: "VIDEO"
      });

      let lastVideoTime = -1;
      let lastViolationLogged = 0;

      const detectFrame = () => {
        if (!cameraStreamRef.current || !videoRef.current) {
          return;
        }

        const vid = video;
        if (vid.currentTime !== lastVideoTime) {
          lastVideoTime = vid.currentTime;

          try {
            const results = detector.detectForVideo(vid, performance.now());
            const detections = results.detections || [];

            if (detections.length === 0) {
              setFaceStatus('No Face');

              const now = Date.now();
              if (now - lastViolationLogged > 15000) {
                lastViolationLogged = now;
                captureAndUploadWebcam(aid, token, 'noface');
                captureAndUploadScreenshare(aid, token, 'noface');
                recordViolation();
              }
            } else if (detections.length > 1) {
              setFaceStatus('Multiple Faces');

              const now = Date.now();
              if (now - lastViolationLogged > 15000) {
                lastViolationLogged = now;
                captureAndUploadWebcam(aid, token, 'multiple');
                captureAndUploadScreenshare(aid, token, 'multiple');
                recordViolation();
              }
            } else {
              setFaceStatus('Face Active');
            }
          } catch (err) {
            console.error("Continuous face detection frame error:", err);
          }
        }

        faceDetectionFrameIdRef.current = requestAnimationFrame(detectFrame);
      };

      faceDetectionFrameIdRef.current = requestAnimationFrame(detectFrame);

    } catch (err) {
      console.error("Failed to start continuous face detection:", err);
      setFaceStatus('Face Active');
    }
  };

  const connectProctoringWebSocket = (aid: number, token: string) => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) { }
      wsRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/proctoring/ws`;;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'auth_candidate',
        token: token,
        attempt_id: aid
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'auth_success') {
          intervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'heartbeat' }));
            }
          }, 10000);
        } else if (msg.type === 'admin_control') {
          const { action, message } = msg;
          if (action === 'warning') {
            setAdminMessage(message || 'Warning issued from supervisor.');
          } else if (action === 'pause') {
            setIsPaused(true);
          } else if (action === 'resume') {
            setIsPaused(false);
          } else if (action === 'terminate') {
            alert('Your examination attempt has been terminated by the administrator due to policy violations.');
            stopProctoring();
            navigate('/candidate');
          } else if (action === 'force_submit') {
            alert('Your examination session was ended by the administrator. Autosubmitting answers...');
            handleSubmitExam();
          }
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    };

    ws.onerror = (err) => console.error('WebSocket connection error:', err);
    ws.onclose = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  };

  const startAutoSavers = (aid: number, token: string) => {

  };

  const logViolationEvent = async (aid: number, token: string, type: string, severity: string, details: string) => {
    try {
      await fetch(`${BASE_URL}/api/proctoring/event?exam_session_token=${token}&attempt_id=${aid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, severity, details })
      });
    } catch (err) {
      console.error('Failed to log violation event', err);
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
            return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.75));
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
          return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.75));
        }
      } catch (err) {
        console.warn('ImageCapture grabFrame failed, falling back to video element:', err);
      }
    }

    return null;
  };

  const logTabSwitchViolation = (aid: number, token: string) => {
    setTabSwitchCount(prev => {
      const next = prev + 1;
      logViolationEvent(
        aid,
        token,
        'tab_switch',
        next >= 3 ? 'high' : 'medium',
        `Candidate switched tabs or unfocused browser (Count: ${next}).`
      );
      return next;
    });

    setTimeout(() => {
      captureAndUploadScreenshare(aid, token, 'tab_switch');
      captureAndUploadWebcam(aid, token, 'tab_switch');
    }, 500);

    recordViolation();
  };

  const captureAndUploadWebcam = async (aid: number, token: string, typeSuffix: string = 'periodic') => {
    if (!cameraStreamRef.current) return;

    try {
      let blob = await captureFrameFromStream(cameraStreamRef.current, 320, 240);

      if (!blob && videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
        }
      }

      if (blob) {
        const formData = new FormData();
        formData.append('attempt_id', String(aid));
        formData.append('exam_session_token', token);
        formData.append('file', blob, `webcam_capture_${typeSuffix}.jpg`);

        await fetch(`${BASE_URL}/api/proctoring/screenshot`, {
          method: 'POST',
          body: formData
        });
      }
    } catch (err) {
      console.error('Failed to capture webcam frame', err);
    }
  };

  const captureAndUploadScreenshare = async (aid: number, token: string, typeSuffix: string = 'periodic') => {
    if (!screenStreamRef.current) return;

    try {
      let blob = await captureFrameFromStream(screenStreamRef.current, 800, 600);

      if (!blob && screenVideoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, canvas.height);
          blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
        }
      }

      if (blob) {
        const formData = new FormData();
        formData.append('attempt_id', String(aid));
        formData.append('exam_session_token', token);
        formData.append('file', blob, `screenshare_capture_${typeSuffix}.jpg`);

        await fetch(`${BASE_URL}/api/proctoring/screenshot`, {
          method: 'POST',
          body: formData
        });
      }
    } catch (err) {
      console.error('Failed to capture screenshare frame', err);
    }
  };

  const stopProctoring = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if ((window as any).activeWebcamStream) {
      try {
        (window as any).activeWebcamStream.getTracks().forEach((track: any) => track.stop());
      } catch (_) { }
      (window as any).activeWebcamStream = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if ((window as any).activeScreenStream) {
      try {
        (window as any).activeScreenStream.getTracks().forEach((track: any) => track.stop());
      } catch (_) { }
      (window as any).activeScreenStream = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if ((window as any).activeAudioStream) {
      try {
        (window as any).activeAudioStream.getTracks().forEach((track: any) => track.stop());
      } catch (_) { }
      (window as any).activeAudioStream = null;
    }

    if (faceDetectionFrameIdRef.current) {
      cancelAnimationFrame(faceDetectionFrameIdRef.current);
      faceDetectionFrameIdRef.current = null;
    }
    if (currentVolumeIntervalRef.current) {
      clearInterval(currentVolumeIntervalRef.current);
      currentVolumeIntervalRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) { }
      wsRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  };

  const handleSelectAnswer = (ans: any) => {
    const q = questions[currentIndex];
    const q_id = String(q.id);
    const updated = { ...answers, [q_id]: ans };
    setAnswers(updated);
    localStorage.setItem(`answers_attempt_${attemptId}`, JSON.stringify(updated));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (!visited.includes(nextIdx)) {
        setVisited([...visited, nextIdx]);
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleJumpToQuestion = (idx: number) => {
    setCurrentIndex(idx);
    if (!visited.includes(idx)) {
      setVisited([...visited, idx]);
    }
  };

  const handleToggleMark = () => {
    if (marked.includes(currentIndex)) {
      setMarked(marked.filter(x => x !== currentIndex));
    } else {
      setMarked([...marked, currentIndex]);
    }
  };

  const handleRunCode = async () => {
    const q = questions[currentIndex];
    const qIdStr = String(q.id);
    const allowedLangs = q.allowed_languages || ['python'];
    const lang = selectedLanguages[qIdStr] || allowedLangs[0] || 'python';
    const cacheKey = `${q.id}_${lang}`;
    const code = drafts[cacheKey] || '';

    setRunningCode(true);
    setRunOutputs(prev => ({ ...prev, [qIdStr]: 'Submitting to sandbox...\nRunning visible test cases...' }));

    try {
      const res = await apiFetch('/api/code/run', {
        method: 'POST',
        body: JSON.stringify({
          attempt_id: attemptId,
          question_id: q.id,
          language: lang,
          source_code: code
        })
      });

      let outMsg = '';
      if (res.compile_output) {
        outMsg += `[Compilation Output]:\n${res.compile_output}\n\n`;
      }
      if (res.status) {
        outMsg += `[Execution Status]: ${res.status}\n`;
      }
      if (res.exit_code !== undefined && res.exit_code !== null) {
        outMsg += `[Exit Code]: ${res.exit_code}\n`;
      }
      if (res.execution_time !== undefined && res.execution_time !== null) {
        outMsg += `[Execution Time]: ${res.execution_time.toFixed(3)}s\n`;
      }
      if (res.memory_used !== undefined && res.memory_used !== null) {
        outMsg += `[Memory Used]: ${(res.memory_used / 1024).toFixed(2)} MB\n`;
      }

      outMsg += `\n[Stdout]:\n${res.stdout || 'None'}\n`;
      if (res.stderr) {
        outMsg += `\n[Stderr]:\n${res.stderr}\n`;
      }

      if (res.passed) {
        outMsg += `\n✓ SUCCESS: All visible test cases passed!`;
      } else {
        outMsg += `\n✗ FAIL: Some test cases failed or output mismatch.`;
      }

      setRunOutputs(prev => ({ ...prev, [qIdStr]: outMsg }));
    } catch (err: any) {
      setRunOutputs(prev => ({ ...prev, [qIdStr]: `Error executing code: ${err.message || 'Unknown sandbox error'}` }));
    } finally {
      setRunningCode(false);
    }
  };

  const handleSubmitExam = async () => {
    setSubmitting(true);
    const aid = attemptIdRef.current;
    const token = examSessionTokenRef.current;
    if (!aid || !token) {
      console.error('Cannot submit exam: missing attemptId or token in refs');
      setSubmitting(false);
      return;
    }
    try {
      await apiFetch(`/api/assessments/${localStorage.getItem('active_exam_id')}/submit?exam_session_token=${token}&attempt_id=${aid}`, {
        method: 'POST',
        body: JSON.stringify({ answers: answersRef.current })
      });

      stopProctoring();
      localStorage.removeItem(`answers_attempt_${aid}`);
      localStorage.removeItem('active_attempt_id');
      localStorage.removeItem('exam_session_token');
      localStorage.removeItem('active_snapshot_data');

      navigate(`/feedback/${aid}`);
    } catch (err: any) {
      alert(err.message || 'Submission failed. Please check your internet connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-slate-450 font-semibold text-sm">Initializing secure testing container...</div>
      </div>
    );
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const qIdStr = String(currentQuestion.id);
  const currentAnswer = answers[qIdStr] !== undefined ? answers[qIdStr] : '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-hidden">
      {isPaused && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center z-50 p-6 text-center">
          <ShieldAlert className="w-16 h-16 text-amber-500 animate-pulse mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Session Temporarily Paused</h2>
          <p className="text-sm text-slate-400 max-w-md">Your examination session has been suspended by the administrator. Please wait for the supervisor to resume your attempt.</p>
        </div>
      )}

      {adminMessage && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-card max-w-md w-full shadow-2xl relative">
            <h3 className="text-base font-bold text-amber-400 flex items-center gap-1.5 mb-2">
              <ShieldAlert className="w-5 h-5" /> Warning from Supervisor
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-850 font-mono mb-6">{adminMessage}</p>
            <button
              onClick={() => setAdminMessage(null)}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-btn text-xs font-bold transition-all"
            >
              Acknowledge Warning
            </button>
          </div>
        </div>
      )}

      <header className="h-16 bg-slate-900 border-b border-slate-850 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-white tracking-wide truncate max-w-xs">{examName}</h2>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-950 border border-slate-850 rounded-xl">
            <span className={`text-xs font-bold font-mono ${timeLeft < 300 ? 'text-rose-400' : 'text-slate-300'}`}>
              Time: {formatTime(timeLeft)}
            </span>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to finish and submit your exam now? This action cannot be undone.')) {
                handleSubmitExam();
              }
            }}
            disabled={submitting}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-btn text-xs font-bold transition-all shadow-md shadow-emerald-600/10"
          >
            {submitting ? 'Submitting...' : 'Submit Exam'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden items-stretch">
        <aside className="w-[280px] bg-slate-900/60 border-r border-slate-850 p-6 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">Question Navigator</h3>

            <div className="grid grid-cols-4 gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAns = answers[String(q.id)] !== undefined && answers[String(q.id)] !== '';
                const isMarked = marked.includes(idx);
                const isVis = visited.includes(idx);

                let btnClass = 'bg-slate-950 border-slate-850 text-slate-500';
                if (isAns) {
                  btnClass = 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400';
                } else if (isMarked) {
                  btnClass = 'bg-amber-500/15 border-amber-500/25 text-amber-400';
                } else if (isVis) {
                  btnClass = 'bg-sky-500/15 border-sky-500/25 text-sky-400';
                }

                if (isCurrent) {
                  btnClass = 'bg-indigo-600 border-indigo-500 text-white font-bold ring-2 ring-indigo-500/20';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => handleJumpToQuestion(idx)}
                    className={`w-11 h-11 border rounded-xl text-xs flex items-center justify-center transition-all ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 mt-8 space-y-2.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-md bg-slate-950 border border-slate-850"></span> Unvisited</div>
            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-md bg-sky-500/15 border border-sky-500/25"></span> Visited</div>
            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-md bg-emerald-500/15 border border-emerald-500/25"></span> Answered</div>
            <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 rounded-md bg-amber-500/15 border border-amber-500/25"></span> Review</div>
          </div>
        </aside>

        <main className="flex-1 p-8 flex flex-col justify-between overflow-y-auto bg-slate-950/20">
          <div>
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                Question {currentIndex + 1} of {questions.length} ({currentQuestion.marks} Marks)
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Difficulty: {currentQuestion.difficulty}</span>
            </div>

            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white leading-relaxed text-left">{currentQuestion.title}</h2>

              {currentQuestion.type === "code_output_mcq" &&
                currentQuestion.options?.code && (
                  <div className="mt-5 max-w-3xl overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">

                    <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Code Snippet
                      </span>

                      <span className="rounded-md bg-slate-800 px-3 py-1 text-[10px] font-bold uppercase text-indigo-300">
                        {(currentQuestion.options?.language || "python").toUpperCase()}
                      </span>
                    </div>

                    <Editor
                      height="300px"
                      language={
                        currentQuestion.options?.language === "cpp"
                          ? "cpp"
                          : currentQuestion.options?.language || "python"
                      }
                      theme="vs-dark"
                      value={currentQuestion.options?.code || ""}
                      options={{
                        readOnly: true,
                        minimap: {
                          enabled: false
                        },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        lineNumbers: "on",
                        wordWrap: "on",
                        fontSize: 14,
                        tabSize: 4,
                        fontFamily: "'Fira Code', monospace",
                        cursorStyle: "line",
                        renderLineHighlight: "none",
                        folding: false,
                        contextmenu: false,
                        padding: {
                          top: 10,
                          bottom: 10
                        }
                      }}
                    />

                  </div>
              )}

              <div className="mt-8">
                {(currentQuestion.type === 'mcq' || currentQuestion.type === 'code_output_mcq') && (
                  <div className="grid grid-cols-1 gap-3 max-w-xl">
                    {(() => {
                      const choices = currentQuestion.type === 'code_output_mcq'
                        ? (currentQuestion.options?.choices || [])
                        : (Array.isArray(currentQuestion.options) ? currentQuestion.options : []);
                      return choices.map((opt: string) => (
                        <button
                          key={opt}
                          onClick={() => handleSelectAnswer(opt)}
                          className={`h-12 border rounded-xl px-5 text-xs font-semibold text-left transition-all duration-200 flex items-center ${currentAnswer === opt
                            ? 'bg-indigo-650/10 border-indigo-500 text-indigo-400'
                            : 'bg-slate-900/60 border-slate-800 text-slate-355 hover:bg-slate-850 hover:text-white'
                            }`}
                        >
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${currentAnswer === opt ? 'border-indigo-400' : 'border-slate-650'
                            }`}>
                            {currentAnswer === opt && <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>}
                          </span>
                          {opt}
                        </button>
                      ));
                    })()}
                  </div>
                )}

                {currentQuestion.type === 'multiselect' && (
                  <div className="grid grid-cols-1 gap-3 max-w-xl">
                    {currentQuestion.options && Array.isArray(currentQuestion.options) && currentQuestion.options.map((opt: any) => {
                      const selectedList = Array.isArray(currentAnswer) ? currentAnswer : [];
                      const isSelected = selectedList.includes(opt);

                      const toggleSelect = () => {
                        if (isSelected) {
                          handleSelectAnswer(selectedList.filter(x => x !== opt));
                        } else {
                          handleSelectAnswer([...selectedList, opt]);
                        }
                      };

                      return (
                        <button
                          key={opt}
                          onClick={toggleSelect}
                          className={`h-12 border rounded-xl px-5 text-xs font-semibold text-left transition-all duration-200 flex items-center ${isSelected
                            ? 'bg-indigo-650/10 border-indigo-500 text-indigo-400'
                            : 'bg-slate-900/60 border-slate-800 text-slate-350 hover:bg-slate-850 hover:text-white'
                            }`}
                        >
                          <span className={`w-4 h-4 rounded-md border flex items-center justify-center mr-3 ${isSelected ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-650'
                            }`}>
                            {isSelected && <span className="text-indigo-400 font-extrabold text-[10px]">✓</span>}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === 'truefalse' && (
                  <div className="flex gap-4 max-w-md">
                    {['True', 'False'].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleSelectAnswer(opt)}
                        className={`flex-1 h-12 border rounded-xl font-bold transition-all duration-200 ${currentAnswer === opt
                          ? 'bg-indigo-650/10 border-indigo-500 text-indigo-400'
                          : 'bg-slate-900/60 border-slate-800 text-slate-350 hover:bg-slate-850 hover:text-white'
                          }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'descriptive' && (
                  <textarea
                    rows={6}
                    placeholder="Enter your explanation response here..."
                    value={currentAnswer}
                    onChange={(e) => handleSelectAnswer(e.target.value)}
                    className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-card p-4 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none resize-none"
                  />
                )}

                {currentQuestion.type === 'coding' && (() => {
                  const allowedLangs = currentQuestion.allowed_languages || ['python'];
                  const lang = selectedLanguages[qIdStr] || allowedLangs[0] || 'python';
                  const cacheKey = `${currentQuestion.id}_${lang}`;
                  const codeValue = drafts[cacheKey] || '';

                  return (
                    <div className="space-y-4 max-w-3xl">
                      <div className="bg-slate-900 border border-slate-800 rounded-card overflow-hidden shadow-xl text-left">
                        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                          <div className="flex items-center gap-2 text-indigo-400">
                            <Terminal className="w-4 h-4" />
                            <select
                              value={lang}
                              onChange={(e) => {
                                const newLang = e.target.value;
                                setSelectedLanguages(prev => ({ ...prev, [qIdStr]: newLang }));
                              }}
                              className="bg-slate-950 border border-slate-850 text-slate-200 rounded px-2 py-0.5 capitalize focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold cursor-pointer"
                            >
                              {allowedLangs.map((l: string) => (
                                <option key={l} value={l} className="bg-slate-900 capitalize">
                                  {l === 'cpp' ? 'C++' : l}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="text-[9px] text-slate-500 font-semibold uppercase">
                            Sandbox Environment Active
                          </span>
                        </div>

                        <div
                          onPaste={handleEditorPaste}
                          className="w-full bg-[#1e1e1e] border-t border-b border-slate-800"
                        >
                          <Editor
                            height="350px"
                            language={lang === 'javascript' ? 'javascript' : lang}
                            theme="vs-dark"
                            value={codeValue}
                            onChange={handleCodeChange}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 13,
                              fontFamily: "'Fira Code', 'Courier New', monospace",
                              scrollBeyondLastLine: false,
                              automaticLayout: true,
                              padding: { top: 12, bottom: 12 }
                            }}
                          />
                        </div>

                        <div className="px-5 py-3 bg-slate-950/40 border-t border-slate-800 flex justify-between items-center">
                          <span className="text-[9px] text-slate-450 font-bold font-mono">
                            Auto-saves changes in 2s
                          </span>
                          <button
                            onClick={handleRunCode}
                            disabled={runningCode}
                            className="h-8 px-4 bg-indigo-660 hover:bg-indigo-600 text-white rounded-btn text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-650/10"
                          >
                            <Play className="w-3.5 h-3.5" /> {runningCode ? 'Executing...' : 'Run Test Cases'}
                          </button>
                        </div>
                      </div>

                      {runOutputs[qIdStr] && (
                        <div className="bg-slate-900 border border-slate-850 p-5 rounded-card text-left font-mono">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 font-sans">Sandbox Console Output</h4>
                          <pre className="bg-slate-950 p-4 border border-slate-900 rounded-xl text-[10px] text-slate-350 leading-relaxed overflow-x-auto text-left whitespace-pre-wrap break-all">
                            {runOutputs[qIdStr]}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-slate-850 pt-6 mt-8">
            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="h-10 px-4 border border-slate-800 text-slate-400 rounded-btn text-xs font-semibold hover:bg-slate-900 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="w-4 h-4 inline mr-1" /> Previous
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === questions.length - 1}
                className="h-10 px-4 border border-slate-800 text-slate-400 rounded-btn text-xs font-semibold hover:bg-slate-900 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-transparent"
              >
                Next <ChevronRight className="w-4 h-4 inline ml-1" />
              </button>
            </div>

            <button
              onClick={handleToggleMark}
              className={`h-10 px-4 border rounded-btn text-xs font-semibold transition-all flex items-center gap-1.5 ${marked.includes(currentIndex)
                ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                : 'border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
            >
              <Bookmark className="w-4 h-4" />
              {marked.includes(currentIndex) ? 'Marked for Review' : 'Mark for Review'}
            </button>
          </div>
        </main>

        {false && [faceStatus, voiceVolume, tabSwitchCount, isFullscreen]}
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '800px', height: '600px', opacity: 0, overflow: 'hidden' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '640px', height: '480px' }}
          />
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted
            style={{ width: '800px', height: '600px' }}
          />
        </div>
      </div>
    </div>
  );
};
export default AssessmentEngine;
