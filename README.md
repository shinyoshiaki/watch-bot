# WatchBot

**WatchBot**は、人間の言葉による簡単な指示で必要な映像・音声を監視し、自動的に異常を検知・録画してくれるシステムです。
音声アシスタントやスマートフォンなどを通じて、自然言語で「○○を監視して」と依頼するだけで、カメラやセンサーと連携して、さまざまな監視タスクを自動実行します。

## ローカル開発環境の起動方法

### 最小構成（ウェブブラウザとPCのマイク/カメラ）で動作させる

- Ubuntuが推奨環境
    - 作者はUbuntu24 on WSL2
- Node.js 20以降をインストール
- このリポジトリをクローン
- RUN `git submodule update --init --recursive`
- RUN `npm i`
- .env.templateを.envにリネーム
    - .envファイルを開く
        - GEMINI_KEYにGEMINIのAPIキーを入れる
- 開発用サーバを起動
    - RUN `npm run dev`
- 開発用クライアントを起動
    - RUN `npm run web`
    - ターミナルに表示されたURLをブラウザで開く

### ブラウザデモアプリの操作方法

- sensorの追加
    - input sensorのinputボタンを押す
    - (入力欄の数字はデバイスの受け入れポート。複数台sensorを追加する際には別のポート番号を指定する)
- agentの呼び出し
    - call to agentのcallボタンを押す
        - 通話が開始される



## センサーのクレデンシャルの発行方法

- Ring
  - https://github.com/dgreif/ring/wiki/Refresh-Tokens
  - 発行したトークンは.envのRING_REFRESH_TOKENに入れる
- Nest
  -https://github.com/potmat/homebridge-google-nest-sdm?tab=readme-ov-file#where-do-the-config-values-come-from
  - 発行した情報は.envの以下に入れる
    - CLIENT_ID
    - CLIENT_SECRET
    - PROJECT_ID
    - REFRESH_TOKEN

また開発用サーバのコードを書き換える必要があります。
次のようにnestやringのコメントアウト箇所を解除してください。

```ts
createSession({
  accessory: {
    whip: [{ port: 9999 }],
    nest: {
      clientId: CLIENT_ID!,
      clientSecret: CLIENT_SECRET!,
      projectId: PROJECT_ID!,
      refreshToken: REFRESH_TOKEN!,
    },
    ring: { refreshToken: RING_REFRESH_TOKEN! },
  },
  frontDevice: { name: "whip", port: 3001 },
  llmApiKey: GEMINI_KEY!,
});

```

## Alexaとの連携

Alexaのホームスキルと連携する必要があります。

- ホームスキルの作成手順
    - https://developer.amazon.com/ja-JP/docs/alexa/smarthome/steps-to-build-a-smart-home-skill.html

Alexa用のAWS Lamdaの関数はこちら
[./packages/alexa-lamda/src/index.ts](./packages/alexa-lamda/src/index.ts)


また開発用サーバのコードを書き換える必要があります。
次のようにfrontDeviceの設定をalexaに変更してください。

```ts
createSession({
  accessory: {
    whip: [{ port: 9999 }],
    // nest: {
    //   clientId: CLIENT_ID!,
    //   clientSecret: CLIENT_SECRET!,
    //   projectId: PROJECT_ID!,
    //   refreshToken: REFRESH_TOKEN!,
    // },
    // ring: { refreshToken: RING_REFRESH_TOKEN! },
  },
  frontDevice: { name: "alexa", port: 3001 },
  llmApiKey: GEMINI_KEY!,
});
```