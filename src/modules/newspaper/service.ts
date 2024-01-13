import fs from "fs";
import dayjs from "dayjs";
import path from "path";

import {AxiosInstance} from "axios";

import {IWechatConfig} from "#/config";
import base_wechat from "#wechat/base_wechat";
import serviceFactory from "#/alapi/request";

import {IMorningNewspaperConfig} from "./config";
import {LocalWechatMessageProcessService} from "#wechat/message_processor/processor/local_processor";

export const serviceCode = path.basename(__dirname);

// let configList;
// try {
//     configList = config.get(`modules.${ path.basename(__dirname) }`) as IMorningNewspaperConfig[];
// } catch(error) {
//     console.warn(`获取模块配置 modules.${ path.basename(__dirname) } 出错！`)
//     throw error;
// }

interface NewspaperData {
    date: string
    news: string[]
    weiyu: string
    image: string
    head_image: string
}

function newspaperDataFormat(newspaper: NewspaperData): string {
    let theNewsDay = dayjs(newspaper.date, 'YYYY-MM-DD').format('YYYY年MM月DD日');
    return `【📰】今天是 ${ theNewsDay }，60 秒了解世界。\n ${ newspaper.news.join('\n') }\n${ newspaper.weiyu }`
}

class NewspaperService extends LocalWechatMessageProcessService {
    public readonly handleNext = false;
    serviceConfig: IMorningNewspaperConfig;
    service: AxiosInstance;
    serviceCode: string = serviceCode;
    constructor(clientConfig: IWechatConfig, config: IMorningNewspaperConfig) {
        super(clientConfig, config);
        this.serviceConfig = config;
        this.service = serviceFactory.createService(config);
    }

    async canProcess(message: base_wechat): Promise<boolean> {
        return this.simpleMessageProcessorTest(message, ["新闻"]);
    }

    replyMessage(message: base_wechat): Promise<string | null> {
        return this.getNewspaperString();
    }
    getServiceName(): string {
        return "早间新闻服务";
    }

    getUsage(): string {
        return "回复关键字 新闻"
    }

    getLocalCache(date: string): NewspaperData | undefined {
        if (this.serviceConfig.localFileName === undefined) {
            return;
        }
        return JSON.parse(fs.readFileSync(`./data/${this.serviceConfig.localFileName}_${date}.json`, 'utf8')) as NewspaperData;
    }

    saveLocalCache(newspaper: NewspaperData) {
        if (this.serviceConfig.localFileName === undefined) {
            return;
        }
        try {
            fs.writeFileSync(`./data/${this.serviceConfig.localFileName}_${newspaper.date}.json`, JSON.stringify(newspaper));
        } catch (err) {
            console.error(err);
        }
    }

    async getNewspaperString(): Promise<string> {
        let content;
        try {
            let localData = this.getLocalCache(dayjs().format('YYYY-MM-DD'));
            if (localData !== undefined) {
                content = newspaperDataFormat(localData);
            }
        } catch (e) {
            console.log("新闻：本地无缓存");
        }

        try {
            let newspaper = await this.service.get<NewspaperData>('zaobao');
            this.saveLocalCache(newspaper.data)
            content = newspaperDataFormat(newspaper.data);
        } catch (e) {
            let errMsg = (e as Error).message;
            content = errMsg;
        }

        if (content === undefined) {
            content = "还没有新闻呢"
        }
        return content;
    }
}

export function register(wechatConfig: IWechatConfig, chatgptConfig: IMorningNewspaperConfig): NewspaperService {
    return new NewspaperService(wechatConfig, chatgptConfig);
}
// const serviceList: BaseWechatMessageProcessService[] = configList.map(c => new NewspaperService(config.get("wechat_server") as IWechatConfig, c));
// export default serviceList;
