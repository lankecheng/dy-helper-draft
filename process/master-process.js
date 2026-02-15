import { fork } from 'child_process';
import { logger } from '../logger/utils.js';
import path from 'path';
import { fileURLToPath } from 'url';

// 创建ESM子进程
const child = fork(path.join(path.dirname(fileURLToPath(import.meta.url)), 'worker-process.js'));

// 连续发送3条不同条件的消息（按顺序：1→2→3）
child.send({ type: 'task', id: 1, data: '任务1-读取文件' });
child.send({ type: 'task', id: 2, data: '任务2-请求接口' });
child.send({ type: 'task', id: 3, data: '任务3-处理数据' });

// 监听子进程回复
child.on('message', (res) => {
  logger.info(`主进程收到回复：${res.msg}`);
});

// 监听子进程退出
child.on('exit', (code) => {
  logger.info(`子进程退出，码：${code}`);
});