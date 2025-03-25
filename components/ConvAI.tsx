"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ElevenLabsClient } from "elevenlabs";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import internal from "stream";

async function streamToBuffer(stream: internal.Readable): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

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
          throw new Error("Transcription produced no text");
        }

        const url = await processConversation();

        if (!url) {
          throw new Error("Failed to get audio URL");
        }

        // Pass the URL directly to Speak
        await Speak(url);
      } catch (error) {
        console.error("Error in speech processing flow:", error);
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

      console.log("Generating audio for text:", kodeusReply);

      try {
        const audio = await client.textToSpeech.convert(
          "JBFqnCBsd6RMkjVDRZzb",
          {
            text: kodeusReply,
            model_id: "eleven_multilingual_v2",
            output_format: "mp3_44100_128",
          }
        );

        const audioBuffer = await streamToBuffer(audio);
        const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

        // Clear previous audio URL
        if (audioURL) {
          try {
            URL.revokeObjectURL(audioURL);
          } catch (e) {
            console.warn("Failed to revoke URL:", e);
          }
        }

        const url = URL.createObjectURL(audioBlob);
        console.log("Created audio URL:", url);

        // Update state first
        setAudioURL(url);

        return url;
      } catch (audioError) {
        console.error("Error generating audio:", audioError);
        return null;
      }
    } catch (error) {
      console.error("Error in conversation processing:", error);
      return null;
    }
  }

  // Modified to accept a direct URL parameter
  async function Speak(directUrl: string) {
    setIsSpeaking(true);
    let audio: HTMLAudioElement | null = null;

    try {
      // Use the passed URL if available, otherwise fall back to state
      const urlToPlay = directUrl || audioURL;

      if (!urlToPlay) {
        throw new Error("No audio URL available");
      }

      console.log("Attempting to play:", urlToPlay);

      // Create audio element and set properties
      audio = new Audio();

      // Create a promise for audio playback
      await new Promise<void>((resolve, reject) => {
        let hasError = false;

        // Safety timeout in case events don't fire
        const timeout = setTimeout(() => {
          if (!hasError) {
            console.warn("Audio playback timeout - resolving anyway");
          }
        }, 1000000); // 10 second timeout

        // Set up event handlers
        const handlePlaybackEnd = () => {
          console.log("Audio playback ended");
          clearTimeout(timeout);
          resolve();
        };

        const handleError = (err: unknown) => {
          hasError = true;
          clearTimeout(timeout);
          // console.error("Audio error:", err, audio.error);
          reject(err);
        };

        if (!audio) {
          return;
        }

        // Attach event listeners - using addEventListener for better control
        audio.addEventListener("ended", handlePlaybackEnd, { once: true });
        audio.addEventListener("error", handleError, { once: true });

        // Add load success handler
        audio.addEventListener(
          "canplaythrough",
          () => {
            if(!audio){
              return
            }
            console.log("Audio can play through, starting playback");
            audio.play().catch(handleError);
          },
          { once: true }
        );

        // Set source and load
        audio.src = urlToPlay;
        audio.load();
      });
    } catch (error) {
      console.error("Speak function error:", error);
    } finally {
      setIsSpeaking(false);

      // Clean up any remaining audio
      if (audio) {
        audio.pause();
        audio.src = "";
      }
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
              {/* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
                <path
                  fill="#FF156D"
                  stroke="#FF156D"
                  stroke-width="15"
                  transform-origin="center"
                  d="m148 84.7 13.8-8-10-17.3-13.8 8a50 50 0 0 0-27.4-15.9v-16h-20v16A50 50 0 0 0 63 67.4l-13.8-8-10 17.3 13.8 8a50 50 0 0 0 0 31.7l-13.8 8 10 17.3 13.8-8a50 50 0 0 0 27.5 15.9v16h20v-16a50 50 0 0 0 27.4-15.9l13.8 8 10-17.3-13.8-8a50 50 0 0 0 0-31.7Zm-47.5 50.8a35 35 0 1 1 0-70 35 35 0 0 1 0 70Z"
                >
                  <animateTransform
                    type="rotate"
                    attributeName="transform"
                    calcMode="spline"
                    dur="1.8"
                    values="0;120"
                    keyTimes="0;1"
                    keySplines="0 0 1 1"
                    repeatCount="indefinite"
                  ></animateTransform>
                </path>
              </svg>
               */}
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
