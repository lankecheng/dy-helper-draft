/* 每次都会重新打开浏览器, 重新收集信息 */
import log4js from 'log4js';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { openBrowser, closeBrowser } from './request.cjs';

//const TARGET_URL = 'https://www.bilibili.com'
const PAGE_URL_LIVE = 'https://live.douyin.com'; //抖音直播主站
const API_URL_FEED = 'https://live.douyin.com/webcast/feed/'
const API_URL_ME = 'https://live.douyin.com/webcast/user/me/'
const CONTAINER_ID = '#_douyin_live_scroll_container_'

let failCounter = 0

log4js.configure({
  appenders: {
    console: { type: 'console' } //控制台输出器
  },
  categories: {
    default: { appenders: ['console'], level: 'info' } //默认分类，info 及以上级别输出
  }
});
const logger = log4js.getLogger();

const feedRequestInfo = {
  url: 'https://live.douyin.com/webcast/feed/',
  params: new Map([
    ['aid', '6383'],
    ['app_name', 'douyin_web'],
    ['live_id', '1'],
    ['device_platform', 'web'],
    ['language', 'zh-CN'],
    ['enter_from', 'link_share'],
    ['cookie_enabled', 'true'],
    ['screen_width', '1920'],
    ['screen_height', '1080'],
    ['browser_language', 'zh-CN'],
    ['browser_platform', 'Win32'],
    ['browser_name', 'Chrome'],
    ['browser_version', '140.0.0.0'],
    ['channel', 'channel_pc_web'],
    ['request_tag_from', 'web'],
    ['need_map', '1'],
    ['liveid', '1'],
    ['is_draw', '1'],
    ['inner_from_drawer', '0'],
    ['custom_count', '8'],
    ['action', 'load_more'],
    ['action_type', 'loadmore'],
    ['enter_source', 'web_homepage_hot_web_live_card'],
    ['source_key', 'web_homepage_hot_web_live_card'],
  ]),
  headers: {
    'accept-language': 'zh-CN,zh;q=0.9',
    'referer': 'https://live.douyin.com/',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin'
  }
}
const worker_filepath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bdms-wrapper.cjs')

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const getRandomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomOffset = (n) => Math.floor(Math.random() * (n * 2 + 1)) - n;
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

/**
 * 解析URL查询参数为Map对象
 * @param {string} url 待解析的URL字符串
 * @returns {Map<string, string>} 解析后的参数Map（键=参数名，值=参数值，已解码）
 */
function parseUrlParamsToMap(url) {
  const paramsStr = url.split('?')[1] || '';
  const paramsArr = paramsStr.split('&');
  const paramsMap = new Map();
  paramsArr.forEach(item => {
    //按=分割键和值，maxSplit=1避免值中包含=的情况（如token）
    const [key, value = ''] = item.split('=', 2);
    //过滤空键（如&结尾导致的空项）
    if (key) {
      paramsMap.set(key, decodeURIComponent(value));
    }
  });
  return paramsMap;
}

function buildUrl(url, defaultParams, actualParams, extraParams) {
  const finalParams = Array.from(defaultParams, ([key, value]) => {
    const actualValue = actualParams.get(key)
    return `${key}=${encodeURIComponent(actualValue ? actualValue : value)}`
  })
  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      finalParams.push(`${key}=${encodeURIComponent(value)}`);
    });
  }
  return `${url}?${finalParams.join('&')}`
}

function interceptRequest(page, baseUrl, rs) {
  page.on('request', async (request) => {
    const requestUrl = request.url()
    if (requestUrl.startsWith(baseUrl)) {
      rs.url = requestUrl
      rs.headers = request.headers()
    }
  })
}

function interceptResponse(page, baseUrl, rs) {
  page.on('response', async (response) => {
    const url = response.url()
    if (url.startsWith(baseUrl)) {
      // logger.info('捕获目标接口', url);
      const responseData = await response.json();
      rs.meResponse = responseData;
    }
  })
}

function interceptRequestPromise(page, baseUrl) {
  return new Promise((resolve, reject) => {
    page.on('request', async (request) => {
      const requestUrl = request.url()
      if (requestUrl.startsWith(baseUrl)) {
        logger.info('intercept request', requestUrl)
        resolve({ url: requestUrl, headers: request.headers() })
      }
    })
  })
}

function interceptResponsePromise(page, baseUrl) {
  return new Promise((resolve, reject) => {
    page.on('response', async (response) => {
      const responseUrl = response.url()
      if (responseUrl.startsWith(baseUrl)) {
        logger.info('intercept response', responseUrl)
        resolve(await response.json())
      }
    })
  })
}

async function actionLikeHuman(page, times = 3, points = 50) {
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const maxX = (viewport.width || 1920) - 100;
  const maxY = (viewport.height || 1080) - 100;
  const minX = 50;
  const minY = 50;

  for (let i = 0; i < times; i++) {
    // 随机起始点、终点
    const start = { x: Math.floor(Math.random() * (maxX - minX)) + minX, y: Math.floor(Math.random() * (maxY - minY)) + minY };
    const end = { x: Math.floor(Math.random() * (maxX - minX)) + minX, y: Math.floor(Math.random() * (maxY - minY)) + minY };
    // 随机2个贝塞尔控制点（生成平滑曲线）
    const cp1 = { x: start.x + randomOffset(200), y: start.y + randomOffset(200) };
    const cp2 = { x: end.x + randomOffset(200), y: end.y + randomOffset(200) };
    // 移动到起始点，随机停顿
    await page.mouse.move(start.x, start.y);
    await delay(Math.floor(Math.random() * 200) + 50);
    // 生成贝塞尔曲线的所有采样点
    const path = generateBezierCurve(start, cp1, cp2, end, points);
    // 随机总滑动时间：500-2000ms（单次滑动的总时长）
    const totalTime = Math.floor(Math.random() * 1500) + 500;
    const stepTime = totalTime / points; // 每个采样点的移动时间
    // 沿曲线平滑移动，实现变速+曲线轨迹
    for (let j = 0; j < path.length; j++) {
      const { x, y } = path[j];
      // 速度随机偏移：±20%的步长时间，实现变速
      await page.mouse.move(x, y, { delay: Math.floor(stepTime * (0.8 + Math.random() * 0.4)) });

      // 偶发操作1：10%概率停顿100-200ms
      if (Math.random() < 0.1) await randomDelay(100, 200);
      // 偶发操作2：8%概率触发滚轮上下滚动（±50像素）
      if (Math.random() < 0.08) {
        await page.mouse.wheel({ deltaY: Math.random() > 0.5 ? 50 : -50 });
      }
      // 偶发操作3：15%概率触发鼠标左键轻击（无实际点击效果，仅模拟动作）
      // if (Math.random() < 0.15) {
      //   await page.mouse.down({ button: 'left' });
      //   await delay(50);
      //   await page.mouse.up({ button: 'left' });
      // }
    }
    // 滑动结束后，随机停顿300-800ms
    await delay(Math.floor(Math.random() * 500) + 300);
  }
}

// 工具函数：生成三阶贝塞尔曲线采样点
function generateBezierCurve(start, cp1, cp2, end, numPoints) {
  const points = [];
  for (let t = 0; t <= 1; t += 1 / numPoints) {
    const x = Math.pow(1 - t, 3) * start.x + 3 * Math.pow(1 - t, 2) * t * cp1.x + 3 * (1 - t) * Math.pow(t, 2) * cp2.x + Math.pow(t, 3) * end.x;
    const y = Math.pow(1 - t, 3) * start.y + 3 * Math.pow(1 - t, 2) * t * cp1.y + 3 * (1 - t) * Math.pow(t, 2) * cp2.y + Math.pow(t, 3) * end.y;
    // 增加随机偏移，让曲线更不规则
    points.push({ x: x + randomOffset(5), y: y + randomOffset(5) });
  }
  return points;
}

async function findLotteryRooms(browserId) {
  const res = await openBrowser({
    id: browserId,
    args: [
      '--disable-blink-features=AutomationControlled', //反检测核心, 禁用Chrome自动化控制特征
      '--no-first-run', //禁用首次运行提示
      '--no-default-browser-check', //禁用默认浏览器检查,
      //'--disable-images', //关闭图片加载（大幅减少请求量，可选）
      //'--disable-media-stream', //关闭非核心媒体流（可选）
    ],
    loadExtensions: false,
  })
  if (res && res.success) {
    logger.info(`browser ${browserId} opened`)
  } else {
    logger.info(`browser ${browserId} failed to open`)
    return
  }
  const browser = await puppeteer.connect({
    browserWSEndpoint: res.data.ws,
    headless: 'new',
    defaultViewport: null, //禁用默认视口，使用比特浏览器的原生窗口大小（更真实）
    ignoreHTTPSErrors: true, //忽略HTTPS错误（避免证书问题阻塞访问）
    slowMo: 100, //放慢操作速度（50ms），模拟真人点击/输入
  })
  try {
    return await findLotteryRoomsHelp(browser)
  } finally {
    await closeBrowser(browserId)
    logger.info(`browser ${browserId} closed`)
  }
}

async function findLotteryRoomsHelp(browser) {
  let pages = await browser.pages() ?? [];
  pages.forEach(p => antiDetectConfig(p))

  const { params, headers, cookie, xmst } = await interceptMeRequest(browser)
  const feedRequestUrl = buildUrl(feedRequestInfo.url, feedRequestInfo.params, params, { a: '123', b: '456' })
  //console.log(feedRequestUrl)
  const feedRequestHeaders = Object.assign(Object.assign({}, feedRequestInfo.headers), headers)
  feedRequestHeaders.cookie = cookie
  //console.log('feedRequestHeaders', feedRequestHeaders)
  const worker = new Worker(worker_filepath, { workerData: { xmst, userAgent: feedRequestHeaders['user-agent'] } });
  const bogusPromise = new Promise((resolve, reject) => {
    worker.on('message', async (msg) => {
      logger.info('process receive abogus', msg);
      resolve(msg)
    });
  })
  worker.on('error', (err) => logger.error('子线程执行错误：', err));
  worker.on('exit', (code) => logger.info(`子线程退出，码值：${code}`))
  worker.postMessage(feedRequestUrl)

  logger.info('await bogusPromise, start')
  const bogus = await bogusPromise
  if (!bogus) {
    throw new Error('bogus is empty')
  }
  logger.info('await bogusPromise, finish')
  logger.info('bogus', bogus)
  //停留一小段时间, 模拟人为操作

  logger.info('doFeedRequest, start')
  const feedResp = await doFeedRequest(feedRequestUrl, xmst, bogus, feedRequestHeaders)
  logger.info('doFeedRequest, finish')
  const rooms = feedResp?.status_code == 0 && feedResp?.data ? search4LotteryRooms(feedResp.data) : []
  return rooms
}

async function interceptMeRequest(browser) {
  let page = await findPage(browser, PAGE_URL_LIVE);
  let [requestPromise, responsePromise] = [null, null]
  if (page) {
    await page.bringToFront();
    // interceptRequest(page, API_URL_ME, rs)
    // interceptResponse(page, API_URL_ME, rs)
    requestPromise = interceptRequestPromise(page, API_URL_ME)
    responsePromise = interceptResponsePromise(page, API_URL_ME)
    try {
      await page.reload({ waitUntil: 'networkidle2' });
      logger.info('page.reload done')
    } catch (error) {
      error.message = `reload live page | ${error.message}`
      logger.error(error.message)
    }
  } else {
    page = await browser.newPage();
    await antiDetectConfig(page);
    // interceptRequest(page, API_URL_ME, rs)
    // interceptResponse(page, API_URL_ME, rs)
    requestPromise = interceptRequestPromise(page, API_URL_ME)
    responsePromise = interceptResponsePromise(page, API_URL_ME)
    try {
      await page.goto(PAGE_URL_LIVE, { waitUntil: 'networkidle2', timeout: 8000 });
      logger.info('page.goto done')
    } catch (error) {
      error.message = `goto live page | ${error.message}`
      logger.error(error.message)
    }
  }
  //模拟自然人的滑动轨迹
  logger.info('human action start')
  await actionLikeHuman(page);
  logger.info('human action finish')
  // while (true) {
  //   logger.info('check rs.meResponse', rs.meResponse != undefined && rs.meResponse != null)
  //   if (rs.meResponse) {
  //     break;
  //   }
  //   await delay(100)
  // }

  logger.info('await requestPromise, start')
  const rs = await Promise.race([
    requestPromise,
    new Promise((_, reject)=> setTimeout(reject('await requestPromise timeout'), 5000))
  ])
  // const rs = Object.assign({}, await requestPromise)
  logger.info('await requestPromise, finish')

  logger.info('await responsePromise, start')
  // rs.responseData = await responsePromise
  rs.responseData = await Promise.race([
    responsePromise,
    new Promise((_, reject)=> setTimeout(reject('await responsePromise timeout'), 5000))
  ])
  logger.info('await responsePromise, finish')

  const params = parseUrlParamsToMap(rs.url)
  params.delete('msToken')
  params.delete('a_bogus')
  //console.log('params', params)

  logger.info('get cookie, start')
  const allCookies = await page.cookies('https://live.douyin.com');
  logger.info('get cookie, finish')
  const cookieStr = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
  //console.log(cookieStr)

  logger.info('get xmst, start')
  const xmst = await page.evaluate(() => {
    return window.localStorage.getItem('xmst') || '无xmst';
  });
  logger.info('get xmst, finish')

  return { params, headers: rs.headers, cookie: cookieStr, xmst }
}

async function doFeedRequest(feedRequestUrl, xmst, bogus, feedRequestHeaders) {
  const encodedMsToken = encodeURIComponent(xmst);
  const encodedABogus = encodeURIComponent(bogus);
  const targetUrl = `${feedRequestUrl}&msToken=${encodedMsToken}&a_bogus=${encodedABogus}`;
  logger.info('feed url', targetUrl)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const resp = await fetch(targetUrl, {
      method: 'GET',
      headers: feedRequestHeaders,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }
    const respText = await resp.text();
    if (!respText) {
      logger.info('feed headers', feedRequestHeaders)
      logger.info(`feed response body: [${respText}]`)
      failCounter++
      return
    }
    return JSON.parse(respText);
  } catch (err) {
    console.log(`failed to request ${targetUrl}`, err)
  }
}

function search4LotteryRooms(data) {
  if (!data?.length) {
    return []
  }
  const rooms = []
  for (const item of data) {
    const itemData = item.data
    if (itemData && itemData.others?.web_enter_benefit_point_data?.has_ongoing_lottery) {
      rooms.push({ id: itemData.id_str, rid: item.web_rid })
    }
  }
  return rooms
}

const id = 'e2c680ad33054848bf9adf14c341a9d2' //5 - 用户3663746679451
//const id = '080ec903cf7e4531aef8e37bf392028c' //1 - 1205猪
//const id = 'dcf763e52fe642f1a6b0c862c1d2de5d' //46 - test1
// const id = '433e686ef62b46259f87c06b0ec02ded' //72 - test2
//const id = '89531bdba0e1462db4157a2e3a81f4ba' //73 - test3
for (let i = 0; i < 10000000000; i++) {
  logger.info(`gonna attemt ${i + 1}`)
  try {
    const rooms = await findLotteryRooms(id)
    logger.info('found rooms', rooms.length, JSON.stringify(rooms))
  } catch (error) {
    logger.error('found rooms failed', error)
  }
  if (failCounter > 6) {
    logger.info(`exit cause failed ${failCounter}`)
    break
  }
  await randomDelay(8000, 20000)
}