import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';


const url = 'https://live.douyin.com/webcast/feed/?aid=6383&app_name=douyin_web&live_id=1&device_platform=web&language=en-US&enter_from=link_share&cookie_enabled=true&screen_width=2560&screen_height=1440&browser_language=en-US&browser_platform=MacIntel&browser_name=Chrome&browser_version=144.0.0.0&channel=channel_pc_web&request_tag_from=web&need_map=1&liveid=1&is_draw=1&inner_from_drawer=0&custom_count=8&action=load_more&action_type=loadmore&enter_source=web_homepage_hot_web_live_card&source_key=web_homepage_hot_web_live_card'
const xmst = 'zSx6jxpQMlh2sh1qZvidI4AmtELbnIYKx4kt7XGtMWmpQKwAr6j1iurHvxx2X_EWrxTeLwCRCNBes4BP9rp1ggaZTrJoE8u8qJJfr4OVdSAULROAbz27LM2mXJ4-xad1nfoD8IKIU-s1q7GOvK8muOt4OBj9cAEbJpl_Ov_B2ift1A=='
const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
// const rs = getFeedBogus(url, xmst, userAgent)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const worker = new Worker(path.join(__dirname, 'bdms-wrapper.cjs'), { workerData: { url, xmst, userAgent } });
// 监听子线程的消息
worker.on('message', (msg) => {
  console.log('process receive:', msg);
});

// 监听子线程错误
worker.on('error', (err) => {
  console.error('子线程执行错误：', err);
});

// 监听子线程退出
worker.on('exit', (code) => {
  if (code !== 0) {
    console.error(`子线程退出，码值：${code}`);
  }
});

// console.log('###################################')
// console.log(rs)