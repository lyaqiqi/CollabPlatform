# doc模块测试方法

**由于还没有实现登录页面，需要直接使用命令进行登录认证和文档创建。**

# 启动项目

```PowerShell
cd /d D:\StudyResources\软件工程\CollabPlatform\server
cd /d D:\StudyResources\软件工程\CollabPlatform\client
```

前后端运行指令，在server和client文件夹下分别运行：

```PowerShell
npm run dev
```

测试文档：

```PowerShell
http://localhost:5173/doc/c031adcf-2ea4-4205-8603-b8283bc68aee
```





# **注册（自行设置username、email、password等）**

```PowerShell
curl.exe -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"testuser\",\"email\":\"test@example.com\",\"password\":\"12345678\"}"
```

```PowerShell
curl.exe -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"testuser2\",\"email\":\"test2@example.com\",\"password\":\"12345678\"}"
```

```PowerShell
curl.exe -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"testuser3\",\"email\":\"test3@example.com\",\"password\":\"12345678\"}"
```



# **登录（使用之前注册的email和password）**

```PowerShell
curl.exe -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\",\"password\":\"12345678\"}"
```

```SQL
curl.exe -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test2@example.com\",\"password\":\"12345678\"}"
```

```SQL
curl.exe -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test3@example.com\",\"password\":\"12345678\"}"
```

返回类似：

\{

"code": 0,

"data": \{

"accessToken": "eyJhbG\.\.\.",

"refreshToken": "eyJhbG\.\.\.",

"user": \{ "user\_id": "\.\.\.", "username": "testuser", "email": "test@example\.com" \}

\},

"message": "登录成功"

\}

如下：

```JSON
{"code":0,"data":{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmOGNiZGZiNi05ZTZjLTQ3OWQtOTQ1Yy1hNGE1MTMwZTE2OGIiLCJpYXQiOjE3ODA0MDIwMjQsImV4cCI6MTc4MTAwNjgyNH0.kW5QxlBTO50t_rjCMdwhMgLZT3gLxq0qkqpUEx0IafQ","refreshToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmOGNiZGZiNi05ZTZjLTQ3OWQtOTQ1Yy1hNGE1MTMwZTE2OGIiLCJpYXQiOjE3ODA0MDIwMjQsImV4cCI6MTc4Mjk5NDAyNH0.B3emco1S3kpUhZDxfIRk2muCs6K6q5PfQ3ouTokb9-g","user":{"user_id":"f8cbdfb6-9e6c-479d-945c-a4a5130e168b","username":"testuser","email":"test@example.com"}},"message":"登录成功"}
```

```JSON
{"code":0,"data":{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiNDIxYjk5Zi0wYzg4LTRmYjgtOGQ3NS04NTFhN2E2YmU1NGYiLCJpYXQiOjE3ODA0MDE5MzUsImV4cCI6MTc4MTAwNjczNX0.eiaXjKF15TyVzchtzUkc5tK7VXNf-kmWtZhKCpRMgNY","refreshToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiNDIxYjk5Zi0wYzg4LTRmYjgtOGQ3NS04NTFhN2E2YmU1NGYiLCJpYXQiOjE3ODA0MDE5MzUsImV4cCI6MTc4Mjk5MzkzNX0.eTlaF8Y73BMn9Z8AzF5ojABdlfnfjWx3iG-gINaFIS0","user":{"user_id":"b421b99f-0c88-4fb8-8d75-851a7a6be54f","username":"testuser2","email":"test2@example.com"}},"message":"登录成功"}
```

```JSON
{"code":0,"data":{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0Y2JiNThiMi03ZDZjLTRlMDAtYTUxMS1kZDJiMjg0ZGFhODEiLCJpYXQiOjE3ODA0MDM3MzUsImV4cCI6MTc4MTAwODUzNX0.dQAYiDyAjqOsy49zvFwa8tJSPeOiXRU76EsAY152tB4","refreshToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0Y2JiNThiMi03ZDZjLTRlMDAtYTUxMS1kZDJiMjg0ZGFhODEiLCJpYXQiOjE3ODA0MDM3MzUsImV4cCI6MTc4Mjk5NTczNX0.yK7RBqSRXootTQ4Opdu-mBgTPhp64DowqWMv-7K3B9M","user":{"user_id":"4cbb58b2-7d6c-4e00-a511-dd2b284daa81","username":"testuser3","email":"test3@example.com"}},"message":"登录成功"}
```



# **让浏览器能进 ****`/doc/:id`****（必做）**

1. 用浏览器打开 [http://localhost:5173](http://localhost:5173/)

2. 按 F12 → Console，粘贴（把下面对应的值换成你登录返回的）：

> 我在测试的时候用了三个不同的浏览器（Edge、Chrome、Firefox）模拟三个用户
> 
> 

```JavaScript
localStorage.setItem('collab_access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmOGNiZGZiNi05ZTZjLTQ3OWQtOTQ1Yy1hNGE1MTMwZTE2OGIiLCJpYXQiOjE3ODA0MDIwMjQsImV4cCI6MTc4MTAwNjgyNH0.kW5QxlBTO50t_rjCMdwhMgLZT3gLxq0qkqpUEx0IafQ');
localStorage.setItem('collab_refresh_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmOGNiZGZiNi05ZTZjLTQ3OWQtOTQ1Yy1hNGE1MTMwZTE2OGIiLCJpYXQiOjE3ODA0MDIwMjQsImV4cCI6MTc4Mjk5NDAyNH0.B3emco1S3kpUhZDxfIRk2muCs6K6q5PfQ3ouTokb9-g');
localStorage.setItem('collab_user', JSON.stringify({
  user_id: 'f8cbdfb6-9e6c-479d-945c-a4a5130e168b',
  username: 'testuser',
  email: 'test@example.com'
}));
location.reload();
```

```JavaScript
localStorage.setItem('collab_access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiNDIxYjk5Zi0wYzg4LTRmYjgtOGQ3NS04NTFhN2E2YmU1NGYiLCJpYXQiOjE3ODA0MDE5MzUsImV4cCI6MTc4MTAwNjczNX0.eiaXjKF15TyVzchtzUkc5tK7VXNf-kmWtZhKCpRMgNY');
localStorage.setItem('collab_refresh_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiNDIxYjk5Zi0wYzg4LTRmYjgtOGQ3NS04NTFhN2E2YmU1NGYiLCJpYXQiOjE3ODA0MDE5MzUsImV4cCI6MTc4Mjk5MzkzNX0.eTlaF8Y73BMn9Z8AzF5ojABdlfnfjWx3iG-gINaFIS0');
localStorage.setItem('collab_user', JSON.stringify({
  user_id: 'b421b99f-0c88-4fb8-8d75-851a7a6be54f',
  username: 'testuser2',
  email: 'test2@example.com'
}));
location.reload();
```

```JavaScript
localStorage.setItem('collab_access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0Y2JiNThiMi03ZDZjLTRlMDAtYTUxMS1kZDJiMjg0ZGFhODEiLCJpYXQiOjE3ODA0MDM3MzUsImV4cCI6MTc4MTAwODUzNX0.dQAYiDyAjqOsy49zvFwa8tJSPeOiXRU76EsAY152tB4');
localStorage.setItem('collab_refresh_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0Y2JiNThiMi03ZDZjLTRlMDAtYTUxMS1kZDJiMjg0ZGFhODEiLCJpYXQiOjE3ODA0MDM3MzUsImV4cCI6MTc4Mjk5NTczNX0.yK7RBqSRXootTQ4Opdu-mBgTPhp64DowqWMv-7K3B9M');
localStorage.setItem('collab_user', JSON.stringify({
  user_id: '4cbb58b2-7d6c-4e00-a511-dd2b284daa81',
  username: 'testuser3',
  email: 'test3@example.com'
}));
location.reload();
```

刷新后不应再被重定向到 `/login`，`ProtectedRoute` 和 `useSocket` 才能正常工作。



# **创建doc**

powershell运行下列登录文本：

```PowerShell
# 1. 登录（邮箱密码改成你注册时用的）
$body = @{
  email    = "test@example.com"
  password = "12345678"
} | ConvertTo-Json

$res = Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/auth/login" `
  -ContentType "application/json" `
  -Body $body

# 2. 检查是否登录成功
if (-not $res.data.accessToken) {
  Write-Host "登录失败，完整返回：" -ForegroundColor Red
  $res | ConvertTo-Json -Depth 5
  return
}

$token = $res.data.accessToken
Write-Host "accessToken 前 20 个字符:" $token.Substring(0, [Math]::Min(20, $token.Length))

# 3. 带 token 访问 /api/me
$headers = @{
  Authorization = "Bearer $token"
}

Invoke-RestMethod -Uri "http://localhost:3000/api/me" -Headers $headers
```

继续：

```PowerShell
$headers = @{
  Authorization = "Bearer $token"
  "Content-Type" = "application/json"
}
$doc = Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/docs" -Headers $headers -Body '{"title":"我的测试文档"}'
$docId = $doc.data.item_id
Write-Host "打开: http://localhost:5173/doc/$docId"
```

浏览器访问打印出来的地址，应看到 TipTap 编辑器（不是「由 C 实现」占位）。





# 插入访问权限（viewer/editor/owner）

用一个账号创建doc后，其他账号没有访问权限，需要用powershell直接写数据库权限。

```Bash
$permId = [guid]::NewGuid().ToString()
$edgeUserId = "粘贴userid"
$itemId = "粘贴docid"

$sql = "INSERT INTO ""Permission"" (""permission_id"", ""user_id"", ""item_id"", ""role"") VALUES ('$permId', '$edgeUserId', '$itemId', 'editor');"
psql -U postgres -h localhost -d collab -c $sql
```



获得权限后访问对应`http://localhost:5173/doc/$docId`，例如：http://localhost:5173/doc/c031adcf\-2ea4\-4205\-8603\-b8283bc68aee



