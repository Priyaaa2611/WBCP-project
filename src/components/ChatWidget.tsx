import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Minus, 
  Maximize2, 
  Image as ImageIcon, 
  Loader2, 
  User, 
  Bot, 
  MapPin, 
  Mic, 
  MicOff, 
  RotateCw, 
  Sparkles,
  Satellite,
  Key,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Volume2,
  VolumeX,
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateChatResponse } from '../services/ragService';
import { agricultureService } from '../services/aiService';
import { useUIStore } from '../stores/uiStore';
import { askGeminiAssistant, generateAdaptiveQuestions, getEffectiveGeminiApiKey } from '../services/geminiAgent';
import { ApiKeyModal } from './ApiKeyModal';
import { useTranslation } from 'react-i18next';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  image?: string;
  thinking?: string;
}

export const ChatWidget: React.FC = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'en';

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showQuestionsPanel, setShowQuestionsPanel] = useState(true);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'bot',
      content: "Hello! I'm your Smart Agriculture Assistant. How can I help you today? You can ask about crops, diseases, weather, or even upload a photo of a plant for diagnosis.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState<string>('');
  const [location, setLocation] = useState<string | null>(null);

  // Speech Recognition & Live Voice State
  const [isListening, setIsListening] = useState(false);
  const [isLiveVoiceMode, setIsLiveVoiceMode] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isLiveVoiceModeRef = useRef(false);
  const liveSendTimerRef = useRef<any>(null);

  // Sync ref
  useEffect(() => {
    isLiveVoiceModeRef.current = isLiveVoiceMode;
  }, [isLiveVoiceMode]);

  // Clean markdown for natural text-to-speech
  const cleanMarkdownForSpeech = (text: string): string => {
    return text
      .replace(/[*#_`~[\]()]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/•|-|\+/g, '')
      .replace(/\n+/g, '. ')
      .trim();
  };

  // Speak text aloud
  const speakText = (text: string, messageId: string, onFinish?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis is not supported in this browser.');
      if (onFinish) onFinish();
      return;
    }

    // Toggle off if currently speaking this same message
    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const clean = cleanMarkdownForSpeech(text);
    if (!clean) {
      if (onFinish) onFinish();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    const langCode = currentLang === 'hi' ? 'hi-IN' : currentLang === 'mr' ? 'mr-IN' : 'en-IN';
    utterance.lang = langCode;

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang === langCode || v.lang.startsWith(langCode.slice(0, 2)));
    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setSpeakingMessageId(null);
      if (onFinish) onFinish();
    };

    utterance.onerror = () => {
      setSpeakingMessageId(null);
      if (onFinish) onFinish();
    };

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  };

  // Active farm analysis from GIS / CropHealthDashboard
  const activeAnalysis = useUIStore((s) => s.activeAnalysis);
  const [questionSetIndex, setQuestionSetIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinkingStep]);

  // Start & Stop Speech Recognition
  const startListening = () => {
    if (!recognitionRef.current) return;
    try {
      const langCode = currentLang === 'hi' ? 'hi-IN' : currentLang === 'mr' ? 'mr-IN' : 'en-IN';
      recognitionRef.current.lang = langCode;
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // Recognition may already be running
    }
  };

  const stopListening = () => {
    if (liveSendTimerRef.current) clearTimeout(liveSendTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }
  };

  // Toggle Live Conversational Voice Mode
  const toggleLiveVoiceMode = () => {
    if (!isLiveVoiceMode) {
      setIsLiveVoiceMode(true);
      isLiveVoiceModeRef.current = true;
      stopSpeaking();
      startListening();
    } else {
      setIsLiveVoiceMode(false);
      isLiveVoiceModeRef.current = false;
      stopListening();
      stopSpeaking();
    }
  };

  // Toggle standard mic
  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please type your message.');
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let transcript = '';
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }

        if (transcript) {
          setInput(transcript);

          // If in Live Voice Mode, automatically submit query on pause or final speech!
          if (isLiveVoiceModeRef.current) {
            if (liveSendTimerRef.current) clearTimeout(liveSendTimerRef.current);

            if (isFinal) {
              handleSend(transcript);
            } else {
              liveSendTimerRef.current = setTimeout(() => {
                if (transcript.trim().length >= 3) {
                  handleSend(transcript);
                }
              }, 1200);
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Get user location on mount
  useEffect(() => {
    const controller = new AbortController();
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${position.coords.latitude}&lon=${position.coords.longitude}&appid=19927003d654bcd63f64e32840eeba91`, {
              signal: controller.signal
            });
            const data = await res.json();
            if (data.name) setLocation(data.name);
          } catch (e: any) {
            if (e.name !== 'AbortError') {
              console.error("Error getting location name", e);
            }
          }
        },
        (err) => {
          if (import.meta.env.DEV) {
            console.warn("Geolocation denied", err);
          }
        }
      );
    }

    return () => controller.abort();
  }, []);

  const handleSend = async (text: string = input, imageFile?: File) => {
    if (!text.trim() && !imageFile) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      image: imageFile ? URL.createObjectURL(imageFile) : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setThinkingStep('');

    try {
      let botResponse = "";
      let botThinking = "";
      
      if (imageFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read image file"));
          reader.readAsDataURL(imageFile);
        });
        const base64Image = await base64Promise;
        const result = await agricultureService.detectDisease(base64Image);
        
        if (result.result === "Low Confidence Detection") {
          botResponse = `I've analyzed the image, but I'm not very certain about the results. 
          
**Observation:** ${result.result}
**Confidence:** ${(result.confidence * 100).toFixed(1)}%

**Suggestions:**
${result.recommendations.map(r => `- ${r}`).join('\n')}`;
        } else {
          botResponse = `I've analyzed the image. 
          
**Detection:** ${result.result}
**Confidence:** ${(result.confidence * 100).toFixed(1)}%

**Details & Recommendations:**
${result.recommendations.join('\n')}`;
        }
      } else {
        // If active farm analysis exists, ground response with bioIntelligence telemetry
        if (activeAnalysis) {
          const geminiRes = await askGeminiAssistant({
            query: text,
            currentAnalysis: activeAnalysis,
            language: currentLang,
            onThinkingUpdate: (step) => setThinkingStep(step)
          });
          botResponse = geminiRes.text;
          botThinking = geminiRes.thinking;
        } else {
          const history = messages.slice(-10).map(m => ({ 
            role: m.role === 'bot' ? 'model' : 'user', 
            content: m.content 
          }));
          const fullQuery = location ? `${text} (User location: ${location})` : text;
          botResponse = await generateChatResponse(fullQuery, history);
        }
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: botResponse || "I'm sorry, I encountered an error while processing your request.",
        timestamp: new Date(),
        thinking: botThinking || undefined
      };

      setMessages(prev => [...prev, botMessage]);

      // If Live Voice Mode is active: automatically speak out response and resume listening!
      if (isLiveVoiceModeRef.current && botResponse) {
        speakText(botResponse, botMessage.id, () => {
          if (isLiveVoiceModeRef.current) {
            startListening();
          }
        });
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      
      let errorMessage = "Sorry, I'm having trouble connecting to the server. Please try again later.";
      
      if (error.message?.includes("RESOURCE_EXHAUSTED")) {
        errorMessage = "I'm receiving too many requests right now. Please wait a moment and try again.";
      } else if (error.message?.includes("max tokens limit")) {
        errorMessage = "The response was too long for me to process. Could you try asking a more specific question?";
      }

      const errMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: errorMessage,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errMessage]);

      if (isLiveVoiceModeRef.current) {
        speakText(errorMessage, errMessage.id, () => {
          if (isLiveVoiceModeRef.current) {
            startListening();
          }
        });
      }
    } finally {
      setIsLoading(false);
      setThinkingStep('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSend("Analyzing this plant image...", file);
    }
  };

  const adaptiveQuestions = generateAdaptiveQuestions(activeAnalysis, currentLang, questionSetIndex);
  const effectiveKey = getEffectiveGeminiApiKey();

  return (
    <>
      <ApiKeyModal isOpen={showApiKeyModal} onClose={() => setShowApiKeyModal(false)} />

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                height: isMinimized ? '64px' : '600px',
                width: '430px'
              }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col mb-4"
            >
              {/* Header */}
              <div className="p-3.5 bg-stone-950/70 border-b border-stone-800 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-950">
                    <Bot size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center space-x-1.5">
                      <span>Farmer Assistant</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    </h3>
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-emerald-400 font-medium">
                        {activeAnalysis ? `🛰️ ${activeAnalysis.crop} (${activeAnalysis.prediction.riskScore}% risk)` : 'AI Diagnostic Advisor'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {/* Live Voice Talking Mode Toggle */}
                  <button
                    onClick={toggleLiveVoiceMode}
                    className={cn(
                      "flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-sm",
                      isLiveVoiceMode
                        ? "bg-emerald-500 text-white shadow-emerald-500/30 animate-pulse border border-emerald-400"
                        : "bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700"
                    )}
                    title={isLiveVoiceMode ? "Live Talking Mode Active (Click to stop)" : "Turn on Live Talking Mode (Hands-free voice)"}
                  >
                    <Radio size={11} className={isLiveVoiceMode ? "animate-spin" : "text-emerald-400"} />
                    <span>{isLiveVoiceMode ? "Live Talking ON" : "Live Voice"}</span>
                  </button>

                  <button 
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                  >
                    {isMinimized ? <Maximize2 size={16} /> : <Minus size={16} />}
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {!isMinimized && (
                <>
                  {/* Live Voice Status Indicator Bar */}
                  {isLiveVoiceMode && (
                    <div className="bg-emerald-950/70 border-b border-emerald-800/50 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-emerald-300">
                      <div className="flex items-center space-x-2 overflow-hidden">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
                        <span className="font-semibold truncate">
                          {speakingMessageId
                            ? "Speaking response aloud..."
                            : isListening
                            ? `Listening (${currentLang.toUpperCase()})... Speak now`
                            : "Processing query..."}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5 shrink-0">
                        {speakingMessageId && (
                          <button
                            onClick={stopSpeaking}
                            className="text-[10px] bg-emerald-900/60 hover:bg-emerald-800 px-2 py-0.5 rounded text-emerald-200 border border-emerald-700/50 cursor-pointer"
                          >
                            Mute
                          </button>
                        )}
                        <button
                          onClick={toggleLiveVoiceMode}
                          className="text-[10px] bg-stone-900/80 hover:bg-stone-800 px-2 py-0.5 rounded text-stone-300 hover:text-white border border-stone-700/60 cursor-pointer"
                        >
                          Exit Live
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Active Analysis Context Banner */}
                  {activeAnalysis && (
                    <div className="bg-emerald-950/40 border-b border-emerald-900/30 px-3.5 py-2 flex items-center justify-between text-xs text-emerald-300">
                      <span className="flex items-center space-x-1.5 font-medium">
                        <Satellite size={13} className="text-emerald-400 flex-shrink-0" />
                        <span className="truncate">Plot Telemetry: <strong>{activeAnalysis.crop}</strong> ({activeAnalysis.prediction.riskScore}% risk)</span>
                      </span>
                      <button 
                        onClick={() => setQuestionSetIndex(prev => prev + 1)}
                        className="flex items-center space-x-1 text-[11px] font-bold text-emerald-400 hover:text-white bg-emerald-900/40 px-2 py-0.5 rounded-lg border border-emerald-800/40 transition-colors cursor-pointer flex-shrink-0"
                        title="Rotate suggested questions"
                      >
                        <RotateCw size={10} />
                        <span>Refresh Qs</span>
                      </button>
                    </div>
                  )}

                  {/* Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-stone-700">
                    {messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={cn(
                          "flex w-full",
                          msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        <div className={cn(
                          "max-w-[85%] flex space-x-2",
                          msg.role === 'user' ? "flex-row-reverse space-x-reverse" : "flex-row"
                        )}>
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                            msg.role === 'user' ? "bg-emerald-600/30 text-emerald-400" : "bg-stone-800 border border-stone-700"
                          )}>
                            {msg.role === 'user' ? <User size={14} className="text-emerald-400" /> : <Bot size={14} className="text-stone-300" />}
                          </div>
                          <div className={cn(
                            "p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm",
                            msg.role === 'user' 
                              ? "bg-emerald-600 text-white rounded-tr-none font-medium" 
                              : "bg-stone-800/80 text-stone-200 border border-stone-700/80 rounded-tl-none"
                          )}>
                            {msg.image && (
                              <img src={msg.image} alt="Uploaded" className="max-w-full rounded-xl mb-2 border border-white/10 shadow" referrerPolicy="no-referrer" />
                            )}
                            {msg.thinking && (
                              <details className="mb-2 text-[11px] text-emerald-300 bg-stone-900/80 p-2 rounded-xl border border-emerald-900/40">
                                <summary className="cursor-pointer font-bold hover:text-emerald-200 flex items-center space-x-1">
                                  <Sparkles size={12} className="text-emerald-400 inline" />
                                  <span>Diagnostic Thinking Process</span>
                                </summary>
                                <p className="mt-1.5 text-stone-300 text-[10px] leading-relaxed">{msg.thinking}</p>
                              </details>
                            )}
                            <div className="prose prose-invert prose-xs max-w-none">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-stone-700/40">
                              <div className="text-[9px] opacity-50 font-mono">
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {msg.role === 'bot' && (
                                <button
                                  onClick={() => speakText(msg.content, msg.id)}
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center space-x-1 transition-colors cursor-pointer",
                                    speakingMessageId === msg.id
                                      ? "bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30"
                                      : "text-stone-400 hover:text-white hover:bg-stone-700/50"
                                  )}
                                  title={speakingMessageId === msg.id ? "Stop voice reading" : "Listen to answer (Text-to-speech)"}
                                >
                                  {speakingMessageId === msg.id ? (
                                    <>
                                      <VolumeX size={11} className="text-emerald-400 animate-pulse" />
                                      <span className="text-[9px] font-bold">Stop</span>
                                    </>
                                  ) : (
                                    <>
                                      <Volume2 size={11} />
                                      <span className="text-[9px]">Listen</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Thinking Status or Loading */}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="flex space-x-2">
                          <div className="w-7 h-7 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center flex-shrink-0">
                            <Bot size={14} className="text-stone-400" />
                          </div>
                          <div className="bg-stone-800/80 p-3 rounded-2xl rounded-tl-none border border-stone-700 flex items-center space-x-2 shadow-sm">
                            <Loader2 size={14} className="animate-spin text-emerald-400" />
                            <span className="text-xs text-stone-300">
                              {thinkingStep || 'Assistant is reasoning...'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Gorgeous, Fully Visible Suggested Questions Panel */}
                  {adaptiveQuestions && adaptiveQuestions.length > 0 && !isLoading && (
                    <div className="border-t border-stone-800 bg-stone-950/70 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setShowQuestionsPanel(!showQuestionsPanel)}
                          className="flex items-center space-x-1.5 text-xs font-bold text-stone-300 hover:text-white cursor-pointer"
                        >
                          <HelpCircle size={13} className="text-emerald-400" />
                          <span>Suggested Questions</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded-full">
                            {adaptiveQuestions.length}
                          </span>
                          {showQuestionsPanel ? <ChevronDown size={13} className="text-stone-500" /> : <ChevronUp size={13} className="text-stone-500" />}
                        </button>
                        <button
                          onClick={() => setQuestionSetIndex(prev => prev + 1)}
                          className="text-[10px] text-stone-400 hover:text-emerald-400 flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <RotateCw size={10} />
                          <span>New Questions</span>
                        </button>
                      </div>

                      {showQuestionsPanel && (
                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-stone-700">
                          {adaptiveQuestions.map((q, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSend(q)}
                              className="w-full text-left text-xs p-2 rounded-xl bg-stone-900 hover:bg-emerald-950/40 text-stone-300 hover:text-white border border-stone-800 hover:border-emerald-500/40 transition-all flex items-start space-x-2 group cursor-pointer shadow-sm"
                            >
                              <span className="text-emerald-400 font-bold group-hover:translate-x-0.5 transition-transform">›</span>
                              <span className="flex-1 leading-snug">{q}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Voice listening banner */}
                  {isListening && (
                    <div className="px-4 py-2 bg-rose-950/50 border-t border-rose-900/40 flex items-center space-x-2 text-rose-300 text-xs animate-pulse">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      <span className="font-bold">Listening to speech... speak now ({currentLang.toUpperCase()})</span>
                    </div>
                  )}

                  {/* Input Controls */}
                  <div className="p-3 border-t border-stone-800 bg-stone-900">
                    {location && (
                      <div className="flex items-center space-x-1 mb-1.5 px-1">
                        <MapPin size={11} className="text-emerald-400" />
                        <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">Location: {location}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1.5">
                      {/* Image upload button */}
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
                        title="Upload plant image"
                      >
                        <ImageIcon size={19} />
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                        className="hidden" 
                        accept="image/*"
                      />

                      {/* Speech Recognition Mic button */}
                      <button
                        type="button"
                        onClick={toggleVoiceInput}
                        className={cn(
                          "p-2 rounded-xl transition-colors cursor-pointer",
                          isListening 
                            ? "bg-rose-500 text-white animate-pulse" 
                            : "text-stone-400 hover:text-white hover:bg-stone-800"
                        )}
                        title={isListening ? "Listening... Click to stop" : "Speak question (Voice to text)"}
                      >
                        {isListening ? <MicOff size={19} /> : <Mic size={19} />}
                      </button>

                      <div className="flex-1 relative">
                        <input 
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                          placeholder={isListening ? "Listening to your voice..." : "Ask about your farm, diseases, weather..."}
                          className="w-full bg-stone-800 border border-stone-700 rounded-xl py-2 px-3 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>

                      <button 
                        onClick={() => handleSend()}
                        disabled={isLoading || !input.trim()}
                        className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 cursor-pointer shadow-md shadow-emerald-950"
                      >
                        <Send size={19} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animated Farmer Agent Button */}
        <div className="relative group/chat">
          {/* Rotating text ring */}
          <AnimatePresence>
            {!isOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1, rotate: 360 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ 
                  opacity: { duration: 0.3 },
                  scale: { duration: 0.3 },
                  rotate: { duration: 15, repeat: Infinity, ease: 'linear' }
                }}
                className="absolute -inset-6 pointer-events-none drop-shadow-md z-0"
              >
                <svg viewBox="0 0 100 100" className="w-full h-full fill-emerald-100 font-bold tracking-widest uppercase">
                  <defs>
                    <path id="textCircle" d="M 50, 50 m -40, 0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0" />
                  </defs>
                  <text fontSize="9.5">
                    <textPath href="#textCircle" startOffset="0%">
                      👋 I'M HERE TO HELP! • ASK ME ANYTHING • 
                    </textPath>
                  </text>
                </svg>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={() => setIsOpen(!isOpen)}
            whileTap={{ scale: 0.93 }}
            className="relative w-16 h-16 rounded-full shadow-2xl shadow-emerald-500/30 flex items-center justify-center overflow-hidden cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #16a34a 0%, #059669 60%, #065f46 100%)' }}
          >
            <span className="absolute inset-0 rounded-full">
              <span className="absolute inset-0 rounded-full border-2 border-emerald-400/60 animate-ping opacity-60"></span>
            </span>

            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X size={26} className="text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="agent"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative flex items-center justify-center"
                >
                  <div className="relative flex items-center justify-center w-full h-full">
                    <motion.div 
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="text-3xl leading-none"
                    >
                      🧑‍🌾
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </>
  );
};
