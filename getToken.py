import asyncio
import json
import os
import random
import re
import sys
import time
from datetime import datetime, timedelta
from urllib import parse

import aiohttp
import aioredis
from aiohttp import TCPConnector

"""
2023 /11/8 22:45
支持隧道代理 Tunnel_url
支持完成后等待时间 默认2秒  Complete_Pause
支持隧道代理403等待时间 默认30秒 Tunnel_Pause
支持是否启用代理默认启用 (感觉秒什么用给一些号特别少的人准备的开关) JD_PROXY_OPEN
隧道代理优先级高于api,设置隧道后不会调用api 
2023/11/7 21:30
修复kr 慈善家的过期时间key错误的值不同问题
pin正则表达式问题
2023/11/6 23:00
必安装依赖 aioredis aiohttp
可安装可不安装依赖 aiodns
依赖版本限制 Python 3.10 > cchardet
依赖版本限制 Python 3.10 <=  charset-normalizer
修复慈善家路径错误问题

2023/11/6 5:30
本地存储支持 M系列 KR 慈善家
远程redis普通模式支持 慈善家 环境
如果有其他库需要添加可以自己添加也可以 https://t.me/InteTU/184 留言 如果是本地存储提供本地存储路径和存储格式 如果是远程存储配合获取格式
慈善家
    不支持 JD_ISV_TOKEN_REDIS_CACHE_KEY 如果需要支持 https://t.me/InteTU/184 留言
    支持 获取JD_ISV_TOKEN_CUSTOM_CACHE 但是仅支持 .json文件
"""
# 获取 token的域名 默认是 https://lzkj-isv.isvjcloud.com
Token_url = "https://lzkj-isv.isvjcloud.com"

# 代理相关 不填写默认获取隧道代理
proxyUrl = None  # 代理API 使用socks5 \n分割 只能提取一个
user_pass = None  # 账户:密码 如果不能自动白名单建议填写

Tunnel_url = None  # 隧道代理, 如果填写隧道代理将会不获取代理api
Tunnel_Pause = 30  # 隧道代理如果403停止秒数
Complete_Pause = 2  # 成功后等待秒默认2

JD_PROXY_OPEN = 0  # 是否启动代理默认启动 非0都不启用 给家宽小白准备的

# M系列缓存Token路径 如果使用就 MCacheToken = "walle1798_EVE/tokens/"
MCacheToken = "walle1798_EVE/tokens/"

# KR系列缓存Token路径 如果使用就 KRCacheToken = "KingRan_KR/function/cache/token.json"
KRCacheToken = "KingRan_KR/function/cache/token.json"
# 慈善家 SuperManito/cishanjia库 默认读取 JD_ISV_TOKEN_REDIS_CACHE_URL
CiShanJiaToken = "SuperManito_cishanjia_main/function/cache/token.json"
# 环境redis换成
redis_url = None  # "redis://:Redis密码@127.0.0.1:6379" 默认读取 PRO_REDIS_URL 变量的

# 慈善家 SuperManito/cishanjia库 支持格式 优先慈善家变量后环境变量
if redis_url is None:
    redis_url = os.environ.get('JD_ISV_TOKEN_REDIS_CACHE_URL', None)
    if redis_url is None:
        redis_url = os.environ.get('PRO_REDIS_URL', None)

# 如果是 0 = JD_SIGN_API 1 =  JD_SIGN_KRAPI 2 = M_API_SIGN_URL
state = 0
# 获取Sign
JD_SIGN = os.environ.get("JD_SIGN_API", None)
if JD_SIGN is None:
    JD_SIGN = os.environ.get("JD_SIGN_KRAPI", None)
    state = 1
    if JD_SIGN is None:
        JD_SIGN = os.environ.get("M_API_SIGN_URL", None)
        state = 2
        if JD_SIGN is None:
            print("没有请填写 sign获取地址 JD_SIGN_API | JD_SIGN_KRAPI | M_API_SIGN_URL")
            sys.exit()

Father_path = re.findall(f"(.*?/scripts/)", os.path.abspath(__file__))[0]
# 自动识别
dirlist = os.listdir(Father_path)
if "walle1798_EVE" in dirlist:
    MCacheToken = Father_path + MCacheToken
    print("识别到M系列Token 存放目录是: ", MCacheToken)
if "KingRan_KR" in dirlist:
    KRCacheToken = Father_path + KRCacheToken
    print("识别到KR Token 存放文件是: ", KRCacheToken)
if "SuperManito_cishanjia_main" in dirlist:
    CiShanJiaToken = Father_path + CiShanJiaToken
    print("识别到慈善家 Token 存放文件是: ", CiShanJiaToken)
# 获取慈善家是否设置了 JD_ISV_TOKEN_CUSTOM_CACHE
if os.environ.get("JD_ISV_TOKEN_CUSTOM_CACHE", None) is not None:
    CiShanJiaToken = os.environ.get("JD_ISV_TOKEN_CUSTOM_CACHE", None)
    # 判断是否可RK一样
    if CiShanJiaToken == KRCacheToken:
        CiShanJiaToken = None


#

class Proxy:
    def __init__(self, url=None, user_pass=None, redis_url=None, Tunnel_url=None):
        self.proxies = None
        self.url = url
        self.user_pass = user_pass
        self.new_time = None
        self.headers = {
            "Connection": "keep-alive",
            "User-Agent": f"okhttp/3.{random.uniform(7, 16)}.{random.uniform(1, 16)};jdmall;android;version/12.0.{random.uniform(1, 16)};build/{random.uniform(1, 100000)};",
            "Charset": "UTF-8",
            "Cache-Control": "no-cache",
        }
        self.redisConn = None
        self.redis_url = redis_url
        self.Tunnel_url = Tunnel_url

    async def getproxy(self):
        for i in range(0, 3):
            resp = await fetch_url_with_proxy(url=self.url, headers=self.headers)
            if resp is None:
                continue
            if resp["status"] != 200:
                print(f"获取代理状态码: {resp['status']} 原因 {resp['data']} 延迟一秒等待")
                # 延迟一秒
                await asyncio.sleep(1)
            else:
                ip = str(resp['data']).rstrip('\n')
                if self.user_pass:
                    self.proxies = f"socks5://{self.user_pass}@{ip}"
                else:
                    self.proxies = f"socks5://{ip}"
                current_time = datetime.now()
                self.new_time = current_time + timedelta(seconds=40)
                print(f"获取新代理: {self.proxies}")
                return

    async def redis(self):
        if self.redis_url is None:
            print("没有配置获取到redis不尝试重新连接")
            return
        try:
            self.redisConn = aioredis.from_url(self.redis_url)
        except aioredis.exceptions.ConnectionError as e:
            print("redis链接地址不通")

    async def use_proxy(self):
        """
        获取使用的代理
        :return:
        :rtype:
        """
        if JD_PROXY_OPEN != 0:
            return None
        if self.url is not None:
            if proxy.new_time < datetime.now():
                print("代理超过40秒主动切换")
                await proxy.getproxy()
                return self.proxies
        else:
            return self.Tunnel_url


proxy = Proxy(url=proxyUrl, user_pass=user_pass, redis_url=redis_url, Tunnel_url=Tunnel_url)


async def fetch_url_with_proxy(url, headers=None, data=None, proxy=None):
    try:
        async with aiohttp.ClientSession(connector=TCPConnector(ssl=False)) as session:
            async with session.post(url=url, headers=headers, data=data, proxy=proxy, ssl=False, timeout=30) as response:
                print("获取状态码返回", response.status)
                return {
                    "status": response.status,
                    "data": await response.text()
                }
    except Exception as e:
        print(e)
        return None


async def get_cookies():
    """
    获取CK
    :return:
    :rtype:
    """
    return os.environ["JD_COOKIE"].split('&')


async def get_sign(functionId, body):
    global headers, data
    if state == 0 or state == 2:
        headers = {"Content-Type": "application/json"}
        data = json.dumps({
            "fn": functionId,
            "functionId": functionId,
            "body": body
        })
    elif state == 1:
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        # 将 JSON 对象转换为 JSON 字符串
        data = {
            "fn": functionId,
            "functionId": functionId,
            "body": json.dumps(body),
        }
    resp = await fetch_url_with_proxy(url=JD_SIGN, headers=headers, data=data)
    if resp is None:
        return None
    if resp["status"] != 200:
        print("sign出现异常", resp["status"])
        return None
    resp_json = json.loads(resp["data"])
    if "body" in resp_json:
        return resp_json["body"]
    elif "data" in resp_json:
        return resp_json["data"]["body"]
    return None


async def gettoken(ck):
    for i in range(0, 3):
        try:
            headers = {
                "X-Rp-Client": "android_3.0.0",
                "Connection": "keep-alive",
                "User-Agent": f"okhttp/3.{random.uniform(7, 16)}.{random.uniform(1, 16)};jdmall;android;version/12.0.{random.uniform(1, 16)};build/{random.uniform(1, 100000)};",
                "X-Referer-Package": "com.jingdong.app.mall",
                "Charset": "UTF-8",
                "X-Referer-Page": "com.jingdong.app.mall.WebActivity",
                "Accept-Encoding": "br,gzip,deflate",
                "Cache-Control": "no-cache",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Host": "api.m.jd.com",
                "Cookie": ck
            }
            functionId = "isvObfuscator"
            data = {"id": "", "url": Token_url}
            sign = await get_sign(functionId, data)
            if sign is None:
                continue
            url = f"https://api.m.jd.com/client.action?functionId={functionId}&{sign}"
            resp = await fetch_url_with_proxy(url, headers, f"body={parse.quote(json.dumps(data))}",
                                              proxy=await proxy.use_proxy())
            if resp is None:
                continue
            if resp["status"] != 200:
                if resp["status"] == 403:
                    if proxy.Tunnel_url is None:
                        print("代理超过403了切换代理")
                        await proxy.getproxy()
                    else:
                        # 隧道代理停止秒
                        await asyncio.sleep(Tunnel_Pause)
                continue
            resp_json = json.loads(resp["data"])
            if resp_json["code"] == "0" and resp_json["errcode"] == 0:
                return resp_json['token']
            print("isvObfuscator 接口发生异常: ", resp_json)
        except Exception as e:
            print("isvObfuscator 接口发生异常: ", e)
    return None


async def m_token(pin, token):
    """
    M系列缓存
    :param pin:
    :type pin:
    :param token:
    :type token:
    :return:
    :rtype:
    """
    if MCacheToken is None:
        return
    var = {"expireTime": int(time.time() * 1000) + 1500000, "token": token}
    with open(f"{MCacheToken}{pin}.json", "w", encoding="utf-8") as f:
        json.dump(var, f)
    print(f"M系列缓存 {pin} 的token 成功")


async def kr_token(path_token, KR):
    if path_token is None:
        return
    try:
        with open(path_token, "w", encoding="utf-8") as f:
            json.dump(KR, f)
        print(f"{path_token} 路径缓存 的token 成功")
    except Exception as e:
        print(f"{path_token} 路径缓存 的token 发生异常: ", e)


async def main_async():
    token_Path = [KRCacheToken, CiShanJiaToken]
    KR = {}
    # 获取代理
    await proxy.getproxy()
    # 链接redis
    await proxy.redis()
    cks = await get_cookies()
    if cks is None:
        return
    for ck in cks:
        token = await gettoken(ck)
        if token is None:
            print("获取次数过多跳过获取, ", ck)
            continue
        pt_pin_match = re.search(r'pin=(.*?);', ck).group(1)
        # 写入开始
        await m_token(pt_pin_match, token)
        # 记录KR
        KR[f"{pt_pin_match}"] = {"expires": int(time.time() * 1000) + 1500000,
                                 "val": token}
        # 环境的开始实现
        if proxy.redisConn is not None:
            try:
                await proxy.redisConn.set(pt_pin_match, token)
                await proxy.redisConn.expire(pt_pin_match, 1500)
                print(f"redis {pt_pin_match}缓存 {token} 成功")
            except Exception as e:
                print("写入redis失败: ", e)
        # 完成任务等待时间
        await asyncio.sleep(Complete_Pause)
    for path_token in token_Path:
        await kr_token(path_token, KR)
    if proxy.redisConn is not None:
        await proxy.redisConn.close()


if __name__ == '__main__':
    asyncio.run(main_async())
