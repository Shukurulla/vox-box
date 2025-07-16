const {
  BrowserWindow,
  app,
  ipcMain,
  desktopCapturer,
  session,
} = require("electron");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const { Buffer } = require("buffer");
require("dotenv").config();

// Webpack constants
// declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
// declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
const electronSquirrelStartup = require("electron-squirrel-startup");

if (electronSquirrelStartup) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    height: 1000,
    width: 1300,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; connect-src 'self' https://api.openai.com;",
          ],
        },
      });
    }
  );

  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      if (permission === "media") {
        callback(true);
      } else {
        callback(false);
      }
    }
  );

  // Webpack entry point'ni to'g'ri yuklash
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY + "#/main_window");
};

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Configuration handlers
ipcMain.handle("get-config", () => {
  return {
    openai_key: process.env.OPENAI_API_KEY,
    api_base: process.env.OPENAI_API_BASE || "https://api.openai.com/v1",
    gpt_model: process.env.OPENAI_MODEL || "gpt-4o",
    assistant_id: process.env.ASSISTANT_ID || "asst_ZyT7rWrTyqNq5l74PdATurJ5",
    primaryLanguage: process.env.PRIMARY_LANGUAGE || "ru",
    secondaryLanguage: process.env.SECONDARY_LANGUAGE || "en",
  };
});

// PDF processing
ipcMain.handle("parsePDF", async (event, pdfBuffer) => {
  try {
    const pdf = require("pdf-parse");
    const data = await pdf(Buffer.from(pdfBuffer), {
      max: 0,
    });
    return { text: data.text };
  } catch (error) {
    return { error: "Failed to parse PDF: " + error.message };
  }
});

// OpenAI STT implementation
let isRecording = false;
let audioChunks = [];
let recordingTimer = null;
let processAudioTimer = null;

ipcMain.handle("start-whisper-stt", async (event, config) => {
  try {
    console.log("Starting OpenAI Whisper STT");
    isRecording = true;
    audioChunks = [];

    return {
      success: true,
      message: "OpenAI Whisper STT started successfully",
      model: "whisper-1",
      language: config.primaryLanguage,
    };
  } catch (error) {
    console.error("Whisper STT start error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("send-audio-to-whisper", async (event, audioData) => {
  if (!isRecording) return;

  try {
    // Convert audio data to buffer and add to chunks
    const buffer = Buffer.from(audioData);
    audioChunks.push(buffer);

    // Clear previous timer
    if (processAudioTimer) {
      clearTimeout(processAudioTimer);
    }

    // Process audio after 1 second of silence
    processAudioTimer = setTimeout(async () => {
      if (audioChunks.length > 0) {
        await processAudioChunks(event);
      }
    }, 1000);
  } catch (error) {
    console.error("Failed to process audio data:", error);
  }
});

async function processAudioChunks(event) {
  if (audioChunks.length === 0) return;

  try {
    // Combine all audio chunks
    const combinedBuffer = Buffer.concat(audioChunks);
    audioChunks = []; // Clear chunks

    // Save to temporary file
    const tempFilePath = path.join(
      app.getPath("temp"),
      `temp_audio_${Date.now()}.wav`
    );

    fs.writeFileSync(tempFilePath, combinedBuffer);

    // Transcribe using OpenAI Whisper
    const config = await getConfig();
    const formData = new FormData();
    formData.append("file", fs.createReadStream(tempFilePath), "audio.wav");
    formData.append("model", "whisper-1");

    if (config.primaryLanguage && config.primaryLanguage !== "auto") {
      formData.append("language", config.primaryLanguage);
    }

    const baseUrl = normalizeApiBaseUrl(config.api_base);
    const apiUrl = `${baseUrl}/audio/transcriptions`;

    const response = await axios.post(apiUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${config.openai_key}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Clean up temp file
    fs.unlinkSync(tempFilePath);

    if (response.data.text && response.data.text.trim()) {
      // Send transcript to renderer with typing effect
      const transcript = response.data.text.trim();
      event.sender.send("whisper-transcript", {
        transcript: transcript,
        is_final: true,
        model: "whisper-1",
        language: config.primaryLanguage,
      });
    }
  } catch (error) {
    console.error("Error processing audio chunks:", error);
  }
}

function getConfig() {
  return {
    openai_key: process.env.OPENAI_API_KEY,
    api_base: process.env.OPENAI_API_BASE || "https://api.openai.com/v1",
    gpt_model: process.env.OPENAI_MODEL || "gpt-4o",
    assistant_id: process.env.ASSISTANT_ID || "asst_ZyT7rWrTyqNq5l74PdATurJ5",
    primaryLanguage: process.env.PRIMARY_LANGUAGE || "ru",
    secondaryLanguage: process.env.SECONDARY_LANGUAGE || "en",
  };
}

ipcMain.handle("stop-whisper-stt", () => {
  isRecording = false;
  audioChunks = [];

  if (recordingTimer) {
    clearTimeout(recordingTimer);
    recordingTimer = null;
  }

  if (processAudioTimer) {
    clearTimeout(processAudioTimer);
    processAudioTimer = null;
  }

  console.log("OpenAI Whisper STT stopped");
});

// Desktop capture
ipcMain.handle("get-desktop-sources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
    });
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  } catch (error) {
    return [];
  }
});

// Call Assistant function
ipcMain.handle(
  "callAssistant",
  async (event, { config, assistantId, threadId, message }) => {
    try {
      const OpenAI = require("openai");
      const openai = new OpenAI({
        apiKey: config.openai_key,
        baseURL: normalizeApiBaseUrl(config.api_base),
      });

      let currentThreadId = threadId;

      if (!currentThreadId) {
        const thread = await openai.beta.threads.create();
        currentThreadId = thread.id;
        console.log("Created new thread:", currentThreadId);
      }

      await openai.beta.threads.messages.create(currentThreadId, {
        role: "user",
        content: message,
      });

      const run = await openai.beta.threads.runs.create(currentThreadId, {
        assistant_id: assistantId,
      });

      let runStatus = await openai.beta.threads.runs.retrieve(
        currentThreadId,
        run.id
      );
      let attempts = 0;
      const maxAttempts = 60;

      while (
        (runStatus.status === "queued" || runStatus.status === "in_progress") &&
        attempts < maxAttempts
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(
          currentThreadId,
          run.id
        );
        attempts++;
      }

      if (runStatus.status === "completed") {
        const messages = await openai.beta.threads.messages.list(
          currentThreadId
        );
        const assistantMessages = messages.data.filter(
          (msg) => msg.role === "assistant"
        );

        if (assistantMessages.length > 0) {
          const latestMessage = assistantMessages[0];
          if (
            latestMessage.content[0] &&
            latestMessage.content[0].type === "text"
          ) {
            return {
              content: latestMessage.content[0].text.value,
              threadId: currentThreadId,
            };
          }
        }
        return { error: "No assistant response found" };
      } else if (runStatus.status === "failed") {
        return { error: runStatus.last_error?.message || "Run failed" };
      } else if (runStatus.status === "expired") {
        return { error: "Assistant run expired" };
      } else if (attempts >= maxAttempts) {
        return { error: "Assistant run timed out" };
      }

      return { error: "Unexpected run status: " + runStatus.status };
    } catch (error) {
      console.error("Assistant call error:", error);
      return { error: error.message || "Unknown error occurred" };
    }
  }
);

// Utility function to normalize API base URL
function normalizeApiBaseUrl(url) {
  if (!url) return "https://api.openai.com/v1";
  url = url.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  if (!url.endsWith("/v1")) {
    url = url.endsWith("/") ? url + "v1" : url + "/v1";
  }
  return url;
}
