import puppeteer from 'puppeteer';

// 工具函数（逻辑不变）
const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const randomDelay = (min = 500, max = 2000) => new Promise(resolve => setTimeout(resolve, randomNumber(min, max)));

(async () => {
  try {
    // 1.连接之
    const BITTER_WS = 'ws://127.0.0.1:62018/devtools/browser/c42b6335-9266-46c4-a9e8-935c11f3abc0';
    const browser = await puppeteer.connect({
      browserWSEndpoint: BITTER_WS,
      defaultViewport: null,
      slowMo: 20
    });

    // 3.新建页面并配置
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    // 4. 抹掉自动化痕迹，不碰指纹
    // await page.evaluateOnNewDocument(() => {
    //   Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    //   window.chrome = window.chrome || {
    //     runtime: {},
    //     app: {},
    //     webstore: {}
    //   };
    // });

    // const liveUrl = 'https://live.douyin.com/12115778872';
    // await page.goto(liveUrl);
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