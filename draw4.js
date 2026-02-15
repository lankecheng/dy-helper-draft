import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as bb from './request.cjs';

// 只开防检测，不动比特指纹（避免冲突）
const stealth = StealthPlugin();
// [
//   'chrome.csi',
//   'chrome.loadTimes',
//   'user-agent-override',
//   'webgl.vendor',
//   'navigator.hardwareConcurrency',
//   'navigator.languages',
//   'navigator.permissions',
//   'navigator.plugins',
//   'chrome.app',
//   'window.outerdimensions'
// ].forEach(e => stealth.enabledEvasions.delete(e));
stealth.enabledEvasions.clear();
stealth.enabledEvasions.add('chrome.runtime');
stealth.enabledEvasions.add('navigator.webdriver');
console.log('stealth enabledEvasions', [...stealth.enabledEvasions])

puppeteer.use(stealth);

// 工具函数（逻辑不变）
const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const randomDelay = (min = 500, max = 2000) => new Promise(resolve => setTimeout(resolve, randomNumber(min, max)));

(async () => {
  try {
    const openResp = await bb.openBrowser({
      id: 'e2c680ad33054848bf9adf14c341a9d2',
      queue: true,
      // args: [
      //   '--disable-blink-features=AutomationControlled',
      //   "--ignoreDefaultArgs: ['--enable-automation']",
      //   '--start-maximized',
      //   '--no-sandbox',
      //   '--disable-setuid-sandbox'
      // ]
    })
    // 1.连接之
    // const BITTER_WS = 'ws://127.0.0.1:49402/devtools/browser/128430d2-8b65-4c1e-aeb6-76847bbc1ea4';
    const BITTER_WS = openResp.data.ws
    const browser = await puppeteer.connect({
      browserWSEndpoint: BITTER_WS,
      defaultViewport: null,
      slowMo: 80
    });

    // 3.新建页面并配置
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    // 4. 抹掉自动化痕迹，不碰指纹
    // await page.evaluateOnNewDocument(() => {
    //   // 1. 兜底隐藏 webdriver（核心防检测）
    //   if (navigator.webdriver !== undefined) {
    //     Object.defineProperty(navigator, 'webdriver', {
    //       get: () => undefined,
    //       configurable: false,
    //       writable: false
    //     });
    //   }

    //   // 2. 模拟真实 Chrome 浏览器的 chrome 对象结构（解决 runtime 为空问题）
    //   window.chrome = window.chrome || {};

    //   // 核心：补全 chrome.runtime 真实结构（非空对象）
    //   window.chrome.runtime = window.chrome.runtime || {
    //     // 真实 Chrome 必有的基础属性（值可以为空，但属性必须存在）
    //     PlatformOs: {
    //       MAC: 'mac',
    //       WIN: 'win',
    //       ANDROID: 'android',
    //       CROS: 'cros',
    //       LINUX: 'linux',
    //       OPENBSD: 'openbsd'
    //     },
    //     lastError: null,
    //     id: '', // 空字符串而非 undefined，符合真实场景
    //     onMessage: {},
    //     onConnect: {},
    //     onInstalled: {},
    //     // 保留比特浏览器原有属性（避免覆盖）
    //     ...window.chrome.runtime
    //   };

    //   // 3. 补全 chrome.app / webstore 真实结构
    //   window.chrome.app = window.chrome.app || {
    //     isInstalled: false,
    //     InstallState: { INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
    //     RunningState: { RUNNING: 'running', CLOSED: 'closed' }
    //   };
    //   window.chrome.webstore = window.chrome.webstore || {
    //     onInstallStageChanged: {},
    //     onDownloadProgress: {}
    //   };
    // });

    // const liveUrl = 'https://live.douyin.com/12115778872';
    // await page.goto(liveUrl);
    // await page.goto('https://bot.sannysoft.com');
    await page.goto('https://www.baidu.com');
    await page.evaluate(() => {
      // 抖音特征一键自检
      console.log('===== 抖音Chrome特征自检结果 =====');
      console.log('1. webdriver:', navigator.webdriver ?? '正常(undefined)');
      console.log('2. 存在window.chrome:', !!window.chrome);
      console.log('3. 存在chrome.runtime:', !!window.chrome?.runtime);
      console.log('4. 插件数量:', navigator.plugins.length);
      console.log('5. mimeTypes数量:', navigator.mimeTypes.length);
      console.log('6. 语言:', navigator.language);
      console.log('==================================');

      const checkList = [];
      if (navigator.webdriver === true) checkList.push('❌ webdriver=true（高危）');
      if (!window.chrome) checkList.push('❌ 无window.chrome');
      if (!window.chrome?.runtime) checkList.push('❌ 无chrome.runtime');
      if (navigator.plugins.length === 0) checkList.push('❌ 插件为空');
      if (navigator.mimeTypes.length === 0) checkList.push('❌ mimeTypes为空');

      if (checkList.length === 0) {
        console.log('✅ 核心Chrome特征全正常，抖音不会识别为自动化');
      } else {
        console.log('⚠️ 被检测风险项：', checkList);
      }
    })
  } catch (error) {
    // ESM 版本建议增加全局错误捕获（生产必备）
    console.error('❌ 脚本执行出错：', error);
    process.exit(1); // 出错后退出进程
  }
})()