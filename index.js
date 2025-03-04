// Cloudflare Worker
// This worker uses Cloudflare KV for storing URL data

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

// 管理员配置 - 从环境变量获取
const getEnvVar = (varName, defaultValue) => {
  // 尝试从全局对象获取环境变量
  try {
    return typeof self[varName] !== "undefined" ? self[varName] : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

// 获取管理员凭据
const ADMIN_USERNAME = getEnvVar("ADMIN_USERNAME", "admin");
const ADMIN_PASSWORD = getEnvVar("ADMIN_PASSWORD", "yourStrongPassword");

async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    const { pathname } = url;
    
    // Handle favicon request
    if (pathname === '/favicon.ico') {
      return new Response(null, { status: 204 });
    }
    
    if (pathname === "/") {
      // Serve the frontend
      return serveFrontend();
    }
    
    if (pathname === "/admin") {
      // Serve the admin panel
      return serveAdminPanel();
    }
    
    if (pathname.startsWith("/api")) {
      // Handle API requests
      return handleAPIRequest(request);
    }
    
    // Redirect for short URLs
    return handleRedirect(pathname);
  } catch (error) {
    console.error('Error handling request:', error);
    return new Response('服务器内部错误', { status: 500 });
  }
}

async function serveFrontend() {
  const turnstileScript = TURNSTILE_SITE_KEY ?
    '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' :
    '';
    
  const frontendHTML = '<!DOCTYPE html>\n' +
'<html lang="zh">\n' +
'<head>\n' +
'    <meta charset="UTF-8">\n' +
'    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'    <title>短链接生成器</title>\n' +
'    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">\n' +
'    <link rel="icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>🔗</text></svg>">\n' +
'    ' + turnstileScript + '\n' +
'</head>\n' +
'<body class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">\n' +
'    <main class="container mx-auto p-6 max-w-2xl">\n' +
'        <div class="text-center mb-12">\n' +
'            <h1 class="text-6xl font-extrabold mb-4">\n' +
'                <span class="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500\n' +
'                hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 transition-all duration-500">\n' +
'                    简约短链Enhanced\n' +
'                </span>\n' +
'            </h1>\n' +
'            <p class="text-gray-600 text-lg mb-4">简单、安全的链接缩短服务</p>\n' +
'            <div class="flex justify-center space-x-4">\n' +
'                <a href="https://github.com/lilynas/CloudflareWorker-KV-UrlShort-Enhanced/"\n' +
'                   target="_blank"\n' +
'                   class="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">\n' +
'                    <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">\n' +
'                        <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"></path>\n' +
'                    </svg>\n' +
'                    自部署开源地址\n' +
'                </a>\n' +
'                <a href="/admin"\n' +
'                   class="inline-flex items-center px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors">\n' +
'                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">\n' +
'                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />\n' +
'                    </svg>\n' +
'                    管理员入口\n' +
'                </a>\n' +
'            </div>\n' +
'        </div>\n' +
'        \n' +
'        <div class="bg-white rounded-xl shadow-lg p-8 backdrop-blur-sm bg-opacity-90">\n' +
'            <form id="shorten-form" class="space-y-6">\n' +
'                <div class="space-y-4">\n' +
'                    <div>\n' +
'                        <label for="url" class="block text-sm font-semibold text-gray-700 mb-2">\n' +
'                            输入链接\n' +
'                            <span class="text-gray-500 font-normal">（必填）</span>\n' +
'                        </label>\n' +
'                        <input id="url" type="url"\n' +
'                            class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"\n' +
'                            placeholder="https://example.com" required>\n' +
'                    </div>\n' +
'                    \n' +
'                    <div class="grid md:grid-cols-2 gap-4">\n' +
'                        <div>\n' +
'                            <label for="slug" class="block text-sm font-semibold text-gray-700 mb-2">\n' +
'                                自定义短链接\n' +
'                                <span class="text-gray-500 font-normal">（可选）</span>\n' +
'                            </label>\n' +
'                            <input id="slug" type="text"\n' +
'                                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"\n' +
'                                placeholder="自定义链接">\n' +
'                        </div>\n' +
'                        <div>\n' +
'                            <label for="expiry" class="block text-sm font-semibold text-gray-700 mb-2">\n' +
'                                有效期\n' +
'                                <span class="text-gray-500 font-normal">（可选）</span>\n' +
'                            </label>\n' +
'                            <select id="expiry"\n' +
'                                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200">\n' +
'                                <option value="">永久有效</option>\n' +
'                                <option value="1h">1小时</option>\n' +
'                                <option value="24h">24小时</option>\n' +
'                                <option value="7d">7天</option>\n' +
'                                <option value="30d">30天</option>\n' +
'                                <option value="custom">自定义时间</option>\n' +
'                            </select>\n' +
'                            <input id="customExpiry" type="datetime-local"\n' +
'                                class="hidden w-full mt-2 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200">\n' +
'                        </div>\n' +
'                    </div>\n' +
'                    \n' +
'                    <div class="grid md:grid-cols-2 gap-4">\n' +
'                        <div>\n' +
'                            <label for="password" class="block text-sm font-semibold text-gray-700 mb-2">\n' +
'                                访问密码\n' +
'                                <span class="text-gray-500 font-normal">（可选）</span>\n' +
'                            </label>\n' +
'                            <input id="password" type="password"\n' +
'                                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"\n' +
'                                placeholder="设置密码">\n' +
'                        </div>\n' +
'                        <div>\n' +
'                            <label for="maxVisits" class="block text-sm font-semibold text-gray-700 mb-2">\n' +
'                                最大访问次数\n' +
'                                <span class="text-gray-500 font-normal">（可选）</span>\n' +
'                            </label>\n' +
'                            <input id="maxVisits" type="number"\n' +
'                                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"\n' +
'                                placeholder="10">\n' +
'                        </div>\n' +
'                    </div>\n' +
'                </div>\n' +
'                \n' +
'                <div class="flex justify-center">\n' +
'                    ' + (TURNSTILE_SITE_KEY ?
                        '<div class="cf-turnstile" data-sitekey="' + TURNSTILE_SITE_KEY + '"></div>' :
                        '') + '\n' +
'                </div>\n' +
'                \n' +
'                <button type="submit"\n' +
'                    class="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:-translate-y-0.5 transition duration-200">\n' +
'                    生成短链接\n' +
'                </button>\n' +
'            </form>\n' +
'            \n' +
'            <div id="result" class="mt-8"></div>\n' +
'        </div>\n' +
'    </main>\n' +
'    <script>\n' +
'    document.getElementById(\'shorten-form\').addEventListener(\'submit\', async (e) => {\n' +
'      e.preventDefault();\n' +
'      \n' +
'      let token = \'\';\n' +
'      try {\n' +
'        if (typeof turnstile !== \'undefined\') {\n' +
'          token = turnstile.getResponse();\n' +
'          if (token === undefined) token = \'\';\n' +
'        }\n' +
'      } catch (error) {\n' +
'        console.error(\'Turnstile error:\', error);\n' +
'      }\n' +
'      \n' +
'      const submitButton = e.target.querySelector(\'button[type="submit"]\');\n' +
'      const resultDiv = document.getElementById(\'result\');\n' +
'      \n' +
'      // 禁用提交按钮并显示加载状态\n' +
'      submitButton.disabled = true;\n' +
'      submitButton.textContent = \'生成中...\';\n' +
'      resultDiv.innerHTML = \'\';\n' +
'      \n' +
'      try {\n' +
'        const expiry = document.getElementById(\'expiry\').value;\n' +
'        let expiryDate = null;\n' +
'        if (expiry) {\n' +
'            const now = new Date();\n' +
'            switch(expiry) {\n' +
'                case \'1h\':\n' +
'                    expiryDate = new Date(now.getTime() + 60 * 60 * 1000);\n' +
'                    break;\n' +
'                case \'24h\':\n' +
'                    expiryDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);\n' +
'                    break;\n' +
'                case \'7d\':\n' +
'                    expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);\n' +
'                    break;\n' +
'                case \'30d\':\n' +
'                    expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);\n' +
'                    break;\n' +
'                case \'custom\':\n' +
'                    expiryDate = document.getElementById(\'customExpiry\').value;\n' +
'                    break;\n' +
'            }\n' +
'        }\n' +
'        const formData = {\n' +
'            url: document.getElementById(\'url\').value,\n' +
'            slug: document.getElementById(\'slug\').value,\n' +
'            expiry: expiryDate,\n' +
'            password: document.getElementById(\'password\').value,\n' +
'            maxVisits: document.getElementById(\'maxVisits\').value,\n' +
'            token: token\n' +
'        };\n' +
'        \n' +
'        const response = await fetch(\'/api/shorten\', {\n' +
'          method: \'POST\',\n' +
'          headers: {\n' +
'            \'Content-Type\': \'application/json\'\n' +
'          },\n' +
'          body: JSON.stringify(formData)\n' +
'        });\n' +
'        \n' +
'        const data = await response.json();\n' +
'        \n' +
'        if (response.ok) {\n' +
'          resultDiv.innerHTML = \n' +
'            \'<div class="p-4 bg-green-50 rounded-lg">\' +\n' +
'            \'  <p class="text-green-800 font-medium mb-2">\' +\n' +
'            \'    短链接生成成功！\' +\n' +
'            \'  </p>\' +\n' +
'            \'  <div class="flex items-center gap-2">\' +\n' +
'            \'    <input type="text" value="\' + data.shortened + \'" readonly \' +\n' +
'            \'      class="flex-1 p-2 border border-gray-300 rounded bg-white">\' +\n' +
'            \'    <button onclick="copyToClipboard(this, \\\'\' + data.shortened + \'\\\')" \' +\n' +
'            \'      class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">\' +\n' +
'            \'      复制\' +\n' +
'            \'    </button>\' +\n' +
'            \'  </div>\' +\n' +
'            \'</div>\';\n' +
'        } else {\n' +
'          resultDiv.innerHTML = \n' +
'            \'<div class="p-4 bg-red-50 rounded-lg">\' +\n' +
'            \'  <p class="text-red-800">\' + data.error + \'</p>\' +\n' +
'            \'</div>\';\n' +
'          if (typeof turnstile !== \'undefined\') {\n' +
'            turnstile.reset();\n' +
'          }\n' +
'        }\n' +
'      } catch (error) {\n' +
'        resultDiv.innerHTML = \n' +
'          \'<div class="p-4 bg-red-50 rounded-lg">\' +\n' +
'          \'  <p class="text-red-800">生成短链接时发生错误，请重试</p>\' +\n' +
'          \'</div>\';\n' +
'        if (typeof turnstile !== \'undefined\') {\n' +
'          turnstile.reset();\n' +
'        }\n' +
'      }\n' +
'      \n' +
'      // 恢复提交按钮状态\n' +
'      submitButton.disabled = false;\n' +
'      submitButton.textContent = \'生成短链接\';\n' +
'    });\n' +
'    document.getElementById(\'expiry\').addEventListener(\'change\', function() {\n' +
'        const customExpiryInput = document.getElementById(\'customExpiry\');\n' +
'        if (this.value === \'custom\') {\n' +
'            customExpiryInput.classList.remove(\'hidden\');\n' +
'        } else {\n' +
'            customExpiryInput.classList.add(\'hidden\');\n' +
'        }\n' +
'    });\n' +
'    function copyToClipboard(button, text) {\n' +
'      navigator.clipboard.writeText(text).then(() => {\n' +
'        const originalText = button.textContent;\n' +
'        button.textContent = \'已复制!\';\n' +
'        button.classList.add(\'bg-green-500\', \'hover:bg-green-600\');\n' +
'        \n' +
'        setTimeout(() => {\n' +
'          button.textContent = originalText;\n' +
'          button.classList.remove(\'bg-green-500\', \'hover:bg-green-600\');\n' +
'          button.classList.add(\'bg-blue-500\', \'hover:bg-blue-600\');\n' +
'        }, 2000);\n' +
'      }).catch(() => {\n' +
'        button.textContent = \'复制失败\';\n' +
'        setTimeout(() => {\n' +
'          button.textContent = \'复制\';\n' +
'        }, 2000);\n' +
'      });\n' +
'    }\n' +
'    </script>\n' +
'</body>\n' +
'</html>';

  return new Response(frontendHTML, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-cache, no-store, must-revalidate"
    },
  });
}

// 新增的管理员面板
async function serveAdminPanel() {
  const adminPanelHTML = '<!DOCTYPE html>\n' +
'<html lang="zh">\n' +
'<head>\n' +
'    <meta charset="UTF-8">\n' +
'    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'    <title>短链接管理后台</title>\n' +
'    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">\n' +
'    <link rel="icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>⚙️</text></svg>">\n' +
'</head>\n' +
'<body class="bg-gray-50">\n' +
'    <div class="min-h-screen flex flex-col">\n' +
'        <header class="bg-white shadow-md">\n' +
'            <div class="container mx-auto px-4 py-4 flex justify-between items-center">\n' +
'                <h1 class="text-2xl font-bold text-gray-800">短链接管理后台</h1>\n' +
'                <div>\n' +
'                    <button id="logout-btn" class="text-gray-500 hover:text-red-500 hidden">\n' +
'                        <span class="mr-1">退出登录</span>\n' +
'                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">\n' +
'                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />\n' +
'                        </svg>\n' +
'                    </button>\n' +
'                </div>\n' +
'            </div>\n' +
'        </header>\n' +
'        \n' +
'        <main class="flex-grow container mx-auto px-4 py-8">\n' +
'            <!-- 登录表单 -->\n' +
'            <div id="login-section" class="max-w-md mx-auto">\n' +
'                <div class="bg-white rounded-lg shadow-md p-6">\n' +
'                    <h2 class="text-xl font-semibold mb-4">管理员登录</h2>\n' +
'                    <form id="login-form" class="space-y-4">\n' +
'                        <div>\n' +
'                            <label for="username" class="block text-sm font-medium text-gray-700">用户名</label>\n' +
'                            <input type="text" id="username" name="username" required\n' +
'                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">\n' +
'                        </div>\n' +
'                        <div>\n' +
'                            <label for="password" class="block text-sm font-medium text-gray-700">密码</label>\n' +
'                            <input type="password" id="password" name="password" required\n' +
'                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">\n' +
'                        </div>\n' +
'                        <button type="submit"\n' +
'                            class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">\n' +
'                            登录\n' +
'                        </button>\n' +
'                    </form>\n' +
'                    <div id="login-error" class="mt-4 text-red-500 text-sm text-center"></div>\n' +
'                </div>\n' +
'                <div class="text-center mt-4">\n' +
'                    <a href="/" class="text-indigo-600 hover:text-indigo-800">返回前台</a>\n' +
'                </div>\n' +
'            </div>\n' +
'            \n' +
'            <!-- 管理面板 -->\n' +
'            <div id="admin-panel" class="hidden">\n' +
'                <div class="bg-white rounded-lg shadow-md p-6 mb-6">\n' +
'                    <h2 class="text-xl font-semibold mb-4">短链接列表</h2>\n' +
'                    <div class="flex justify-between items-center mb-4">\n' +
'                        <div class="text-sm text-gray-500">点击短链接可查看详情</div>\n' +
'                        <button id="refresh-btn" class="flex items-center text-indigo-600 hover:text-indigo-800">\n' +
'                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">\n' +
'                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />\n' +
'                            </svg>\n' +
'                            刷新列表\n' +
'                        </button>\n' +
'                    </div>\n' +
'                    <div class="overflow-x-auto">\n' +
'                        <table class="min-w-full divide-y divide-gray-200">\n' +
'                            <thead class="bg-gray-50">\n' +
'                                <tr>\n' +
'                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">短链接</th>\n' +
'                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目标链接</th>\n' +
'                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>\n' +
'                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">到期时间</th>\n' +
'                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">访问次数</th>\n' +
'                                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>\n' +
'                                </tr>\n' +
'                            </thead>\n' +
'                            <tbody id="links-table" class="bg-white divide-y divide-gray-200">\n' +
'                                <!-- 表格内容将通过JavaScript填充 -->\n' +
'                                <tr>\n' +
'                                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">加载中...</td>\n' +
'                                </tr>\n' +
'                            </tbody>\n' +
'                        </table>\n' +
'                    </div>\n' +
'                </div>\n' +
'                \n' +
'                <!-- 分页控件 -->\n' +
'                <div id="pagination" class="flex justify-center space-x-1 my-4"></div>\n' +
'            </div>\n' +
'        </main>\n' +
'        \n' +
'        <footer class="bg-white border-t">\n' +
'            <div class="container mx-auto px-4 py-4 text-center text-gray-500 text-sm">\n' +
'                &copy; 2023 简约短链 - 管理控制台\n' +
'            </div>\n' +
'        </footer>\n' +
'    </div>\n' +
'\n' +
'    <!-- 删除确认模态框 -->\n' +
'    <div id="delete-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">\n' +
'        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">\n' +
'            <h3 class="text-lg font-semibold mb-4">确认删除</h3>\n' +
'            <p class="mb-4">确定要删除短链接 <span id="delete-slug" class="font-semibold"></span> 吗？此操作不可撤销。</p>\n' +
'            <div class="flex justify-end space-x-3">\n' +
'                <button id="cancel-delete" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">取消</button>\n' +
'                <button id="confirm-delete" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">删除</button>\n' +
'            </div>\n' +
'        </div>\n' +
'    </div>\n' +
'    \n' +
'    <script>\n' +
'        // 存储状态\n' +
'        const state = {\n' +
'            isLoggedIn: false,\n' +
'            token: \'\',\n' +
'            links: [],\n' +
'            currentPage: 1,\n' +
'            itemsPerPage: 10,\n' +
'            totalItems: 0\n' +
'        };\n' +
'        \n' +
'        // 检查是否有登录令牌\n' +
'        function checkAuth() {\n' +
'            const token = localStorage.getItem(\'admin_token\');\n' +
'            if (token) {\n' +
'                state.token = token;\n' +
'                state.isLoggedIn = true;\n' +
'                showAdminPanel();\n' +
'            } else {\n' +
'                showLoginForm();\n' +
'            }\n' +
'        }\n' +
'        \n' +
'        // 显示登录表单\n' +
'        function showLoginForm() {\n' +
'            document.getElementById(\'login-section\').classList.remove(\'hidden\');\n' +
'            document.getElementById(\'admin-panel\').classList.add(\'hidden\');\n' +
'            document.getElementById(\'logout-btn\').classList.add(\'hidden\');\n' +
'        }\n' +
'        \n' +
'        // 显示管理面板\n' +
'        function showAdminPanel() {\n' +
'            document.getElementById(\'login-section\').classList.add(\'hidden\');\n' +
'            document.getElementById(\'admin-panel\').classList.remove(\'hidden\');\n' +
'            document.getElementById(\'logout-btn\').classList.remove(\'hidden\');\n' +
'            loadLinks();\n' +
'        }\n' +
'        \n' +
'        // 加载短链接列表\n' +
'        async function loadLinks() {\n' +
'            try {\n' +
'                const response = await fetch(\'/api/links\', {\n' +
'                    method: \'GET\',\n' +
'                    headers: {\n' +
'                        \'Content-Type\': \'application/json\',\n' +
'                        \'Authorization\': \'Bearer \' + state.token\n' +
'                    }\n' +
'                });\n' +
'                \n' +
'                if (response.status === 401) {\n' +
'                    // 授权失败\n' +
'                    localStorage.removeItem(\'admin_token\');\n' +
'                    state.isLoggedIn = false;\n' +
'                    state.token = \'\';\n' +
'                    showLoginForm();\n' +
'                    document.getElementById(\'login-error\').textContent = \'会话已过期，请重新登录\';\n' +
'                    return;\n' +
'                }\n' +
'                \n' +
'                if (!response.ok) {\n' +
'                    throw new Error(\'Failed to load links\');\n' +
'                }\n' +
'                \n' +
'                const data = await response.json();\n' +
'                state.links = data.links;\n' +
'                state.totalItems = state.links.length;\n' +
'                \n' +
'                renderLinksTable();\n' +
'                renderPagination();\n' +
'            } catch (error) {\n' +
'                console.error(\'Error loading links:\', error);\n' +
'                document.getElementById(\'links-table\').innerHTML = \n' +
'                    \'<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">加载失败</td></tr>\';\n' +
'            }\n' +
'        }\n' +
'        \n' +
'        // 渲染链接表格\n' +
'        function renderLinksTable() {\n' +
'            const tableBody = document.getElementById(\'links-table\');\n' +
'            \n' +
'            if (state.links.length === 0) {\n' +
'                tableBody.innerHTML = \'<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">暂无短链接数据</td></tr>\';\n' +
'                return;\n' +
'            }\n' +
'            \n' +
'            const start = (state.currentPage - 1) * state.itemsPerPage;\n' +
'            const end = Math.min(start + state.itemsPerPage, state.totalItems);\n' +
'            const currentPageLinks = state.links.slice(start, end);\n' +
'            \n' +
'            let html = \'\';\n' +
'            \n' +
'            currentPageLinks.forEach(link => {\n' +
'                // 格式化日期\n' +
'                const createdDate = new Date(link.created).toLocaleString();\n' +
'                const expiryDate = link.expiry ? new Date(link.expiry).toLocaleString() : \'永久有效\';\n' +
'                \n' +
'                // 截断长URL\n' +
'                const shortenedUrl = link.url.length > 50 ? link.url.substring(0, 50) + \'...\' : link.url;\n' +
'                \n' +
'                html += \n' +
'                \'<tr>\' +\n' +
'                \'    <td class="px-6 py-4 whitespace-nowrap">\' +\n' +
'                \'        <a href="/\' + link.slug + \'" target="_blank" class="text-indigo-600 hover:text-indigo-900">\' + link.slug + \'</a>\' +\n' +
'                \'    </td>\' +\n' +
'                \'    <td class="px-6 py-4 whitespace-nowrap">\' +\n' +
'                \'        <a href="\' + link.url + \'" target="_blank" class="text-gray-600 hover:text-gray-900" title="\' + link.url + \'">\' +\n' +
'                \'            \' + shortenedUrl + \'\' +\n' +
'                \'        </a>\' +\n' +
'                \'    </td>\' +\n' +
'                \'    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\' + createdDate + \'</td>\' +\n' +
'                \'    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\' + expiryDate + \'</td>\' +\n' +
'                \'    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\' + (link.visits || 0) + (link.maxVisits ? \'/\' + link.maxVisits : \'\') + \'</td>\' +\n' +
'                \'    <td class="px-6 py-4 whitespace-nowrap text-sm">\' +\n' +
'                \'        <button \' +\n' +
'                \'            onclick="showDeleteConfirmation(\\\'\' + link.slug + \'\\\')" \' +\n' +
'                \'            class="text-red-600 hover:text-red-900 mr-3">删除</button>\' +\n' +
'                \'    </td>\' +\n' +
'                \'</tr>\';\n' +
'            });\n' +
'            \n' +
'            tableBody.innerHTML = html;\n' +
'        }\n' +
'        \n' +
'        // 渲染分页控件\n' +
'        function renderPagination() {\n' +
'            const paginationContainer = document.getElementById(\'pagination\');\n' +
'            const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);\n' +
'            \n' +
'            if (totalPages <= 1) {\n' +
'                paginationContainer.innerHTML = \'\';\n' +
'                return;\n' +
'            }\n' +
'            \n' +
'            let html = \'\';\n' +
'            \n' +
'            // 上一页按钮\n' +
'            html += \n' +
'                \'<button \' +\n' +
'                \'    onclick="changePage(\' + (state.currentPage - 1) + \')" \' +\n' +
'                \'    class="px-3 py-1 rounded \' + (state.currentPage === 1 ? \'text-gray-400 cursor-not-allowed\' : \'text-gray-700 hover:bg-gray-200\') + \'"\' +\n' +
'                \'    \' + (state.currentPage === 1 ? \'disabled\' : \'\') + \'>\' +\n' +
'                \'    &lt;\' +\n' +
'                \'</button>\';\n' +
'            \n' +
'            // 页码按钮\n' +
'            for (let i = 1; i <= totalPages; i++) {\n' +
'                if (i === state.currentPage) {\n' +
'                    html += \n' +
'                        \'<button \' +\n' +
'                        \'    class="px-3 py-1 rounded bg-indigo-600 text-white">\' +\n' +
'                        \'    \' + i + \'\' +\n' +
'                        \'</button>\';\n' +
'                } else {\n' +
'                    html += \n' +
'                        \'<button \' +\n' +
'                        \'    onclick="changePage(\' + i + \')" \' +\n' +
'                        \'    class="px-3 py-1 rounded text-gray-700 hover:bg-gray-200">\' +\n' +
'                        \'    \' + i + \'\' +\n' +
'                        \'</button>\';\n' +
'                }\n' +
'            }\n' +
'            \n' +
'            // 下一页按钮\n' +
'            html += \n' +
'                \'<button \' +\n' +
'                \'    onclick="changePage(\' + (state.currentPage + 1) + \')" \' +\n' +
'                \'    class="px-3 py-1 rounded \' + (state.currentPage === totalPages ? \'text-gray-400 cursor-not-allowed\' : \'text-gray-700 hover:bg-gray-200\') + \'"\' +\n' +
'                \'    \' + (state.currentPage === totalPages ? \'disabled\' : \'\') + \'>\' +\n' +
'                \'    &gt;\' +\n' +
'                \'</button>\';\n' +
'            \n' +
'            paginationContainer.innerHTML = html;\n' +
'        }\n' +
'        \n' +
'        // 分页切换\n' +
'        function changePage(page) {\n' +
'            const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);\n' +
'            if (page < 1 || page > totalPages) return;\n' +
'            \n' +
'            state.currentPage = page;\n' +
'            renderLinksTable();\n' +
'            renderPagination();\n' +
'        }\n' +
'        \n' +
'        // 显示删除确认框\n' +
'        function showDeleteConfirmation(slug) {\n' +
'            document.getElementById(\'delete-slug\').textContent = slug;\n' +
'            document.getElementById(\'delete-modal\').classList.remove(\'hidden\');\n' +
'            \n' +
'            // 设置确认删除按钮的事件\n' +
'            document.getElementById(\'confirm-delete\').onclick = () => {\n' +
'                deleteLink(slug);\n' +
'                document.getElementById(\'delete-modal\').classList.add(\'hidden\');\n' +
'            };\n' +
'        }\n' +
'        \n' +
'        // 删除短链接\n' +
'        async function deleteLink(slug) {\n' +
'            try {\n' +
'                const response = await fetch(\'/api/links/\' + slug, {\n' +
'                    method: \'DELETE\',\n' +
'                    headers: {\n' +
'                        \'Content-Type\': \'application/json\',\n' +
'                        \'Authorization\': \'Bearer \' + state.token\n' +
'                    }\n' +
'                });\n' +
'                \n' +
'                if (response.status === 401) {\n' +
'                    localStorage.removeItem(\'admin_token\');\n' +
'                    state.isLoggedIn = false;\n' +
'                    state.token = \'\';\n' +
'                    showLoginForm();\n' +
'                    document.getElementById(\'login-error\').textContent = \'会话已过期，请重新登录\';\n' +
'                    return;\n' +
'                }\n' +
'                \n' +
'                if (!response.ok) {\n' +
'                    throw new Error(\'Failed to delete link\');\n' +
'                }\n' +
'                \n' +
'                // 删除成功后，重新加载链接列表\n' +
'                loadLinks();\n' +
'                \n' +
'            } catch (error) {\n' +
'                console.error(\'Error deleting link:\', error);\n' +
'                alert(\'删除短链接失败，请重试\');\n' +
'            }\n' +
'        }\n' +
'        \n' +
'        // 事件监听器\n' +
'        document.addEventListener(\'DOMContentLoaded\', () => {\n' +
'            // 检查登录状态\n' +
'            checkAuth();\n' +
'            \n' +
'            // 登录表单提交\n' +
'            document.getElementById(\'login-form\').addEventListener(\'submit\', async (e) => {\n' +
'                e.preventDefault();\n' +
'                \n' +
'                const username = document.getElementById(\'username\').value;\n' +
'                const password = document.getElementById(\'password\').value;\n' +
'                const errorDiv = document.getElementById(\'login-error\');\n' +
'                \n' +
'                try {\n' +
'                    const response = await fetch(\'/api/admin/login\', {\n' +
'                        method: \'POST\',\n' +
'                        headers: {\n' +
'                            \'Content-Type\': \'application/json\'\n' +
'                        },\n' +
'                        body: JSON.stringify({ username, password })\n' +
'                    });\n' +
'                    \n' +
'                    const data = await response.json();\n' +
'                    \n' +
'                    if (response.ok) {\n' +
'                        state.token = data.token;\n' +
'                        state.isLoggedIn = true;\n' +
'                        localStorage.setItem(\'admin_token\', data.token);\n' +
'                        showAdminPanel();\n' +
'                        errorDiv.textContent = \'\';\n' +
'                    } else {\n' +
'                        errorDiv.textContent = data.error || \'登录失败\';\n' +
'                    }\n' +
'                } catch (error) {\n' +
'                    console.error(\'Login error:\', error);\n' +
'                    errorDiv.textContent = \'登录请求失败，请重试\';\n' +
'                }\n' +
'            });\n' +
'            \n' +
'            // 刷新按钮\n' +
'            document.getElementById(\'refresh-btn\').addEventListener(\'click\', () => {\n' +
'                loadLinks();\n' +
'            });\n' +
'            \n' +
'            // 登出按钮\n' +
'            document.getElementById(\'logout-btn\').addEventListener(\'click\', () => {\n' +
'                localStorage.removeItem(\'admin_token\');\n' +
'                state.isLoggedIn = false;\n' +
'                state.token = \'\';\n' +
'                showLoginForm();\n' +
'            });\n' +
'            \n' +
'            // 取消删除按钮\n' +
'            document.getElementById(\'cancel-delete\').addEventListener(\'click\', () => {\n' +
'                document.getElementById(\'delete-modal\').classList.add(\'hidden\');\n' +
'            });\n' +
'        });\n' +
'    </script>\n' +
'</body>\n' +
'</html>';

  return new Response(adminPanelHTML, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-cache, no-store, must-revalidate"
    },
  });
}

async function handleAPIRequest(request) {
  try {
    const { pathname } = new URL(request.url);
    
    // 管理员登录API
    if (pathname === "/api/admin/login") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "请求方法不允许" }), {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Allow": "POST"
          }
        });
      }
      
      const { username, password } = await request.json();
      
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // 生成简单的JWT令牌（实际应用中应使用更安全的方法）
        const token = btoa(JSON.stringify({
          username: username,
          exp: Date.now() + 24 * 60 * 60 * 1000 // 24小时过期
        }));
        
        return new Response(JSON.stringify({
          success: true,
          token: token
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: "用户名或密码错误"
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    
    // 获取所有链接列表（需要管理员权限）
    if (pathname === "/api/links") {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "请求方法不允许" }), {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Allow": "GET"
          }
        });
      }
      
      // 验证管理员身份
      const isAdmin = await verifyAdminToken(request);
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "未授权访问" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // 获取所有短链接
      // 注意：实际应用中，如果短链接数量很多，应该实现分页机制
      const keys = await URL_SHORT_KV.list();
      const links = [];
      
      for (const key of keys.keys) {
        const slug = key.name;
        const value = await URL_SHORT_KV.get(slug);
        
        if (value) {
          try {
            const data = JSON.parse(value);
            links.push({
              slug: slug,
              ...data
            });
          } catch (e) {
            console.error('Error parsing KV data for slug:', slug);
          }
        }
      }
      
      return new Response(JSON.stringify({ links }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // 删除链接API（需要管理员权限）
    if (pathname.startsWith("/api/links/")) {
      const slug = pathname.replace('/api/links/', '');
      
      if (request.method !== "DELETE") {
        return new Response(JSON.stringify({ error: "请求方法不允许" }), {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Allow": "DELETE"
          }
        });
      }
      
      // 验证管理员身份
      const isAdmin = await verifyAdminToken(request);
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "未授权访问" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // 检查短链接是否存在
      const exists = await URL_SHORT_KV.get(slug);
      if (!exists) {
        return new Response(JSON.stringify({ error: "短链接不存在" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      // 删除短链接
      await URL_SHORT_KV.delete(slug);
      
      return new Response(JSON.stringify({
        success: true,
        message: "短链接已删除"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (pathname === "/api/shorten") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "请求方法不允许" }), {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Allow": "POST"
          }
        });
      }
      const { url, slug, expiry, password, maxVisits, token } = await request.json();
      if (!url) {
        return new Response(JSON.stringify({ error: "请输入链接地址" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Validate URL
      try {
        new URL(url);
      } catch {
        return new Response(JSON.stringify({ error: "链接格式无效" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      // 添加最大访问次数验证
      if (maxVisits && (parseInt(maxVisits) <= 0 || isNaN(parseInt(maxVisits)))) {
        return new Response(JSON.stringify({ error: "最大访问次数必须大于0" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      // 添加自定义有效期验证
      if (expiry) {
        const expiryDate = new Date(expiry);
        const now = new Date();
        if (expiryDate <= now) {
          return new Response(JSON.stringify({ error: "有效期必须大于当前时间" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      // 移除URL检查代码，直接生成新的短链接
      const shortSlug = slug || generateSlug();
      
      // 添加自定义短链接长度验证
      if (slug && slug.length < 3) {
        return new Response(JSON.stringify({ error: "自定义链接至少需要3个字符" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      // Validate slug format
      if (!/^[a-zA-Z0-9-_]+$/.test(shortSlug)) {
        return new Response(JSON.stringify({ error: "自定义链接格式无效，只能使用字母、数字、横线和下划线" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const existing = await URL_SHORT_KV.get(shortSlug);
      if (existing) {
        return new Response(JSON.stringify({ error: "该自定义链接已被使用" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const expiryTimestamp = expiry ? new Date(expiry).getTime() : null;
      await URL_SHORT_KV.put(shortSlug, JSON.stringify({
        url,
        expiry: expiryTimestamp,
        password,
        created: Date.now(),
        maxVisits: maxVisits ? parseInt(maxVisits) : null,
        visits: 0
      }));
      const baseURL = new URL(request.url).origin;
      const shortURL = baseURL + '/' + shortSlug;
      return new Response(JSON.stringify({ shortened: shortURL }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    if (pathname.startsWith('/api/verify/')) {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "请求方法不允许" }), {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            "Allow": "POST"
          }
        });
      }
      const slug = pathname.replace('/api/verify/', '');
      const record = await URL_SHORT_KV.get(slug);
      
      if (!record) {
        return new Response(JSON.stringify({ error: "链接不存在" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      const { password: correctPassword, url, maxVisits, visits = 0 } = JSON.parse(record);
      const { password: inputPassword, token } = await request.json();
      // 验证 Turnstile token
      if (TURNSTILE_SITE_KEY && TURNSTILE_SECRET) {
        if (!token) {
          return new Response(JSON.stringify({ error: "请完成人机验证" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        const tokenValidation = await validateTurnstileToken(token);
        if (!tokenValidation.success) {
          return new Response(JSON.stringify({ error: "人机验证失败" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      if (inputPassword === correctPassword) {
        if (maxVisits) {
          const newVisits = visits + 1;
          await URL_SHORT_KV.put(slug, JSON.stringify({
            ...JSON.parse(record),
            visits: newVisits
          }));
        }
        return new Response(JSON.stringify({
          success: true,
          url: url
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: "密码错误"
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    
    return new Response(JSON.stringify({ error: "页面不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: "服务器内部错误" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// 验证管理员令牌
async function verifyAdminToken(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
      return false;
    }
    
    // 解码并验证令牌
    try {
      const decodedToken = JSON.parse(atob(token));
      
      // 检查令牌是否过期
      if (decodedToken.exp && decodedToken.exp < Date.now()) {
        return false;
      }
      
      // 验证用户名
      if (decodedToken.username !== ADMIN_USERNAME) {
        return false;
      }
      
      return true;
    } catch (e) {
      return false;
    }
  } catch (e) {
    console.error('Token verification error:', e);
    return false;
  }
}

async function handleRedirect(pathname) {
  try {
    const slug = pathname.slice(1);
    const record = await URL_SHORT_KV.get(slug);
    if (!record) {
      return new Response("链接不存在", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
    const data = JSON.parse(record);
    const { url, expiry, password, maxVisits, visits = 0 } = data;
    if (expiry && Date.now() > expiry) {
      await URL_SHORT_KV.delete(slug);
      return new Response("链接已过期", {
        status: 410,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
    if (maxVisits && visits >= maxVisits) {
      await URL_SHORT_KV.delete(slug);
      return new Response("链接访问次数已达上限", {
        status: 410,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
    // 只在没有密码保护时更新访问次数
    if (maxVisits && !password) {
      data.visits = visits + 1;
      await URL_SHORT_KV.put(slug, JSON.stringify(data));
    }
    if (password) {
      const turnstileScript = TURNSTILE_SITE_KEY ?
        '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' :
        '';
      
      const frontendHTML = '<!DOCTYPE html>\n' +
      '<html lang="zh">\n' +
      '<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>密码保护链接</title>\n' +
      '<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">\n' +
      '<link rel="icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>🔒</text></svg>">\n' +
      turnstileScript + '\n' +
      '</head>\n' +
      '<body class="bg-gray-100">\n' +
      '  <main class="container mx-auto p-4 max-w-md min-h-screen flex items-center justify-center">\n' +
      '    <div class="bg-white rounded-lg shadow-md p-6 w-full">\n' +
      '      <h1 class="text-2xl font-bold mb-6 text-center text-gray-800">密码保护链接</h1>\n' +
      '      <form id="password-form" class="space-y-4">\n' +
      '        <div>\n' +
      '          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">请输入访问码：</label>\n' +
      '          <input id="password" type="password" class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required>\n' +
      '        </div>\n' +
      '        <div class="flex justify-center">\n' +
      '          ' + (TURNSTILE_SITE_KEY ?
                  '<div class="cf-turnstile" data-sitekey="' + TURNSTILE_SITE_KEY + '"></div>' :
                  '') + '\n' +
      '        </div>\n' +
      '        <button type="submit" class="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">\n' +
      '          访问链接\n' +
      '        </button>\n' +
      '      </form>\n' +
      '      <div id="error" class="mt-4 text-red-500 text-center"></div>\n' +
      '    </div>\n' +
      '  </main>\n' +
      '  <script>\n' +
      '    document.getElementById(\'password-form\').addEventListener(\'submit\', async (e) => {\n' +
      '      e.preventDefault();\n' +
      '      const submitButton = e.target.querySelector(\'button[type="submit"]\');\n' +
      '      const inputPassword = document.getElementById(\'password\').value;\n' +
      '      const errorDiv = document.getElementById(\'error\');\n' +
      '      \n' +
      '      submitButton.disabled = true;\n' +
      '      submitButton.textContent = \'验证中...\';\n' +
      '      errorDiv.textContent = \'\';\n' +
      '      \n' +
      '      let token = \'\';\n' +
      '      try {\n' +
      '        if (typeof turnstile !== \'undefined\') {\n' +
      '          token = turnstile.getResponse();\n' +
      '        }\n' +
      '      } catch (error) {\n' +
      '        console.error(\'Turnstile error:\', error);\n' +
      '      }\n' +
      '      \n' +
      '      try {\n' +
      '        const response = await fetch(\'/api/verify/' + slug + '\', {\n' +
      '          method: \'POST\',\n' +
      '          headers: {\n' +
      '            \'Content-Type\': \'application/json\'\n' +
      '          },\n' +
      '          body: JSON.stringify({\n' +
      '            password: inputPassword,\n' +
      '            token: token\n' +
      '          })\n' +
      '        });\n' +
      '        \n' +
      '        const data = await response.json();\n' +
      '        \n' +
      '        if (data.success) {\n' +
      '          window.location.href = data.url;\n' +
      '        } else {\n' +
      '          errorDiv.textContent = "密码错误";\n' +
      '          // 重置 Turnstile\n' +
      '          if (typeof turnstile !== \'undefined\') {\n' +
      '            turnstile.reset();\n' +
      '          }\n' +
      '        }\n' +
      '      } catch (error) {\n' +
      '        errorDiv.textContent = "发生错误，请重试";\n' +
      '        // 发生错误时也重置 Turnstile\n' +
      '        if (typeof turnstile !== \'undefined\') {\n' +
      '          turnstile.reset();\n' +
      '        }\n' +
      '      } finally {\n' +
      '        submitButton.disabled = false;\n' +
      '        submitButton.textContent = \'访问链接\';\n' +
      '      }\n' +
      '    });\n' +
      '  </script>\n' +
      '</body>\n' +
      '</html>';
      
     return new Response(frontendHTML, {
        headers: {
           "Content-Type": "text/html",
          "Cache-Control": "no-cache, no-store, must-revalidate"
        },
      });
    }
    
   return Response.redirect(url, 302);
  } catch (error) {
    console.error('Redirect Error:', error);
    return new Response("服务器内部错误", {
       status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

function generateSlug(length = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function onloadTurnstileCallback() {
  console.log('Turnstile loaded successfully');
}

async function validateTurnstileToken(token) {
  try {
    const formData = new FormData();
    formData.append('secret', TURNSTILE_SECRET);
    formData.append('response', token);
    
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    return {
       success: data.success,
      error: data['error-codes']
    };
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return {
       success: false,
      error: ['验证服务器错误']
    };
  }
}
