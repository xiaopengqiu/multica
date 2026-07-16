# Daemon 启动与 Agent 注册

## 问题现象

- Daemon 启动后页面显示 agent 运行时为 **offline**
- Daemon 日志报 `invalid token`（401）或 `connection refused`
- Runtime 注册后 visibility 为 `private`，workspace 其他成员无法在该 runtime 上创建或迁移 Agent
- cfuse `--version` 触发交互式引擎升级提示，导致 daemon 注册流程卡死

## 背景

Daemon 是本地 agent 运行时的守护进程，负责向远端服务器注册本地的 claude/codex/openclaw/cfuse 等运行时，并通过 heartbeat 保持在线状态。Runtime 注册时默认 visibility 为 `private`：只有 runtime owner 或 workspace owner/admin 能在其上创建或迁移 Agent。Runtime owner 创建 `workspace` Agent 后，同一 workspace 的所有成员都可以使用该 Agent，无需把 runtime 改为 `public`。

## 根因

1. **Token 过期** — 本地 profile 中保存的 token 失效，导致 API 请求 401
2. **server_url 指向 localhost** — profile 配置中 `server_url` 为 `localhost:8080`，而非远端服务器地址
3. **cfuse 引擎版本检测阻塞** — cfuse `--version` 命令会先弹出交互式升级提示，daemon 调用时无 TTY 导致卡死
4. **Runtime 默认 visibility=private** — 注册时未传递 visibility 参数，数据库默认 `private`；这只限制创建/迁移 Agent，不限制使用已有的 `workspace` Agent

## 涉及代码

- `server/internal/handler/runtime.go:35` — visibility 字段定义，默认 private
- `server/internal/handler/runtime.go:461-465` — PATCH visibility 接口
- `server/pkg/agent/agent.go:147` — DetectVersion 函数，调用 `agent --version` 检测版本
- `server/internal/daemon/config.go` — daemon 配置加载，读取 profile config.json

## 操作步骤

### 1. 配置远端服务器地址

编辑 `~/.multica/profiles/<profile>/config.json`，将 `server_url` 指向远端：

```json
{
  "server_url": "http://<remote-host>:8080",
  "app_url": "http://<remote-host>:3000",
  "workspace_id": "<workspace-uuid>",
  "token": "mul_..."
}
```

### 2. 获取有效 Token

**方式一：通过 Web UI**
1. 浏览器打开 `http://<remote-host>:3000`
2. Settings → API Tokens → Generate New Token
3. 复制 `mul_...` 格式的 token

**方式二：通过 CLI 交互式登录**
```bash
cd server && go run ./cmd/multica login --server-url http://<remote-host>:8080
```

**方式三：复用已有 token**
- 全局配置 `~/.multica/config.json` 可能存有有效 token
- 用 curl 验证：`curl -s -H "Authorization: Bearer mul_..." http://<remote-host>:8080/api/me`，返回 200 即有效

### 3. 处理 cfuse 引擎版本提示

cfuse `--version` 会弹出版本升级交互提示，阻塞 daemon 注册。需先手动执行一次跳过：

```bash
echo "3" | cfuse --version
# 选项 3：标记当前版本不再提示
```

验证修复：
```bash
cfuse --version  # 应直接输出版本号，如 "2.1.91 (Claude Code)"
```

### 4. 启动 Daemon

```bash
cd server && go run ./cmd/multica daemon start --profile <profile>
```

确认注册成功：
```bash
tail -20 ~/.multica/profiles/<profile>/daemon.log
# 应看到 "registered runtime ... provider=cfuse" 和 "heartbeat" 日志
```

### 5. 可选：将 Runtime 改为 Public

如果希望普通 workspace member 也能在这个 runtime 上创建或迁移 Agent，可调用 PATCH 接口把 runtime 改为 `public`。如果只需要队友使用 runtime owner 已创建的 `workspace` Agent，无需执行此步骤。

```bash
# 查看当前 runtime 列表
curl -s -H "Authorization: Bearer <token>" \
  -H "X-Workspace-ID: <workspace-id>" \
  http://<remote-host>:8080/api/runtimes/ | python3 -c "
import json,sys
for r in json.loads(sys.stdin.read().replace('\n',' ')):
    print(f\"{r['id']} | {r['provider']} | {r['visibility']}\")
"

# 逐个改为 public
for id in <runtime-id-1> <runtime-id-2> ...; do
  curl -s -X PATCH \
    -H "Authorization: Bearer <token>" \
    -H "X-Workspace-ID: <workspace-id>" \
    -H "Content-Type: application/json" \
    -d '{"visibility":"public"}' \
    "http://<remote-host>:8080/api/runtimes/$id"
done
```

或通过 CLI：
```bash
cd server && go run ./cmd/multica runtime update <runtime-id> --visibility public
```

### 6. 快速一键脚本

将以上步骤合并（假设 profile=local，remote=47.102.103.66）：

```bash
#!/bin/bash
set -e
REMOTE="47.102.103.66"
PROFILE="local"
TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.multica/profiles/$PROFILE/config.json'))['token'])")
WS_ID=$(python3 -c "import json; print(json.load(open('$HOME/.multica/profiles/$PROFILE/config.json'))['workspace_id'])")

# 确保 cfuse 不弹交互提示
echo "3" | cfuse --version 2>/dev/null || true

# 停旧 daemon
cd server && go run ./cmd/multica daemon stop --profile $PROFILE 2>/dev/null || true

# 启新 daemon
go run ./cmd/multica daemon start --profile $PROFILE

# 等 daemon 注册完
sleep 8

# 改 visibility 为 public
RUNTIMES=$(curl -s -H "Authorization: Bearer $TOKEN" -H "X-Workspace-ID: $WS_ID" http://$REMOTE:8080/api/runtimes/)
for id in $(echo "$RUNTIMES" | python3 -c "import json,sys; [print(r['id']) for r in json.loads(sys.stdin.read().replace('\n',' ')) if r['visibility']=='private']"); do
  curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "X-Workspace-ID: $WS_ID" -H "Content-Type: application/json" -d '{"visibility":"public"}' "http://$REMOTE:8080/api/runtimes/$id" > /dev/null
  echo "Set $id -> public"
done

echo "Done. All runtimes are public for agent creation and migration."
```

## ⚠️ 注意事项

- **cfuse 版本提示是阻塞的** — 每次升级 cfuse 后可能再次出现引擎版本提示，导致 daemon 注册卡死。daemon 没有超时优雅降级逻辑，cfuse 卡死会阻塞整个注册流程
- **Token 隔离** — 全局 `~/.multica/config.json` 和 profile `~/.multica/profiles/<name>/config.json` 中的 token 是独立的，更新时别改错文件
- **Runtime 默认 private** — 当前 daemon 注册不传 visibility。只有在需要其他成员创建/迁移 Agent 时才需要改为 public；已有 `workspace` Agent 的分配、聊天、提及和委派不受 runtime visibility 限制
- **daemon restart vs start** — `daemon restart` 会先 stop 再 start，但如果旧进程端口未释放（health port 20038），会报 `bind: address already in use`，需先 `kill` 旧进程
- **workspace_id 配置** — profile config.json 中的 `workspace_id` 必须在远端服务器上存在，否则 daemon 无法注册 runtime
