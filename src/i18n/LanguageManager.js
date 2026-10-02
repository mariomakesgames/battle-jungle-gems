export const LANGUAGES = [
    { code: 'zh-CN', label: '简体中文' },
    { code: 'en', label: 'English' },
    { code: 'vi', label: 'Tiếng Việt' }
];

const messages = {
    'zh-CN': {
        start: '开始游戏', language: '语言', settings: '设置', pause: '暂停',
        music: '音乐', sound: '音效', continue: '继续', restart: '重新开始', quit: '返回地图',
        connect: '连接 Facebook', play: '开始', stage: '第 {level} 关', moves: '剩余步数', score: '分数', missions: '目标',
        loading: '加载中 {percent}%', loadingShop: '商店加载中…', error: '出错了，请重试。',
        soldOut: '已售罄', purchaseSuccess: '购买成功！', notEnoughCoins: '金币不足！',
        alreadyPurchased: '已购买此物品！', rewardSuccess: '领取成功！', tickets: '转盘券',
        lives: '生命', coins: '金币', spin: '转一转', selectAll: '全选', sendAll: '全部赠送',
        victory: '胜利！', defeat: '再试一次', shop: '商店', friends: '好友', level: '等级'
    },
    en: {
        start: 'START', language: 'Language', settings: 'Settings', pause: 'Paused',
        music: 'Music', sound: 'Sound', continue: 'Continue', restart: 'Restart', quit: 'Back to map',
        connect: 'Connect Facebook', play: 'Play', stage: 'Stage {level}', moves: 'Moves', score: 'Score', missions: 'Missions',
        loading: 'Loading {percent}%', loadingShop: 'Loading shop…', error: 'Error. Please try again.',
        soldOut: 'Sold out', purchaseSuccess: 'Purchase successful!', notEnoughCoins: 'Not enough coins!',
        alreadyPurchased: 'Already purchased!', rewardSuccess: 'Reward collected!', tickets: 'Spin tickets',
        lives: 'Lives', coins: 'Coins', spin: 'Spin', selectAll: 'Select all', sendAll: 'Send all',
        victory: 'Victory!', defeat: 'Try again', shop: 'Shop', friends: 'Friends', level: 'Level'
    },
    vi: {
        start: 'BẮT ĐẦU', language: 'Ngôn ngữ', settings: 'Cài đặt', pause: 'Tạm dừng',
        music: 'Nhạc', sound: 'Âm thanh', continue: 'Tiếp tục', restart: 'Chơi lại', quit: 'Về bản đồ',
        connect: 'Kết nối Facebook', play: 'Chơi', stage: 'Màn {level}', moves: 'Lượt đi', score: 'Điểm', missions: 'Mục tiêu',
        loading: 'Đang tải {percent}%', loadingShop: 'Đang tải cửa hàng…', error: 'Có lỗi xảy ra. Vui lòng thử lại!',
        soldOut: 'Đã bán hết', purchaseSuccess: 'Mua thành công!', notEnoughCoins: 'Không đủ coin để mua item này!',
        alreadyPurchased: 'Item này đã được mua rồi!', rewardSuccess: 'Nhận thưởng thành công!', tickets: 'Vé quay',
        lives: 'Mạng', coins: 'Xu', spin: 'Quay', selectAll: 'Chọn tất cả', sendAll: 'Gửi tất cả',
        victory: 'Chiến thắng!', defeat: 'Thử lại', shop: 'Cửa hàng', friends: 'Bạn bè', level: 'Cấp'
    }
};

const STORAGE_KEY = 'jungle-gems-language';
export function resolveLanguage(value) {
    const code = String(value || '').toLowerCase();
    if (code.startsWith('zh')) return 'zh-CN';
    if (code.startsWith('vi')) return 'vi';
    return 'en';
}

class LanguageManager {
    constructor() {
        let saved;
        try { saved = globalThis.localStorage?.getItem(STORAGE_KEY); } catch { /* Private browsing. */ }
        this.language = LANGUAGES.some(item => item.code === saved)
            ? saved : resolveLanguage(globalThis.navigator?.language);
        this.listeners = new Set();
        this.updateDocument();
    }

    t(key, params = {}) {
        const template = messages[this.language]?.[key] ?? messages.en[key] ?? key;
        return template.replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match);
    }

    setLanguage(code) {
        if (!LANGUAGES.some(item => item.code === code)) return false;
        this.language = code;
        try { globalThis.localStorage?.setItem(STORAGE_KEY, code); } catch { /* Still switch in memory. */ }
        this.updateDocument();
        for (const listener of this.listeners) listener();
        return true;
    }

    updateDocument() {
        if (globalThis.document) document.documentElement.lang = this.language;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

export default new LanguageManager();
