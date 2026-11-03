// 直接走 GitHub Contents API 上传（github.com:443 连不上时的备选）
import fs from 'node:fs'
import path from 'node:path'

const token = process.env.GH_TOKEN
if (!token) {
  console.error('缺少 GH_TOKEN')
  process.exit(1)
}
const owner = process.env.GH_OWNER || 'yyjsdsg'
const repo = process.env.GH_REPO || 'dsh-redact'
const root = process.cwd()

const headers = {
  authorization: `token ${token}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'dsh-redact',
  'content-type': 'application/json',
}

const files = []
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else files.push(p)
  }
}
walk(root)

files.sort((a, b) => a.length - b.length)

let ok = 0
let failed = 0
for (const f of files) {
  const rel = path.relative(root, f).replace(/\\/g, '/')
  const content = fs.readFileSync(f).toString('base64')
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(rel)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ message: `add ${rel}`, content }),
  })
  const text = await res.text()
  if (res.ok) {
    ok += 1
    console.log('ok  ', rel)
  } else {
    failed += 1
    console.log('FAIL', rel, res.status, text.slice(0, 160))
  }
}
console.log(`\n完成：${ok} 个成功，${failed} 个失败`)
