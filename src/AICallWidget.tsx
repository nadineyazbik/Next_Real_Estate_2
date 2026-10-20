import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  X,
  Volume2,
  VolumeX,
  Square,
  Pause,
  Play,
  Filter,
  AlertCircle,
  Send,
  Trash2,
  ShieldAlert,
  Loader2,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { Language } from './types';

interface AICallWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onFilterProperties: (filters: {
    location?: string;
    propertyType?: string;
    action?: string;
    budget?: string;
    bedrooms?: string;
    saleOrRental?: string;
  }) => void;
  onScheduleAppointment: (details?: any) => void;
  onViewProperty?: (propertyId: string) => void;
  lastFilterAction?: { location?: string; propertyType?: string; action?: string; timestamp: number } | null;
  lastAppointmentAction?: { text: string; timestamp: number } | null;
  autoStart?: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  time: string;
}

const MOHAMMAD_AVATAR_SRC = '/mohammad-avatar.jpg';
const MOHAMMAD_FALLBACK_AVATAR = '/assets/mohammad-avatar.jpg';

// Requirement 4: Lebanese Arabic Welcome Message
const LEBANESE_GREETING_AR =
  'أهلاً! أنا محمد من Next Real Estate. فيك تحكي معي بالعربي أو بالإنكليزي، أو تكتب هون، وأنا بفلتر العقارات عالشاشة.';
const LEBANESE_GREETING_EN =
  'أهلاً وسهلاً! أنا محمد من Next Real Estate. فيك تحكي معي أو تكتب هون، وأنا بفلترلك العقارات عالشاشة.\nHello! I am Mohammad from Next Real Estate. You can talk or type in Arabic or English.';

// Agent ID read strictly from public environment variable VITE_ELEVENLABS_AGENT_ID
const AGENT_ID = (import.meta.env.VITE_ELEVENLABS_AGENT_ID as string) || '';

const AICallWidgetInner: React.FC<AICallWidgetProps> = ({
  isOpen,
  onClose,
  lang,
  onFilterProperties,
  onScheduleAppointment,
  onViewProperty,
  lastFilterAction,
}) => {
  const isArabic = lang === 'ar';

  // State
  const [inputText, setInputText] = useState<string>('');
  const [avatarSrc, setAvatarSrc] = useState<string>(MOHAMMAD_AVATAR_SRC);

  // Permission & error banner states
  const [permissionDeniedBanner, setPermissionDeniedBanner] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dictation (Speech-to-Text) states - Separate from Voice Call
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [dictationSeconds, setDictationSeconds] = useState<number>(0);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);

  // TTS Read-Aloud states
  const [loadingTtsMessageId, setLoadingTtsMessageId] = useState<string | null>(null);
  const [playingTtsMessageId, setPlayingTtsMessageId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [pausedTtsMessageId, setPausedTtsMessageId] = useState<string | null>(null);

  // WhatsApp appointment booking link if triggered
  const [whatsappDispatchUrl, setWhatsappDispatchUrl] = useState<string | null>(null);

  // Chat messages
  const getInitialMessage = useCallback((): ChatMessage => ({
    id: `init-${Date.now()}`,
    sender: 'agent',
    text: isArabic ? LEBANESE_GREETING_AR : LEBANESE_GREETING_EN,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }), [isArabic]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [getInitialMessage()]);

  // Refs
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingTypedMessageRef = useRef<string | null>(null);
  const callStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);
const ttsCacheRef = useRef<Record<string, string>>({});

  // Dictation refs
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const dictationStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const baseInputTextRef = useRef<string>('');

  // Scroll to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Client Tools for ElevenLabs Agent (Live property filtering)
  const clientTools = {
    filter_properties: async (parameters: any) => {
      try {
        console.log('[ElevenLabs Tool] filter_properties:', parameters);
        onFilterProperties({
          ...parameters,
          propertyType: parameters?.propertyType || parameters?.property_type,
          budget:
            parameters?.budget ||
            (parameters?.max_price ? String(parameters.max_price) : undefined),
        });
        if (parameters?.propertyId && onViewProperty) {
          onViewProperty(parameters.propertyId);
        }
        return isArabic
          ? 'تمت تصفية العقارات بنجاح وعرضها مباشرة على شاشة الزبون'
          : 'Properties successfully filtered on customer screen';
      } catch (e: any) {
        console.error('Error in filter_properties client tool:', e);
        return 'Error filtering properties';
      }
    },
    search_properties: async (parameters: any) => {
      try {
        const query = parameters?.query || parameters?.location || parameters?.type;
        console.log('[ElevenLabs Tool] search_properties:', query);
        onFilterProperties({ location: query });
        return isArabic
          ? `تم البحث عن العقارات المطابقة لـ "${query}" وعرضها على الشاشة`
          : `Searched and displayed properties matching "${query}" on screen`;
      } catch (e: any) {
        console.error('Error in search_properties tool:', e);
        return 'Error searching properties';
      }
    },
    schedule_viewing: async (parameters: any) => {
      try {
        console.log('[ElevenLabs Tool] schedule_viewing:', parameters);
        onScheduleAppointment(parameters);

        const propertyId = parameters?.propertyId || parameters?.referenceNo || 'General';
        const clientName = parameters?.name || parameters?.clientName || 'Valued Client';
        const clientPhone = parameters?.phone || parameters?.clientPhone || '';
        const date = parameters?.date || parameters?.preferredDate || 'Upcoming Viewing';

        const whatsappText = encodeURIComponent(
          `Hello Next Real Estate! I would like to confirm a viewing appointment:\n` +
            `• Property: ${propertyId}\n` +
            `• Client: ${clientName}\n` +
            `• Phone: ${clientPhone}\n` +
            `• Preferred Date: ${date}`
        );
        const waLink = `https://wa.me/96176743414?text=${whatsappText}`;
        setWhatsappDispatchUrl(waLink);

        return isArabic
          ? 'تم استلام طلب الموعد وتجهيز رابط التأكيد المباشر عبر الواتساب'
          : 'Appointment scheduled. Direct WhatsApp confirmation prepared.';
      } catch (e) {
        return 'Error scheduling appointment';
      }
    },
    view_property: async (parameters: any) => {
      const id = parameters?.propertyId || parameters?.id || parameters?.referenceNo;
      if (id && onViewProperty) {
        onViewProperty(id);
        return isArabic
          ? `تم فتح صفحة تفاصيل العقار ${id} مباشرة على الشاشة`
          : `Opened property ${id} details page on screen`;
      }
      return 'Property identifier missing';
    },
  };

  // Official ElevenLabs useConversation hook for voice calling
  const conversation = useConversation({
    clientTools,
    onConnect: () => {
      console.log('[ElevenLabs] Connected successfully to agent');
      setErrorMessage(null);
      setPermissionDeniedBanner(false);

      if (pendingTypedMessageRef.current) {
        const text = pendingTypedMessageRef.current;
        pendingTypedMessageRef.current = null;
        try {
          conversation.sendUserMessage(text);
        } catch (err) {
          console.error('[ElevenLabs] Error sending pending message:', err);
        }
      }
    },
    onDisconnect: (details) => {
      console.log('[ElevenLabs] Disconnected:', details);
      if (callStreamRef.current) {
        callStreamRef.current.getTracks().forEach((track) => track.stop());
        callStreamRef.current = null;
      }
    },
    onError: (msg: string, context?: any) => {
      console.error('[ElevenLabs] Agent error:', msg, context);
      setErrorMessage(
        isArabic
          ? 'خدمة الصوت غير متوفرة حالياً'
          : 'Voice service is temporarily unavailable'
      );
    },
    onMessage: (payload: any) => {
      console.log('[ElevenLabs] Message received:', payload);
      const text = String(payload?.message || '').replace(/\[[^\]]*\]/g, '').replace(/[ \t]{2,}/g, ' ').trim();
      if (!text || !text.trim()) return;

      const isUser = payload?.role === 'user' || payload?.source === 'user';
      const role: 'user' | 'agent' = isUser ? 'user' : 'agent';

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === role && last.text.trim() === text.trim()) {
          return prev;
        }
        return [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            sender: role,
            text: text.trim(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];
      });
    },
  });

  // Handle microphone errors with user-friendly messages
  const handleMicrophoneError = (err: any) => {
    console.error('Microphone access error:', err?.name, err?.message, err);

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      setPermissionDeniedBanner(true);
      setErrorMessage(
        isArabic
          ? 'يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح للاستمرار.'
          : 'Please allow microphone access in your browser settings to continue.'
      );
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      setPermissionDeniedBanner(false);
      setErrorMessage(
        isArabic
          ? 'لم يتم العثور على ميكروفون متصل بجهازك. يرجى توصيل ميكروفون.'
          : 'No microphone was found on your device. Please connect one.'
      );
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      setPermissionDeniedBanner(false);
      setErrorMessage(
        isArabic
          ? 'الميكروفون قيد الاستخدام حالياً من تطبيق آخر أو يتعذر قراءته.'
          : 'Microphone is busy or being used by another application.'
      );
    } else {
      setPermissionDeniedBanner(false);
      setErrorMessage(
        isArabic
          ? `تعذر تشغيل الميكروفون (${err.name || 'خطأ'}).`
          : `Microphone error (${err.name || 'Unknown'}).`
      );
    }
  };

  // ==========================================================================
  // FUNCTION 1: startVoiceCall() - Started ONLY from Header Phone Button
  // ==========================================================================
  const startVoiceCall = async () => {
    setPermissionDeniedBanner(false);
    setErrorMessage(null);

    // Stop any ongoing dictation first
    if (isDictating) {
      stopDictation();
    }

    if (!AGENT_ID) {
      console.error('VITE_ELEVENLABS_AGENT_ID is missing in .env.local');
      setErrorMessage(
        isArabic
          ? 'خدمة الصوت غير متوفرة حالياً'
          : 'Voice service is temporarily unavailable'
      );
      return;
    }

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      console.error('Microphone error: Insecure context (no HTTPS)');
      setErrorMessage(
        isArabic
          ? 'يتطلب استخدام الميكروفون بيئة آمنة مشفرة (HTTPS).'
          : 'Microphone requires a secure HTTPS context.'
      );
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      console.error('Microphone error: getUserMedia not supported');
      setErrorMessage(
        isArabic
          ? 'المتصفح الحالي لا يدعم الوصول للميكروفون.'
          : 'Your browser does not support getUserMedia microphone access.'
      );
      return;
    }

    try {
      // 1. Request microphone permission ONLY on click
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      callStreamRef.current = stream;
      setPermissionDeniedBanner(false);
      setErrorMessage(null);

      // 2. Fetch database properties to provide real estate context
      let databasePropertiesContext = '';
      try {
        const pRes = await fetch('/api/agent/properties');
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData?.properties && Array.isArray(pData.properties)) {
            databasePropertiesContext = pData.properties
              .slice(0, 30)
              .map(
                (p: any) =>
                  `• [REF: ${p.referenceNo} | ID: ${p.id}] ${p.title} (${p.titleAr}) in ${p.location} - $${Number(p.price).toLocaleString()} (${
                    p.isRental ? 'Rental' : 'Sale'
                  }), ${p.beds || 3} Beds, ${p.areaSqm} sqm`
              )
              .join('\n');
          }
        }
      } catch (fetchErr) {
        console.warn('Could not load properties context for session:', fetchErr);
      }

      // 3. Start ElevenLabs session using the official SDK
      await conversation.startSession({
        agentId: AGENT_ID,
        clientTools,
        dynamicVariables: {
          database_properties: databasePropertiesContext,
        },
      });
    } catch (err: any) {
      handleMicrophoneError(err);
    }
  };

  // End voice call
  const handleEndCall = () => {
    try {
      conversation.endSession();
    } catch (e) {
      console.warn('Error ending ElevenLabs session:', e);
    }
    if (callStreamRef.current) {
      callStreamRef.current.getTracks().forEach((track) => track.stop());
      callStreamRef.current = null;
    }
  };

  // ==========================================================================
  // FUNCTION 2: startDictation() - Started ONLY from Input Bar Mic Button
  // Speech-to-Text: turns speech into text inside input field, NEVER starts call
  // ==========================================================================
  const startDictation = async () => {
    setPermissionDeniedBanner(false);
    setErrorMessage(null);

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      console.error('Microphone error: Insecure context (no HTTPS)');
      setErrorMessage(
        isArabic
          ? 'يتطلب استخدام الميكروفون بيئة آمنة مشفرة (HTTPS).'
          : 'Microphone requires a secure HTTPS context.'
      );
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      console.error('Microphone error: getUserMedia not supported');
      setErrorMessage(
        isArabic
          ? 'المتصفح الحالي لا يدعم إدخال الصوت.'
          : 'Your browser does not support microphone audio capture.'
      );
      return;
    }

    try {
      // 1. Request microphone permission ONLY on user click
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      dictationStreamRef.current = stream;

      // Reset state
      setIsDictating(true);
      setDictationSeconds(0);
      baseInputTextRef.current = inputText.trim() ? `${inputText.trim()} ` : '';

      // Start timer interval
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setDictationSeconds((s) => s + 1);
      }, 1000);

      // 2. Check for Web Speech API (webkitSpeechRecognition) with ar-LB
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.lang = 'ar-LB';
          recognition.interimResults = true;
          recognition.continuous = true;

          recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';
            for (let i = 0; i < event.results.length; i++) {
              if (event.results[i].isFinal) {
                final += event.results[i][0].transcript + ' ';
              } else {
                interim += event.results[i][0].transcript;
              }
            }
            const spokenText = (final + interim).trim();
            if (spokenText) {
              setInputText(baseInputTextRef.current + spokenText);
            }
          };

          recognition.onerror = (event: any) => {
            console.error('SpeechRecognition error:', event.error, event);
            if (
              ['network', 'service-not-allowed', 'language-not-supported', 'not-allowed'].includes(
                event.error
              )
            ) {
              // Fallback to MediaRecorder + /api/stt
              startMediaRecorderFallback(stream);
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (recErr) {
          console.error('SpeechRecognition failed to start, using MediaRecorder fallback:', recErr);
          startMediaRecorderFallback(stream);
        }
      } else {
        // Fallback directly to MediaRecorder + /api/stt
        startMediaRecorderFallback(stream);
      }
    } catch (err: any) {
      handleMicrophoneError(err);
      stopDictation();
    }
  };

  // Helper to start MediaRecorder fallback for /api/stt
  const startMediaRecorderFallback = (stream: MediaStream) => {
    try {
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
    } catch (mrErr) {
      console.error('MediaRecorder fallback start error:', mrErr);
    }
  };

  // Stop dictation and finalize transcribed text
  const stopDictation = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsDictating(false);

    // Stop SpeechRecognition if active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('SpeechRecognition stop:', e);
      }
      recognitionRef.current = null;
    }

    // Stop MediaRecorder and send to /api/stt if chunks collected
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        const chunks = audioChunksRef.current;
        if (chunks.length > 0) {
          setIsTranscribing(true);
          try {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Data = (reader.result as string)?.split(',')[1];
              if (base64Data) {
                const res = await fetch('/api/stt', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ audio: base64Data, mimeType: 'audio/webm' }),
                });
                if (res.ok) {
                  const data = await res.json();
                  if (data && typeof data.text === 'string' && data.text.trim()) {
                    setInputText((prev) =>
                      prev.trim() ? `${prev.trim()} ${data.text.trim()}` : data.text.trim()
                    );
                  }
                }
              }
              setIsTranscribing(false);
            };
            reader.readAsDataURL(blob);
          } catch (sttErr) {
            console.error('Failed to transcribe audio via /api/stt:', sttErr);
            setIsTranscribing(false);
          }
        }
      };

      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('MediaRecorder stop:', e);
      }
      mediaRecorderRef.current = null;
    }

    // Stop all microphone tracks
    if (dictationStreamRef.current) {
      dictationStreamRef.current.getTracks().forEach((t) => t.stop());
      dictationStreamRef.current = null;
    }
  };

  // Toggle dictation handler
  const handleToggleDictation = () => {
    if (isDictating) {
      stopDictation();
    } else {
      startDictation();
    }
  };

  // Format dictation timer e.g. 0:04
  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  // Clear chat history
  const handleClearChat = () => {
    setMessages([getInitialMessage()]);
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setPlayingTtsMessageId(null);
    setLoadingTtsMessageId(null);
    setTtsError(null);
    setWhatsappDispatchUrl(null);
  };

  // Play TTS (Read Aloud) via server-side ElevenLabs /api/tts endpoint
  const handleStopTTS = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    setPlayingTtsMessageId(null);
    setPausedTtsMessageId(null);
    setLoadingTtsMessageId(null);
  };

  const handlePauseResumeTTS = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setPausedTtsMessageId(null);
      } else {
        window.speechSynthesis.pause();
        setPausedTtsMessageId(playingTtsMessageId);
      }
      return;
    }
    const audio = activeAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setPausedTtsMessageId(null);
    } else {
      audio.pause();
      setPausedTtsMessageId(playingTtsMessageId);
    }
  };

  const handlePlayTTS = async (messageId: string, text: string) => {
    setPausedTtsMessageId(null);

    try {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }

      setTtsError(null);
      setLoadingTtsMessageId(messageId);
      setPlayingTtsMessageId(null);

      const cacheKey = `${messageId}:${text}`;
      let audioSrc = ttsCacheRef.current[cacheKey];

      if (!audioSrc) {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'TTS generation failed');
        }

        const data = await res.json();
        if (!data.audio) throw new Error('No audio returned');

        audioSrc = `data:${data.mimeType || 'audio/mpeg'};base64,${data.audio}`;
        ttsCacheRef.current[cacheKey] = audioSrc;
      }
      const audio = new Audio(audioSrc);
      activeAudioRef.current = audio;

      audio.onended = () => {
        setPlayingTtsMessageId(null);
        setLoadingTtsMessageId(null);
        activeAudioRef.current = null;
      };

      audio.onerror = () => {
        setPlayingTtsMessageId(null);
        setLoadingTtsMessageId(null);
        setTtsError(
          isArabic ? 'تعذر تشغيل الصوت للرسالة.' : 'Failed to play audio message.'
        );
      };

      await audio.play();
      setLoadingTtsMessageId(null);
      setPlayingTtsMessageId(messageId);
    } catch (err: any) {
      console.warn('ElevenLabs TTS failed:', err.message);
      setLoadingTtsMessageId(null);
      setPlayingTtsMessageId(null);
      setTtsError(
        isArabic
          ? 'خدمة الصوت غير متوفرة حالياً'
          : 'Voice service is temporarily unavailable'
      );
    }
  };

  // Free browser voice (no ElevenLabs credits)
  const pickArabicVoice = (): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    const arabic = voices.filter((v) => v.lang.toLowerCase().startsWith('ar'));
    if (arabic.length === 0) return null;
    const score = (v: SpeechSynthesisVoice) => {
      let s = 0;
      const n = v.name.toLowerCase();
      if (v.lang.toLowerCase().replace('_', '-') === 'ar-lb') s += 4;
      if (n.includes('natural') || n.includes('online')) s += 3;
      if (n.includes('google')) s += 2;
      if (!v.localService) s += 1;
      return s;
    };
    return [...arabic].sort((a, b) => score(b) - score(a))[0];
  };

  const handleBrowserTTS = (messageId: string, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setTtsError(
        isArabic
          ? 'المتصفح لا يدعم القراءة الصوتية.'
          : 'Your browser does not support text-to-speech.'
      );
      return;
    }
    window.speechSynthesis.cancel();
    setTtsError(null);
    setPausedTtsMessageId(null);

    const clean = text.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) return;

    const chunks =
      clean.match(/[\u0600-\u06FF\u0750-\u077F][^A-Za-z]*|[A-Za-z][^\u0600-\u06FF\u0750-\u077F]*/g) || [clean];
    const allVoices = window.speechSynthesis.getVoices();
    const arabicVoice = pickArabicVoice();
    const englishVoice =
      allVoices.find((v) => v.lang.toLowerCase().startsWith('en') && /natural|google|online/i.test(v.name)) ||
      allVoices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
      null;

    if (/[\u0600-\u06FF]/.test(clean) && !arabicVoice) {
      setTtsError(
        isArabic
          ? 'ما في صوت عربي مثبت على هالمتصفح. جرّب متصفح Edge أو ثبّت صوت عربي من إعدادات الويندوز.'
          : 'No Arabic voice is installed on this browser. Try Microsoft Edge or install an Arabic voice in Windows settings.'
      );
    }

    setPlayingTtsMessageId(messageId);
    chunks.forEach((chunk, i) => {
      const part = chunk.trim();
      if (!part) return;
      const isAr = /[\u0600-\u06FF]/.test(part);
      const u = new SpeechSynthesisUtterance(part);
      const v = isAr ? arabicVoice : englishVoice;
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else {
        u.lang = isAr ? 'ar-SA' : 'en-US';
      }
      u.rate = 1;
      u.pitch = 1;
      u.onerror = (e: any) => {
        if (e?.error === 'interrupted' || e?.error === 'canceled') return;
        setPlayingTtsMessageId(null);
        setPausedTtsMessageId(null);
      };
      if (i === chunks.length - 1) {
        u.onend = () => {
          setPlayingTtsMessageId(null);
          setPausedTtsMessageId(null);
        };
      }
      window.speechSynthesis.speak(u);
    });
  };

  // Send typed message
  const handleSendTypedMessage = async () => {
    const text = inputText.trim();
    if (!text) return;

    if (isDictating) {
      stopDictation();
    }

    // Display user message optimistically in the chat transcript
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // If an ElevenLabs voice call session is currently connected, send through it
    if (conversation.status === 'connected') {
      try {
        await conversation.sendUserMessage(text);
        return;
      } catch (err) {
        console.warn('sendUserMessage through connected ElevenLabs session failed:', err);
      }
    }

    // Otherwise, send directly to server agent endpoint
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, lang }),
      });

      {
        const data = await res.json().catch(() => null);
        if (data && data.reply) {
          const agentMsg: ChatMessage = {
            id: `agent-${Date.now()}`,
            sender: 'agent',
            text: data.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, agentMsg]);

          if (data.filterAction) {
            onFilterProperties(data.filterAction);
          }
        }
      }
    } catch (e) {
      console.error('Server agent chat error:', e);
    }
  };

  // Cleanup on unmount or widget close
  useEffect(() => {
    if (!isOpen) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      stopDictation();
      setPlayingTtsMessageId(null);
      setLoadingTtsMessageId(null);
      setPermissionDeniedBanner(false);
      setErrorMessage(null);
      setTtsError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConnected = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting';
  const isSpeaking = conversation.isSpeaking || conversation.mode === 'speaking';
  const isListening = isConnected && !isSpeaking;
  const isSessionActive = isConnected || isConnecting;

  return (
    <div
      className={`fixed z-[9999] w-[calc(100vw-1.5rem)] max-w-[380px] sm:max-w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-200/90 overflow-hidden flex flex-col transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 pointer-events-auto right-[12px] bottom-[calc(12px+env(safe-area-inset-bottom,0px))] sm:right-[24px] sm:bottom-[24px] ${
        isArabic ? 'font-cairo' : 'font-prompt'
      }`}
      dir={isArabic ? 'rtl' : 'ltr'}
      style={{
        maxHeight: 'min(740px, calc(100vh - 3.5rem))',
      }}
    >
      {/* 1. Header with Avatar, WhatsApp-style Phone Call Button, Trash, Close */}
      <div className="bg-[#0b3c35] text-white px-3.5 py-3 flex items-center justify-between select-none shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <img
              src={avatarSrc}
              onError={() => setAvatarSrc(MOHAMMAD_FALLBACK_AVATAR)}
              alt="Mohammad AI"
              className={`w-10 h-10 rounded-full object-cover border-2 shadow-xs transition-transform ${
                isSpeaking
                  ? 'border-emerald-400 ring-2 ring-emerald-300 scale-105'
                  : 'border-emerald-400/80'
              }`}
            />
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0b3c35] ${
                isConnected
                  ? 'bg-emerald-400 animate-pulse'
                  : isConnecting
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-emerald-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm tracking-tight text-white leading-tight">
                {isArabic ? 'محمد AI' : 'Mohammad AI'}
              </h3>
              <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-emerald-400/30">
                Next Real Estate
              </span>
            </div>
            <p className="text-[10.5px] text-emerald-100/70 leading-tight">
              {isConnected
                ? isSpeaking
                  ? isArabic
                    ? 'محمد يتحدث...'
                    : 'Mohammad is speaking'
                  : isArabic
                  ? 'متصل - يستمع إليك'
                  : 'Connected - Listening'
                : isConnecting
                ? isArabic
                  ? 'جارٍ الاتصال...'
                  : 'Connecting...'
                : isArabic
                ? 'مستشار Next Real Estate'
                : 'Next Real Estate Advisor'}
            </p>
          </div>
        </div>

        {/* Action Buttons: Phone Call Icon (WhatsApp style), Trash, Close */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Requirement 2: Small round phone-icon button inside the chat window HEADER */}
          <button
            type="button"
            onClick={isSessionActive ? handleEndCall : startVoiceCall}
            title={
              isSessionActive
                ? isArabic
                  ? 'إنهاء المكالمة'
                  : 'End call'
                : isArabic
                ? 'مكالمة صوتية'
                : 'Voice call'
            }
            aria-label={isArabic ? 'مكالمة صوتية' : 'Voice call'}
            className={`p-2 rounded-full transition-all cursor-pointer flex items-center justify-center ${
              isSessionActive
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse shadow-md ring-2 ring-red-400'
                : 'text-emerald-300 hover:text-white hover:bg-white/15'
            }`}
          >
            {isSessionActive ? (
              <PhoneOff className="w-4 h-4" />
            ) : (
              <Phone className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handleClearChat}
            title={isArabic ? 'مسح سجل المحادثة' : 'Clear Chat History'}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (isSessionActive) handleEndCall();
              stopDictation();
              onClose();
            }}
            title={isArabic ? 'إغلاق' : 'Close'}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Requirement 2: Green Bar Under Header while voice call is active */}
      {isSessionActive && (
        <div className="bg-emerald-600 text-white px-3.5 py-2 flex items-center justify-between shadow-xs transition-all animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 min-w-0">
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                <span className="text-xs font-bold truncate">
                  {isArabic ? 'جارٍ الاتصال...' : 'Connecting...'}
                </span>
              </>
            ) : (
              <>
                <div className="relative shrink-0 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping absolute" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-200 relative" />
                </div>
                <span className="text-xs font-bold truncate">
                  {isSpeaking
                    ? isArabic
                      ? 'محمد يتحدث...'
                      : 'Mohammad is speaking...'
                    : isArabic
                    ? 'يستمع إليك...'
                    : 'Listening...'}
                </span>
                {isSpeaking && (
                  <div className="flex items-center gap-0.5 h-3">
                    <span className="w-0.5 bg-white rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-2" />
                    <span className="w-0.5 bg-white rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-3" />
                    <span className="w-0.5 bg-white rounded-full animate-[pulse_0.3s_ease-in-out_infinite] h-2" />
                  </div>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleEndCall}
            className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white text-[11px] font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
            title={isArabic ? 'إنهاء المكالمة' : 'End call'}
          >
            <PhoneOff className="w-3 h-3" />
            <span>{isArabic ? 'إنهاء المكالمة' : 'End call'}</span>
          </button>
        </div>
      )}

      {/* 2. Main Body Area */}
      <div className="p-3 bg-gray-50/60 flex-grow flex flex-col justify-between overflow-hidden">
        {/* Permission Denied Banner (Shown ONLY if user clicked and denied) */}
        {permissionDeniedBanner && (
          <div className="mb-2 bg-amber-50 border border-amber-300 text-amber-900 text-xs p-2.5 rounded-xl flex items-start gap-2 animate-in fade-in">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">
                {isArabic ? 'الميكروفون محظور:' : 'Microphone Access Denied:'}
              </span>
              <span>
                {errorMessage ||
                  (isArabic
                    ? 'يرجى السماح بالوصول إلى الميكروفون من إعدادات المتصفح.'
                    : 'Please allow microphone access in your browser settings to continue.')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setPermissionDeniedBanner(false);
                setErrorMessage(null);
              }}
              className="text-amber-800/70 hover:text-amber-950 p-0.5 rounded cursor-pointer transition shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* General Error Notice */}
        {errorMessage && !permissionDeniedBanner && (
          <div className="mb-2 bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded-xl flex items-center justify-between gap-1.5 animate-in fade-in">
            <div className="flex items-center gap-1.5 truncate">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-700/70 hover:text-red-900 p-0.5 rounded cursor-pointer transition shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TTS Error Notice */}
        {ttsError && (
          <div className="mb-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs p-2 rounded-xl flex items-center justify-between gap-1.5 animate-in fade-in">
            <div className="flex items-center gap-1.5 truncate">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">{ttsError}</span>
            </div>
            <button
              type="button"
              onClick={() => setTtsError(null)}
              className="text-amber-800/70 hover:text-amber-950 p-0.5 rounded cursor-pointer transition shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* WhatsApp Dispatch Banner */}
        {whatsappDispatchUrl && (
          <div className="mb-2 bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-xs text-emerald-950 flex flex-col gap-1.5 animate-in fade-in">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>
                {isArabic ? 'تم تجهيز تفاصيل المعاينة للإدارة' : 'Viewing inquiry ready for WhatsApp'}
              </span>
            </div>
            <a
              href={whatsappDispatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#25D366] hover:bg-[#20ba59] text-white font-bold py-1.5 px-2.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
            >
              <span>{isArabic ? 'إرسال عبر واتساب (76743414)' : 'Send to WhatsApp (+961 76 743 414)'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Scrollable Chat Transcript */}
        <div className="flex-grow overflow-y-auto space-y-2 pr-1 max-h-[380px] sm:max-h-[460px] mb-2 text-xs">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`whitespace-pre-line max-w-[88%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-xs ${
                  m.sender === 'user'
                    ? 'bg-[#0b3c35] text-white rounded-br-xs font-medium'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-xs'
                }`}
              >
                {m.text}
              </div>

              {/* Message Footer: Timestamp & Speaker Icon for Agent Replies (Requirement 4) */}
              <div className="flex items-center gap-1.5 mt-0.5 px-1">
                <span className="text-[9px] text-gray-400">{m.time}</span>
                {m.sender === 'agent' && (
                  <div className="flex items-center gap-0.5">
                    {loadingTtsMessageId === m.id ? (
                      <span className="p-1">
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                      </span>
                    ) : playingTtsMessageId === m.id ? (
                      <>
                        <button
                          type="button"
                          onClick={handlePauseResumeTTS}
                          className="p-2 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                          title={
                            pausedTtsMessageId === m.id
                              ? isArabic ? 'متابعة' : 'Resume'
                              : isArabic ? 'إيقاف مؤقت' : 'Pause'
                          }
                        >
                          {pausedTtsMessageId === m.id ? (
                            <Play className="w-3 h-3 fill-current" />
                          ) : (
                            <Pause className="w-3 h-3 fill-current" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleStopTTS}
                          className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 cursor-pointer"
                          title={isArabic ? 'إيقاف' : 'Stop'}
                        >
                          <Square className="w-3 h-3 fill-current" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBrowserTTS(m.id, m.text)}
                        className="p-2 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-gray-100 cursor-pointer"
                        title={isArabic ? 'استماع للرسالة' : 'Read aloud'}
                      >
                        <Volume2 className="w-4 h-4" /><span className="text-[10px] font-semibold ms-1">{isArabic ? 'استماع' : 'Listen'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>

        {/* Live Filter Indicator */}
        {lastFilterAction && (
          <div className="mb-2 bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 flex items-center gap-1.5 text-[10.5px] text-emerald-900">
            <Filter className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="truncate">
              {isArabic ? 'تصفية حية من محمد AI:' : 'Filtered by Mohammad AI:'}{' '}
              {[lastFilterAction.location, lastFilterAction.propertyType, lastFilterAction.action]
                .filter(Boolean)
                .join(' • ')}
            </span>
          </div>
        )}

        {/* 3. Bottom Input Bar with Dictation Mic & Send (Requirement 2: Big Green Call Button Removed!) */}
        <div className="pt-2 border-t border-gray-100 flex flex-col gap-1.5">
          {/* Active Dictation Live Timer Indicator */}
          {isDictating && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-red-700 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                <span className="font-bold">
                  {isArabic ? 'جارٍ تسجيل الصوت (تكلم بالعربي)...' : 'Listening (speak in Lebanese Arabic)...'}
                </span>
              </div>
              <span className="font-mono font-bold text-xs bg-red-200/60 px-1.5 py-0.5 rounded text-red-900">
                {formatTimer(dictationSeconds)}
              </span>
            </div>
          )}

          {/* Transcribing Indicator */}
          {isTranscribing && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1 flex items-center gap-2 text-xs text-emerald-800">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700 shrink-0" />
              <span>{isArabic ? 'جارٍ تحويل الصوت إلى نص...' : 'Converting speech to text...'}</span>
            </div>
          )}

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendTypedMessage();
            }}
            className="flex items-center gap-1.5"
          >
            <input
              id="mohammad-ai-chat-input"
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (errorMessage) setErrorMessage(null);
                setPermissionDeniedBanner(false);
              }}
              placeholder={
                isDictating
                  ? isArabic
                    ? 'تكلم الآن، وسيظهر كلامك هنا...'
                    : 'Speak now, your words will appear here...'
                  : isArabic
                  ? 'اكتب رسالة إلى محمد AI...'
                  : 'Type a message to Mohammad AI...'
              }
              className={`flex-grow bg-gray-100 focus:bg-white text-gray-800 text-xs px-3 py-2.5 rounded-xl border focus:outline-none transition ${
                isDictating
                  ? 'border-red-400 bg-red-50/30'
                  : 'border-gray-200 focus:border-[#0b3c35]'
              }`}
            />

            {/* Requirement 3: Microphone Button for Dictation (Speech to Text) */}
            <button
              type="button"
              onClick={handleToggleDictation}
              title={
                isDictating
                  ? isArabic
                    ? 'إيقاف التسجيل الصوتي'
                    : 'Stop dictation'
                  : isArabic
                  ? 'تسجيل صوتي وتحويله إلى نص (إملاء)'
                  : 'Dictate message (Speech to Text)'
              }
              aria-label={isDictating ? 'Stop dictation' : 'Start dictation'}
              className={`p-2.5 rounded-xl transition-all cursor-pointer shrink-0 border flex items-center justify-center ${
                isDictating
                  ? 'bg-red-600 text-white border-red-600 animate-pulse shadow-md ring-4 ring-red-400/50'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
              }`}
            >
              {isDictating ? (
                <MicOff className="w-4 h-4 text-white" />
              ) : (
                <Mic className="w-4 h-4 text-gray-700" />
              )}
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isTranscribing}
              title={isArabic ? 'إرسال' : 'Send'}
              className="bg-[#0b3c35] hover:bg-[#072823] disabled:opacity-40 disabled:cursor-not-allowed text-white p-2.5 rounded-xl transition cursor-pointer shrink-0 shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export const AICallWidget: React.FC<AICallWidgetProps> = (props) => {
  return (
    <ConversationProvider>
      <AICallWidgetInner {...props} />
    </ConversationProvider>
  );
};
