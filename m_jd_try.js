/**
 * 京东试用， 
 * cron: 0 14 * * *
 */
const $ = new Env('京东试用');
const notify = $.isNode() ? require('./sendNotify') : '';
const jdCookieNode = $.isNode() ? require('./jdCookie.js') : '';
const { USER_AGENT } = $.isNode() ? require('./USER_AGENTS.js') : '';
const { getBaseCookie } = require('./baseCookie'); // 不生成基础Cookie请求会直接暴毙
const H5ST = $.isNode() ? require('./h5st41.js') : '';
const CryptoJS = $.isNode() ? require('crypto-js') : '';
const axios = require('axios');
const querystring = require('querystring');
let cookiesArr = [];
let activeData = [];

if ($.isNode()) {
    Object.keys(jdCookieNode).forEach((item) => { cookiesArr.push(jdCookieNode[item]) });
    if (process.env.JD_DEBUG && process.env.JD_DEBUG === 'false') console.log = () => { };
} else {
    cookiesArr = [$.getdata('CookieJD'), $.getdata('CookieJD2'), ...$.toObj($.getdata('CookiesJD') || '[]').map((item) => item.cookie)].filter((item) => !!item);
}
!(async () => {
    if (!cookiesArr[0]) {
        $.msg($.name, '【提示】请先获取京东账号一cookie\n直接使用NobyDa的京东签到获取', 'https://bean.m.jd.com/bean/signIndex.action', { 'open-url': 'https://bean.m.jd.com/bean/signIndex.action' });
        return;
    }

    for (let i = 0; i < cookiesArr.length; i++) {
        $.index = i + 1;
        $.cookie = cookiesArr[i] + getBaseCookie();
        $.nickName = $.cookie.match(/pt_pin=([^; ]+)(?=;?)/) && $.cookie.match(/pt_pin=([^; ]+)(?=;?)/)[1];
        $.UserName = decodeURIComponent($.nickName);
        $.userAgent = USER_AGENT()
        console.log(`\n*****开始【京东账号${$.index}】${$.nickName || $.UserName}*****\n`);
        if (activeData.length == 0) {
            console.log('开始获取试用列表....')
            let tabData = await getTryTabs();
            for (let i = 0; i < tabData.length; i++) {
                await getNewTryList(tabData[i]['tabId']);
                await $.wait(5000)
            }
        }
        console.log(`本次共计${activeData.length}个商品待申请，开始申请`)
        let time = 5;
        for (let i = 0; i < activeData.length; i++) {
            await tryApply(i);
            await $.wait(time * 1000)
        }
        if($.index == 10){
            console.log(`只运行前10个号，退出。。。`)
            return
        }
    }

})().catch((e) => { $.log('', `❌ ${$.name}, 失败! 原因: ${e}!`, '') }).finally(() => { $.done(); })

async function tryApply(a) {
    try {
        item = activeData[a];
        let body = await getH5st('newtry', $.nickName, 'try_apply', { 'activityId': item.trialActivityId.toString() });
        const joylog = CryptoJS.MD5(`{"activityId":${item.trialActivityId.toString()}}`, "newtryundefinedundefinedtry_applyundefined").toString().concat("*").concat(undefined); // 一个简易的，不通用的log
        body += '&x-api-eid-token=jdd03YI5TVF4GOQAGTNYWCPKHJF7IRAUORM2ERCCAM5IBUIRAOXDOQ2ZDOG6OUQDSHXFAZGDVJA3NPT2EJ5UZOSGQ4MUVTIAAAAMLJF3NNOIAAAAACBK27RMX2Z66S4X&joylog=' + joylog;
        // console.log(body)
        const { status, data } = await axios({
            url: 'https://api.m.jd.com/client.action',
            method: "POST",
            headers: {
                'Cookie': $.cookie,
                'Origin': 'https://prodev.m.jd.com',
                'Referer': 'https://prodev.m.jd.com/mall/active/3C751WNneAUaZ8Lw8xYN7cbSE8gm/index.html?ids=501188849%2C501197994&tttparams=gH3GMeyJhZGRyZXNzSWQiOjI3NDc0NTQ0MzksImRMYXQiOjAsImRMbmciOjAsImdMYXQiOiIyOS44MDY0NzQiLCJnTG5nIjoiMTIxLjU0MDQ3IiwiZ3BzX2FyZWEiOiIwXzBfMF8wIiwibGF0IjowLCJsbmciOjAsIm1vZGVsIjoiU00tRzk5ODAiLCJwb3NMYXQiOiIyOS44MDY0NzQiLCJwb3NMbmciOiIxMjEuNTQwNDciLCJwcnN0YXRlIjoiMCIsInVlbXBzIjoiMC0wLTIiLCJ1bl9hcmVhIjoiMTVfMTE1OF80NjM0M181OTM3Ny5J9&preventPV=1&forceCurrentView=1;',
                'User-Agent': $.userAgent,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: body
        });
        if (status === 200 && data) {
            // console.log(data);
            console.log(`第${a}个商品: ${item.skuTitle} ${data.message}`);
        } else {
            console.log(`第${a}个商品: ${item.skuTitle} 请求出错`);
        }
    }
    catch (e) {
        console.log(`第${a}个商品: ${item.skuTitle} 申请失败` + e);
    }
}

async function getTryTabs() {
    try {
        const { status, data } = await axios({
            url: 'https://api.m.jd.com/client.action',
            method: 'POST',
            headers: {
                Cookie: $.cookie,
                Origin: 'https://prodev.m.jd.com',
                Referer: 'https://prodev.m.jd.com/mall/active/3C751WNneAUaZ8Lw8xYN7cbSE8gm/index.html?ids=501188849%2C501197994&tttparams=gH3GMeyJhZGRyZXNzSWQiOjI3NDc0NTQ0MzksImRMYXQiOjAsImRMbmciOjAsImdMYXQiOiIyOS44MDY0NzQiLCJnTG5nIjoiMTIxLjU0MDQ3IiwiZ3BzX2FyZWEiOiIwXzBfMF8wIiwibGF0IjowLCJsbmciOjAsIm1vZGVsIjoiU00tRzk5ODAiLCJwb3NMYXQiOiIyOS44MDY0NzQiLCJwb3NMbmciOiIxMjEuNTQwNDciLCJwcnN0YXRlIjoiMCIsInVlbXBzIjoiMC0wLTIiLCJ1bl9hcmVhIjoiMTVfMTE1OF80NjM0M181OTM3Ny5J9&preventPV=1&forceCurrentView=1;',
                'User-Agent': $.userAgent,
            },
            data: querystring.stringify({
                ext: JSON.stringify({ 'prstate': 0 }),
                appid: 'newtry',
                functionId: 'try_TabSpecTabs',
                clientVersion: '12.1.0',
                client: 'wh5',
                osVersion: '13',
                networkType: 'UNKNOWN',
                body: JSON.stringify({ 'tabIds': [212, 221, 222, 223, 229, 225, 224, 226, 234, 227, 228], 'version': 2, 'previewTime': '' }),
            }),
        });

        if (status === 200 && data && data.data && data.data.tabList) {
            // console.log('获取试用TAB页信息正常');
            // printTable(data.data.tabList, {
            //   tabId: '试用类型ID',
            //   tabName: '试用类型名称',
            // });
            return data.data.tabList;
        } else {
            console.log('获取试用TAB页信息失败');
        }
    }
    catch (e) {
        console.log(e, 123);
    }
}

async function getNewTryList(tabId) {
    try {
        let body = await getH5st('newtry', $.nickName, 'try_feedsList', { 'tabId': tabId, 'page': 2, 'version': 2, 'source': 'default', 'client': 'app' });
        const { status, data } = await axios({
            url: 'https://api.m.jd.com/client.action',
            method: 'POST',
            headers: {
                'Cookie': $.cookie,
                'Origin': 'https://prodev.m.jd.com',
                'Referer': 'https://prodev.m.jd.com/mall/active/3C751WNneAUaZ8Lw8xYN7cbSE8gm/index.html?ids=501188849%2C501197994&tttparams=gH3GMeyJhZGRyZXNzSWQiOjI3NDc0NTQ0MzksImRMYXQiOjAsImRMbmciOjAsImdMYXQiOiIyOS44MDY0NzQiLCJnTG5nIjoiMTIxLjU0MDQ3IiwiZ3BzX2FyZWEiOiIwXzBfMF8wIiwibGF0IjowLCJsbmciOjAsIm1vZGVsIjoiU00tRzk5ODAiLCJwb3NMYXQiOiIyOS44MDY0NzQiLCJwb3NMbmciOiIxMjEuNTQwNDciLCJwcnN0YXRlIjoiMCIsInVlbXBzIjoiMC0wLTIiLCJ1bl9hcmVhIjoiMTVfMTE1OF80NjM0M181OTM3Ny5J9&preventPV=1&forceCurrentView=1;',
                'User-Agent': $.userAgent,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: body + '&x-api-eid-token=jdd03YI5TVF4GOQAGTNYWCPKHJF7IRAUORM2ERCCAM5IBUIRAOXDOQ2ZDOG6OUQDSHXFAZGDVJA3NPT2EJ5UZOSGQ4MUVTIAAAAMLJF3NNOIAAAAACBK27RMX2Z66S4X'
        });

        if (status === 200 && data && data.data && data.data.feedList) {
            // console.log('获取试用列表信息正常');
            // printTable(data.data.feedList, {
            //   trialActivityId: '试用活动ID',
            //   brandName: '品牌',
            //   sku: '商品ID',
            //   skuImg: '商品图片',
            //   skuTitle: '商品名称',
            //   trialPrice: '试用价格',
            //   jdPrice: '原始价格',
            //   applyNum: '已申请人数',
            //   supplyNum: '提供数量',
            // });
            let strfilter = process.env['jd_filter'] || null;
            let arrFilter = strfilter?.split('#') || [];
            for (let i = 0; i < data.data.feedList.length; i++) {
                let item = data.data.feedList[i];
                let isFilter = false;
                for (let j = 0; j < arrFilter.length; j++) {
                    if (item['skuTitle'].indexOf(arrFilter[j]) > -1 || item['trialPrice'] != '0' || item['applyState'] == 1) {
                        isFilter = true;
                        break;
                    }
                }
                if (!isFilter) {
                    activeData.push(item);
                }
            }

        } else {
            console.log('获取试用列表信息失败');
        }
    }
    catch (e) {
        console.log('获取试用列表信息失败：403');
    }
}

async function getH5st(appid, pin, functionId, body) {
    try {
        let new_H5ST = new H5ST({
            'appId': '35fa0',
            'appid': appid,
            'pin': pin,
            'clientVersion': '6.0.0',//6.0.0
            'client': 'android',
            'ua': $.userAgent,
            'version': '4.1'
        });
        // console.log(new_H5ST)
        await new_H5ST.genAlgo();
        let data = await new_H5ST.genUrlParams(functionId, body);//拼接的url参数
        return data;
    } catch {
        return ''
    }
}

function Env(t, e) { 'undefined' != typeof process && JSON.stringify(process.env).indexOf('GITHUB') > -1 && process.exit(0); class s { constructor(t) { this.env = t } send(t, e = 'GET') { t = 'string' == typeof t ? { url: t } : t; let s = this.get; return 'POST' === e && (s = this.post), new Promise((e, i) => { s.call(this, t, (t, s, r) => { t ? i(t) : e(s) }) }) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, 'POST') } } return new class { constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = 'box.dat', this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = '\n', this.startTime = (new Date).getTime(), Object.assign(this, e), this.log('', `🔔${this.name}, 开始!`) } isNode() { return 'undefined' != typeof module && !!module.exports } isQuanX() { return 'undefined' != typeof $task } isSurge() { return 'undefined' != typeof $httpClient && 'undefined' == typeof $loon } isLoon() { return 'undefined' != typeof $loon } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; const i = this.getdata(t); if (i) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise(e => { this.get({ url: t }, (t, s, i) => e(i)) }) } runScript(t, e) { return new Promise(s => { let i = this.getdata('@chavy_boxjs_userCfgs.httpapi'); i = i ? i.replace(/\n/g, '').trim() : i; let r = this.getdata('@chavy_boxjs_userCfgs.httpapi_timeout'); r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r; const [o, h] = i.split('@'), n = { url: `http://${h}/v1/scripting/evaluate`, body: { script_text: t, mock_type: 'cron', timeout: r }, headers: { 'X-Key': o, Accept: '*/*' } }; this.post(n, (t, e, i) => s(i)) }).catch(t => this.logErr(t)) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require('fs'), this.path = this.path ? this.path : require('path'); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e); if (!s && !i) return {}; { const i = s ? t : e; try { return JSON.parse(this.fs.readFileSync(i)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require('fs'), this.path = this.path ? this.path : require('path'); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : i ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r) } } lodash_get(t, e, s) { const i = e.replace(/\[(\d+)\]/g, '.$1').split('.'); let r = t; for (const t of i) if (r = Object(r)[t], void 0 === r) return s; return r } lodash_set(t, e, s) { return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t) } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ''; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, i, '') : e } catch (t) { e = '' } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, i, r] = /^@(.*?)\.(.*?)$/.exec(e), o = this.getval(i), h = i ? 'null' === o ? null : o || '{}' : '{}'; try { const e = JSON.parse(h); this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), i) } catch (e) { const o = {}; this.lodash_set(o, r, t), s = this.setval(JSON.stringify(o), i) } } else s = this.setval(t, e); return s } getval(t) { return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null } setval(t, e) { return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null } initGotEnv(t) { this.got = this.got ? this.got : require('got'), this.cktough = this.cktough ? this.cktough : require('tough-cookie'), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = (() => { })) { t.headers && (delete t.headers['Content-Type'], delete t.headers['Content-Length']), this.isSurge() || this.isLoon() ? (this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { 'X-Surge-Skip-Scripting': !1 })), $httpClient.get(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) })) : this.isQuanX() ? (this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t))) : this.isNode() && (this.initGotEnv(t), this.got(t).on('redirect', (t, e) => { try { if (t.headers['set-cookie']) { const s = t.headers['set-cookie'].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } }).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) })) } post(t, e = (() => { })) { if (t.body && t.headers && !t.headers['Content-Type'] && (t.headers['Content-Type'] = 'application/x-www-form-urlencoded'), t.headers && delete t.headers['Content-Length'], this.isSurge() || this.isLoon()) this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { 'X-Surge-Skip-Scripting': !1 })), $httpClient.post(t, (t, s, i) => { !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i) }); else if (this.isQuanX()) t.method = 'POST', this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => e(t)); else if (this.isNode()) { this.initGotEnv(t); const { url: s, ...i } = t; this.got.post(s, i).then(t => { const { statusCode: s, statusCode: i, headers: r, body: o } = t; e(null, { status: s, statusCode: i, headers: r, body: o }, o) }, t => { const { message: s, response: i } = t; e(s, i, i && i.body) }) } } time(t, e = null) { const s = e ? new Date(e) : new Date; let i = { 'M+': s.getMonth() + 1, 'd+': s.getDate(), 'H+': s.getHours(), 'm+': s.getMinutes(), 's+': s.getSeconds(), 'q+': Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + '').substr(4 - RegExp.$1.length))); for (let e in i) new RegExp('(' + e + ')').test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? i[e] : ('00' + i[e]).substr(('' + i[e]).length))); return t } msg(e = t, s = '', i = '', r) { const o = t => { if (!t) return t; if ('string' == typeof t) return this.isLoon() ? t : this.isQuanX() ? { 'open-url': t } : this.isSurge() ? { url: t } : void 0; if ('object' == typeof t) { if (this.isLoon()) { let e = t.openUrl || t.url || t['open-url'], s = t.mediaUrl || t['media-url']; return { openUrl: e, mediaUrl: s } } if (this.isQuanX()) { let e = t['open-url'] || t.url || t.openUrl, s = t['media-url'] || t.mediaUrl; return { 'open-url': e, 'media-url': s } } if (this.isSurge()) { let e = t.url || t.openUrl || t['open-url']; return { url: e } } } }; if (this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, o(r)) : this.isQuanX() && $notify(e, s, i, o(r))), !this.isMuteLog) { let t = ['', '==============📣系统通知📣==============']; t.push(e), s && t.push(s), i && t.push(i), console.log(t.join('\n')), this.logs = this.logs.concat(t) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { const s = !this.isSurge() && !this.isQuanX() && !this.isLoon(); s ? this.log('', `❗️${this.name}, 错误!`, t.stack) : this.log('', `❗️${this.name}, 错误!`, t) } wait(t) { return new Promise(e => setTimeout(e, t)) } done(t = {}) { const e = (new Date).getTime(), s = (e - this.startTime) / 1e3; this.log('', `🔔${this.name}, 结束! 🕛 ${s} 秒`), this.log(), (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t) } }(t, e) }
