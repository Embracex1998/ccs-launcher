# npm publish 检查清单

## 1. 发布前检查

```bash
# 登录 npm（确保账号已注册并开启 2FA）
npm login

# 检查包名是否已被占用
npm view ccs-cli
# 若返回 404，说明名称可用；若已有包，需修改 package.json 里的 name

# 干跑测试（模拟发布，不实际上传）
npm pack
# 检查生成的 tgz 内容是否包含 bin/ccs.js、README.md、package.json
```

## 2. 更新元数据（如需发布）

在 `package.json` 中补充以下字段：

```json
{
  "name": "ccs-cli",
  "version": "1.0.0",
  "description": "Claude Code 配置切换启动器",
  "bin": {
    "ccs": "bin/ccs.js"
  },
  "keywords": ["claude", "claude-code", "launcher", "profile", "cli"],
  "author": "你的名字 <邮箱>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/你的用户名/ccs-cli.git"
  },
  "bugs": {
    "url": "https://github.com/你的用户名/ccs-cli/issues"
  },
  "homepage": "https://github.com/你的用户名/ccs-cli#readme",
  "engines": {
    "node": ">=18"
  }
}
```

## 3. 正式发布

```bash
# 自动升级 patch 版本号（1.0.0 -> 1.0.1）
npm version patch

# 或者手动改 package.json 后执行
npm publish --access public
```

## 4. 发布后验证

```bash
# 全局安装验证
npm install -g ccs-cli

# 检查命令是否可用
ccs help

# 检查版本
npm list -g ccs-cli
```

## 5. 后续更新流程

1. 修改代码 / 文档
2. `npm version patch|minor|major`
3. `npm publish`
4. `npm install -g ccs-cli@latest`
