# WatchBot

**WatchBot**は、人間の言葉による簡単な指示で必要な映像・音声を監視し、自動的に異常を検知・録画してくれるシステムです。
音声アシスタントやスマートフォンなどを通じて、自然言語で「○○を監視して」と依頼するだけで、カメラやセンサーと連携して、さまざまな監視タスクを自動実行します。

# ローカル開発環境の起動方法

## 最小構成（ウェブブラウザとPCのマイク/カメラ）で動作させる

- Ubuntuが推奨環境
    - 作者はUbuntu24 on WSL2
- Node.js 20以降をインストール
- [Dockerfile](/packages/service/Dockerfile)を参考に以下の依存パッケージをOSにインストールする
    - ffmpeg
    - build-essential
- このリポジトリをクローン
- RUN `git submodule update --init --recursive`
- RUN `npm i`
- .env.templateを.envにリネーム
    - .envファイルを開く
        - GEMINI_KEYにGEMINIのAPIキーを入れる
            - aistudio.google.comの方、vertexはレートリミットが謎にキツイので開発中はこっちで
- 開発用サーバを起動
    - RUN `npm run dev`
- 開発用クライアントを起動
    - RUN `npm run web`
    - ターミナルに表示されたURLをブラウザで開く

## ブラウザデモアプリの操作方法

- sensorの追加
    - input sensorのinputボタンを押す
    - (入力欄の文字はデバイスのID。複数台sensorを追加する際には別のIDを指定する)
- agentの呼び出し
    - call to agentのcallボタンを押す
        - 通話が開始される

## ハードウェアの追加

### センサーのクレデンシャルの発行方法

- Ring
  - https://github.com/dgreif/ring/wiki/Refresh-Tokens
  - 発行したトークンは.envのRING_REFRESH_TOKENに入れる
- Nest
  -https://github.com/potmat/homebridge-google-nest-sdm?tab=readme-ov-file#where-do-the-config-values-come-from
  - 発行した情報は.envの以下に入れる
    - NEST_CLIENT_ID
    - NEST_CLIENT_SECRET
    - NEST_PROJECT_ID
    - NEST_REFRESH_TOKEN

### Alexaとの連携

Alexaのホームスキルと連携する必要があります。

- ホームスキルの作成手順
    - https://developer.amazon.com/ja-JP/docs/alexa/smarthome/steps-to-build-a-smart-home-skill.html

Alexa用のAWS Lamdaの関数はこちら

[./packages/alexa-lamda/src/index.ts](./packages/alexa-lamda/src/index.ts)

Lamdaにはビルドしてバンドルしたファイルをアップロードしてください。また、外部デバイス(NestやRingなど)を利用する場合は適切に環境変数の設定をしてください
