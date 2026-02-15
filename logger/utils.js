import log4js from 'log4js';

export const isChildProcess = !!process.send;
// console.log(`isChildProcess=${isChildProcess}`)

const commonLoggerConfig = {
  appenders: {
    console: {
      type: 'console',
      layout: { type: 'colored' }
    }
  },
  categories: {
    default: {
      appenders: ['console'],
      level: 'debug'
    }
  },
  disableClustering: false
}

if (isChildProcess) {
  // 集群子进程：仅声明slave模式
  // log4js.configure({ slave: true, disableClustering: false });
  log4js.configure({
    ...commonLoggerConfig,
    slave: true,
    disableClustering: false
  });
} else {
  log4js.configure({
    ...commonLoggerConfig,
    master: true,
    disableClustering: false
  });
}

export const logger = log4js.getLogger();

export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
export const getRandomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const randomDelay = (min = 500, max = 2000) => new Promise(resolve => setTimeout(resolve, getRandomNum(min, max)));

