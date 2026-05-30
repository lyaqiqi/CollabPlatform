// 必须第一行加载环境变量
require('./config/env');

const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket/index');
const { PORT } = require('./config/env');

const httpServer = http.createServer(app);

// 初始化 Socket.io
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
