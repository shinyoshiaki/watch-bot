import { randomUUID } from "crypto";

import type { AccessoryDevice as SensorDevice } from "./accessory/base.js";
import {
  type GoogleNestCredentials,
  setupGoogleNest,
} from "./accessory/nest.js";
import { type RingCredentials, setupRing } from "./accessory/ring/ring.js";
import { setupWHIPSensor } from "./accessory/whip.js";
import { AlexaFrontDevice } from "./front/alexa.js";
import type { FrontDevice } from "./front/base.js";
import { WHIPFrontDevice } from "./front/whip.js";
import type { VertexConfig } from "./imports/gemini.js";
import type { LLMAgent } from "./llm/base.js";
import { GeminiLLM } from "./llm/gemini.js";
import { MultiModalLLM } from "./llm/multimodal/gemini.js";
import { frontLLMPrompt } from "./prompt.js";
import type {
  FrontDeviceName,
  SensorAddResponse,
  WHIPSensorCredential,
} from "./schema.js";

interface SessionOptions {
  vertex?: VertexConfig;
  model?: string;
}

export class Session {
  readonly id: string;
  frontDevice?: FrontDevice;
  frontLLM!: LLMAgent;
  tasks: MultiModalLLM[] = [];
  sensors: SensorDevice[] = [];

  constructor(
    readonly props: {
      id?: string;
      llmApiKey: string;
      sensors?: SensorDevice[];
      options?: SessionOptions;
    },
  ) {
    this.id = props.id ?? randomUUID();
    this.sensors = props.sensors ?? [];
  }

  async init() {
    const deviceNames = this.sensors.map((d) => d.name);

    this.frontLLM = new GeminiLLM({
      apiKey: this.props.llmApiKey,
      systemInstruction: frontLLMPrompt.systemInstruction(deviceNames),
      declarations: frontLLMPrompt.declarations,
      responseModality: "audio",
      model: this.props.options?.model,
      vertex: this.props.options?.vertex,
    });

    this.frontLLM.onToolCall.subscribe(async (call) => {
      console.log("front Tool call", JSON.stringify(call, null, 2));

      switch (call.name) {
        case "device_list":
          {
            const deviceNames = this.sensors.map((d) => d.name);
            this.sensorList({ id: call.id, deviceNames });
          }
          break;
        case "set_task":
          {
            const { device: deviceName, task } = call.args as {
              device: string;
              task: string;
            };
            const res = await this.setTask({ deviceName, task }).catch((e) => ({
              e,
            }));
            if ("e" in res) {
              this.frontLLM.sendToolCallResponse({
                id: call.id,
                response: { ok: false },
              });
              return;
            }
            this.frontLLM.sendToolCallResponse({
              id: call.id,
              response: {
                id: res.id,
              },
            });
          }
          break;
        case "task_list":
          {
            const list = this.taskList();
            this.frontLLM.sendToolCallResponse({
              id: call.id,
              response: { list },
            });
          }
          break;
        case "abort_task":
          {
            const { id } = call.args as { id: string };
            const res = await this.abortTask({ id })
              .then(() => ({ ok: true }))
              .catch((e) => ({ e }));
            if ("e" in res) {
              this.frontLLM.sendToolCallResponse({
                id: call.id,
                response: { ok: false },
              });
              return;
            }
            this.frontLLM.sendToolCallResponse({
              id: call.id,
              response: { ok: true },
            });
          }
          break;
      }
    });
    this.frontLLM.onAudio.subscribe((rtp) => {
      if (this.frontDevice) {
        this.frontDevice.handleAudio(rtp);
      }
    });
    this.frontLLM.onCompleteText.subscribe((text) => {
      console.log("front complete text", text);
      this.frontLLM.muteInputAudio = false;
      this.frontLLM.unmuteAt = Date.now();
    });
    await this.frontLLM.start();
  }

  setFrontDevice(frontDevice: FrontDeviceName) {
    const frontDeviceInstance = (() => {
      switch (frontDevice) {
        case WHIPFrontDevice.deviceName:
          return new WHIPFrontDevice();
        case AlexaFrontDevice.deviceName:
          return new AlexaFrontDevice();
        default:
          throw new Error(`Unknown front device: ${frontDevice}`);
      }
    })();
    this.frontDevice = frontDeviceInstance;
    frontDeviceInstance.onAudio.subscribe((rtp) => {
      this.frontLLM.sendAudio(rtp);
    });
    return frontDeviceInstance;
  }

  async addSensor(sensorInit: SessionSensor): Promise<SensorAddResponse[]> {
    const sensors: SensorDevice[] = await (async () => {
      if (sensorInit.nest) {
        return await setupGoogleNest(sensorInit.nest);
      }
      if (sensorInit.ring) {
        return await setupRing(sensorInit.ring);
      }
      if (sensorInit.whip) {
        return [await setupWHIPSensor(sensorInit.whip[0])];
      }
      throw new Error("sensor not found");
    })();
    this.sensors.push(...sensors);
    return sensors.map((s) => ({ sensorId: s.id, negotiation: s.negotiation }));
  }

  private async createMultiModalLLM(device: SensorDevice, task: string) {
    const multiModalLLM = new MultiModalLLM({
      device,
      apiKey: this.props.llmApiKey,
      model: this.props.options?.model,
      vertex: this.props.options?.vertex,
      task,
    });
    multiModalLLM.onCompleteTask.subscribe(({ task, result }) => {
      const complete = frontLLMPrompt.completeTask({
        task,
        result,
      });
      this.frontLLM.sendCompleteText(complete);
    });
    this.tasks.push(multiModalLLM);
    multiModalLLM.onCompleteTask.once(() => {
      this.tasks = this.tasks.filter((t) => t.id !== multiModalLLM.id);
    });
    await multiModalLLM.start();
    return multiModalLLM;
  }

  private sensorList({
    id,
    deviceNames,
  }: { id: string; deviceNames: string[] }) {
    this.frontLLM.sendToolCallResponse({
      id,
      response: {
        devices: deviceNames,
      },
    });
  }

  private async setTask({
    deviceName,
    task,
  }: { deviceName: string; task: string }) {
    const device = this.sensors.find((d) => d.name === deviceName);
    if (!device) {
      throw new Error("device not found");
    }
    return await this.createMultiModalLLM(device, task);
  }

  private taskList() {
    return this.tasks.map((t) => t.task);
  }

  private async abortTask({ id }: { id: string }) {
    const task = this.tasks.find((t) => t.id === id || t.task === id);
    if (!task) {
      throw new Error("task not found");
    }
    this.tasks = this.tasks.filter((t) => t.id !== id);
    task.close();
  }
}

export type SessionSensor = {
  nest?: GoogleNestCredentials;
  ring?: RingCredentials;
  whip?: WHIPSensorCredential[];
};
export type SessionSensorValue = NonNullable<
  SessionSensor[keyof SessionSensor]
>;
