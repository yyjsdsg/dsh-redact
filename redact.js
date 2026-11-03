// dsh-redact / 脱敏规则引擎
//
// 纯函数，无依赖。Host 和测试都直接调用它。
// 设计目标：宁可漏一点，也不要误伤普通文本——误伤会让人不敢用。

/** 每条规则：命中什么、换成什么、为什么 */
export const RULES = [
  {
    id: 'api-key',
    label: 'API 密钥',
    hint: 'sk- 开头的密钥',
    pattern: /\bsk-[A-Za-z0-9_-]{16,}/g,
    replace: () => 'sk-***',
  },
  {
    id: 'github-token',
    label: 'GitHub 令牌',
    hint: 'ghp_ / gho_ / ghu_ 等',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
    replace: () => '<github-token>',
  },
  {
    id: 'aws-key',
    label: 'AWS 密钥',
    hint: 'AKIA 开头',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    replace: () => 'AKIA***',
  },
  {
    id: 'bearer',
    label: 'Bearer 令牌',
    hint: 'Authorization 头里的长串',
    pattern: /\b(Bearer\s+)[A-Za-z0-9._~+/-]{16,}=*/gi,
    replace: (_m, head) => head + '<token>',
  },
  {
    id: 'secret-assignment',
    label: '疑似密码',
    hint: 'password= / api_key: 这类赋值',
    // 只吃 ASCII 的密钥字符，避免把后面的中文一起当密码吃掉
    pattern:
      /\b((?:api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key)\s*[:=]\s*)(["']?)([A-Za-z0-9._~+/=-]{8,})\2/gi,
    replace: (_m, head, quote) => head + quote + '***' + quote,
  },
  {
    id: 'win-user-path',
    label: '本机路径',
    hint: 'C:\\Users\\<名字>',
    pattern: /\b([A-Za-z]):\\Users\\[^\\\s"'<>|]+/g,
    replace: (_m, drive) => `${drive}:\\Users\\<user>`,
  },
  {
    id: 'unix-home',
    label: '本机路径',
    hint: '/home/<名字>',
    pattern: /\/home\/[^/\s"'<>|]+/g,
    replace: () => '/home/<user>',
  },
  {
    id: 'private-ip',
    label: '内网 IP',
    hint: '10.x / 192.168.x / 172.16-31.x',
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g,
    replace: () => '<内网IP>',
  },
  {
    id: 'email',
    label: '邮箱',
    hint: 'xxx@yyy',
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    replace: () => '<邮箱>',
  },
  {
    id: 'phone-cn',
    label: '手机号',
    hint: '11 位大陆手机号',
    pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
    replace: () => '<手机号>',
  },
  {
    id: 'id-card',
    label: '身份证号',
    hint: '18 位',
    pattern: /(?<!\d)\d{17}[\dXx](?!\d)/g,
    replace: () => '<身份证>',
  },
  {
    id: 'bank-card',
    label: '银行卡号',
    hint: '16-19 位纯数字（容易误伤，默认关）',
    pattern: /(?<!\d)\d{16,19}(?!\d)/g,
    replace: () => '<卡号>',
    defaultEnabled: false,
  },
]

export const DEFAULT_ENABLED = Object.fromEntries(
  RULES.map((r) => [r.id, r.defaultEnabled !== false]),
)

/** 人看的短摘要，最多 40 字 */
function clip(text, n = 40) {
  const s = String(text).replace(/\s+/g, ' ')
  return s.length > n ? s.slice(0, n) + '…' : s
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 跑一遍脱敏。
 * @param {string} text 原文
 * @param {{ enabled?: Record<string, boolean>, custom?: Array<{pattern:string,isRegex?:boolean,replace?:string,label?:string,enabled?:boolean}> }} [options]
 * @returns {{ output: string, findings: Array<{id:string,label:string,hint:string,sample:string,replacement:string}>, stats: Record<string, number> }}
 */
export function redact(text, options = {}) {
  const enabled = { ...DEFAULT_ENABLED, ...(options.enabled || {}) }
  const source = typeof text === 'string' ? text : ''
  const findings = []
  const stats = {}
  let output = source

  for (const rule of RULES) {
    if (!enabled[rule.id]) continue
    output = output.replace(rule.pattern, (...args) => {
      const match = args[0]
      const replacement = rule.replace(...args)
      if (match === replacement) return match
      findings.push({
        id: rule.id,
        label: rule.label,
        hint: rule.hint,
        sample: clip(match),
        replacement,
      })
      stats[rule.id] = (stats[rule.id] || 0) + 1
      return replacement
    })
  }

  // 自定义规则：放最后跑，补上内置规则没覆盖的词
  const custom = Array.isArray(options.custom) ? options.custom : []
  for (const rule of custom) {
    if (!rule || rule.enabled === false) continue
    const raw = String(rule.pattern || '')
    if (!raw) continue
    let re
    try {
      re = new RegExp(rule.isRegex ? raw : escapeRegExp(raw), 'g')
    } catch {
      continue // 正则写错了就跳过这条，不影响别的
    }
    const replacement = String(rule.replace || '<自定义>')
    const label = String(rule.label || raw).slice(0, 20)
    const key = 'custom:' + label
    output = output.replace(re, (match) => {
      if (!match) return match
      findings.push({
        id: key,
        label: rule.label || '自定义',
        hint: rule.isRegex ? '自定义正则' : '自定义词',
        sample: clip(match),
        replacement,
      })
      stats[key] = (stats[key] || 0) + 1
      return replacement
    })
  }

  return { output, findings, stats }
}

/** 有没有任何命中 */
export function hasFindings(result) {
  return !!(result && result.findings && result.findings.length)
}
