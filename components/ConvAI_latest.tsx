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
  apiKey: "sk_90274c6fe5c20df269347ec14978da39228e893a6e9a279b",
});

// Advanced Audio Playback with Additional Controls
class AudioPlayer {
  constructor(audioUrl) {
    this.audio = new Audio(audioUrl);

    // Event listeners for various audio states
    this.audio.addEventListener("loadedmetadata", () => {
      console.log("Audio metadata loaded");
      console.log("Duration:", this.audio.duration);
    });

    this.audio.addEventListener("ended", () => {
      console.log("Audio playback finished");
    });
  }

  play() {
    return this.audio.play();
  }

  pause() {
    this.audio.pause();
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  setVolume(volume) {
    // Volume ranges from 0 to 1
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  seek(time) {
    // Seek to a specific time in the audio
    this.audio.currentTime = time;
  }
}

export function ConvAI() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatId, setChatId] = useState("");
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  let transcribedText = "";
  let kodeusReply = "";
  const [audioURL, setAudioURL] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // async function switchSpeak() {
  // if (!isRecording) {
  // setIsRecording(!isRecording);
  // await startRecording();
  // console.log(chatId);
  // console.log("1");
  // } else {
  // setIsRecording(!isRecording);
  // await stopRecording();
  // console.log(fileBlob?.arrayBuffer.length);
  // console.log("2");
  // await transcribe();
  // console.log(transcribedText);
  // console.log("3");
  // await processConversation();
  // console.log(kodeusReply);
  // console.log("4");
  // await Speak();
  // console.log("5");
  // console.log();
  // }
  // return;
  // }

  async function switchSpeak() {
    if (!isRecording) {
      // Reset previous state explicitly before starting a new recording
      setFileBlob(null);
      setAudioURL("");
      transcribedText = "";

      setIsRecording(true);
      await startRecording();
    } else {
      setIsRecording(false);
      const recordedBlob = await stopRecording();

      if (recordedBlob) {
        await transcribeBlob(recordedBlob);
        const newAudioURL = await processConversation();

        // Make sure we're using the most current audio URL
        if (newAudioURL) {
          setAudioURL(newAudioURL);
          await Speak();
        } else {
          console.error("No audio URL generated");
        }
      } else {
        console.error("No audio blob captured");
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

          // Use functional update to ensure we're working with the latest state
          setFileBlob((currentBlob) => {
            console.log("New blob created:", audioBlob.size);
            return audioBlob;
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
    return new Promise((resolve) => {
      if (mediaRecorderRef.current) {
        // Set up a one-time event handler for the stop event
        mediaRecorderRef.current.addEventListener(
          "stop",
          () => {
            if (audioChunksRef.current.length > 0) {
              const audioBlob = new Blob(audioChunksRef.current, {
                type: "audio/webm",
              });

              // Still update the state for other parts of the app
              setFileBlob(audioBlob);

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
  async function transcribeBlob(blob) {
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

  // Keep the original transcribe function for backward compatibility
  async function transcribe() {
    // Create a local blob from audioChunksRef if fileBlob is null
    const blobToTranscribe =
      fileBlob ||
      (audioChunksRef.current.length > 0
        ? new Blob(audioChunksRef.current, { type: "audio/webm" })
        : null);

    await transcribeBlob(blobToTranscribe);
  }

  async function processConversation() {
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

    const audio = await client.textToSpeech.convert("JBFqnCBsd6RMkjVDRZzb", {
      // Sarah: EXAVITQu4vr4xnSDxMaL
      text: kodeusReply,

      model_id: "eleven_multilingual_v2",

      output_format: "mp3_44100_128",
    });

    const audioBuffer = await streamToBuffer(audio);
    const audioBlob = new Blob([audioBuffer], { type: "audio/mp3" });

    // Revoke any existing object URL to prevent memory leaks
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }

    const url = URL.createObjectURL(audioBlob);
    setAudioURL(url);

    // Return the URL to ensure it's immediately available
    return url;
  }

  async function Speak() {
    setIsSpeaking(true);
    try {
      // Use the latest audioURL from state or the one passed directly
      const audio = new Audio(audioURL);

      // Return a promise that resolves when the audio has finished playing
      await new Promise((resolve, reject) => {
        audio.onended = resolve;
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          reject(e);
        };

        // Ensure audio is loaded before attempting to play
        audio.oncanplaythrough = () => {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.error("Play failed:", error);
              reject(error);
            });
          }
        };

        // Handle the case where the audio fails to load
        audio.onerror = (e) => {
          console.error("Failed to load audio:", e);
          reject(e);
        };
      });
    } catch (error) {
      console.error("Error during audio playback:", error);
    } finally {
      setIsSpeaking(false);
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
