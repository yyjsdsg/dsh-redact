// dsh-redact — 把会话或文档发给别人之前，先把密钥、本机路径、内网 IP 打码。
//
// 结构：
//   redact.js  纯规则引擎（可单测）
//   index.js   宿主：HTTP 接口 + 自定义规则持久化
//   client.js  界面：左边粘贴，右边出结果，带高亮和统计

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { redact, RULES, DEFAULT_ENABLED } from './redact.js'

export const inject = []

const DEFAULTS = {
  enabled: true,
  /** 单次处理的最大字符数，防止把整本日志塞进来把内存打满 */
  maxChars: 400000,
  customPath: join(homedir(), '.dsh', 'redact-custom.json'),
}

const MAX_CUSTOM_RULES = 50
const MAX_PATTERN_LEN = 200

/** 清洗一条自定义规则，别让坏数据把整个文件搞坏 */
function cleanRule(raw) {
  if (!raw || typeof raw !== 'object') return null
  const pattern = String(raw.pattern || '').slice(0, MAX_PATTERN_LEN)
  if (!pattern) return null
  const rule = {
    pattern,
    isRegex: raw.isRegex === true,
    replace: String(raw.replace || '<自定义>').slice(0, 40),
    enabled: raw.enabled !== false,
  }
  const label = String(raw.label || '').trim().slice(0, 20)
  if (label) rule.label = label
  if (rule.isRegex) {
    try {
      new RegExp(rule.pattern) // 只校验能不能编译
    } catch {
      return null
    }
  }
  return rule
}

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config }
  if (cfg.enabled === false) return

  const readCustom = () => {
    try {
      const raw = readFileSync(cfg.customPath, 'utf8')
      const parsed = JSON.parse(raw)
      const list = Array.isArray(parsed) ? parsed : parsed.rules
      if (!Array.isArray(list)) return []
      return list.slice(0, MAX_CUSTOM_RULES).map(cleanRule).filter(Boolean)
    } catch {
      return []
    }
  }

  const writeCustom = (rules) => {
    const cleaned = (Array.isArray(rules) ? rules : [])
      .slice(0, MAX_CUSTOM_RULES)
      .map(cleanRule)
      .filter(Boolean)
    mkdirSync(dirname(cfg.customPath), { recursive: true })
    writeFileSync(cfg.customPath, JSON.stringify({ rules: cleaned }, null, 2), 'utf8')
    return cleaned
  }

  ctx.inject(['webServer'], (scoped) => {
    scoped.effect(() => {
      const json = (res, code, data) => {
        res.statusCode = code
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.end(JSON.stringify(data))
      }

      const readBody = async (req) => {
        let body = ''
        for await (const chunk of req) body += chunk
        return body ? JSON.parse(body) : {}
      }

      const offRules = scoped.webServer.register({
        kind: 'exact',
        path: '/redact/rules',
        handler: (req, res) => {
          json(res, 200, {
            rules: RULES.map((r) => ({
              id: r.id,
              label: r.label,
              hint: r.hint,
              defaultEnabled: DEFAULT_ENABLED[r.id] !== false,
            })),
            maxCustom: MAX_CUSTOM_RULES,
            maxPatternLen: MAX_PATTERN_LEN,
          })
        },
      })

      const offCustom = scoped.webServer.register({
        kind: 'exact',
        path: '/redact/custom',
        handler: async (req, res) => {
          if (req.method === 'GET') {
            json(res, 200, { rules: readCustom() })
            return
          }
          if (req.method !== 'POST') {
            json(res, 405, { error: 'GET or POST only' })
            return
          }
          try {
            const body = await readBody(req)
            json(res, 200, { rules: writeCustom(body.rules) })
          } catch (e) {
            json(res, 400, { error: String(e && e.message) })
          }
        },
      })

      const offRun = scoped.webServer.register({
        kind: 'exact',
        path: '/redact/run',
        handler: async (req, res) => {
          if (req.method !== 'POST') {
            json(res, 405, { error: 'POST only' })
            return
          }
          try {
            const body = await readBody(req)
            const text = typeof body.text === 'string' ? body.text : ''
            if (!text) {
              json(res, 200, { output: '', findings: [], stats: {}, truncated: false })
              return
            }
            let truncated = false
            let source = text
            if (source.length > cfg.maxChars) {
              source = source.slice(0, cfg.maxChars)
              truncated = true
            }
            // 自定义规则每次从磁盘读，改了立刻生效
            const custom = Array.isArray(body.custom) ? body.custom : readCustom()
            const result = redact(source, { enabled: body.enabled || {}, custom })
            json(res, 200, { ...result, truncated })
          } catch (e) {
            json(res, 400, { error: String(e && e.message) })
          }
        },
      })

      return () => {
        offRules()
        offCustom()
        offRun()
      }
    })
  })
}
