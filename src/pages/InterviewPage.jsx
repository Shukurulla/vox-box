import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Mic,
  MicOff,
  RefreshCw,
  Trash,
  Zap,
  Clock,
  FileText,
  Send,
  Sparkles,
  Globe,
  FileAudio,
  Bot,
} from "lucide-react";
import Timer from "../components/Timer";
import ErrorDisplay from "../components/ErrorDisplay";
import { useError } from "../contexts/ErrorContext";
import { useInterview } from "../contexts/InterviewContext";
import ReactMarkdown from "react-markdown";

const InterviewPage = () => {
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
  const [isAutoGPTEnabled, setIsAutoGPTEnabled] = useState(true);
  const [userMedia, setUserMedia] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const [processor, setProcessor] = useState(null);
  const [autoSubmitTimer, setAutoSubmitTimer] = useState(null);
  const [sttStatus, setSttStatus] = useState({});
  const [assistantId, setAssistantId] = useState("");
  const [threadId, setThreadId] = useState("");

  const aiResponseRef = useRef(null);
  const textareaRef = useRef(null);

  const glassPanelStyle =
    "bg-white bg-opacity-20 backdrop-blur-lg border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl";

  useEffect(() => {
    loadConfig();
  }, []);

  const typeWriter = (text, callback) => {
    let i = 0;
    setDisplayedAiResult("");

    const typeInterval = setInterval(() => {
      if (i < text.length) {
        setDisplayedAiResult(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(typeInterval);
        if (callback) callback();
      }
    }, 20);

    return typeInterval;
  };

  const handleAskGPT = async (newContent) => {
    const contentToProcess =
      newContent || currentText.slice(lastProcessedIndex).trim();
    if (!contentToProcess) return;

    setIsLoading(true);
    try {
      const config = await window.electronAPI.getConfig();

      const response = await window.electronAPI.callAssistant({
        config: config,
        assistantId: assistantId,
        threadId: threadId,
        message: contentToProcess,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.threadId) {
        setThreadId(response.threadId);
      }

      const formattedResponse = response.content.trim();

      typeWriter(formattedResponse, () => {
        setAiResult(formattedResponse);
      });

      setLastProcessedIndex(currentText.length);
    } catch (error) {
      console.error("Assistant error:", error);
      setError("Не удалось получить ответ от ассистента. Попробуйте еще раз.");
    } finally {
      setIsLoading(false);
      if (aiResponseRef.current) {
        aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
      }
    }
  };

  const handleAskGPTStable = useCallback(
    async (newContent) => {
      handleAskGPT(newContent);
    },
    [handleAskGPT]
  );

  useEffect(() => {
    const handleDeepgramTranscript = (event, data) => {
      console.log("Raw Deepgram data:", JSON.stringify(data, null, 2));
      if (data.is_final && data.channel?.alternatives?.[0]?.transcript) {
        const transcript = data.channel.alternatives[0].transcript.trim();
        console.log("Processed transcript:", transcript);

        if (transcript) {
          setSttStatus({
            model: data.metadata?.model_info?.name || "general",
            language: data.metadata?.model_info?.language || "ru",
          });

          setCurrentText((prev) => {
            const updatedText = prev + (prev ? " " : "") + transcript;
            console.log("Updated currentText:", updatedText);

            if (isAutoGPTEnabled) {
              if (autoSubmitTimer) {
                clearTimeout(autoSubmitTimer);
              }

              const newTimer = setTimeout(() => {
                const newContent = updatedText.slice(lastProcessedIndex);
                if (newContent.trim()) {
                  console.log("Sending to GPT:", newContent);
                  handleAskGPTStable(newContent);
                }
              }, 500);
              setAutoSubmitTimer(newTimer);
            }

            return updatedText;
          });
        } else {
          console.log("Transcript is empty");
        }
      } else {
        console.log("No valid transcript found in data");
      }
    };

    const handleDeepgramStatus = (event, data) => {
      console.log("Deepgram status:", data);
      setSttStatus({
        language: data.language,
        model: data.model,
        status: data.status,
      });
    };

    const handleDeepgramError = (event, error) => {
      console.error("Deepgram error:", error);
      setError("Ошибка распознавания речи: " + error.message);
    };

    window.electronAPI.ipcRenderer.on(
      "deepgram-transcript",
      handleDeepgramTranscript
    );
    window.electronAPI.ipcRenderer.on("deepgram-status", handleDeepgramStatus);
    window.electronAPI.ipcRenderer.on("deepgram-error", handleDeepgramError);

    return () => {
      window.electronAPI.ipcRenderer.removeListener(
        "deepgram-transcript",
        handleDeepgramTranscript
      );
      window.electronAPI.ipcRenderer.removeListener(
        "deepgram-status",
        handleDeepgramStatus
      );
      window.electronAPI.ipcRenderer.removeListener(
        "deepgram-error",
        handleDeepgramError
      );

      if (autoSubmitTimer) {
        clearTimeout(autoSubmitTimer);
      }
    };
  }, [
    isAutoGPTEnabled,
    lastProcessedIndex,
    currentText,
    handleAskGPTStable,
    setCurrentText,
  ]);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      if (config && config.openai_key && config.deepgram_api_key) {
        setIsConfigured(true);
        setAssistantId(config.assistant_id || "asst_ZyT7rWrTyqNq5l74PdATurJ5");
      } else {
        setError(
          "OpenAI API ключ или Deepgram API ключ не настроен. Проверьте файл .env"
        );
      }
    } catch (err) {
      setError("Не удалось загрузить конфигурацию. Проверьте файл .env");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
        video: false,
      });
      setUserMedia(stream);

      const config = await window.electronAPI.getConfig();

      console.log("🎙️ Запуск Deepgram STT");

      const result = await window.electronAPI.startDeepgramSTT({
        deepgram_api_key: config.deepgram_api_key,
        primaryLanguage: config.primaryLanguage,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      console.log("✅ Deepgram STT запущен:", result.message);

      if (result.language || result.model) {
        setSttStatus({
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

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const audioData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          audioData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
        }
        window.electronAPI.sendAudioToDeepgram(audioData.buffer);
      };

      setIsRecording(true);
    } catch (err) {
      console.error("Ошибка записи:", err);
      setError(
        "Не удалось начать запись: " +
          (err.message ||
            "Проверьте разрешения микрофона или попробуйте снова.")
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
    window.electronAPI.stopDeepgramSTT();
    setIsRecording(false);
    setUserMedia(null);
    setAudioContext(null);
    setProcessor(null);
    setSttStatus({});
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

  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const handleTextareaChange = (e) => {
    setCurrentText(e.target.value);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-indigo-950 p-4 transition-all duration-300">
      <ErrorDisplay error={error} onClose={clearError} />

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
              {isRecording ? "Остановить" : "Записать"}
            </span>
            <span className="relative invisible">
              {isRecording ? "Остановить запись" : "Начать запись"}
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
          {assistantId && (
            <div className="flex items-center px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
              <Bot size={14} className="mr-1" />
              <span className="text-xs font-medium">Ассистент активен</span>
            </div>
          )}

          <label className="flex items-center cursor-pointer space-x-2 px-4 py-2 rounded-full transition-all duration-300 bg-white/30 dark:bg-gray-800/30 hover:bg-white/50 dark:hover:bg-gray-700/50">
            <input
              type="checkbox"
              checked={isAutoGPTEnabled}
              onChange={(e) => setIsAutoGPTEnabled(e.target.checked)}
              className="sr-only"
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
              <span className="text-sm font-medium">Авто</span>
            </div>
          </label>

          {isRecording && sttStatus.language && (
            <div className="flex items-center px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              <Globe size={14} className="mr-1" />
              <span className="text-xs font-medium">
                {sttStatus.language === "ru"
                  ? "Русский"
                  : sttStatus.language === "en"
                  ? "Английский"
                  : sttStatus.language}
              </span>
            </div>
          )}

          {isRecording && sttStatus.model && (
            <div className="flex items-center px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
              <FileAudio size={14} className="mr-1" />
              <span className="text-xs font-medium">
                {sttStatus.model.includes("deepgram")
                  ? "Deepgram"
                  : sttStatus.model}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`${glassPanelStyle} p-4 flex flex-col h-[calc(100vh-170px)]`}
        >
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold flex items-center">
              <FileText
                size={18}
                className="mr-2 text-indigo-600 dark:text-indigo-400"
              />
              Транскрибированный текст
            </h2>
            <button
              onClick={() => setCurrentText("")}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Очистить текст"
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
                ? "Идет запись... Речь появится здесь"
                : "Транскрибированный текст появится здесь..."
            }
          />

          {isRecording && (
            <div className="flex justify-center mt-2">
              <div className="flex items-center space-x-1">
                <span className="animate-ping inline-flex h-2 w-2 rounded-full bg-red-600 opacity-75"></span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Идет запись
                </span>
              </div>
            </div>
          )}
        </div>

        <div
          className={`${glassPanelStyle} p-4 flex flex-col h-[calc(100vh-170px)]`}
        >
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold flex items-center">
              <Sparkles
                size={18}
                className="mr-2 text-indigo-600 dark:text-indigo-400"
              />
              Ответ ассистента
            </h2>
            <button
              onClick={() => setDisplayedAiResult("")}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Очистить ответ ИИ"
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
                Ответ ассистента появится здесь...
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
                <span>Обработка...</span>
              </>
            ) : (
              <>
                <Send size={18} className="mr-2" />
                <span>Спросить ассистента</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewPage;
