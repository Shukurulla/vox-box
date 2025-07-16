import React, { useState, useRef } from "react";
import { useKnowledgeBase } from "../contexts/KnowledgeBaseContext";
import { useError } from "../contexts/ErrorContext";
import ErrorDisplay from "../components/ErrorDisplay";
import OpenAI from "openai";
import ReactMarkdown from "react-markdown";
import { FaFile, FaImage } from "react-icons/fa";
import { Bot, MessageSquare, FileText, Upload } from "lucide-react";

interface UploadedFile extends File {
  pdfText?: string;
  error?: string;
}

const KnowledgeBase: React.FC = () => {
  const {
    knowledgeBase,
    addToKnowledgeBase,
    conversations,
    addConversation,
    clearConversations,
    displayedAiResult,
    setDisplayedAiResult,
  } = useKnowledgeBase();
  const { error, setError, clearError } = useError();
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [useAssistant, setUseAssistant] = useState(true);
  const [threadId, setThreadId] = useState<string>("");

  // Glass panel styling
  const glassPanelStyle =
    "bg-white bg-opacity-20 backdrop-blur-lg border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl";

  const simulateTyping = (text: string) => {
    let i = 0;
    setDisplayedAiResult("");
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayedAiResult(text.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setDisplayedAiResult((prev) => prev + "\n\n");
        }, 500);
      }
    }, 10);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && uploadedFiles.length === 0) return;

    try {
      setIsLoading(true);
      let fileContents: string[] = [];

      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          if ("pdfText" in file) {
            fileContents.push(file.pdfText);
          } else if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            const content = await new Promise<string>((resolve) => {
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
            });
            fileContents.push(content);
          } else {
            const reader = new FileReader();
            const content = await new Promise<string>((resolve) => {
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsText(file);
            });
            fileContents.push(content);
          }
        }
      }

      const userMessage = chatInput.trim()
        ? uploadedFiles.length > 0
          ? `[Files: ${uploadedFiles
              .map((f) => f.name)
              .join(", ")}] ${chatInput}`
          : chatInput
        : uploadedFiles.length > 0
        ? `Please analyze the attached files: ${uploadedFiles
            .map((f) => f.name)
            .join(", ")}`
        : "";

      // Add file contents to the message if any
      const fullMessage =
        fileContents.length > 0
          ? `${userMessage}\n\nFile contents:\n${fileContents.join("\n\n")}`
          : userMessage;

      addConversation({ role: "user", content: userMessage });

      const config = await window.electronAPI.getConfig();
      let response;

      if (useAssistant && config.assistant_id) {
        // Use Assistant API
        response = await window.electronAPI.callAssistant({
          config: config,
          assistantId: config.assistant_id,
          threadId: threadId,
          message: fullMessage,
        });

        // Update thread ID if new thread was created
        if (response.threadId) {
          setThreadId(response.threadId);
        }
      } else {
        // Use regular OpenAI API
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: "" },
          ...knowledgeBase.map((item) => {
            if (item.startsWith("data:image")) {
              return {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: item } } as const,
                ],
              } as OpenAI.Chat.ChatCompletionUserMessageParam;
            }
            return {
              role: "user",
              content: item,
            } as OpenAI.Chat.ChatCompletionUserMessageParam;
          }),
          ...conversations.map(
            (conv) =>
              ({
                role: conv.role,
                content: conv.content,
              } as OpenAI.Chat.ChatCompletionMessageParam)
          ),
        ];

        if (fileContents.length > 0) {
          for (const content of fileContents) {
            if (content.startsWith("data:image")) {
              messages.push({
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: content } } as const,
                ],
              } as OpenAI.Chat.ChatCompletionUserMessageParam);
            } else {
              messages.push({
                role: "user",
                content: content,
              } as OpenAI.Chat.ChatCompletionUserMessageParam);
            }
          }
        }

        messages.push({
          role: "user",
          content: userMessage,
        } as OpenAI.Chat.ChatCompletionUserMessageParam);

        response = await window.electronAPI.callOpenAI({
          config: config,
          messages: messages,
        });
      }

      setChatInput("");
      setUploadedFiles([]);

      if ("error" in response) {
        throw new Error(response.error);
      }

      if (typeof response.content !== "string") {
        throw new Error("Unexpected API response structure");
      }

      addConversation({ role: "assistant", content: response.content });
      simulateTyping(response.content);
    } catch (error) {
      setError("Failed to get response from GPT. Please try again.");
      console.error("Detailed error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      if (uploadedFiles.length + newFiles.length > 3) {
        setError("You can only upload up to 3 files.");
        return;
      }
      console.log(
        "Processing files:",
        newFiles.map((f) => ({ name: f.name, type: f.type }))
      );
      const processedFiles = await Promise.all(
        newFiles.map(async (file) => {
          if (file.type === "application/pdf") {
            const arrayBuffer = await file.arrayBuffer();
            console.log("Calling parsePDF for file:", file.name);
            const result = await window.electronAPI.parsePDF(arrayBuffer);
            console.log("parsePDF response received:", result);
            if (result.error) {
              console.error("Error parsing PDF:", result.error);
              return { ...file, error: result.error } as UploadedFile;
            }
            return {
              ...file,
              pdfText: result.text,
              name: file.name,
              type: file.type,
            } as UploadedFile;
          }
          return file as UploadedFile;
        })
      );
      console.log("Processed files:", processedFiles);
      setUploadedFiles((prevFiles) => [...prevFiles, ...processedFiles]);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-indigo-950 p-4 transition-all duration-300">
      <ErrorDisplay error={error} onClose={clearError} />

      <div className={`${glassPanelStyle} max-w-4xl mx-auto p-6`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <MessageSquare
              size={28}
              className="text-indigo-600 dark:text-indigo-400 mr-3"
            />
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              Knowledge Base Chat
            </h1>
          </div>

          {/* Assistant Toggle */}
          <div className="flex items-center space-x-3">
            <label className="flex items-center cursor-pointer space-x-2">
              <input
                type="checkbox"
                checked={useAssistant}
                onChange={(e) => setUseAssistant(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`relative w-10 h-5 transition-all duration-200 ease-in-out rounded-full ${
                  useAssistant ? "bg-indigo-600" : "bg-gray-400"
                }`}
              >
                <div
                  className={`absolute left-0.5 top-0.5 w-4 h-4 transition-all duration-200 ease-in-out transform ${
                    useAssistant
                      ? "translate-x-5 bg-white"
                      : "translate-x-0 bg-white"
                  } rounded-full`}
                ></div>
              </div>
              <div className="flex items-center">
                <Bot
                  size={16}
                  className={`mr-1 ${
                    useAssistant
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                />
                <span className="text-sm font-medium">Use Assistant</span>
              </div>
            </label>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-auto mb-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white/30 dark:bg-gray-800/30 shadow-inner min-h-[400px] max-h-[500px]">
          {conversations.map((conv, index) => (
            <div
              key={index}
              className={`mb-4 ${
                conv.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block p-3 rounded-lg max-w-[80%] ${
                  conv.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-white/80 dark:bg-gray-700/80 text-gray-800 dark:text-gray-200"
                }`}
              >
                {conv.role === "user" ? (
                  <span>
                    {conv.content.startsWith("[Files:") ? (
                      <>
                        {conv.content.includes("image") ? (
                          <FaImage className="inline mr-1" />
                        ) : (
                          <FaFile className="inline mr-1" />
                        )}
                        {conv.content}
                      </>
                    ) : (
                      conv.content
                    )}
                  </span>
                ) : index === conversations.length - 1 ? (
                  <ReactMarkdown className="prose dark:prose-invert max-w-none">
                    {displayedAiResult}
                  </ReactMarkdown>
                ) : (
                  <ReactMarkdown className="prose dark:prose-invert max-w-none">
                    {conv.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* File Upload Display */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap items-center mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200 mr-2">
              Attached files:
            </span>
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center mr-3 mb-1">
                {file && file.type ? (
                  file.type.startsWith("image/") ? (
                    <FaImage className="mr-1 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <FaFile className="mr-1 text-indigo-600 dark:text-indigo-400" />
                  )
                ) : (
                  <FaFile className="mr-1 text-indigo-600 dark:text-indigo-400" />
                )}
                <span className="mr-2 text-sm">
                  {file && file.name
                    ? file.name.length > 20
                      ? file.name.substring(0, 20) + "..."
                      : file.name
                    : "Unknown file"}
                </span>
                <button
                  onClick={() =>
                    setUploadedFiles((files) =>
                      files.filter((_, i) => i !== index)
                    )
                  }
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Chat Input */}
        <form
          onSubmit={handleChatSubmit}
          className="flex items-center space-x-2"
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <Upload size={16} className="mr-1" />
            Upload
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.txt"
            multiple
          />
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            className="flex-grow p-3 bg-white/50 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            placeholder="Type your message..."
          />
          <button
            type="submit"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send"}
          </button>
        </form>

        {/* Clear Chat Button */}
        <button
          onClick={() => {
            clearConversations();
            setDisplayedAiResult("");
            setThreadId(""); // Reset thread ID when clearing chat
          }}
          className="w-full mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
        >
          Clear Chat
        </button>
      </div>
    </div>
  );
};

export default KnowledgeBase;
