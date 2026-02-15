import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { parseDuration } from './utils.js'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const getRandomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomOffset = (n) => Math.floor(Math.random() * (n * 2 + 1)) - n;
const randomDelay = (min = 500, max = 2000) => new Promise(resolve => setTimeout(resolve, getRandomNum(min, max)));


// 初始化stealth插件，禁用可能与比特浏览器冲突的指纹修改
const stealth = StealthPlugin({
  // 禁用UA、时区等静态指纹修改（由比特浏览器接管）
  plugins: {
    // 必须保留的核心插件（隐藏自动化特征）
    hideWebdriver: true, // 修复 navigator.webdriver = true 的核心插件
    removeTestIdAttribute: true, // 移除自动化相关的 test-id 属性
    hideChromeRuntime: true, // 修复 window.chrome 异常的特征
    // 禁用与比特浏览器指纹冲突的插件（由比特浏览器接管）
    userAgentOverride: false, // 禁用UA覆盖
    navigatorLanguages: false, // 禁用语言指纹修改
    navigatorPlatform: false, // 禁用平台指纹修改
    navigatorHardwareConcurrency: false, // 禁用CPU核心数修改
    navigatorDeviceMemory: false, // 禁用设备内存修改
    timezoneOverride: false, // 补充：禁用时区修改（避免冲突）
    canvasFingerprintDefender: false, // 补充：禁用Canvas指纹修改（比特浏览器已处理）
    webglFingerprintDefender: false, // 补充：禁用WebGL指纹修改（比特浏览器已处理）
  }
});
puppeteer.use(stealth);

const run = async () => {
  // 连接比特浏览器（替换为你的调试地址）
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:56261/devtools/browser/8891aeb6-cf3a-4df2-8f26-e4104ac55d47',
    defaultViewport: null,
    slowMo: 50
  });
  const page = await browser.newPage();
  // await page.goto('https://live.douyin.com/217578759434');
  // await page.goto('https://live.douyin.com/946191148556');
  await page.goto('https://live.douyin.com/765780905502');
  // console.log(`load elapsed ${Date.now() - start} ms`)
  // await randomDelay(6000, 8000)
  await randomDelay(10000, 12000)
  // 2. 获取div的边界信息（x/y是左上角坐标，width/height是宽高）
  let divBounds
  // const selector = '.LMUtLyr9'
  const selector = '.ycjwPFJI'
  const waitForSelectorStart = Date.now()
  try {
    await page.waitForSelector(selector, { visible: true, timeout: 5000 });
    // divBounds = await page.$eval(selector, (el) => {
    //   const rect = el.getBoundingClientRect();
    //   return {
    //     x: rect.left,
    //     y: rect.top,
    //     width: rect.width,
    //     height: rect.height
    //   }
    // });
    divBounds = await page.$eval(selector, (el) => {
      return el.innerHTML
    });
    console.log('divBounds', parseDuration(divBounds))
  } catch (error) {
    console.log(`error.name=${error.name}`)
    console.log(`typeof error=${typeof error}`)
    console.log(error)
    return
  }
  console.log(`waitForSelector elapsed ${Date.now() - waitForSelectorStart}ms`)

  // 3. 计算中间20%区域的边界范围（核心调整：40%到60%）
  // 水平：左边界 = 原x + 宽度*40%，右边界 = 原x + 宽度*60%（中间20%宽度）
  // const middle20XMin = divBounds.x + divBounds.width * 0.4;
  // const middle20XMax = divBounds.x + divBounds.width * 0.6;
  // // 垂直：上边界 = 原y + 高度*40%，下边界 = 原y + 高度*60%（中间20%高度）
  // const middle20YMin = divBounds.y + divBounds.height * 0.4;
  // const middle20YMax = divBounds.y + divBounds.height * 0.6;

  // // 4. 在中间20%区域内生成随机坐标
  // const randomX = middle20XMin + Math.random() * (middle20XMax - middle20XMin);
  // const randomY = middle20YMin + Math.random() * (middle20YMax - middle20YMin);

  // // 取整：Puppeteer支持浮点数，但取整更贴近真实鼠标的像素坐标
  // const targetX = Math.round(randomX);
  // const targetY = Math.round(randomY)

  // console.log(targetX, targetY)

}


try {
  run()
} catch (error) {
  console.log('run failed', error)
}


