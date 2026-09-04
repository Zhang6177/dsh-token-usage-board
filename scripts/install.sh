#!/usr/bin/env bash
# =============================================================================
# dsh-token-usage-board 一键安装脚本（官方 CLI 方式，macOS / Linux / Windows Git Bash）
#
# 通过 DSH 官方插件命令安装 npm 包并自动挂载：
#   dsh plugin --profile web add dsh-token-usage-board@<version>
#
# 包内声明了 dsh.bundle.patch（cordis.patch.yml）：CLI 的 bundle 协调会把它
# 自动加进 profile 的 dsh.profile.bundles，下次启动即挂载——无需手动写
# cordis.patch.yml 挂载行。符合仓库硬约束：不修改 DSH 源码，插件永远作为
# 独立包被 profile 引用。
#
# 用法：
#   bash scripts/install.sh [版本] [--profile <名>] [--restart] [--dry-run]
#   # 或一行命令：
#   curl -fsSL https://raw.githubusercontent.com/Zhang6177/dsh-token-usage-board/main/scripts/install.sh | bash
#
#   版本        npm 版本号/范围，缺省 latest（自动解析为精确最新版）。
#               示例：0.3.0、^0.3.0、~0.3.0、latest
#   --profile   目标 profile 名（缺省 web）
#   --restart   装完后尝试 `pm2 restart dsh-web`（无 pm2 时仅打印提示）。
#               注意：重启会断开当前 DSH 页面会话，默认不自动重启。
#   --dry-run   只打印将要执行的操作，不写任何文件。
#   -h/--help   打印本帮助。
#
# 环境（均可省略，脚本会自动探测）：
#   DSH_HOME    默认 ~/.dsh（Windows Git Bash 下回退 $USERPROFILE/.dsh）
#   REGISTRY    默认 https://registry.npmjs.org（发布源；装依赖仍走 pnpm 配置）
#   DSH_CMD     默认优先用 PATH 上的 `dsh`，缺省回退 npx -y --package @deepseek-ai/dsh
#
# 说明：
# - 本插件无原生依赖、无构建脚本，不需要 pnpm 构建许可。
# - pnpm 11 的 minimumReleaseAge 会拒绝发布 <24h 的新版本。脚本会预写
#   minimumReleaseAgeExclude（幂等），放行本插件，避免“重跑一次才成功”。
# - 回滚：dsh plugin --profile web remove dsh-token-usage-board
# =============================================================================
set -euo pipefail

PKG="dsh-token-usage-board"

# 帮助请求优先处理
for arg in "$@"; do
  if [ "$arg" = "-h" ] || [ "$arg" = "--help" ]; then
    sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
  fi
done

DSH_HOME="${DSH_HOME:-${HOME:-${USERPROFILE:-}}/.dsh}"
REGISTRY="${REGISTRY:-https://registry.npmjs.org}"
DSH_CMD="${DSH_CMD:-dsh}"

RESTART=false
DRY_RUN=false
VERSION_SPEC=""
PROFILE_NAME="web"
while [ $# -gt 0 ]; do
  case "$1" in
    --restart) RESTART=true ;;
    --dry-run) DRY_RUN=true ;;
    --profile)
      if [ $# -lt 2 ]; then echo "--profile 需要一个 profile 名（如 web）" >&2; exit 2; fi
      PROFILE_NAME="$2"; shift ;;
    -*) echo "未知参数: ${1}（用 -h 查看用法）" >&2; exit 2 ;;
    *) VERSION_SPEC="$1" ;;
  esac
  shift
done

PROFILE_DIR="$DSH_HOME/profiles/$PROFILE_NAME"
WS_YML="$PROFILE_DIR/pnpm-workspace.yaml"

say()  { printf '\033[32m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

# 预写 pnpm-workspace.yaml 的 minimumReleaseAgeExclude（幂等），
# 放行本插件新版本，避免 pnpm 11 冷静期导致“重跑一次才成功”。
ensure_release_age_exclusion() {
  WS_RESULT="$(node -e '
const fs = require("fs");
const p = process.argv[1];
const pkg = process.argv[2];
let t = fs.readFileSync(p, "utf8");
const before = t;
const re = new RegExp("^\\s*-\\s+" + pkg.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") + "\\s*$", "m");
if (!re.test(t)) {
  if (/^\s*minimumReleaseAgeExclude:\s*$/m.test(t)) {
    t = t.replace(/^(\s*minimumReleaseAgeExclude:\s*)$/m, "$1\n  - " + pkg);
  } else {
    t += "\nminimumReleaseAgeExclude:\n  - " + pkg + "\n";
  }
}
if (t !== before) fs.writeFileSync(p, t);
console.log(t === before ? "unchanged" : "updated");
' "$WS_YML" "$PKG")"
  [ "$WS_RESULT" = "updated" ] \
    && say "已确保 ${WS_YML}：minimumReleaseAgeExclude（${PKG}）" \
    || say "workspace 设置已就绪，跳过"
}

# 解析用户给的版本 -> CLI 要用的 npm spec（"x.y.z" / "^x.y.z" / latest）
resolve_spec() {
  local given="${1:-latest}"
  case "$given" in
    latest)
      local v=""
      if command -v npm >/dev/null 2>&1; then
        v="$(npm view "$PKG" version --registry="$REGISTRY" 2>/dev/null)" || v=""
      fi
      if [ -z "$v" ] && command -v pnpm >/dev/null 2>&1; then
        v="$(pnpm view "$PKG" version --registry="$REGISTRY" 2>/dev/null)" || v=""
      fi
      if [ -n "$v" ]; then
        printf '%s' "$v"
      else
        warn "无法联网解析最新版本（npm/pnpm 查询失败），回退为 latest，由 pnpm 直接解析。"
        warn "若已知版本号，可显式传入：bash scripts/install.sh 0.3.0"
        printf 'latest'
      fi
      ;;
    *) printf '%s' "$given" ;;
  esac
}

# 组装 dsh CLI 调用：优先 PATH 上的 dsh，缺省 npx 拉官方包
dsh_cli() {
  if command -v "$DSH_CMD" >/dev/null 2>&1; then
    printf '%s' "$DSH_CMD"
  elif command -v npx >/dev/null 2>&1; then
    printf 'npx -y --package @deepseek-ai/dsh dsh'
  else
    die "未找到 dsh 或 npx。请先安装 DSH（并确保 Node/npm 可用），或用 DSH_CMD 指定 dsh 路径。"
  fi
}

# 前置校验
command -v node >/dev/null 2>&1 || die "未找到 node（DSH 运行需要 Node.js ≥ 22.19 或 24+），请先安装 Node.js 并加入 PATH。"

[ -d "$PROFILE_DIR" ] || die "找不到 profile 目录：${PROFILE_DIR}（请先安装并运行过一次 dsh web）"
[ -f "$WS_YML" ]      || die "找不到 ${WS_YML}（请先初始化 ${PROFILE_NAME} profile）"

SPEC="$(resolve_spec "$VERSION_SPEC")"
CLI="$(dsh_cli)"
say "目标：$CLI plugin --profile $PROFILE_NAME add $PKG@${SPEC}（profile: ${PROFILE_DIR}）"

if [ "$DRY_RUN" = true ]; then
  say "[dry-run] 步骤 1：确保 $WS_YML 含 minimumReleaseAgeExclude（${PKG}）"
  say "[dry-run] 步骤 2：执行 $CLI plugin --profile $PROFILE_NAME add $PKG@$SPEC（安装 + bundle 自动注册）"
  say "[dry-run] 步骤 3：校验 dsh.profile.bundles 含 $PKG"
  if [ "$RESTART" = true ]; then say "[dry-run] 步骤 4：pm2 restart dsh-web"; else say "[dry-run] 步骤 4：提示用户手动重启 DSH"; fi
  exit 0
fi

# 步骤 1：预写 workspace 设置（幂等）
ensure_release_age_exclusion

# 步骤 2：官方 CLI 安装 + bundle 自动注册（含挂载）
say "执行 $CLI plugin --profile $PROFILE_NAME add $PKG@$SPEC ..."
if ! $CLI plugin --profile "$PROFILE_NAME" add "$PKG@$SPEC" 2>&1 | tail -n +1; then
  warn "dsh plugin add 失败。已预写 minimumReleaseAgeExclude，仍失败的可能原因："
  warn "  - 网络/登录问题：npm registry 不可达或需要登录。"
  warn "  - 依赖安装冲突：可手动重试 cd $PROFILE_DIR && pnpm install。"
  exit 1
fi

# 步骤 3：校验 bundle 已注册（挂载生效的判据）
if ! node -e '
  const fs = require("fs");
  const p = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const bundles = p.dsh?.profile?.bundles ?? [];
  process.exit(bundles.includes(process.argv[2]) ? 0 : 1);
' "$PROFILE_DIR/package.json" "$PKG"; then
  warn "${PKG} 未出现在 dsh.profile.bundles 中——挂载未注册，请查看上面的 CLI 输出。"
  exit 1
fi
say "bundle 已注册：dsh.profile.bundles 包含 ${PKG}（下次启动自动挂载）"

say "安装完成：$PKG@$SPEC"

# 步骤 4：重启提示
if [ "$RESTART" = true ]; then
  if command -v pm2 >/dev/null 2>&1; then
    say "重启 dsh-web（pm2）..."
    pm2 restart dsh-web || warn "pm2 restart 失败，请手动重启 DSH"
  else
    warn "未找到 pm2，请手动重启 DSH（如：pm2 restart dsh-web 或 dsh web）"
  fi
else
  say "下一步：重启 DSH 并硬刷新（Cmd/Ctrl+Shift+R）使新副本生效。"
  if command -v pm2 >/dev/null 2>&1; then
    say "本机可用：pm2 restart dsh-web（会短暂断开当前页面会话）"
  fi
fi