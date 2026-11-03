import test from 'node:test'
import assert from 'node:assert/strict'
import { redact, RULES } from '../redact.js'

const run = (text, options) => redact(text, options)

test('打码 sk- 密钥', () => {
  const r = run('key=sk-abcdefghijklmnop1234 结束')
  assert.equal(r.output, 'key=sk-*** 结束')
  assert.equal(r.stats['api-key'], 1)
})

test('打码 GitHub 令牌', () => {
  const r = run('token gho_abcdefghijklmnopqrstuvwxyz0123456789 here')
  assert.ok(r.output.includes('<github-token>'))
  assert.equal(r.stats['github-token'], 1)
})

test('打码本机用户路径，保留盘符与后续路径', () => {
  const r = run('文件在 C:\\Users\\Administrator\\Desktop\\插件\\x.txt 里')
  assert.equal(r.output, '文件在 C:\\Users\\<user>\\Desktop\\插件\\x.txt 里')
  assert.equal(r.stats['win-user-path'], 1)
})

test('打码 /home 路径', () => {
  const r = run('cd /home/alice/project')
  assert.equal(r.output, 'cd /home/<user>/project')
})

test('打码内网 IP，公网 IP 不动', () => {
  const r = run('内网 192.168.1.10 和 10.0.0.5，公网 8.8.8.8')
  assert.ok(r.output.includes('<内网IP>'))
  assert.ok(r.output.includes('8.8.8.8'))
  assert.equal(r.stats['private-ip'], 2)
})

test('打码邮箱与手机号', () => {
  const r = run('联系 a.b@example.com 或 13800138000')
  assert.ok(r.output.includes('<邮箱>'))
  assert.ok(r.output.includes('<手机号>'))
})

test('打码 password= 赋值', () => {
  const r = run('db password=hunter2hunter2 结束')
  assert.ok(!r.output.includes('hunter2hunter2'))
  assert.equal(r.stats['secret-assignment'], 1)
})

test('中文紧跟在密码后面时不被一起吃掉', () => {
  const r = run('数据库 password=hunter2hunter2，内网 192.168.1.10')
  assert.equal(r.output, '数据库 password=***，内网 <内网IP>')
})

test('中文直接贴着密码也不吃中文', () => {
  const r = run('token=abcdefghijklmnop然后继续')
  assert.equal(r.output, 'token=***然后继续')
})

test('普通中文和英文不被误伤', () => {
  const text = '今天把插件做完了，顺手提交了 PR。版本 0.1.0，文件 index.js 和 client.js，端口 127.0.0.1:3000。'
  const r = run(text)
  assert.equal(r.output, text)
  assert.equal(r.findings.length, 0)
})

test('普通数字不被当成卡号（默认关）', () => {
  const r = run('订单号 1234567890123456')
  assert.equal(r.output, '订单号 1234567890123456')
  assert.equal(r.stats['bank-card'], undefined)
})

test('打开 bank-card 后才打码', () => {
  const r = run('订单号 1234567890123456', { enabled: { 'bank-card': true } })
  assert.equal(r.output, '订单号 <卡号>')
})

test('关掉某类规则就不处理它', () => {
  const r = run('a@b.com', { enabled: { email: false } })
  assert.equal(r.output, 'a@b.com')
})

test('空文本与 undefined 安全', () => {
  assert.equal(run('').output, '')
  assert.equal(run(undefined).output, '')
})

test('多次命中统计正确', () => {
  const r = run('sk-aaaaaaaaaaaaaaaa1111 和 sk-bbbbbbbbbbbbbbbb2222')
  assert.equal(r.stats['api-key'], 2)
  assert.equal(r.findings.length, 2)
})

test('已脱敏文本再次脱敏不会重复打码', () => {
  const once = run('C:\\Users\\Administrator\\a 和 sk-aaaaaaaaaaaaaaaa1111')
  const twice = run(once.output)
  assert.equal(twice.output, once.output)
})

test('规则 id 唯一', () => {
  const ids = RULES.map((r) => r.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('自定义词打码', () => {
  const r = run('我们公司在星辰科技，产品叫启明', {
    custom: [{ pattern: '星辰科技', replace: '<公司>' }],
  })
  assert.equal(r.output, '我们公司在<公司>，产品叫启明')
  assert.equal(r.findings.length, 1)
})

test('自定义正则打码多处', () => {
  const r = run('编号 AB-1234 和 CD-5678', {
    custom: [{ pattern: '[A-Z]{2}-\\d{4}', isRegex: true, replace: '<编号>' }],
  })
  assert.equal(r.output, '编号 <编号> 和 <编号>')
})

test('自定义正则写错时跳过，其他规则照常', () => {
  const r = run('sk-abcdefghijklmnop1234', { custom: [{ pattern: '([', isRegex: true }] })
  assert.ok(r.output.includes('sk-***'))
})

test('自定义规则可以带标签', () => {
  const r = run('对接方是某某银行', {
    custom: [{ pattern: '某某银行', label: '客户名', replace: '<客户>' }],
  })
  assert.equal(r.findings[0].label, '客户名')
  assert.equal(r.output, '对接方是<客户>')
})

test('自定义词里的正则元字符按字面量处理', () => {
  const r = run('价格 (含税) 是 100 元', { custom: [{ pattern: '(含税)', replace: '<备注>' }] })
  assert.equal(r.output, '价格 <备注> 是 100 元')
})
