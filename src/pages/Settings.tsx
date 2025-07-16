import React, { useState, useEffect } from "react";
import { useError } from "../contexts/ErrorContext";
import ErrorDisplay from "../components/ErrorDisplay";
import { languageOptions } from "../utils/languageOptions";
import {
  Settings as SettingsIcon,
  Globe,
  Key,
  Server,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Mic,
  Database,
  Bot,
  Radio,
  User,
} from "lucide-react";

const Settings: React.FC = () => {
  const { error, setError, clearError } = useError();
  const [apiKey, setApiKey] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [apiModel, setApiModel] = useState("gpt-4o");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiCallMethod, setApiCallMethod] = useState<"direct" | "proxy">(
    "direct"
  );
  const [testResult, setTestResult] = useState<string | null>(null);
  const [primaryLanguage, setPrimaryLanguage] = useState("auto");
  const [secondaryLanguage, setSecondaryLanguage] = useState("");
  const [deepgramApiKey, setDeepgramApiKey] = useState("");
  const [deepgramModel, setDeepgramModel] = useState("nova-2");
  const [assistantId, setAssistantId] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.getConfig();
      setApiKey(config.openai_key || "");
      setApiModel(config.gpt_model || "gpt-4o");
      setApiBase(config.api_base || "");
      setApiCallMethod(config.api_call_method || "direct");
      setPrimaryLanguage(config.primaryLanguage || "auto");
      setSecondaryLanguage(config.secondaryLanguage || "");
      setDeepgramApiKey(config.deepgram_api_key || "");
      setDeepgramModel(config.deepgram_model || "nova-2");
      setAssistantId(config.assistant_id || "asst_ZyT7rWrTyqNq5l74PdATurJ5");
    } catch (err) {
      console.error("Failed to load configuration", err);
      setError("Failed to load configuration. Please check your settings.");
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await window.electronAPI.setConfig({
        openai_key: apiKey,
        gpt_model: apiModel,
        api_base: apiBase,
        api_call_method: apiCallMethod,
        primaryLanguage: primaryLanguage,
        secondaryLanguage: secondaryLanguage,
        deepgram_api_key: deepgramApiKey,
        deepgram_model: deepgramModel,
        assistant_id: assistantId,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const testAPIConfig = async () => {
    try {
      setIsTesting(true);
      setTestResult("Testing...");
      const result = await window.electronAPI.testAPIConfig({
        openai_key: apiKey,
        gpt_model: apiModel,
        api_base: apiBase,
      });
      if (result.success) {
        setTestResult("API configuration is valid!");
      } else {
        setTestResult(
          `API configuration test failed: ${result.error || "Unknown error"}`
        );
        setError(
          `Failed to test API configuration: ${result.error || "Unknown error"}`
        );
      }
    } catch (err) {
      console.error("API configuration test error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setTestResult(`API configuration test failed: ${errorMessage}`);
      setError(`Failed to test API configuration: ${errorMessage}`);
    } finally {
      setIsTesting(false);
    }
  };

  const testAssistantConfig = async () => {
    try {
      setIsTesting(true);
      setTestResult("Testing Assistant...");
      const result = await window.electronAPI.testAssistant({
        openai_key: apiKey,
        api_base: apiBase,
        assistant_id: assistantId,
      });
      if (result.success) {
        setTestResult("Assistant configuration is valid!");
      } else {
        setTestResult(
          `Assistant test failed: ${result.error || "Unknown error"}`
        );
        setError(
          `Failed to test Assistant: ${result.error || "Unknown error"}`
        );
      }
    } catch (err) {
      console.error("Assistant test error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setTestResult(`Assistant test failed: ${errorMessage}`);
      setError(`Failed to test Assistant: ${errorMessage}`);
    } finally {
      setIsTesting(false);
    }
  };

  // Glass panel styling
  const glassPanelStyle =
    "bg-white bg-opacity-20 backdrop-blur-lg border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl";

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-indigo-950 p-4 transition-all duration-300">
      <ErrorDisplay error={error} onClose={clearError} />

      <div className={`${glassPanelStyle} max-w-3xl mx-auto p-6`}>
        <div className="flex items-center mb-6">
          <SettingsIcon
            size={28}
            className="text-indigo-600 dark:text-indigo-400 mr-3"
          />
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            Settings
          </h1>
        </div>

        {/* OpenAI API Settings */}
        <div className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-6">
          <div className="flex items-center mb-4">
            <Bot
              size={20}
              className="text-indigo-600 dark:text-indigo-400 mr-2"
            />
            <h2 className="text-lg font-semibold">OpenAI API Settings</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center">
                <Server size={16} className="mr-1 text-gray-500" />
                API Base URL (Optional)
              </label>
              <input
                type="text"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                className="w-full p-3 bg-white/50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="https://api.openai.com"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter proxy URL if using API proxy. Example:
                https://your-proxy.com/v1
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 flex items-center">
                <Database size={16} className="mr-1 text-gray-500" />
                API Model
              </label>
              <input
                type="text"
                value={apiModel}
                onChange={(e) => setApiModel(e.target.value)}
                className="w-full p-3 bg-white/50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="gpt-4o"
              />
              <p className="mt-1 text-xs text-gray-500">
                Please use a model supported by your API. Preferably gpt-4o or
                gpt-4.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                API Call Method
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    checked={apiCallMethod === "direct"}
                    onChange={() => setApiCallMethod("direct")}
                    className="form-radio text-indigo-600 h-5 w-5"
                  />
                  <span className="ml-2">Direct</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    checked={apiCallMethod === "proxy"}
                    onChange={() => setApiCallMethod("proxy")}
                    className="form-radio text-indigo-600 h-5 w-5"
                  />
                  <span className="ml-2">Proxy</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Assistant Settings */}
        <div className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-6">
          <div className="flex items-center mb-4">
            <User
              size={20}
              className="text-indigo-600 dark:text-indigo-400 mr-2"
            />
            <h2 className="text-lg font-semibold">Assistant Settings</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center">
                <Bot size={16} className="mr-1 text-gray-500" />
                Assistant ID
              </label>
              <input
                type="text"
                value={assistantId}
                onChange={(e) => setAssistantId(e.target.value)}
                className="w-full p-3 bg-white/50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="asst_ZyT7rWrTyqNq5l74PdATurJ5"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter your OpenAI Assistant ID. You can create one at
                https://platform.openai.com/assistants
              </p>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <div className="flex items-start">
                <CheckCircle
                  size={16}
                  className="text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0"
                />
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                    Current Assistant ID: {assistantId || "Not set"}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    All conversations will be processed through this Assistant
                    instead of regular ChatGPT
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deepgram Settings */}
        <div className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-6">
          <div className="flex items-center mb-4">
            <Mic
              size={20}
              className="text-indigo-600 dark:text-indigo-400 mr-2"
            />
            <h2 className="text-lg font-semibold">
              Speech Recognition Settings
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center">
                <Key size={16} className="mr-1 text-gray-500" />
                Deepgram API Key
              </label>
              <input
                type="password"
                value={deepgramApiKey}
                onChange={(e) => setDeepgramApiKey(e.target.value)}
                className="w-full p-3 bg-white/50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="Deepgram API key..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 flex items-center">
                <Radio size={16} className="mr-1 text-gray-500" />
                Speech Recognition Model
              </label>
              <select
                value={deepgramModel}
                onChange={(e) => setDeepgramModel(e.target.value)}
                className="w-full p-3 bg-white/50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="nova-2">Nova-2 (Recommended)</option>
                <option value="whisper">Whisper (Best for Russian)</option>
                <option value="nova-3">Nova-3 (Experimental)</option>
              </select>

              {primaryLanguage === "ru" && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-start">
                  <CheckCircle
                    size={16}
                    className="text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0"
                  />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {deepgramModel === "whisper"
                      ? "Whisper model is optimized for Russian language and provides better accuracy."
                      : "For Russian language, we recommend using the Whisper model for better accuracy."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Language Settings */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Globe
              size={20}
              className="text-indigo-600 dark:text-indigo-400 mr-2"
            />
            <h2 className="text-lg font-semibold">Language Settings</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Primary Language
              </label>
              <select
                value={primaryLanguage}
                onChange={(e) => setPrimaryLanguage(e.target.value)}
                className="w-full p-3 bg-white/50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {primaryLanguage === "ru" && (
                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-start">
                  <CheckCircle
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0"
                  />
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Russian language selected - Whisper model is recommended for
                    better accuracy
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-between gap-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center px-6 py-3 rounded-lg transition-all ${
              isSaving
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg text-white"
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw size={18} className="mr-2 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={18} className="mr-2" />
                <span>Save Settings</span>
              </>
            )}
          </button>

          <div className="flex gap-2">
            <button
              onClick={testAPIConfig}
              disabled={isTesting}
              className={`flex items-center px-6 py-3 rounded-lg transition-all ${
                isTesting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 shadow-md"
              }`}
            >
              {isTesting ? (
                <>
                  <RefreshCw size={18} className="mr-2 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={18} className="mr-2" />
                  <span>Test API</span>
                </>
              )}
            </button>

            <button
              onClick={testAssistantConfig}
              disabled={isTesting || !assistantId}
              className={`flex items-center px-6 py-3 rounded-lg transition-all ${
                isTesting || !assistantId
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg text-white"
              }`}
            >
              {isTesting ? (
                <>
                  <RefreshCw size={18} className="mr-2 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <Bot size={18} className="mr-2" />
                  <span>Test Assistant</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {saveSuccess && (
          <div className="mt-4 p-3 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg flex items-center">
            <CheckCircle size={18} className="mr-2" />
            <span>Settings saved successfully</span>
          </div>
        )}

        {testResult && (
          <div
            className={`mt-4 p-3 rounded-lg flex items-center ${
              testResult.includes("valid")
                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
            }`}
          >
            {testResult.includes("valid") ? (
              <CheckCircle size={18} className="mr-2" />
            ) : (
              <AlertCircle size={18} className="mr-2" />
            )}
            <span>{testResult}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
