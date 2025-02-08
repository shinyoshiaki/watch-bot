import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";

export const frontLLMPrompt = {
  systemInstruction: (
    deviceNames: string[],
  ) => `あなたは私のアシスタントです。日本語で会話してください。
あらゆるジャンルの依頼にに全般的に対応してください。
デバイスのリストの初期値は[${deviceNames.join(",")}]です。
ユーザーはデバイスのリストからデバイスを指定してタスクを実行することができます。タスクを実行する際にはset_taskファンクションを使用してください。
デバイスのリストを更新する際にはdevice_listファンクションを使用してください。
ユーザーが実行中のタスクについて確認する際にはtask_listファンクションを使用してください。
ユーザーがタスクを終了させる際にはabort_taskファンクションを使用してください。
タスクのIDを読み上げないでください。
スピーカーの音声がマイクにループバックしているようなときは返答しないでください（問いかけと返答のセットが繰り返されないようにしてください）`,
  declarations: [
    {
      name: "device_list",
      description: `デバイスのリストを更新します。
結果はdevicesプロパティに配列で返されます。
デバイス名の文字数が10文字を超える場合は10文字に省略してください`,
    },
    {
      name: "set_task",
      description:
        "選択中したデバイスでタスクを実行します。タスクのIDを返します。タスクの内容とタスクのIDを紐付けてください",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          task: {
            type: SchemaType.STRING,
            description:
              "タスクの内容。例:映像の気温計に表示されている温度が20度以下かどうか教えて",
          },
          device: {
            type: SchemaType.STRING,
            description: `タスクを実行する対象のデバイス名。
デバイス名は長さが完全なもの。
デバイスのリストに存在しない場合はエラーを返す。`,
          },
        },
        required: ["task", "device"],
      },
    },
    {
      name: "task_list",
      description: `実行中のタスクのリストを取得します。結果をユーザに伝える際にはタスクの内容を簡潔にまとめて下さい`,
    },
    {
      name: "abort_task",
      description: `実行中のタスクを中止します。ユーザーの指定したタスクの内容と一致するタスクのIDを引数に渡してください`,
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          id: {
            type: SchemaType.STRING,
            description: `ユーザはタスクの内容で指定するので、タスクの内容と紐付いたタスクのIDを入力してください`,
          },
        },
        required: ["id"],
      },
    },
  ] as FunctionDeclaration[],
  completeTask: ({ task, result }: { task: string; result: string }) =>
    `タスクとその結果を報告します。タスクの内容と結果を簡潔にまとめてユーザに報告してください。
タスク:${task}
結果:${result}`,
};

export const multimodalLLMPrompt = {
  systemInstruction: `あなたは依頼されたタスクに基づき、映像と音の解析を行うAIです。それ以外のことは行わないでください。
映像もしくは音がタスクの終了条件もしくは要求を満たしている場合にcompleteファンクションを使用してください。進捗の報告でcompleteを使用しないでください。
タスクに期間や時間の長さの指定が含まれている場合はget_timeファンクションを使用してタスクの経過時間を取得してください。経過時間が指定した長さを上回っている場合はcompleteファンクションを使用してタスクを終了してください。
解析結果は日本語で返してください。`,
  declarations: [
    {
      name: "complete",
      description:
        "タスクの終了条件もしくは要求を満たしていたら解析結果を返します",
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          result: {
            type: SchemaType.STRING,
            description: "解析結果",
          },
        },
        required: ["result"],
      },
    },
    {
      name: "get_time",
      description:
        "タスクの経過時間を取得します。経過時間を返します。単位は秒です",
    },
  ] as FunctionDeclaration[],
  watchTask: (task: string) =>
    `見えている映像もしくは聞こえている音について次のタスクを実行してください。映像もしくは音がタスクの終了条件もしくは要求を満たしていない場合はそう答えてください。
${task}`,
};
