#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const readline = require('readline');
const { Writable } = require('stream');

const CCS_DIR = path.join(os.homedir(), '.ccs');
const PROFILES_FILE = path.join(CCS_DIR, 'profiles.json');

function ensureStorage() {
  if (!fs.existsSync(CCS_DIR)) fs.mkdirSync(CCS_DIR, { recursive: true });
  if (!fs.existsSync(PROFILES_FILE)) fs.writeFileSync(PROFILES_FILE, '[]', 'utf-8');
}

function loadProfiles() {
  try {
    return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveProfiles(profiles) {
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
}

function resolveClaude() {
  if (process.platform !== 'win32') return 'claude';
  try {
    const out = require('child_process').execSync('where claude', { encoding: 'utf-8' });
    const lines = out.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const exe = lines.find(l => l.endsWith('.exe'));
    const cmd = lines.find(l => l.endsWith('.cmd'));
    return exe || cmd || 'claude';
  } catch {
    return 'claude';
  }
}

function applyProfileToSettings(configDir, profile) {
  const settingsPath = path.join(configDir, 'settings.json');
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = {};
    }
  }
  if (!settings.env) settings.env = {};

  // 先清理旧的环境变量，避免残留冲突
  const keysToClean = [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'CLAUDE_MODEL',
    'ANTHROPIC_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_REASONING_MODEL'
  ];
  keysToClean.forEach(k => delete settings.env[k]);

  if (profile.apiKey) {
    settings.env.ANTHROPIC_AUTH_TOKEN = profile.apiKey;
  }
  if (profile.apiUrl) {
    settings.env.ANTHROPIC_BASE_URL = profile.apiUrl;
  }
  if (profile.modelName) {
    settings.env.ANTHROPIC_MODEL = profile.modelName;
    settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = profile.modelName;
    settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = profile.modelName;
    settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = profile.modelName;
    settings.env.ANTHROPIC_REASONING_MODEL = profile.modelName;
  }

  if (profile.skipPermissions) {
    settings.skipDangerousModePermissionPrompt = true;
  } else if ('skipDangerousModePermissionPrompt' in settings) {
    delete settings.skipDangerousModePermissionPrompt;
  }

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    if (hidden) process.stdout.write(question);
    const output = hidden
      ? new Writable({ write(chunk, encoding, callback) { callback(); } })
      : process.stdout;
    const rl = readline.createInterface({ input: process.stdin, output });
    rl.question(hidden ? '' : question, (answer) => {
      rl.close();
      if (hidden) console.log();
      resolve(answer.trim());
    });
  });
}

async function selectProfile() {
  const profiles = loadProfiles();
  if (profiles.length === 0) {
    console.log('还没有任何配置，先添加一个吧。');
    console.log('用法: ccs add <名称> [配置目录] [API_KEY] [描述]');
    process.exit(1);
  }

  console.log('================================');
  console.log('  Claude Code 配置选择器');
  console.log('================================');
  profiles.forEach((p, i) => {
    const desc = p.desc ? ` [${p.desc}]` : '';
    console.log(`  ${i + 1}) ${p.name.padEnd(20)}${desc}`);
  });
  console.log('  0) 取消');
  console.log('================================');

  const choice = await ask('选择要启动的配置 [0-' + profiles.length + ']: ');
  const idx = parseInt(choice, 10);
  if (choice === '0' || isNaN(idx) || idx < 1 || idx > profiles.length) {
    console.log('已取消');
    process.exit(0);
  }

  const selected = profiles[idx - 1];
  console.log(`→ 启动配置: ${selected.name}`);

  if (!selected.apiKey) {
    console.log('⚠ 当前配置未设置 API Key，Claude Code 将尝试使用系统环境变量中的 ANTHROPIC_AUTH_TOKEN。');
  }

  applyProfileToSettings(selected.configDir, selected);

  const env = { ...process.env, CLAUDE_CONFIG_DIR: selected.configDir };
  const claudePath = resolveClaude();
  const claudeArgs = selected.skipPermissions ? ['--dangerously-skip-permissions'] : [];
  spawnSync(claudePath, claudeArgs, { stdio: 'inherit', env });
}

async function cmdAdd(args) {
  let name = args[0];
  let configDir = args[1];
  let apiKey = args[2];
  let desc = args[3];

  if (name === undefined) name = await ask('配置名称 (如 work/personal): ');
  if (!name) { console.log('名称不能为空'); process.exit(1); }

  if (configDir === undefined) {
    const defaultDir = path.join(os.homedir(), `.claude-${name}`);
    configDir = await ask(`配置目录 [默认: ${defaultDir}]: `);
    configDir = configDir || defaultDir;
  }
  configDir = path.resolve(configDir.replace(/^~/, os.homedir()));

  if (apiKey === undefined) {
    apiKey = await ask('API Key / Auth Token (留空则继承当前环境): ', true);
    if (!apiKey) {
      console.log('ℹ 未设置 API Key，将继承当前环境变量 ANTHROPIC_AUTH_TOKEN。');
    }
  }

  let apiUrl, modelName;
  if (args.length <= 4) {
    apiUrl = await ask('API Base URL (留空使用官方默认): ');
    modelName = await ask('Model 名称 (留空使用默认): ');
  }

  let skipPermissions = false;
  if (args.length <= 4) {
    const skip = await ask('跳过权限提示 --dangerously-skip-permissions (y/N): ');
    skipPermissions = skip.toLowerCase() === 'y' || skip.toLowerCase() === 'yes';
  }

  if (desc === undefined) desc = await ask('描述 (可选): ');

  const profiles = loadProfiles();
  const idx = profiles.findIndex(p => p.name === name);
  const profile = { name, configDir, apiKey, apiUrl, modelName, skipPermissions, desc };
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  saveProfiles(profiles);

  // 创建配置目录并写入初始 settings.json
  applyProfileToSettings(configDir, profile);

  console.log(`✓ 已保存配置: ${name}`);
}

function cmdList() {
  const profiles = loadProfiles();
  if (profiles.length === 0) {
    console.log('暂无配置');
    return;
  }
  profiles.forEach(p => {
    const extras = [];
    if (p.apiUrl) extras.push(`URL=${p.apiUrl}`);
    if (p.modelName) extras.push(`Model=${p.modelName}`);
    if (p.skipPermissions) extras.push('skip-permissions');
    const extraStr = extras.length ? ` (${extras.join(', ')})` : '';
    console.log(`• ${p.name}${p.desc ? ` — ${p.desc}` : ''}${extraStr}`);
    console.log(`  目录: ${p.configDir}`);
  });
}

async function cmdRm(args) {
  let [name] = args;
  if (!name) {
    cmdList();
    console.log();
    name = await ask('要删除的配置名称: ');
  }
  let profiles = loadProfiles();
  const before = profiles.length;
  profiles = profiles.filter(p => p.name !== name);
  if (profiles.length === before) {
    console.log(`✗ 未找到配置: ${name}`);
    process.exit(1);
  }
  saveProfiles(profiles);
  console.log(`✓ 已删除配置: ${name}`);
}

async function cmdEdit(args) {
  let [oldName] = args;
  if (!oldName) {
    cmdList();
    console.log();
    oldName = await ask('要修改的配置名称: ');
  }
  const profiles = loadProfiles();
  const p = profiles.find(x => x.name === oldName);
  if (!p) {
    console.log(`✗ 未找到配置: ${oldName}`);
    process.exit(1);
  }

  const name = (await ask(`新名称 [${p.name}]: `)) || p.name;
  const configDir = path.resolve(
    ((await ask(`配置目录 [${p.configDir}]: `)) || p.configDir).replace(/^~/, os.homedir())
  );
  const apiKeyInput = await ask('API Key / Auth Token [保留原值请直接回车]: ', true);
  const apiKey = apiKeyInput || p.apiKey;
  const apiUrl = (await ask(`API Base URL [${p.apiUrl || ''}]: `)) || p.apiUrl || '';
  const modelName = (await ask(`Model 名称 [${p.modelName || ''}]: `)) || p.modelName || '';
  const skipInput = await ask(`跳过权限提示 --dangerously-skip-permissions [${p.skipPermissions ? 'Y' : 'N'}] (y/N): `);
  const skipPermissions = skipInput ? (skipInput.toLowerCase() === 'y' || skipInput.toLowerCase() === 'yes') : !!p.skipPermissions;
  const desc = (await ask(`描述 [${p.desc || ''}]: `)) || p.desc;

  p.name = name;
  p.configDir = configDir;
  p.apiKey = apiKey;
  p.apiUrl = apiUrl;
  p.modelName = modelName;
  p.skipPermissions = skipPermissions;
  p.desc = desc;
  saveProfiles(profiles);

  applyProfileToSettings(configDir, p);
  if (!p.apiKey) {
    console.log('ℹ 当前配置未设置 API Key，将继承当前环境变量 ANTHROPIC_AUTH_TOKEN。');
  }
  console.log('✓ 已更新配置');
}

function cmdHelp() {
  console.log(`
Usage: ccs [command] [args...]

Commands:
  (none)           交互式选择配置并启动 claude
  add [名] [目录] [key] [描述]   添加/更新配置
  list             列出所有配置
  rm [名]          删除配置
  edit [名]        修改配置
  help             显示帮助

支持覆盖:
  • CLAUDE_CONFIG_DIR  → 配置目录
  • settings.json env  → ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL / ANTHROPIC_MODEL 等

Examples:
  ccs add work ~/.claude-work sk-xxx "工作账号"
  ccs add personal ~/.claude-personal "" "个人账号"
`);
}

async function main() {
  ensureStorage();
  const cmd = process.argv[2];
  const args = process.argv.slice(3);

  switch (cmd) {
    case 'add': await cmdAdd(args); break;
    case 'list':
    case 'ls': cmdList(); break;
    case 'rm':
    case 'del':
    case 'remove': await cmdRm(args); break;
    case 'edit': await cmdEdit(args); break;
    case 'help':
    case '-h':
    case '--help': cmdHelp(); break;
    case undefined: await selectProfile(); break;
    default:
      console.log(`未知命令: ${cmd}`);
      cmdHelp();
      process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
