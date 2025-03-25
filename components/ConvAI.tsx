"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ElevenLabsClient } from "elevenlabs";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

const client = new ElevenLabsClient({
  apiKey: "sk_4e7026128a2ef3d7719fdc1168e77718c6120e66189a5573",
});

export function ConvAI() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatId, setChatId] = useState("");
  let transcribedText = "";
  let kodeusReply = "";
  const [audioURL, setAudioURL] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaSourceRef = useRef<MediaSource | null>(null);

  async function switchSpeak() {
    if (!isRecording) {
      // Reset previous state explicitly before starting a new recording
      setAudioURL("");
      transcribedText = "";
      kodeusReply = "";

      setIsRecording(true);
      await startRecording();
    } else {
      setIsRecording(false);
      try {
        const recordedBlob = await stopRecording();

        if (!recordedBlob) {
          throw new Error("No audio recorded");
        }

        await transcribeBlob(recordedBlob);

        if (!transcribedText) {
          throw new Error("No transcription text");
        }

        const streamData = await processConversation();

        if (!streamData) {
          throw new Error("Failed to get audio stream");
        }

        // Pass the streaming data to Speak
        await Speak(streamData);
      } catch (error) {
        console.error("Error in speech processing flow:", error);
        setIsSpeaking(false);
      }
    }
  }

  async function startConversation() {
    setChatId(uuidv4());
    setIsConnected(true);
  }

  async function endConversation() {
    setIsConnected(false);
    setIsRecording(false);
    transcribedText = "";
    kodeusReply = "";
  }

  async function startRecording() {
    // Create a new array for each recording
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });

          const url = URL.createObjectURL(audioBlob);
          setAudioURL((currentURL) => {
            // Revoke previous URL to prevent memory leaks
            if (currentURL) URL.revokeObjectURL(currentURL);
            return url;
          });
        } else {
          console.error("No audio data recorded.");
        }
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }

  async function stopRecording() {
    return new Promise((resolve: (value: Blob | null) => void) => {
      if (mediaRecorderRef.current) {
        // Set up a one-time event handler for the stop event
        mediaRecorderRef.current.addEventListener(
          "stop",
          () => {
            if (audioChunksRef.current.length > 0) {
              const audioBlob = new Blob(audioChunksRef.current, {
                type: "audio/webm",
              });

              const url = URL.createObjectURL(audioBlob);
              setAudioURL((currentURL) => {
                if (currentURL) URL.revokeObjectURL(currentURL);
                return url;
              });

              // Resolve the promise with the blob
              resolve(audioBlob);
            } else {
              console.error("No audio data recorded.");
              resolve(null);
            }
          },
          { once: true }
        );

        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream
          .getTracks()
          .forEach((track) => track.stop());
      } else {
        resolve(null);
      }
    });
  }

  // Create a new function to transcribe a specific blob
  async function transcribeBlob(blob: Blob | null) {
    if (!blob) {
      console.error("No audio blob available for transcription");
      return;
    }

    const transcription = await client.speechToText.convert({
      file: blob,
      model_id: "scribe_v1",
    });
    transcribedText = transcription.text;
    console.log(transcription);
  }

  async function processConversation() {
    try {
      const response = await fetch(
        "https://yesthisoneforfree.zapto.org/message",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: transcribedText,
            context: chatId,
            message_id: "",
          }),
        }
      );

      const resp = await response.json();
      kodeusReply = resp.message;

      if (!kodeusReply) {
        console.error("Empty response from conversation API");
        return null;
      }

      console.log("Streaming audio for text:", kodeusReply);

      // ElevenLabs Streaming API Call
      const ttsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb/stream`,
        {
          method: "POST",
          headers: {
            "xi-api-key": "sk_4e7026128a2ef3d7719fdc1168e77718c6120e66189a5573",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: kodeusReply,
            model_id: "eleven_multilingual_v2",
            output_format: "mp3_44100_128",
            stream: true,
          }),
        }
      );

      if (!ttsResponse.ok || !ttsResponse.body) {
        throw new Error("Failed to stream audio");
      }

      // Setup streaming media source
      mediaSourceRef.current = new MediaSource();
      const audioUrl = URL.createObjectURL(mediaSourceRef.current);

      // Create audio element here to start playing as soon as data is available
      const audio = new Audio(audioUrl);
      audio.autoplay = true;

      // Return both the URL and the streaming setup promise
      return {
        url: audioUrl,
        setupPromise: setupStreamingAudio(ttsResponse.body, audio)
      };

    } catch (error) {
      console.error("Error in conversation processing:", error);
      return null;
    }
  }

  // New function to set up streaming audio
  async function setupStreamingAudio(readableStream: ReadableStream, audio: HTMLAudioElement) {
    return new Promise<void>((resolve, reject) => {
      if (!mediaSourceRef.current) {
        reject(new Error("MediaSource not initialized"));
        return;
      }

      setIsSpeaking(true);

      mediaSourceRef.current.addEventListener("sourceopen", async () => {
        try {
          const sourceBuffer = mediaSourceRef.current!.addSourceBuffer("audio/mpeg");
          const reader = readableStream.getReader();

          // This value may need adjustment based on your specific requirements
          const BUFFER_THRESHOLD = 100000; // ~100KB before starting playback
          let initialBufferFilled = false;
          let accumulatedSize = 0;

          const pump = async () => {
            try {
              const { done, value } = await reader.read();

              if (done) {
                // End of stream
                if (!sourceBuffer.updating) {
                  mediaSourceRef.current?.endOfStream();
                } else {
                  sourceBuffer.addEventListener("updateend", () => {
                    mediaSourceRef.current?.endOfStream();
                  }, { once: true });
                }

                // Wait for audio to finish playing
                audio.addEventListener("ended", () => {
                  setIsSpeaking(false);
                  resolve();
                }, { once: true });

                return;
              }

              // Wait if the buffer is updating
              if (sourceBuffer.updating) {
                sourceBuffer.addEventListener("updateend", () => pump(), { once: true });
                return;
              }

              // Append the new chunk
              sourceBuffer.appendBuffer(value);

              // Track accumulated buffer size
              accumulatedSize += value.length;

              // Start playback once we have enough data
              if (!initialBufferFilled && accumulatedSize >= BUFFER_THRESHOLD) {
                initialBufferFilled = true;
                audio.play().catch(e => {
                  console.error("Failed to start audio playback:", e);
                  reject(e);
                });
              }

              // Continue pumping
              pump();
            } catch (error) {
              console.error("Error while pumping audio data:", error);
              reject(error);
            }
          };

          // Start the pumping process
          pump();
        } catch (error) {
          console.error("Error setting up media source:", error);
          reject(error);
        }
      });
    });
  }

  async function Speak(streamData: { url: string, setupPromise: Promise<void> }) {
    if (!streamData) return;

    try {
      // The audio element is created and playback is managed in setupStreamingAudio
      await streamData.setupPromise;
    } catch (error) {
      console.error("Playback error:", error);
    } finally {
      setIsSpeaking(false);
      if (mediaSourceRef.current) {
        // Only end the stream if it hasn't already ended
        if (mediaSourceRef.current.readyState !== 'ended') {
          mediaSourceRef.current.endOfStream();
        }
        mediaSourceRef.current = null;
      }
      if (audioURL) URL.revokeObjectURL(audioURL);
    }
  }

  return (
    <div className={"flex justify-center items-center gap-x-4"}>
      <Card className={"rounded-2xl"}>
        <CardContent>
          <CardHeader>
            <CardTitle className={"text-center"}>
              {isConnected
                ? isSpeaking
                  ? `Agent is speaking`
                  : isRecording
                    ? "Agent is listening"
                    : "Agent is connected"
                : "Disconnected"}
            </CardTitle>
          </CardHeader>
          <div className={"flex flex-col gap-y-4 text-center"}>
            <div
              className={cn(
                "orb my-16 mx-12",
                isConnected
                  ? "orb-active"
                  : isSpeaking
                    ? "animate-orb"
                    : isRecording
                      ? "animate-orb-slow"
                      : "orb-inactive"
              )}
            ></div>
            <Button
              variant={"ghost"}
              className={"rounded-full w-16 h-16 mx-auto"}
              style={{
                backgroundColor: isRecording ? "green" : "red",
              }}
              size={"icon"}
              disabled={!isConnected}
              onClick={switchSpeak}
            >

              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-mic"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="23" />
                <line x1="8" x2="16" y1="23" y2="23" />
              </svg>
            </Button>
            <Button
              variant={"outline"}
              className={"rounded-full"}
              size={"lg"}
              disabled={isConnected}
              onClick={startConversation}
            >
              Start conversation
            </Button>
            <Button
              variant={"outline"}
              className={"rounded-full"}
              size={"lg"}
              disabled={!isConnected}
              onClick={endConversation}
            >
              End conversation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}