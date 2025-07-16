import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Mic,
  MicOff,
  RefreshCw,
  Play,
  Trash,
  Save,
  Zap,
  Clock,
  FileText,
  MessageSquare,
  Send,
  Sparkles,
  Globe,
  FileAudio,
  CheckCircle,
  XCircle,
  Bot,
} from "lucide-react";
import Timer from "../components/Timer";
import { useKnowledgeBase } from "../contexts/KnowledgeBaseContext";
import ErrorDisplay from "../components/ErrorDisplay";
import { useError } from "../contexts/ErrorContext";
import { useInterview } from "../contexts/InterviewContext";
import ReactMarkdown from "react-markdown";

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

const InterviewPage: React.FC = () => {
  const { knowledgeBase, conversations, addConversation, clearConversations } =
    useKnowledgeBase();
  const { error, setError, clearError } = useError();
  const {
    currentText,
    setCurrentText,
    aiResult,
    setAiResult,
    displayedAiResult,
    setDisplayedAiResult,
    lastProcessedIndex,
    setLastProcessedIndex,
  } = useInterview();

  const [isRecording, setIsRecording] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoGPTEnabled, setIsAutoGPTEnabled] = useState(false);
  const [userMedia, setUserMedia] = useState<MediaStream | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [processor, setProcessor] = useState<ScriptProcessorNode | null>(null);
  const [autoSubmitTimer, setAutoSubmitTimer] = useState<NodeJS.Timeout | null>(
    null
  );
  const [deepgramStatus, setDeepgramStatus] = useState<{
    language?: string;
    model?: string;
  }>({});
  const [assistantId, setAssistantId] = useState<string>("");
  const [threadId, setThreadId] = useState<string>("");

  const aiResponseRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Glass panel styling
  const glassPanelStyle =
    "bg-white bg-opacity-20 backdrop-blur-lg border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl";

  useEffect(() => {
    loadConfig();
  }, []);

  const handleAskGPT = async (newContent?: string) => {
    const contentToProcess =
      newContent || currentText.slice(lastProcessedIndex).trim();
    if (!contentToProcess) return;

    setIsLoading(true);
    try {
      const config = await window.electronAPI.getConfig();

      // Assistant yordamida javob olish
      const response = await window.electronAPI.callAssistant({
        config: config,
        assistantId: assistantId,
        threadId: threadId,
        message: contentToProcess,
      });

      if ("error" in response) {
        throw new Error(response.error);
      }

      // Thread ID ni yangilash (yangi thread yaratilgan bo'lishi mumkin)
      if (response.threadId) {
        setThreadId(response.threadId);
      }

      const formattedResponse = response.content.trim();
      addConversation({ role: "user", content: contentToProcess });
      addConversation({ role: "assistant", content: formattedResponse });
      setDisplayedAiResult(
        (prev) => prev + (prev ? "\n\n" : "") + formattedResponse
      );
      setLastProcessedIndex(currentText.length);
    } catch (error) {
      setError("Failed to get response from GPT Assistant. Please try again.");
    } finally {
      setIsLoading(false);
      if (aiResponseRef.current) {
        aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
      }
    }
  };

  const handleAskGPTStable = useCallback(
    async (newContent: string) => {
      handleAskGPT(newContent);
    },
    [handleAskGPT]
  );

  useEffect(() => {
    let lastTranscriptTime = Date.now();
    let checkTimer: NodeJS.Timeout | null = null;

    const handleDeepgramTranscript = (_event: any, data: any) => {
      if (data.transcript && data.is_final) {
        // Update deepgram status if we have model/language info
        if (data.model || data.language) {
          setDeepgramStatus({
            model: data.model,
            language: data.language,
          });
        }

        setCurrentText((prev: string) => {
          const newTranscript = data.transcript.trim();
          if (!prev.endsWith(newTranscript)) {
            lastTranscriptTime = Date.now();
            const updatedText = prev + (prev ? "\n" : "") + newTranscript;

            if (isAutoGPTEnabled) {
              if (autoSubmitTimer) {
                clearTimeout(autoSubmitTimer);
              }
              const newTimer = setTimeout(() => {
                const newContent = updatedText.slice(lastProcessedIndex);
                if (newContent.trim()) {
                  handleAskGPTStable(newContent);
                }
              }, 2000);
              setAutoSubmitTimer(newTimer);
            }

            return updatedText;
          }
          return prev;
        });
      }
    };

    const handleDeepgramStatus = (_event: any, data: any) => {
      setDeepgramStatus({
        language: data.language,
        model: data.model,
      });
    };

    const checkAndSubmit = () => {
      if (isAutoGPTEnabled && Date.now() - lastTranscriptTime >= 2000) {
        const newContent = currentText.slice(lastProcessedIndex);
        if (newContent.trim()) {
          handleAskGPTStable(newContent);
        }
      }
      checkTimer = setTimeout(checkAndSubmit, 1000);
    };

    window.electronAPI.ipcRenderer.on(
      "deepgram-transcript",
      handleDeepgramTranscript
    );
    window.electronAPI.ipcRenderer.on("deepgram-status", handleDeepgramStatus);
    checkTimer = setTimeout(checkAndSubmit, 1000);

    return () => {
      window.electronAPI.ipcRenderer.removeListener(
        "deepgram-transcript",
        handleDeepgramTranscript
      );
      window.electronAPI.ipcRenderer.removeListener(
        "deepgram-status",
        handleDeepgramStatus
      );
      if (checkTimer) {
        clearTimeout(checkTimer);
      }
    };
  }, [
    isAutoGPTEnabled,
    lastProcessedIndex,
    currentText,
    handleAskGPTStable,
    setCurrentText,
    setLastProcessedIndex,
  ]);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      if (config && config.openai_key && config.deepgram_api_key) {
        setIsConfigured(true);
        // Assistant ID ni konfiguratsiyadan olish
        setAssistantId(config.assistant_id || "asst_ZyT7rWrTyqNq5l74PdATurJ5");
      } else {
        setError(
          "OpenAI API key or Deepgram API key not configured. Please check settings."
        );
      }
    } catch (err) {
      setError("Failed to load configuration. Please check settings.");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      setUserMedia(stream);

      const config = await window.electronAPI.getConfig();

      // Model tanlash - rus tili uchun maxsus
      const deepgramModel = config.deepgram_model || "nova-2";
      let startFunction = "start-deepgram"; // default

      if (config.primaryLanguage === "ru") {
        if (deepgramModel === "whisper") {
          startFunction = "start-deepgram-whisper";
          console.log("🇷🇺 Using Whisper model for Russian");
        } else {
          startFunction = "start-deepgram";
          console.log("🇷🇺 Using Nova model for Russian");
        }
      }

      console.log(`Starting ${startFunction} with config:`, {
        language: config.primaryLanguage,
        model: deepgramModel,
      });

      const result = await window.electronAPI.ipcRenderer.invoke(
        startFunction,
        {
          deepgram_key: config.deepgram_api_key,
          primaryLanguage: config.primaryLanguage,
          deepgram_model: deepgramModel,
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log("✅ Deepgram started:", result.message);

      // Update deepgram status with info from the result
      if (result.language || result.model) {
        setDeepgramStatus({
          language: result.language,
          model: result.model,
        });
      }

      const context = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
      setAudioContext(context);
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      setProcessor(processor);

      source.connect(processor);
      processor.connect(context.destination);

      processor.onaudioprocess = (e: {
        inputBuffer: { getChannelData: (arg0: number) => any };
      }) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          audioData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
        }
        window.electronAPI.ipcRenderer.invoke(
          "send-audio-to-deepgram",
          audioData.buffer
        );
      };

      setIsRecording(true);
    } catch (err: any) {
      console.error("Recording error:", err);
      setError(
        "Failed to start recording. " +
          (err.message || "Please check permissions or try again.")
      );
    }
  };

  const stopRecording = () => {
    if (userMedia) {
      userMedia.getTracks().forEach((track) => track.stop());
    }
    if (audioContext) {
      audioContext.close();
    }
    if (processor) {
      processor.disconnect();
    }
    window.electronAPI.ipcRenderer.invoke("stop-deepgram");
    setIsRecording(false);
    setUserMedia(null);
    setAudioContext(null);
    setProcessor(null);
    setDeepgramStatus({});
  };

  useEffect(() => {
    loadConfig();
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  useEffect(() => {
    if (aiResponseRef.current) {
      aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
    }
  }, [displayedAiResult]);

  const debounce = (func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentText(e.target.value);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-indigo-950 p-4 transition-all duration-300">
      <ErrorDisplay error={error} onClose={clearError} />

      {/* Control Panel */}
      <div
        className={`${glassPanelStyle} p-4 mb-4 flex flex-wrap items-center justify-between gap-3`}
      >
        <div className="flex items-center space-x-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={!isConfigured}
            className={`relative inline-flex items-center justify-center px-6 py-3 overflow-hidden font-medium transition-all rounded-full shadow-md group ${
              !isConfigured
                ? "bg-gray-400 cursor-not-allowed text-gray-200"
                : isRecording
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            <span className="absolute inset-0 flex items-center justify-center w-full h-full text-white duration-300 -translate-x-full group-hover:translate-x-0 ease">
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </span>
            <span className="absolute flex items-center justify-center w-full h-full text-white transition-all duration-300 transform group-hover:translate-x-full ease">
              {isRecording ? "Stop" : "Record"}
            </span>
            <span className="relative invisible">
              {isRecording ? "Stop Recording" : "Start Recording"}
            </span>
          </button>

          <div className="flex items-center space-x-2 bg-white/30 dark:bg-gray-800/30 py-2 px-4 rounded-full">
            <Clock size={18} className="text-gray-600 dark:text-gray-300" />
            <Timer
              isRunning={isRecording}
              className="font-mono text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Assistant ID display */}
          {assistantId && (
            <div className="flex items-center px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
              <Bot size={14} className="mr-1" />
              <span className="text-xs font-medium">Assistant Active</span>
            </div>
          )}

          {/* Automatic GPT toggle */}
          <label className="flex items-center cursor-pointer space-x-2 px-4 py-2 rounded-full transition-all duration-300 bg-white/30 dark:bg-gray-800/30 hover:bg-white/50 dark:hover:bg-gray-700/50">
            <input
              type="checkbox"
              checked={isAutoGPTEnabled}
              onChange={(e) => setIsAutoGPTEnabled(e.target.checked)}
              className="sr-only" // Hide the actual checkbox
            />
            <div
              className={`relative w-10 h-5 transition-all duration-200 ease-in-out rounded-full ${
                isAutoGPTEnabled ? "bg-indigo-600" : "bg-gray-400"
              }`}
            >
              <div
                className={`absolute left-0.5 top-0.5 w-4 h-4 transition-all duration-200 ease-in-out transform ${
                  isAutoGPTEnabled
                    ? "translate-x-5 bg-white"
                    : "translate-x-0 bg-white"
                } rounded-full`}
              ></div>
            </div>
            <div className="flex items-center">
              <Zap
                size={16}
                className={`mr-1 ${
                  isAutoGPTEnabled
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              />
              <span className="text-sm font-medium">Auto</span>
            </div>
          </label>

          {/* Status indicators */}
          {isRecording && deepgramStatus.language && (
            <div className="flex items-center px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              <Globe size={14} className="mr-1" />
              <span className="text-xs font-medium">
                {deepgramStatus.language === "ru"
                  ? "Russian"
                  : deepgramStatus.language === "en"
                  ? "English"
                  : deepgramStatus.language}
              </span>
            </div>
          )}

          {isRecording && deepgramStatus.model && (
            <div className="flex items-center px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
              <FileAudio size={14} className="mr-1" />
              <span className="text-xs font-medium">
                {deepgramStatus.model.includes("whisper")
                  ? "Whisper"
                  : deepgramStatus.model.includes("nova-2")
                  ? "Nova-2"
                  : deepgramStatus.model.includes("nova-3")
                  ? "Nova-3"
                  : deepgramStatus.model}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Transcription Panel */}
        <div
          className={`${glassPanelStyle} p-4 flex flex-col h-[calc(100vh-170px)]`}
        >
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold flex items-center">
              <FileText
                size={18}
                className="mr-2 text-indigo-600 dark:text-indigo-400"
              />
              Transcribed Text
            </h2>
            <button
              onClick={() => setCurrentText("")}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Clear text"
            >
              <Trash size={16} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={currentText}
            onChange={handleTextareaChange}
            className="flex-grow p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
            placeholder={
              isRecording
                ? "Recording... Speech will appear here"
                : "Transcribed text will appear here..."
            }
          />

          {isRecording && (
            <div className="flex justify-center mt-2">
              <div className="flex items-center space-x-1">
                <span className="animate-ping inline-flex h-2 w-2 rounded-full bg-red-600 opacity-75"></span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Recording in progress
                </span>
              </div>
            </div>
          )}
        </div>

        {/* AI Response Panel */}
        <div
          className={`${glassPanelStyle} p-4 flex flex-col h-[calc(100vh-170px)]`}
        >
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold flex items-center">
              <Sparkles
                size={18}
                className="mr-2 text-indigo-600 dark:text-indigo-400"
              />
              AI Assistant Response
            </h2>
            <button
              onClick={() => setDisplayedAiResult("")}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Clear AI response"
            >
              <Trash size={16} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div
            ref={aiResponseRef}
            className="flex-grow p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-auto mb-3"
          >
            {displayedAiResult ? (
              <ReactMarkdown
                className="prose dark:prose-invert max-w-none"
                components={{
                  p: ({ node, ...props }) => (
                    <p style={{ whiteSpace: "pre-wrap" }} {...props} />
                  ),
                }}
              >
                {displayedAiResult}
              </ReactMarkdown>
            ) : (
              <div className="text-gray-400 dark:text-gray-500 italic">
                AI Assistant response will appear here...
              </div>
            )}
          </div>

          <button
            onClick={debounce(() => handleAskGPT(), 300)}
            disabled={!currentText || isLoading}
            className={`w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg transition-all ${
              !currentText || isLoading
                ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg"
            }`}
          >
            {isLoading ? (
              <>
                <RefreshCw size={18} className="mr-2 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Send size={18} className="mr-2" />
                <span>Ask Assistant</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewPage;
