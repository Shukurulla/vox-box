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
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
require("dotenv").config();

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
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; connect-src 'self' https://api.openai.com https://api.deepgram.com ws://api.deepgram.com wss://api.deepgram.com;",
          ],
        },
      });
    }
  );

  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      if (permission === "media" || permission === "microphone") {
        callback(true);
      } else {
        callback(false);
      }
    }
  );

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

ipcMain.handle("get-config", () => {
  return {
    openai_key: process.env.OPENAI_API_KEY,
    api_base: process.env.OPENAI_API_BASE || "https://api.openai.com/v1",
    gpt_model: process.env.OPENAI_MODEL || "gpt-4o",
    assistant_id: process.env.ASSISTANT_ID || "asst_ZyT7rWrTyqNq5l74PdATurJ5",
    primaryLanguage: process.env.PRIMARY_LANGUAGE || "ru",
    secondaryLanguage: process.env.SECONDARY_LANGUAGE || "en",
    deepgram_api_key: process.env.DEEPGRAM_API_KEY,
  };
});

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

let deepgramConnection = null;

ipcMain.handle("start-deepgram-stt", async (event, config) => {
  try {
    console.log("Starting Deepgram STT");

    if (!config.deepgram_api_key) {
      throw new Error("Deepgram API key is required");
    }

    const deepgram = createClient(config.deepgram_api_key);
    deepgramConnection = deepgram.listen.live({
      model: "nova-2",
      language: config.primaryLanguage || "ru",
      smart_format: true,
      interim_results: true,
      endpointing: 300,
      encoding: "linear16",
      sample_rate: 16000,
      channels: 1,
    });

    deepgramConnection.addListener(LiveTranscriptionEvents.Open, () => {
      console.log("Deepgram connection opened");
      event.sender.send("deepgram-status", {
        status: "open",
        language: config.primaryLanguage,
        model: "nova-2",
      });
    });

    deepgramConnection.addListener(LiveTranscriptionEvents.Close, () => {
      console.log("Deepgram connection closed");
      event.sender.send("deepgram-status", { status: "closed" });
    });

    deepgramConnection.addListener(
      LiveTranscriptionEvents.Transcript,
      (data) => {
        console.log("Deepgram transcript received:", data);
        if (data && data.channel?.alternatives?.[0]?.transcript) {
          const transcript = data.channel.alternatives[0].transcript.trim();
          if (transcript) {
            console.log("Sending transcript to renderer:", transcript);
            event.sender.send("deepgram-transcript", {
              transcript: transcript,
              is_final: data.is_final,
              speech_final: data.speech_final,
              channel: data.channel,
              metadata: data.metadata,
            });
          }
        }
      }
    );

    deepgramConnection.addListener(LiveTranscriptionEvents.Error, (err) => {
      console.error("Deepgram error:", err);
      event.sender.send("deepgram-error", err);
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Deepgram connection timeout"));
      }, 10000);

      deepgramConnection.addListener(LiveTranscriptionEvents.Open, () => {
        clearTimeout(timeout);
        resolve();
      });

      deepgramConnection.addListener(LiveTranscriptionEvents.Error, (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return {
      success: true,
      message: "Deepgram STT started successfully",
      model: "nova-2",
      language: config.primaryLanguage,
    };
  } catch (error) {
    console.error("Deepgram STT start error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("send-audio-to-deepgram", async (event, audioData) => {
  if (!deepgramConnection) {
    console.warn("Deepgram connection not established");
    return;
  }

  try {
    const buffer = Buffer.from(audioData);
    deepgramConnection.send(buffer);
  } catch (error) {
    console.error("Failed to send audio data to Deepgram:", error);
  }
});

ipcMain.handle("stop-deepgram-stt", () => {
  if (deepgramConnection) {
    console.log("Stopping Deepgram STT");
    deepgramConnection.finish();
    deepgramConnection = null;
  }
});

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
