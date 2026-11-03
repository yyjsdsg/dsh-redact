// dsh-redact / 前端：左边粘贴原文，右边出脱敏结果
//
// 侧边栏图标 → 主面板。规则跑在宿主，这里只管界面。

window.__ModuleLoader__.load({
  id: 'dsh-redact',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    const T = {
      text: 'var(--dsw-alias-label-primary, #111827)',
      dim: 'var(--dsw-alias-label-secondary, #6b7280)',
      line: 'var(--dsw-alias-border-l1, rgba(127,127,127,.2))',
      card: 'var(--dsw-alias-bg-layer-1, rgba(127,127,127,.05))',
      card2: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,.09))',
      base: 'var(--dsw-alias-bg-base, #fff)',
      accent: 'var(--dsw-alias-brand-primary, #2563eb)',
      ok: 'var(--dsw-alias-state-success-primary, #10b981)',
      bad: 'var(--dsw-alias-state-error-primary, #ef4444)',
    }

    const ghost = {
      fontSize: 12,
      padding: '5px 12px',
      borderRadius: 8,
      border: '1px solid currentColor',
      background: 'transparent',
      color: 'inherit',
      opacity: 0.72,
      cursor: 'pointer',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
    }

    const primary = {
      fontSize: 12,
      padding: '5px 14px',
      borderRadius: 8,
      border: '1px solid #1d4ed8',
      background: '#2563eb',
      color: '#ffffff',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }

    const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Microsoft YaHei", monospace'

    const inputStyle = {
      fontSize: 11.5,
      padding: '4px 9px',
      borderRadius: 7,
      border: '1px solid ' + T.line,
      background: T.base,
      color: T.text,
      outline: 'none',
      fontFamily: 'inherit',
    }

    /** 把 <占位符> 和 *** 标红 */
    function Highlighted(props) {
      const text = String(props.text || '')
      const parts = text.split(/(<[^<>\n]{1,24}>|\*\*\*)/g)
      return h(
        'pre',
        {
          style: {
            margin: 0,
            padding: '14px 16px',
            fontFamily: MONO,
            fontSize: 12.5,
            lineHeight: 1.85,
            color: T.text,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          },
        },
        parts.map((p, i) =>
          /^(<[^<>\n]{1,24}>|\*\*\*)$/.test(p)
            ? h(
                'mark',
                {
                  key: i,
                  style: {
                    background: 'rgba(239,68,68,.16)',
                    color: '#dc2626',
                    borderRadius: 4,
                    padding: '0 3px',
                    fontWeight: 600,
                  },
                },
                p,
              )
            : h('span', { key: i }, p),
        ),
      )
    }

    function Icon(props) {
      const size = props && props.size ? props.size : 20
      const active = props && props.active
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
        h('path', {
          d: 'M12 3.2l7 2.6v5.6c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V5.8l7-2.6z',
          stroke: active ? '#5B9EFF' : 'currentColor',
          strokeWidth: 1.5,
          strokeLinejoin: 'round',
        }),
        h('path', {
          d: 'M8.8 12.2l2.2 2.2 4.2-4.4',
          stroke: currentColorFallback(active),
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function currentColorFallback(active) {
      return active ? '#2BD9A5' : 'currentColor'
    }

    function Page() {
      const [text, setText] = useState('')
      const [result, setResult] = useState(null)
      const [rules, setRules] = useState([])
      const [enabled, setEnabled] = useState({})
      const [showRules, setShowRules] = useState(false)
      const [showFindings, setShowFindings] = useState(false)
      const [copied, setCopied] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [customRules, setCustomRules] = useState([])
      const [newPattern, setNewPattern] = useState('')
      const [newReplace, setNewReplace] = useState('')
      const [newRegex, setNewRegex] = useState(false)
      const fileRef = useRef(null)
      const timerRef = useRef(null)

      useEffect(() => {
        fetch('/redact/rules', { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => {
            if (d.rules) {
              setRules(d.rules)
              const init = {}
              for (const r of d.rules) init[r.id] = r.defaultEnabled !== false
              setEnabled(init)
            }
          })
          .catch(() => setError('读不到脱敏规则'))
        fetch('/redact/custom', { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => setCustomRules(d.rules || []))
          .catch(() => {})
      }, [])

      const saveCustom = async (list) => {
        try {
          const res = await fetch('/redact/custom', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ rules: list }),
          })
          const json = await res.json()
          if (json.error) throw new Error(json.error)
          setCustomRules(json.rules || [])
          return true
        } catch (e) {
          setError('保存自定义规则失败：' + String(e && e.message))
          setTimeout(() => setError(''), 4000)
          return false
        }
      }

      const addCustom = async () => {
        const p = newPattern.trim()
        if (!p) return
        const ok = await saveCustom([
          ...customRules,
          { pattern: p, replace: newReplace.trim() || '<自定义>', isRegex: newRegex, enabled: true },
        ])
        if (ok) {
          setNewPattern('')
          setNewReplace('')
          setNewRegex(false)
        }
      }

      const removeCustom = async (index) => {
        await saveCustom(customRules.filter((_, i) => i !== index))
      }

      const run = useCallback(async (input, flags) => {
        if (!input.trim()) {
          setResult(null)
          return
        }
        setBusy(true)
        setError('')
        try {
          const res = await fetch('/redact/run', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: input, enabled: flags }),
          })
          const json = await res.json()
          if (json.error) throw new Error(json.error)
          setResult(json)
        } catch (e) {
          setError('脱敏失败：' + String(e && e.message))
        } finally {
          setBusy(false)
        }
      }, [])

      // 输入变化后 350ms 自动跑一次
      useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => run(text, enabled), 350)
        return () => {
          if (timerRef.current) clearTimeout(timerRef.current)
        }
      }, [text, enabled, run])

      const stats = (result && result.stats) || {}
      const findings = (result && result.findings) || []
      const total = findings.length
      const output = (result && result.output) || ''

      const statLine = Object.entries(stats)
        .map(([id, n]) => {
          const n2 = { 'api-key': '密钥', 'github-token': 'GitHub 令牌', 'aws-key': 'AWS 密钥', bearer: '令牌', 'secret-assignment': '密码', 'win-user-path': '本机路径', 'unix-home': '本机路径', 'private-ip': '内网 IP', email: '邮箱', 'phone-cn': '手机号', 'id-card': '身份证', 'bank-card': '卡号' }[id] || id
          return n2 + ' ' + n
        })
        .join(' · ')

      const copy = async () => {
        try {
          await navigator.clipboard.writeText(output)
          setCopied('已复制')
          setTimeout(() => setCopied(''), 2000)
        } catch {
          setCopied('复制失败')
          setTimeout(() => setCopied(''), 2000)
        }
      }

      const download = () => {
        const blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'redacted-' + new Date().toISOString().slice(0, 10) + '.txt'
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 3000)
      }

      const pickFile = () => {
        if (fileRef.current) fileRef.current.click()
      }

      const onFile = async (e) => {
        const f = e.target.files && e.target.files[0]
        if (!f) return
        try {
          const t = await f.text()
          setText(t)
        } catch {
          setError('读不了这个文件')
        }
        e.target.value = ''
      }

      const paste = async () => {
        try {
          const t = await navigator.clipboard.readText()
          if (t) setText(t)
        } catch {
          setError('浏览器不允许读剪贴板，请手动粘贴（Ctrl+V）')
          setTimeout(() => setError(''), 3000)
        }
      }

      return h(
        'div',
        { style: { height: '100%', background: T.base, display: 'flex', flexDirection: 'column', overflow: 'hidden' } },

        // 顶栏
        h(
          'div',
          {
            style: {
              padding: '16px 26px 12px',
              borderBottom: '1px solid ' + T.line,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              flex: '0 0 auto',
            },
          },
          h(
            'div',
            { style: { display: 'grid', gap: 1 } },
            h('div', { style: { fontSize: 16.5, fontWeight: 700, color: T.text } }, '脱敏'),
            h('div', { style: { fontSize: 11, color: T.dim } }, '密钥、本机路径、内网 IP、手机号——发出去之前先打码'),
          ),
          h('div', { style: { flex: '1 1 auto' } }),
          h(
            'button',
            { onClick: () => setShowRules(!showRules), style: { ...ghost, opacity: showRules ? 1 : 0.72 } },
            '规则 ' + Object.values(enabled).filter(Boolean).length + '/' + rules.length,
          ),
          h(
            'button',
            { onClick: () => setShowFindings(!showFindings), style: ghost },
            '明细' + (total ? ' ' + total : ''),
          ),
        ),

        // 规则面板
        showRules
          ? h(
              'div',
              {
                style: {
                  padding: '10px 26px 12px',
                  borderBottom: '1px solid ' + T.line,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  background: T.card,
                  flex: '0 0 auto',
                },
              },
              rules.length
                ? rules.map((r) =>
                    h(
                      'label',
                      {
                        key: r.id,
                        title: r.hint,
                        style: {
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11.5,
                          color: enabled[r.id] ? T.text : T.dim,
                          border: '1px solid ' + (enabled[r.id] ? T.line : T.line),
                          borderRadius: 99,
                          padding: '3px 10px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          background: enabled[r.id] ? T.base : 'transparent',
                        },
                      },
                      h('input', {
                        type: 'checkbox',
                        checked: !!enabled[r.id],
                        onChange: (e) => setEnabled({ ...enabled, [r.id]: e.target.checked }),
                        style: { margin: 0, accentColor: T.accent },
                      }),
                      r.label,
                    ),
                  )
                : h('span', { style: { fontSize: 11.5, color: T.dim } }, '加载规则中…'),
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    borderTop: '1px solid ' + T.line,
                    paddingTop: 8,
                  },
                },
                h('span', { style: { fontSize: 11, color: T.dim } }, '自定义'),
                h('input', {
                  value: newPattern,
                  onChange: (e) => setNewPattern(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter') addCustom()
                  },
                  placeholder: '要打码的词，或正则',
                  style: { ...inputStyle, width: 210 },
                }),
                h('span', { style: { fontSize: 11, color: T.dim } }, '→'),
                h('input', {
                  value: newReplace,
                  onChange: (e) => setNewReplace(e.target.value),
                  placeholder: '<自定义>',
                  style: { ...inputStyle, width: 110 },
                }),
                h(
                  'label',
                  {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11.5,
                      color: T.dim,
                      cursor: 'pointer',
                    },
                  },
                  h('input', {
                    type: 'checkbox',
                    checked: newRegex,
                    onChange: (e) => setNewRegex(e.target.checked),
                    style: { margin: 0, accentColor: T.accent },
                  }),
                  '按正则',
                ),
                h('button', { onClick: addCustom, style: { ...primary, padding: '3px 11px' } }, '添加'),
                h('span', { style: { fontSize: 10.5, color: T.dim } }, '保存后一直生效，存在本机'),
              ),
              customRules.length
                ? h(
                    'div',
                    { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
                    customRules.map((r, i) =>
                      h(
                        'span',
                        {
                          key: i,
                          style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11,
                            border: '1px solid ' + T.line,
                            borderRadius: 99,
                            padding: '2px 3px 2px 10px',
                            color: T.text,
                            background: T.base,
                          },
                        },
                        h('span', { style: { fontFamily: MONO } }, r.pattern),
                        h('span', { style: { color: T.dim } }, '→'),
                        h('span', { style: { fontFamily: MONO, color: '#dc2626' } }, r.replace),
                        r.isRegex ? h('span', { style: { color: T.dim, fontSize: 10 } }, '正则') : null,
                        h(
                          'button',
                          {
                            onClick: () => removeCustom(i),
                            title: '删除这条',
                            style: {
                              border: 'none',
                              background: 'transparent',
                              color: T.dim,
                              cursor: 'pointer',
                              fontSize: 14,
                              lineHeight: 1,
                              padding: '0 5px',
                            },
                          },
                          '×',
                        ),
                      ),
                    ),
                  )
                : null,
            )
          : null,

        // 统计条
        total > 0 || (result && result.truncated)
          ? h(
              'div',
              {
                style: {
                  padding: '7px 26px',
                  fontSize: 11.5,
                  color: total ? '#dc2626' : T.dim,
                  borderBottom: '1px solid ' + T.line,
                  background: total ? 'rgba(239,68,68,.06)' : 'transparent',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  flex: '0 0 auto',
                },
              },
              h('span', null, total ? '打码 ' + total + ' 处：' + statLine : '没有命中，这份内容可以直接发'),
              h('span', { style: { flex: '1 1 auto' } }),
              result && result.truncated ? h('span', { style: { color: T.dim } }, '内容过长，只处理了前面一部分') : null,
            )
          : null,

        error ? h('div', { style: { padding: '6px 26px', fontSize: 11.5, color: T.bad } }, error) : null,

        // 明细
        showFindings && findings.length
          ? h(
              'div',
              {
                style: {
                  padding: '8px 26px 10px',
                  borderBottom: '1px solid ' + T.line,
                  maxHeight: 150,
                  overflowY: 'auto',
                  display: 'grid',
                  gap: 3,
                  flex: '0 0 auto',
                },
              },
              findings.map((f, i) =>
                h(
                  'div',
                  { key: i, style: { display: 'flex', gap: 8, fontSize: 11, alignItems: 'baseline' } },
                  h('span', { style: { color: '#dc2626', flex: '0 0 62px' } }, f.label),
                  h(
                    'span',
                    {
                      style: {
                        fontFamily: MONO,
                        color: T.dim,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      },
                      title: f.sample,
                    },
                    f.sample,
                  ),
                  h('span', { style: { color: T.dim, flex: '0 0 auto' } }, '→'),
                  h('span', { style: { color: '#dc2626', fontFamily: MONO, flex: '0 0 auto' } }, f.replacement),
                ),
              ),
            )
          : null,

        // 主体
        h(
          'div',
          { style: { flex: '1 1 auto', display: 'flex', minHeight: 0 } },

          // 输入
          h(
            'div',
            { style: { flex: '1 1 50%', minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid ' + T.line } },
            h(
              'div',
              {
                style: {
                  padding: '7px 14px',
                  borderBottom: '1px solid ' + T.line,
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  flex: '0 0 auto',
                },
              },
              h('span', { style: { fontSize: 11, color: T.dim, flex: '1 1 auto' } }, '原文'),
              h('button', { onClick: paste, style: ghost }, '粘贴'),
              h('button', { onClick: pickFile, style: ghost }, '打开文件'),
              h(
                'button',
                { onClick: () => setText(''), style: ghost },
                '清空',
              ),
              h('input', {
                ref: fileRef,
                type: 'file',
                accept: '.md,.txt,.log,.json,.yaml,.yml',
                onChange: onFile,
                style: { display: 'none' },
              }),
            ),
            h('textarea', {
              value: text,
              onChange: (e) => setText(e.target.value),
              placeholder: '把要发出去的会话、总结、日志粘贴到这里\n\n支持 .md / .txt / .log / .json 文件',
              spellCheck: false,
              style: {
                flex: '1 1 auto',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'none',
                border: 'none',
                outline: 'none',
                padding: '14px 16px',
                fontFamily: MONO,
                fontSize: 12.5,
                lineHeight: 1.85,
                color: T.text,
                background: 'transparent',
              },
            }),
          ),

          // 输出
          h(
            'div',
            { style: { flex: '1 1 50%', minWidth: 0, display: 'flex', flexDirection: 'column' } },
            h(
              'div',
              {
                style: {
                  padding: '7px 14px',
                  borderBottom: '1px solid ' + T.line,
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                  flex: '0 0 auto',
                },
              },
              h('span', { style: { fontSize: 11, color: T.dim, flex: '1 1 auto' } }, '脱敏后'),
              busy ? h('span', { style: { fontSize: 10.5, color: T.dim } }, '处理中…') : null,
              h(
                'button',
                { onClick: copy, disabled: !output, style: { ...primary, opacity: output ? 1 : 0.5 } },
                copied || '复制',
              ),
              h('button', { onClick: download, disabled: !output, style: { ...ghost, opacity: output ? 0.72 : 0.4 } }, '下载'),
            ),
            h(
              'div',
              { style: { flex: '1 1 auto', overflowY: 'auto', background: T.card } },
              output
                ? h(Highlighted, { text: output })
                : h(
                    'div',
                    {
                      style: {
                        padding: '52px 24px',
                        textAlign: 'center',
                        fontSize: 12.5,
                        color: T.dim,
                        lineHeight: 2,
                      },
                    },
                    '左边粘上内容，这里会实时显示打码结果。',
                    h('br'),
                    '命中的片段会被标红。',
                  ),
            ),
          ),
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: 'redact', order: 32 }, Icon),
        )
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'redact' }, Page))
      },
    }
  },
})
