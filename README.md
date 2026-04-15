# ccs-cli

Claude Code Switcher — 在任意终端里秒切不同的 Claude Code 配置（coding plan）。

## 一句话介绍

**在不同 shell、不同项目、不同场景下，用 `ccs` 一键启动对应配置的 Claude Code。**

无论是官方 API、企业代理、Kimi 中转，还是不同的模型偏好和权限策略，`ccs` 都能帮你隔离管理。

## 核心特性

- **配置隔离**：每个 profile 拥有独立的配置目录、API Token、Base URL、Model
- **环境变量自动注入**：通过 `settings.json` 的 `env` 字段持久化，和手动在 shell 里 `export` 说再见
- **权限提示可选控制**：支持为每个配置独立开启 `--dangerously-skip-permissions`
- **跨终端可用**：安装为 npm 全局命令后，CMD / PowerShell / Git Bash / Terminal 都能用
- **零外部依赖**：纯 Node 内置模块，轻量稳定

## 安装

```bash
cd ~/ccs-cli
npm link
```

安装完成后，任意目录输入 `ccs` 即可使用。

## 快速开始

### 1. 添加一个配置

```bash
ccs add
```

按提示输入：
- 配置名称（如 `work`、`kimi`、`personal`）
- 配置目录（默认 `~/.claude-<name>`）
- API Key / Auth Token
- API Base URL（可选，留空走官方）
- Model 名称（可选）
- 是否 `--dangerously-skip-permissions`（可选）
- 描述（可选）

### 2. 列出所有配置

```bash
ccs list
```

输出示例：
```
• example — 示例配置 (URL=https://api.example.com/v1, Model=claude-sonnet-4-6)
  目录: C:\Users\18600\.claude-example
• kimi (URL=https://api.kimi.com/coding, Model=K2.6-code-preview, skip-permissions)
  目录: C:\Users\18600\.claude-kimi
```

### 3. 启动 Claude Code

```bash
ccs
```

输入数字选择配置，回车即可在当前终端启动对应配置的 Claude Code。

## 命令速查

| 命令 | 说明 |
|------|------|
| `ccs` | 交互式选择配置并启动 |
| `ccs add [名] [目录] [key] [描述]` | 添加或更新配置 |
| `ccs list` | 列出所有配置 |
| `ccs rm [名]` | 删除配置 |
| `ccs edit [名]` | 修改已有配置 |
| `ccs help` | 查看帮助 |

## 配置文件

所有 profile 存储在：

```
~/.ccs/profiles.json
```

单条记录示例：

```json
{
  "name": "kimi",
  "configDir": "C:\\Users\\18600\\.claude-kimi",
  "apiKey": "sk-kimi-xxx",
  "apiUrl": "https://api.kimi.com/coding",
  "modelName": "K2.6-code-preview",
  "desc": "",
  "skipPermissions": true
}
```

## 生效原理

启动前，`ccs` 会做了两件事：

1. **写入目标配置目录的 `settings.json`**
   - `ANTHROPIC_AUTH_TOKEN`
   - `ANTHROPIC_BASE_URL`
   - `ANTHROPIC_MODEL`（及各类 `DEFAULT_*_MODEL`）
   - `skipDangerousModePermissionPrompt`
2. **设置 `CLAUDE_CONFIG_DIR`** 环境变量，并启动 `claude`

这意味着每次切换 profile，Claude Code 都会拿到完全干净且正确的环境配置。

## 卸载

```bash
npm unlink -g ccs-cli
```

然后手动删除 `~/.ccs` 目录即可清理所有配置数据。
