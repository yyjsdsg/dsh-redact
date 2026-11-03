const base = 'http://127.0.0.1:49432'

const save = await fetch(base + '/redact/custom', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    rules: [
      { pattern: '星辰科技', replace: '<公司>', isRegex: false, label: '公司名', enabled: true },
      { pattern: 'AB-\\d{4}', replace: '<编号>', isRegex: true, label: '项目编号', enabled: true },
    ],
  }),
})
console.log('保存:', await save.text())

const run = await fetch(base + '/redact/run', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    text: '我们和星辰科技对接，编号 AB-1234，路径 C:\\Users\\Administrator\\a.txt，密钥 sk-abcdefghijklmnop1234，内网 192.168.1.9',
    enabled: {},
  }),
})
const j = await run.json()
console.log('输出:', j.output)
console.log('统计:', JSON.stringify(j.stats))
console.log('命中:')
for (const f of j.findings) console.log('  ', f.label, '|', f.sample, '=>', f.replacement)

// 清理测试规则，别留在用户机器上
const clear = await fetch(base + '/redact/custom', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ rules: [] }),
})
console.log('清理后:', await clear.text())
