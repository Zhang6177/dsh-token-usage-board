## =============================================================================
# dsh-activity-dashboard 一键安装脚本（官方 CLI 方式，Windows PowerShell 5.1+ / pwsh）
#
# 通过 DSH 官方插件命令安装 npm 包并自动挂载：
#   dsh plugin --profile web add dsh-activity-dashboard@<version>
#
# 包内声明了 dsh.bundle.patch（cordis.patch.yml）：CLI 的 bundle 协调会把它
# 自动加进 profile 的 dsh.profile.bundles，下次启动即挂载——无需手动写
# cordis.patch.yml 挂载行。符合仓库硬约束：不修改 DSH 源码，插件永远作为
# 独立包被 profile 引用。
#
# 用法（任选其一）：
#   # 默认最新版
#   $script = (irm 'https://raw.githubusercontent.com/Zhang6177/dsh-activity-dashboard/main/scripts/install.ps1').TrimStart([char]0xFEFF)
#   & ([scriptblock]::Create($script))
#   # 指定版本 / 装完重启
#   $script = (irm 'https://raw.githubusercontent.com/Zhang6177/dsh-activity-dashboard/main/scripts/install.ps1').TrimStart([char]0xFEFF)
#   & ([scriptblock]::Create($script)) -Version 0.3.0 -Restart
#   # 本地保存后运行
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Version 0.3.0 -DryRun
#
# 参数：
#   -Version    npm 版本号/范围，缺省 latest（自动解析为精确最新版）。
#   -Profile    目标 profile 名（缺省 web）。
#   -Restart    装完后尝试 `pm2 restart dsh-web`（无 pm2 时仅提示）。会断开当前页面会话。
#   -DryRun     只打印将要执行的操作，不写任何文件。
#
# 环境变量（均可省略）：
#   DSH_HOME    默认 %USERPROFILE%\.dsh
#   REGISTRY    默认 https://registry.npmjs.org
#   DSH_CMD     默认优先 PATH 上的 dsh，缺省回退 npx -y --package @deepseek-ai/dsh
#
# 说明：
# - 本插件无原生依赖、无构建脚本，不需要 pnpm 构建许可。
# - pnpm 11 的 minimumReleaseAge 会拒绝发布 <24h 的新版本。脚本会预写
#   minimumReleaseAgeExclude（幂等），放行本插件，避免“重跑一次才成功”。
# - 回滚：dsh plugin --profile web remove dsh-activity-dashboard
# =============================================================================
param(
  [string]$Version = '',
  [switch]$Restart,
  [switch]$DryRun,
  [string]$Profile = 'web'
)

$ErrorActionPreference = 'Stop'
$PKG = 'dsh-activity-dashboard'
$REGISTRY = if ($env:REGISTRY) { $env:REGISTRY } else { 'https://registry.npmjs.org' }

# DSH_HOME：DSH_HOME 环境变量 > %USERPROFILE% > $HOME
if ($env:DSH_HOME) {
  $DSH_HOME = $env:DSH_HOME
} elseif ($env:USERPROFILE) {
  $DSH_HOME = Join-Path $env:USERPROFILE '.dsh'
} else {
  $DSH_HOME = Join-Path $HOME '.dsh'
}
$PROFILE_DIR = Join-Path $DSH_HOME "profiles\$Profile"
$WS_YML = Join-Path $PROFILE_DIR 'pnpm-workspace.yaml'

function Say([string]$m)  { Write-Host "[install] $m" -ForegroundColor Green }
function Warn([string]$m) { Write-Host "[warn] $m" -ForegroundColor Yellow }
function Die([string]$m)  { Write-Host "[error] $m" -ForegroundColor Red; exit 1 }

# 解析版本 -> npm spec（"x.y.z" / "^x.y.z" / latest）
function Resolve-Spec {
  param([string]$Given)
  if ([string]::IsNullOrWhiteSpace($Given) -or $Given -eq 'latest') {
    $v = $null
    foreach ($tool in @('npm', 'pnpm')) {
      if (Get-Command $tool -ErrorAction SilentlyContinue) {
        $v = (& $tool view $PKG version "--registry=$REGISTRY" 2>$null | Select-Object -Last 1)
        if ($v) { break }
      }
    }
    if ($v) { return ([string]$v).Trim() }
    Warn '无法联网解析最新版本（npm/pnpm 查询失败），回退为 latest，由 pnpm 直接解析。'
    Warn '若已知版本号，可显式传入：-Version 0.3.0'
    return 'latest'
  }
  return $Given
}

# 组装 dsh CLI：优先 PATH 上的 dsh，缺省 npx 拉官方包
function Get-DshCli {
  if ($env:DSH_CMD) { return $env:DSH_CMD }
  if (Get-Command dsh -ErrorAction SilentlyContinue) { return 'dsh' }
  if (Get-Command npx -ErrorAction SilentlyContinue) { return 'npx' }
  return $null
}

# 预写 pnpm-workspace.yaml 的 minimumReleaseAgeExclude（幂等），
# 放行本插件新版本，避免 pnpm 11 冷静期导致“重跑一次才成功”。
function Ensure-ReleaseAgeExclusion {
  $wsScript = @'
const fs = require("fs");
const p = process.argv[1];
const pkg = process.argv[2];
let t = fs.readFileSync(p, "utf8");
const before = t;
const re = new RegExp("^\\s*-\\s+" + pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\\\$&") + "\\s*$", "m");
if (!re.test(t)) {
  if (/^\s*minimumReleaseAgeExclude:\s*$/m.test(t)) {
    t = t.replace(/^(\s*minimumReleaseAgeExclude:\s*)$/m, "$1\n  - " + pkg);
  } else {
    t += "\nminimumReleaseAgeExclude:\n  - " + pkg + "\n";
  }
}
if (t !== before) fs.writeFileSync(p, t);
console.log(t === before ? "unchanged" : "updated");
'@
  # PowerShell 5.1 把含内嵌双引号的多行 JS 作为参数传给 `node -e` 时，引号会被
  # Windows 命令行解析吞掉，导致 JS 语法错误。改用临时文件方式，兼容 PS 5.1 与 pwsh 7。
  $wsJs = Join-Path $env:TEMP ("dshus-ws-" + [guid]::NewGuid().ToString("N") + ".js")
  Set-Content -LiteralPath $wsJs -Value $wsScript -Encoding UTF8
  $wsOut = node $wsJs "$WS_YML" "$PKG" 2>&1
  $wsCode = $LASTEXITCODE
  Remove-Item -LiteralPath $wsJs -Force -ErrorAction SilentlyContinue
  $wsResult = (($wsOut | Out-String)).Trim()
  if ($wsCode -ne 0) { Die "处理 $WS_YML 失败（node 退出码 $wsCode）：$wsResult" }
  if ($wsResult -eq 'updated') {
    Say "已确保 $WS_YML：minimumReleaseAgeExclude（$PKG）"
  } else {
    Say 'workspace 设置已就绪，跳过'
  }
}

# 前置校验
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Die '未找到 node（DSH 运行需要 Node.js >= 22.19 或 24+），请先安装 Node.js 并加入 PATH。'
}
if (-not (Test-Path $PROFILE_DIR)) {
  Die "找不到 profile 目录：$PROFILE_DIR（请先安装并运行过一次 dsh web）"
}
if (-not (Test-Path $WS_YML)) {
  Die "找不到 $WS_YML（请先初始化 $Profile profile）"
}

$SPEC = Resolve-Spec $Version
$CLI = Get-DshCli
if (-not $CLI) {
  Die '未找到 dsh 或 npx。请先安装 DSH（并确保 Node/npm 可用），或用 DSH_CMD 指定。'
}
$SPEC = if ($SPEC -eq 'latest') { 'latest' } else { $SPEC }

Say "目标：$CLI plugin --profile $Profile add $PKG@$SPEC（profile: $PROFILE_DIR）"

if ($DryRun) {
  Say "[dry-run] 步骤 1：确保 $WS_YML 含 minimumReleaseAgeExclude（$PKG）"
  Say "[dry-run] 步骤 2：执行 $CLI plugin --profile $Profile add $PKG@$SPEC（安装 + bundle 自动注册）"
  Say "[dry-run] 步骤 3：校验 dsh.profile.bundles 含 $PKG"
  if ($Restart) { Say '[dry-run] 步骤 4：pm2 restart dsh-web' } else { Say '[dry-run] 步骤 4：提示用户手动重启 DSH' }
  exit 0
}

# 步骤 1：预写 workspace 设置（幂等）
Ensure-ReleaseAgeExclusion

# 步骤 2：官方 CLI 安装 + bundle 自动注册（含挂载）
Say "执行 $CLI plugin --profile $Profile add $PKG@$SPEC ..."
$cliArgs = @('plugin', '--profile', $Profile, 'add', "$PKG@$SPEC")
if ($CLI -eq 'npx') { $cliArgs = @('-y', '--package', '@deepseek-ai/dsh', 'dsh') + $cliArgs }
& $CLI @cliArgs 2>&1 | ForEach-Object { Write-Host $_ }
if ($LASTEXITCODE -ne 0) {
  Warn 'dsh plugin add 失败。已预写 minimumReleaseAgeExclude，仍失败的可能原因：'
  Warn '  - 网络/登录问题：npm registry 不可达或需要登录。'
  Warn "  - 依赖安装冲突：可手动重试 cd $PROFILE_DIR; pnpm install。"
  exit 1
}

# 步骤 3：校验 bundle 已注册（挂载生效的判据）
if (-not (node -e '
  const fs = require("fs");
  const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const bundles = p.dsh?.profile?.bundles ?? [];
  process.exit(bundles.includes(process.argv[2]) ? 0 : 1);
' (Join-Path $PROFILE_DIR 'package.json') $PKG)) {
  Warn "$PKG 未出现在 dsh.profile.bundles 中——挂载未注册，请查看上面的 CLI 输出。"
  exit 1
}
Say "bundle 已注册：dsh.profile.bundles 包含 $PKG（下次启动自动挂载）"

Say "安装完成：$PKG@$SPEC"

# 步骤 4：重启提示
if ($Restart) {
  if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    Say '重启 dsh-web（pm2）...'
    pm2 restart dsh-web
    if ($LASTEXITCODE -ne 0) { Warn 'pm2 restart 失败，请手动重启 DSH' }
  } else {
    Warn '未找到 pm2，请手动重启 DSH（如：pm2 restart dsh-web 或 dsh web）'
  }
} else {
  Say '下一步：重启 DSH 并硬刷新（Cmd/Ctrl+Shift+R）使新副本生效。'
  if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    Say '本机可用：pm2 restart dsh-web（会短暂断开当前页面会话）'
  }
}