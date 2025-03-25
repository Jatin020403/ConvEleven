"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ElevenLabsClient } from "elevenlabs";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";
import internal from "stream";
import { WhisperSTT } from "whisper-speech-to-text";

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

const whisper = new WhisperSTT(
  "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"
);

export function ConvAI() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatId, setChatId] = useState("");
  let transcribedText = "";
  let kodeusReply = "";
  const [audioURL, setAudioURL] = useState<string>("");

  async function switchSpeak() {
    if (!isRecording) {
      setIsRecording(!isRecording);
      await Recording();
      console.log(chatId);
      console.log("1");
    } else {
      setIsRecording(!isRecording);
      await stopRecording();
      console.log("2");
      await transcribe();
      console.log(transcribedText);
      console.log("3");
      await processConversation();
      console.log(kodeusReply);
      console.log("4");
      await Speak();
      console.log("5");
      console.log();
    }
    return;
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

  async function Recording() {
    await whisper.startRecording();
  }

  async function stopRecording() {
    await whisper.pauseRecording();
  }

  async function transcribe() {
    await whisper.stopRecording((text) => {
      console.log("Transcription:", text);
      transcribedText = text;
      console.log(transcribedText);
    });
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
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

    const urlSite = URL.createObjectURL(audioBlob);

    setAudioURL(urlSite);
  }

  async function Speak() {
    setIsSpeaking(true);
    //     <audio hidden controls autoPlay className="w-full">
    //   <source src={audioURL} type="audio/mpeg" />
    // </audio>
    const beat = new Audio(audioURL);
    beat.play();
    setIsSpeaking(false);
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
