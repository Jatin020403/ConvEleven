"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ElevenLabsClient } from "elevenlabs";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

// Access environment variables with NEXT_PUBLIC_ prefix
const XI_API_KEY = process.env.NEXT_PUBLIC_XI_API_KEY || "";
const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID || "";

const client = new ElevenLabsClient({
  apiKey: XI_API_KEY,
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
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Add a simple request counter to track the latest request
  const requestIdRef = useRef<number>(0);

  // Function to stop any currently playing audio
  const stopCurrentAudio = () => {
    // First, stop playback
    if (currentAudioRef.current) {
      // Pause the audio first
      currentAudioRef.current.pause();

      // Remove the src attribute before revoking URL to prevent errors
      currentAudioRef.current.removeAttribute('src');
      currentAudioRef.current.srcObject = null;

      // Force release of audio resources
      currentAudioRef.current.load();
      currentAudioRef.current = null;
    }

    // Then handle the MediaSource
    if (mediaSourceRef.current) {
      if (mediaSourceRef.current.readyState === 'open') {
        try {
          mediaSourceRef.current.endOfStream();
        } catch (e) {
          console.warn("Could not end media stream:", e);
        }
      }
      mediaSourceRef.current = null;
    }

    // After disconnecting the audio element, it's safe to revoke the URL
    if (audioURL) {
      // Add a small delay before revoking to ensure any pending operations complete
      setTimeout(() => {
        URL.revokeObjectURL(audioURL);
      }, 100);
      setAudioURL("");
    }

    setIsSpeaking(false);
  };

  async function switchSpeak() {
    if (!isRecording) {
      // Stop any current audio before starting a new recording
      stopCurrentAudio();

      // Reset previous state explicitly before starting a new recording
      setAudioURL("");
      transcribedText = "";
      kodeusReply = "";

      setIsRecording(true);
      await startRecording();
    } else {
      setIsRecording(false);

      // Increment request ID for this new request
      requestIdRef.current++;
      const currentRequestId = requestIdRef.current;

      try {
        const recordedBlob = await stopRecording();

        // Skip if another request has started
        if (currentRequestId !== requestIdRef.current) return;

        if (!recordedBlob) {
          throw new Error("No audio recorded");
        }

        await transcribeBlob(recordedBlob);

        // Skip if another request has started
        if (currentRequestId !== requestIdRef.current) return;

        if (!transcribedText) {
          throw new Error("No transcription text");
        }

        const streamData = await processConversation();

        // Skip if another request has started
        if (currentRequestId !== requestIdRef.current) return;

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
    // Stop any playing audio when ending the conversation
    stopCurrentAudio();

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
    // Stop any currently playing audio before starting a new one
    stopCurrentAudio();

    // Store the current request ID for this processing session
    const currentRequestId = requestIdRef.current;

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

      // Check if this is still the current request
      if (currentRequestId !== requestIdRef.current) {
        console.log("Request superseded by newer request");
        return null;
      }

      const resp = await response.json();
      kodeusReply = resp.message;

      if (!kodeusReply) {
        console.error("Empty response from conversation API");
        return null;
      }

      console.log("Streaming audio for text:", kodeusReply);

      // ElevenLabs Streaming API Call
      const ttsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/` + AGENT_ID + `/stream`,
        {
          method: "POST",
          headers: {
            "xi-api-key": XI_API_KEY,
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

      // Check if this is still the current request
      if (currentRequestId !== requestIdRef.current) {
        console.log("TTS request superseded by newer request");
        return null;
      }

      if (!ttsResponse.ok || !ttsResponse.body) {
        throw new Error("Failed to stream audio");
      }

      // Setup streaming media source
      mediaSourceRef.current = new MediaSource();
      const audioUrl = URL.createObjectURL(mediaSourceRef.current);

      // Create audio element here to start playing as soon as data is available
      const audio = new Audio(audioUrl);
      audio.autoplay = true;

      // Store reference to the current audio element
      currentAudioRef.current = audio;

      // Return both the URL and the streaming setup promise
      return {
        url: audioUrl,
        setupPromise: setupStreamingAudio(ttsResponse.body, audio, currentRequestId)
      };
    } catch (error) {
      console.error("Error in conversation processing:", error);
      return null;
    }
  }

  // Update setupStreamingAudio to check the request ID
  async function setupStreamingAudio(readableStream: ReadableStream, audio: HTMLAudioElement, requestId: number) {
    return new Promise<void>((resolve, reject) => {
      if (!mediaSourceRef.current) {
        reject(new Error("MediaSource not initialized"));
        return;
      }

      setIsSpeaking(true);

      mediaSourceRef.current.addEventListener("sourceopen", async () => {
        try {
          // Check if this is still the current request
          if (requestId !== requestIdRef.current) {
            resolve(); // Resolve without error since it's just outdated
            return;
          }

          // Set duration only after MediaSource is open
          if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
            mediaSourceRef.current.duration = 100;
          } else {
            throw new Error("MediaSource is not open");
          }

          const sourceBuffer = mediaSourceRef.current!.addSourceBuffer("audio/mpeg");
          const reader = readableStream.getReader();

          // Increase buffer threshold for smoother playback
          const BUFFER_THRESHOLD = 200000; // ~200KB before starting playback
          let initialBufferFilled = false;
          let accumulatedSize = 0;

          // Add event listener for when playback is about to starve
          audio.addEventListener('waiting', () => {
            console.log('Audio playback buffering...');
          });

          const pump = async () => {
            try {
              // Check if this is still the current request
              if (requestId !== requestIdRef.current) {
                console.log("Pump aborted - newer request exists");
                return;
              }

              const { done, value } = await reader.read();

              if (done) {
                // Check if mediaSourceRef is still valid and in open state
                if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open' &&
                  requestId === requestIdRef.current) {
                  if (!sourceBuffer.updating) {
                    try {
                      mediaSourceRef.current.endOfStream();
                    } catch (e) {
                      console.warn("Could not end media stream:", e);
                    }
                  } else {
                    sourceBuffer.addEventListener("updateend", () => {
                      if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open' &&
                        requestId === requestIdRef.current) {
                        try {
                          mediaSourceRef.current.endOfStream();
                        } catch (e) {
                          console.warn("Could not end media stream:", e);
                        }
                      }
                    }, { once: true });
                  }
                }

                // Wait for audio to finish playing
                audio.addEventListener("ended", () => {
                  setIsSpeaking(false);
                  resolve();
                }, { once: true });

                return;
              }

              // Check if MediaSource is still valid and this is still the current request
              if (!mediaSourceRef.current || mediaSourceRef.current.readyState !== 'open' ||
                requestId !== requestIdRef.current) {
                return; // Just return without error if superseded
              }

              // Wait if the buffer is updating
              if (sourceBuffer.updating) {
                sourceBuffer.addEventListener("updateend", () => {
                  if (requestId === requestIdRef.current) pump();
                }, { once: true });
                return;
              }

              // Append the new chunk
              try {
                sourceBuffer.appendBuffer(value);
              } catch (e) {
                if (requestId !== requestIdRef.current) {
                  return;
                }
                throw e;
              }

              // Track accumulated buffer size
              accumulatedSize += value.length;

              // Start playback once we have enough data
              if (!initialBufferFilled && accumulatedSize >= BUFFER_THRESHOLD) {
                initialBufferFilled = true;
                // Add a short delay before playing to ensure buffer is processed
                setTimeout(() => {
                  if (requestId === requestIdRef.current) {
                    audio.play().catch(e => {
                      console.error("Failed to start audio playback:", e);
                      reject(e);
                    });
                  }
                }, 100);
              }

              // Continue pumping
              sourceBuffer.addEventListener("updateend", () => {
                if (requestId === requestIdRef.current) pump();
              }, { once: true });
            } catch (error) {
              if (requestId === requestIdRef.current) {
                console.error("Error while pumping audio data:", error);
                reject(error);
              }
            }
          };

          // Start the pumping process
          pump();
        } catch (error) {
          if (requestId === requestIdRef.current) {
            console.error("Error setting up media source:", error);
            reject(error);
          }
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
      // Clear the current audio reference
      currentAudioRef.current = null;

      if (mediaSourceRef.current) {
        // Only end the stream if it's in the open state
        if (mediaSourceRef.current.readyState === 'open') {
          try {
            mediaSourceRef.current.endOfStream();
          } catch (e) {
            console.warn("Could not end media stream:", e);
          }
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