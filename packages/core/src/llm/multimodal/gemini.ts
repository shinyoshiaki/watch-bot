import { randomUUID } from "crypto";
import { Event, useH264, useVP8 } from "werift";
import type { AccessoryDevice } from "../../accessory/base.js";
import type { GeminiConfig } from "../../imports/gemini.js";
import type { LLMAgent } from "../base.js";
import { GeminiLLM } from "../gemini.js";
import { multimodalLLMPrompt } from "../../prompt.js";

export class MultiModalLLM {
  id: string = randomUUID();
  llm: LLMAgent;
  onCompleteTask = new Event<[{ task: string; result: string }]>();
  task: string;

  constructor(
    private props: {
      device: AccessoryDevice;
      task: string;
    } & Omit<
      GeminiConfig,
      "responseModality" | "systemInstruction" | "declarations"
    >,
  ) {
    this.task = this.props.task;

    this.llm = new GeminiLLM({
      ...props,
      systemInstruction: multimodalLLMPrompt.systemInstruction,
      declarations: multimodalLLMPrompt.declarations,
      videoCodec: props.device.videoCodec === "h264" ? useH264() : useVP8(),
      responseModality: "text",
    });
    this.llm.onToolCall.subscribe((call) => {
      console.log("multimodal Tool call", JSON.stringify(call, null, 2));

      switch (call.name) {
        case "complete":
          {
            const { result } = call.args as { result: string };
            this.llm.sendToolCallResponse({
              id: call.id,
              response: {
                ok: true,
              },
            });

            const task = this.llm.task;
            if (!task) {
              return;
            }
            this.llm.stopTask();

            this.props.device.recording({
              duration: 5000,
              path: Date.now().toString() + ".webm",
            });
            this.onCompleteTask.execute({ task, result });
            this.close();
          }
          break;
        case "get_time":
          {
            const time = Math.floor(
              (Date.now() - this.llm.taskStartTime!) / 1000,
            );
            this.llm.sendToolCallResponse({
              id: call.id,
              response: {
                time,
              },
            });
          }
          break;
      }
    });
    this.llm.onCompleteText.subscribe((text) => {
      if (text) {
        console.log("multimodal complete text", text);
      }
    });

    props.device.onAudio.subscribe((rtp) => {
      this.llm.sendAudio(rtp);
    });
    props.device.onVideo.subscribe((rtp) => {
      this.llm.sendVideo(rtp);
    });
  }

  async start() {
    await this.llm.start();
    this.llm.onImageSent.once(() => {
      this.llm.updateTask(multimodalLLMPrompt.watchTask(this.props.task));
    });
  }

  close() {
    this.llm.close();
  }
}
