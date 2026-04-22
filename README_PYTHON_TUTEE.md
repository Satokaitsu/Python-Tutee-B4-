
# Python-tutee System

このシステムは、Matlab-tutee-testをベースにカスタマイズされたPython学習支援システムです。
テスト機能や知識チェックリスト機能を排除し、純粋に「マナビーに教える」体験に特化しています。

## 特徴
- **シンプル化されたUI**: テストボタンや知識パネルを削除し、チャット画面を広く使用できます。
- **専用プロンプト**: Chain-of-Thought (CoT) プロンプトを使用し、マナビーは「知識の浅い生徒」として振る舞い、ユーザーに教えを請います。
- **学習ログ**: 会話内容は `data/mock_sessions` に保存されます。

## 実行方法

### 1. バックエンド (サーバー) の起動
新しいターミナルを開き、以下のコマンドを実行してください：
```bash
cd "c:\Users\佐藤　快飛\Python-tutee"
python run_mock_server.py
```
サーバーは `http://127.0.0.1:8025` で起動します。

### 2. フロントエンド (UI) の起動
別のターミナルを開き、以下のコマンドを実行してください：
```bash
cd "c:\Users\佐藤　快飛\Python-tutee\frontend_demo"
npm install
npm run dev
```
(初回のみ `npm install` が必要です)

ブラウザで `http://localhost:5173` (または表示されるURL) にアクセスしてください。

## 構成ファイル
- `tools/mock_server.py`: バックエンドロジック（テスト機能を削除済み）
- `learning-ui/python_tutee_prompts_improved.py`: CoTプロンプト定義
- `frontend_demo/src/components/ChatTestScreen.jsx`: チャットUI（テスト機能を削除済み）

## ユーザーの追加方法
ユーザーを追加するには、`data/users.json` ファイルを編集してください。

例:
```json
[
  {
    "id": "demouser",
    "name": "Demo User"
  },
  {
    "id": "new_user",
    "name": "New User Name"
  }
]
```
ファイルを保存後、フロントエンドをリロードするとユーザー選択画面に反映されます。

## 履歴の確認
ユーザーごとの会話ログは `data/mock_sessions/sess_{user_id}.json` に保存されます。
（単元ごとではなく、ユーザーごとに1つのファイルに統合されました）
