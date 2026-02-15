import puppeteer from 'puppeteer'
import { openBrowser } from './request.js'

//const TARGET_URL = 'https://www.bilibili.com'
const PAGE_URL_LIVE = 'https://live.douyin.com'; //抖音直播主站
const API_URL_FEED = 'https://live.douyin.com/webcast/feed'
const CONTAINER_ID = '#_douyin_live_scroll_container_'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const getRandomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDelay = (min = 500, max = 2000) => new Promise(resolve => setTimeout(resolve, getRandomNum(min, max)));

//反检测核心函数：封装所有Puppeteer特征屏蔽逻辑
async function antiDetectConfig(page) {
  //核心中的核心：屏蔽 Puppeteer 最关键的 webdriver 特征（可视化模式也必须留）
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    //清理 Puppeteer 专属的全局变量（可视化模式仍会存在，需删除）
    delete window.__puppeteer_evaluation_script__;
  });
  await page.setCacheEnabled(true); //启用缓存，贴合真人浏览器
}

async function findPage(_browser, targetUrl) {
  const [targetUrl1, targetUrl2] = targetUrl.endsWith('/')
    ? [targetUrl.substring(0, targetUrl.length - 1), targetUrl]
    : [targetUrl, `${targetUrl}/`]
  for (const p of await _browser.pages()) {
    const pageUrl = await p.evaluate(() => window.location.href);
    if (pageUrl === targetUrl1 || pageUrl === targetUrl2) {
      return p
    }
  }
  return undefined
}

async function interceptRequest(page, baseUrl, rs) {
  return new Promise((resolve, reject) => {
    page.on('request', request => {
      const requestUrl = request.url()
      if (!rs.url && requestUrl.startsWith(baseUrl)) {
        console.log(new Date() + '> set window.stopScroll=true')
        page.evaluate(() => {
          window.stopScroll = true
          console.log(new Date() + '> set window.stopScroll=true')
        });
        console.log(`> url=${requestUrl}`)
        console.log(`> headers=${JSON.stringify(request.headers())}`)
        rs.url = requestUrl
        rs.headers = request.headers()
        console.log('rs', rs)
        request.continue()
        resolve()
        // reslove({ url: requestUrl, headers: request.headers() })
      } else {
        request.continue()
      }
    })
  })
}

/**
 * 模拟自然人操作，将指定ID的滚动容器滚动到底部（核心：先慢后快非匀速，防检测拉满，兼容viewport null）
 * @param {puppeteer.Page} page - Puppeteer的page实例
 * @param {string} containerId - 滚动容器的ID选择器（如#_hot_scroll_container_）
 * @returns {Promise<void>}
 */
async function scrollLikeHuman(page, containerId, scrollStartTime, timeout = 5000) {
  //1.模拟自然人：滚动前随机分步移动鼠标，加思考停顿
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const pageWidth = viewport.width || 1920;
  const pageHeight = viewport.height || 1080;
  const randomX = Math.floor(Math.random() * (pageWidth - 200)) + 100; //左右留100px边距，避免出界
  const randomY = Math.floor(Math.random() * (pageHeight - 200)) + 100; //上下留100px边距
  await page.mouse.move(randomX, randomY, { steps: Math.floor(Math.random() * 10) + 5 }); //5-15步分步移动，避免瞬移
  await delay(Math.random() * 400 + 100); //100-500ms随机思考延时
  //2.无限滚动+快慢随机+10秒超时+容器内footer可见检测
  await page.evaluate(async (id, _scrollStartTime, _timeout) => {
    //🔴 按要求获取：指定容器内的footer
    const container = document.querySelector(id);
    if (!container) throw new Error(`滚动失败：容器${id}不存在`);
    //配置项：10秒超时（单位：毫秒）、快慢滚参数（基于容器高度动态计算，适配不同容器）
    const containerHeight = container.clientHeight;
    //慢滚/快滚 步长范围（基于容器高度，比固定像素更贴合真人）
    const SLOW_STEP = [Math.floor(containerHeight / 15), Math.floor(containerHeight / 8)];  //慢：容器1/15 ~ 1/8
    const FAST_STEP = [Math.floor(containerHeight / 8), Math.floor(containerHeight / 4)];   //快：容器1/8 ~ 1/4
    //慢滚/快滚 延时范围（毫秒）
    const SLOW_DELAY = [100, 250];  //慢滚：100-250ms
    const FAST_DELAY = [30, 120];   //快滚：30-120ms

    const getRandomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    //防死循环：记录上一次滚动位置，检测是否滚动到位
    let lastScrollTop = container.scrollTop;
    //无限循环滚动：直到footer可见/超时/滚动位置不变
    while (true) {
      if (window.stopScroll) {
        console.log(new Date() + '> detect stopScroll=true')
        break
      }; // 请求触发，立即退出
      if (Date.now() - _scrollStartTime > _timeout) {
        // throw new Error(`scroll timeout ${_timeout}ms`)  //超时退出
        break
      }
      //快慢随机滚动（50%概率，可调整概率）
      const isFast = Math.random() > 0.5;
      //随机生成当前滚动的步长和延时
      const scrollStep = getRandomNum(...(isFast ? FAST_STEP : SLOW_STEP));
      const scrollDelay = getRandomNum(...(isFast ? FAST_DELAY : SLOW_DELAY));
      // console.log(`scrollStep=${scrollStep} scrollDelay=${scrollDelay}`)
      container.scrollTop += scrollStep; //执行滚动：累加步长，不做过度滚动
      await new Promise(resolve => setTimeout(resolve, scrollDelay)); //等待延时，模拟真人滚动节奏
      //核心检测：footer是否可见，可见则立即停止滚动（触发加载）
      //防无效滚动：若滚动位置未变化（已到容器极限），直接终止
      if (container.scrollTop === lastScrollTop) {
        // throw new Error(`容器${id}滚动位置未变化，已到极限，停止滚动`)
        break
      }
      lastScrollTop = container.scrollTop;
    }
  }, containerId, scrollStartTime, timeout);
  //3.模拟自然人：滚动完成后轻微调整鼠标，加短暂停顿
  await page.mouse.move(
    randomX + Math.floor(Math.random() * 50) - 25,
    randomY + Math.floor(Math.random() * 50) - 25,
    { steps: 3 }
  );
  await delay(Math.random() * 200 + 100);
}

const id = 'e2c680ad33054848bf9adf14c341a9d2'
//const id = '080ec903cf7e4531aef8e37bf392028c'
let res = await openBrowser({
  id,
  args: [
    '--disable-blink-features=AutomationControlled', //反检测核心, 禁用Chrome自动化控制特征
    '--no-first-run', //禁用首次运行提示
    '--no-default-browser-check' //禁用默认浏览器检查
  ],
  loadExtensions: false,
})
console.log('------------------------------------------------')
console.log(res)
console.log('------------------------------------------------')
if (res && res.success) {
  console.log('open successfully')
}

const browser = await puppeteer.connect({
  browserWSEndpoint: res.data.ws,
  defaultViewport: null, //禁用默认视口，使用比特浏览器的原生窗口大小（更真实）
  ignoreHTTPSErrors: true, //忽略HTTPS错误（避免证书问题阻塞访问）
  slowMo: 100, //放慢操作速度（50ms），模拟真人点击/输入
})

let pages = await browser.pages() ?? [];
console.log('当前页面数', pages.length)
pages.forEach(p => antiDetectConfig(p))

async function interceptFeedRequest(_browser, currentAttempt) {
  const page = await findPage(_browser, PAGE_URL_LIVE);
  if (page) {
    await page.bringToFront();
    await page.reload({ waitUntil: 'networkidle2' });
  } else {
    page = await _browser.newPage();
    await antiDetectConfig(page);
    await page.goto(PAGE_URL_LIVE, { waitUntil: 'networkidle2' });
  }

  const rs = {}
  await page.evaluate(() => {
    window.stopScroll = false
  });
  await page.setRequestInterception(true)
  const scrollStartTime = Date.now();
  const requestPromise = interceptRequest(page, API_URL_FEED, rs)
  const scrollPromise = scrollLikeHuman(page, CONTAINER_ID, scrollStartTime)
  await Promise.race([requestPromise, scrollPromise])
  return rs
}

const finalResult = await interceptFeedRequest(browser, 1)
console.log('finalResult', finalResult)

//try {
//  //2.获取比特浏览器的活动页面，若无则新建页面

//  //2.检测是否已有抖音直播页面


//  //3.无则新建页面打开，有则选中并刷新（避免页面缓存）
//  if (!page) {
//    page = await browser.newPage();
//    //await targetPage.setRequestInterception(true);
//    //await targetPage.setViewport(VIEWPORT);
//    //targetPage.on('request', async (request) => {
//    ////继续请求，不阻塞页面加载
//    //await request.continue();
//    //});

//    //await page.setRequestInterception(true);
//    //page.on('request', (request) => {
//    //  console.log(`> ${request.url()}`)
//    //  //const requestUrl = request.url()
//    //  //if (requestUrl.startsWith(FEED_API)) {
//    //  //    console.log(`> url=${requestUrl}`)
//    //  //    console.log(`> headers=${JSON.stringify(request.headers())}`)
//    //  //}
//    //  request.continue()
//    //})

//    const start = new Date().getTime()
//    await page.goto(PAGE_URL_HOME, { waitUntil: 'networkidle2' });
//    await antiDetectConfig(page);
//    //await targetPage.goto(TARGET_URL, { waitUntil: 'load', timeout: 0 });
//    console.log(`open ${PAGE_URL_HOME} done, elapsed ${new Date().getTime() - start}`)
//  } else {
//    await page.bringToFront(); //选中页签
//    //await page.setRequestInterception(true); //开启请求拦截
//    //page.on('request', (request) => {
//    //  console.log(`> ${request.url()}`)
//    //  //const requestUrl = request.url()
//    //  //if (requestUrl.startsWith(FEED_API)) {
//    //  //    console.log(`> url=${requestUrl}`)
//    //  //    console.log(`> headers=${JSON.stringify(request.headers())}`)
//    //  //}
//    //  request.continue()
//    //})
//    const start = new Date().getTime()
//    try {
//      await page.reload({ waitUntil: 'networkidle2' });
//    } catch (error) {
//      console.log('error', error)
//      console.log('error.name', error.name)
//      console.log('error.message', error.message)
//      console.log('typeof(error)', typeof (error))
//    }
//    console.log(`reload ${PAGE_URL_HOME} done, elapsed ${new Date().getTime() - start}`)
//  }

//  await delay(Math.random() * 400 + 100);

//  const viewport = await page.evaluate(() => ({ width: window.innerHeight, height: window.innerHeight }))
//  console.log('viewport', viewport)



//  // page.on('response', (response) => {
//  //  console.log(`< response.url=${response.url()}`)
//  //  //const requestUrl = response.request().url()
//  //  //if (requestUrl.startsWith(FEED_API)) {
//  //  //  const resData = await response.json();
//  //  //  console.log(`< request.url=${requestUrl}`)
//  //  //  console.log(`< response.url=${response.url()}`)
//  //  //  console.log(`< ${response.ok()} ${response.status()}`)
//  //  //  console.log(`< data=${resData}`)
//  //  //}
//  // })

//  await scroll2BottomLikeHuman(page, '#_douyin_live_scroll_container_')

//  //const isContainerBottom = await page.evaluate((id) => {
//  //  const container = document.querySelector(id);
//  //  return container ? (container.scrollHeight - container.scrollTop - container.clientHeight) <= 0 : false;
//  //}, containerId);
//  //console.log(`滚动完成，容器${containerId}是否触底：${isContainerBottom}`);

//  //console.log(`width=${await targetPage.viewport.width} height=${await  targetPage.viewport.height}`)

//  //const pageTimeZone = await targetPage.evaluate(() => {
//  //return Intl.DateTimeFormat().resolvedOptions().timeZone;
//  //});
//  //console.log('页面当前时区：', pageTimeZone);
//  //const chromeApp = await targetPage.evaluate(() => {
//  //return window.chrome.app;
//  //});
//  //console.log('chromeApp:', chromeApp);


//  ////执行滚动：滚动10次，每次滚动800像素，间隔1秒（可根据需求调整）
//  //await scrollDown(10, 800, 1000);

//  //5.下滑页面，触发webcast/feed接口请求（模拟用户操作）
//  //console.log('🔄 正在下滑页面触发接口请求...');
//  //const scrollContainerSelector = '#_douyin_live_scroll_container_';
//  //await targetPage.waitForSelector(scrollContainerSelector, {
//  //timeout: 10000, //超时时间10s，可根据页面调整
//  //visible: true //确保容器可见
//  //});
//  //await targetPage.evaluate((s) => {
//  //const container = document.querySelector(s);
//  ////const container = document.querySelector('#_douyin_live_scroll_container_');
//  //container.scrollTop = 2000
//  ////window.scrollTo(0, document.body.scrollHeight / 2);
//  //}, scrollContainerSelector);



//  //await targetPage.evaluate(() => {
//  ////抖音live.douyin.com的feed流滚动容器固定选择器
//  //const scrollContainer = document.querySelector('.webcast-feed-scroller');
//  //if (scrollContainer) {
//  ////方式1：相对当前位置下滑500px（更贴合用户手动滑动）
//  //scrollContainer.scrollTop += 500;
//  ////方式2：滑到容器中部（和你原逻辑一致），二选一即可
//  ////scrollContainer.scrollTop = scrollContainer.scrollHeight / 2;
//  //} else {
//  //console.warn('未找到抖音滚动容器，尝试默认body滚动');
//  //window.scrollTo(0, document.body.scrollHeight / 2);
//  //}
//  //});
//  ////抖音直播页专属滚动：操作真实的feed流滚动容器，下滑500px（可调整）
//  //console.log('✅ 成功下滑页面触发接口请求');
//  ////等待接口请求完成（最多等待10秒，避免无限等待）
//  //await waitForCapture(captureData, 10000);
//  ////6.获取localStorage中的xmst值
//  //console.log('🔍 正在获取localStorage.xmst...');
//  //captureData.xmst = await targetPage.evaluate(() => {
//  //return window.localStorage.getItem('xmst') || null;
//  //});
//  //if (!captureData.xmst) {
//  //console.warn('⚠️  localStorage中未找到xmst值');
//  //}
//  ////7.打印捕获信息
//  //console.log('📌 捕获结果预览：', {
//  //xmst: captureData.xmst,
//  //hasApiData: !!captureData.requestHeaders
//  //});
//} catch (err) {
//  console.error(err)
//}