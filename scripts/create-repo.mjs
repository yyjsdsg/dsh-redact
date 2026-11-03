// 用 GitHub API 建仓库（node fetch，比 PowerShell 的 Invoke-RestMethod 稳）
const token = process.env.GH_TOKEN
if (!token) {
  console.error('缺少 GH_TOKEN')
  process.exit(1)
}

const headers = {
  authorization: `token ${token}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'dsh-redact',
  'content-type': 'application/json',
}

const body = {
  name: 'dsh-redact',
  description: 'Redact secrets, local paths, private IPs and personal data before you share or commit session text.',
  private: false,
  has_issues: true,
  has_wiki: false,
  has_projects: false,
}

const res = await fetch('https://api.github.com/user/repos', {
  method: 'POST',
  headers,
  body: JSON.stringify(body),
})

const text = await res.text()
if (!res.ok) {
  console.error('status', res.status)
  console.error(text.slice(0, 500))
  process.exit(1)
}
const repo = JSON.parse(text)
console.log('created:', repo.full_name, 'private=' + repo.private, 'default=' + repo.default_branch)
