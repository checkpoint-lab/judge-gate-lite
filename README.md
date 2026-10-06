# judge-gate-lite

Claude Code用の非公式の無料キットです。Anthropic社とは関係がありません。

作る役と検査する役を分け、検査する役（Judge）が合格を出すまで、公開系のコマンドが通らないようにします。

## これは何か

次の2つだけを切り出したものです。

- **Judge**：成果物を検査するエージェント。読む・検索するツールだけを渡してあり、編集とコマンドの実行はできません
- **Hook**：`judge_records/current_gate.json` が `PASS` でない間、`--publish` や `git push origin main` を止めます

作る役（Builder）、依頼を構造化する `/goal`、Hookの自己テスト、判定基準の雛形は、フル版（有料）に入っています。フル版はGumroadで販売しています。

https://checkpointlab.gumroad.com/l/judge-gate-kit

## 入っているもの

| ファイル | 内容 |
|---|---|
| `agents/judge.md` | Judge。Read、Grep、Glob、WebSearch、WebFetchのみで、編集とコマンド実行ができない |
| `hooks/check-judge-gate.cjs` | 公開系コマンドを、Judgeが合格を出すまで止めるHook |
| `hooks/settings.snippet.json` | `settings.json` に足す設定の雛形 |
| `LICENSE` | MIT License |

## 前提

- Claude Code
- Node.js（Hookの実行に使います。確認したバージョンはv24.16.0だけで、最低バージョンは未確認です）
- `settings.json` を自分で編集できること

## 使い方（手動運用）

1. `agents/judge.md` を `~/.claude/agents/` にコピーします。
2. `hooks/` を移動しない場所に置きます。`settings.snippet.json` の内容を `settings.json` にマージし、`<ここをhooksフォルダの絶対パスに置換>` を実際のパスに変えます。Windowsでも `C:/Users/名前/...` のように、スラッシュで書きます。
3. 成果物ができたら、Claude Codeに「judgeエージェントでこの成果物を検査して」と頼みます。
4. Judgeが `verdict: PASS` を返したら、プロジェクトの `judge_records/current_gate.json` に、次の内容を自分で保存します。

```json
{"task_id": "任意の名前", "round": 1, "verdict": "PASS", "checked_at": "2026-10-06T13:00:00+09:00"}
```

5. この保存があるまで、公開系コマンドはHookに止められます。
6. 設定が反映されないときは、Claude Codeを再起動してください。

## Goal Specの最小例

Judgeは、`goals/<task_id>.md`（Goal Spec）を読んで、そこに書かれた完了条件で検査します。Lite版には、これを作る `/goal` コマンドが入っていないので、自分で書きます。最小の例です。

```md
---
task_id: sample
type: article
---

# 完了条件
- [ ] 見出しが、すべて名詞句になっている
- [ ] 数値の記述に、出典が書かれている
```

「judgeエージェントで、`goals/sample.md` の完了条件に照らして、この成果物を検査して」と頼みます。完了条件は、Yes/Noで答えられる文で書いてください。

## 検証状況

- Windows 11とClaude Codeで使っています。macOS・Linuxでは動かしていません
- 公開のブロックは、Bashコマンドの文字列照合です。MCPツールやGUI経由の公開は止められません
- `echo "--publish"` のように、公開の意図がなくても、文字列が一致すると止まります
- 使っているデプロイコマンドが標準パターンに無い場合は、プロジェクトに `.claude/judge-gate-patterns.json` を置くと、標準パターンの代わりに使われます

## ライセンス

MIT License です。`LICENSE` を参照してください。保証はありません。
