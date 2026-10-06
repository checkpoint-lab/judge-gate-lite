#!/usr/bin/env node
// PreToolUse hook（プロジェクト共通・汎用）
// Bashコマンドが「公開」系操作にマッチする場合、judge_records/current_gate.json が
// PASSでない限りブロックする。Manager/Builder/Judgeワークフロー用の技術ゲート。
//
// デフォルトの「公開」判定パターンは --publish フラグ / git push ... main|master。
// プロジェクトごとに異なる公開コマンドを使う場合は、プロジェクトルートに
// .claude/judge-gate-patterns.json を置くと、それがデフォルトを上書きする。
// 例: ["--deploy\\b", "npm run deploy", "vercel .*--prod"]

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PUBLISH_PATTERNS = [
  "--publish\\b",
  "git\\s+push\\b.*\\b(main|master)\\b",
];

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    // 入力が読めない場合はブロックしない（フックの不具合で全操作が止まる事故を避ける）
    process.exit(0);
  }

  const toolName = payload.tool_name || "";
  const toolInput = payload.tool_input || {};
  const command = toolInput.command || "";

  if (toolName !== "Bash" || !command) {
    process.exit(0);
  }

  // このHookプロセス自身のprocess.cwd()は、コマンド文字列内の`cd <dir> && ...`が
  // 実行される「前」の時点のものなので、実際の作業先とズレることがある。
  // まずコマンド文字列先頭の `cd <path> &&` / `cd <path>;` を解析し、
  // 見つかればそちらを優先する（見つからなければprocess.cwd()にフォールバック）。
  function resolveWorkingDir(cmd, fallback) {
    const m = cmd.match(/^\s*cd\s+(?:"([^"]+)"|'([^']+)'|(\S+))\s*(?:&&|;)/);
    if (!m) return fallback;
    let dir = m[1] || m[2] || m[3];
    // Git Bash(MSYS)形式のパス（例: /c/Users/...）をWindowsパスに変換
    const msys = dir.match(/^\/([a-zA-Z])\/(.*)$/);
    if (msys) dir = `${msys[1]}:/${msys[2]}`;
    return path.isAbsolute(dir) ? dir : path.resolve(fallback, dir);
  }

  const cwd = resolveWorkingDir(command, process.cwd());

  // プロジェクト固有の公開パターン設定があれば読み込む（なければデフォルト）
  let patternStrings = DEFAULT_PUBLISH_PATTERNS;
  const overridePath = path.join(cwd, ".claude", "judge-gate-patterns.json");
  if (fs.existsSync(overridePath)) {
    try {
      const custom = JSON.parse(fs.readFileSync(overridePath, "utf8"));
      if (Array.isArray(custom) && custom.length > 0) {
        patternStrings = custom;
      }
    } catch {
      // 設定ファイルが壊れている場合はデフォルトのまま続行
    }
  }

  const publishPatterns = patternStrings.map((s) => new RegExp(s));
  const isPublishAction = publishPatterns.some((re) => re.test(command));
  if (!isPublishAction) {
    process.exit(0);
  }

  const gatePath = path.join(cwd, "judge_records", "current_gate.json");

  if (!fs.existsSync(gatePath)) {
    console.error(
      "[Judge Gate] judge_records/current_gate.json が存在しません。Judgeの検査を経ずに公開操作はできません。"
    );
    process.exit(2); // 非ゼロ終了でツール呼び出しをブロック
  }

  let gate;
  try {
    gate = JSON.parse(fs.readFileSync(gatePath, "utf8"));
  } catch {
    console.error("[Judge Gate] current_gate.json の読み込みに失敗しました。内容を確認してください。");
    process.exit(2);
  }

  if (gate.verdict !== "PASS") {
    console.error(
      `[Judge Gate] 最新のJudge判定は "${gate.verdict}" です。PASSでない限り公開操作はブロックされます。（task_id: ${gate.task_id}, round: ${gate.round}）`
    );
    process.exit(2);
  }

  console.error(
    `[Judge Gate] PASS確認済み（task_id: ${gate.task_id}, round: ${gate.round}）。公開操作を許可します。`
  );
  process.exit(0);
});
