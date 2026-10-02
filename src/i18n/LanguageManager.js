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
        victory: '胜利！', defeat: '再试一次', shop: '商店', friends: '好友', level: '等级',
        aiDuel: 'AI 对战', duelYou: '你', duelAI: 'AI', duelRound: '第 {round} / {total} 轮',
        duelYourTurn: '你的回合', duelAIThinking: 'AI 正在思考…', duelSwaps: '本回合还可交换 {count} 次',
        duelRules: '每回合 2 次有效交换，10 轮后比较总分。\n交换形成 4 连、5 连或 T/L 形匹配，奖励 1 次；每次交换最多奖励 1 次。',
        duelBonus: '特殊匹配！额外奖励 1 次交换', duelWin: '你赢了！', duelLose: 'AI 获胜',
        duelDraw: '平局！', duelFinalScore: '你 {player} : {ai} AI', duelBack: '返回'
    },
    en: {
        start: 'START', language: 'Language', settings: 'Settings', pause: 'Paused',
        music: 'Music', sound: 'Sound', continue: 'Continue', restart: 'Restart', quit: 'Back to map',
        connect: 'Connect Facebook', play: 'Play', stage: 'Stage {level}', moves: 'Moves', score: 'Score', missions: 'Missions',
        loading: 'Loading {percent}%', loadingShop: 'Loading shop…', error: 'Error. Please try again.',
        soldOut: 'Sold out', purchaseSuccess: 'Purchase successful!', notEnoughCoins: 'Not enough coins!',
        alreadyPurchased: 'Already purchased!', rewardSuccess: 'Reward collected!', tickets: 'Spin tickets',
        lives: 'Lives', coins: 'Coins', spin: 'Spin', selectAll: 'Select all', sendAll: 'Send all',
        victory: 'Victory!', defeat: 'Try again', shop: 'Shop', friends: 'Friends', level: 'Level',
        aiDuel: 'Play vs AI', duelYou: 'You', duelAI: 'AI', duelRound: 'Round {round} / {total}',
        duelYourTurn: 'Your turn', duelAIThinking: 'AI is thinking…', duelSwaps: '{count} swaps left this turn',
        duelRules: '2 valid swaps per turn. Highest score after 10 rounds wins.\nSwap to make 4+, T or L matches: +1 swap, at most once per swap.',
        duelBonus: 'Special match! +1 swap', duelWin: 'You win!', duelLose: 'AI wins',
        duelDraw: 'Draw!', duelFinalScore: 'You {player} : {ai} AI', duelBack: 'Back'
    },
    vi: {
        start: 'BẮT ĐẦU', language: 'Ngôn ngữ', settings: 'Cài đặt', pause: 'Tạm dừng',
        music: 'Nhạc', sound: 'Âm thanh', continue: 'Tiếp tục', restart: 'Chơi lại', quit: 'Về bản đồ',
        connect: 'Kết nối Facebook', play: 'Chơi', stage: 'Màn {level}', moves: 'Lượt đi', score: 'Điểm', missions: 'Mục tiêu',
        loading: 'Đang tải {percent}%', loadingShop: 'Đang tải cửa hàng…', error: 'Có lỗi xảy ra. Vui lòng thử lại!',
        soldOut: 'Đã bán hết', purchaseSuccess: 'Mua thành công!', notEnoughCoins: 'Không đủ coin để mua item này!',
        alreadyPurchased: 'Item này đã được mua rồi!', rewardSuccess: 'Nhận thưởng thành công!', tickets: 'Vé quay',
        lives: 'Mạng', coins: 'Xu', spin: 'Quay', selectAll: 'Chọn tất cả', sendAll: 'Gửi tất cả',
        victory: 'Chiến thắng!', defeat: 'Thử lại', shop: 'Cửa hàng', friends: 'Bạn bè', level: 'Cấp',
        aiDuel: 'Đấu với AI', duelYou: 'Bạn', duelAI: 'AI', duelRound: 'Vòng {round} / {total}',
        duelYourTurn: 'Lượt của bạn', duelAIThinking: 'AI đang suy nghĩ…', duelSwaps: 'Còn {count} lần đổi trong lượt',
        duelRules: 'Mỗi lượt 2 lần đổi hợp lệ. Sau 10 vòng, điểm cao hơn thắng.\nĐổi tạo chuỗi 4+, chữ T/L: +1 lần đổi, tối đa một lần mỗi nước.',
        duelBonus: 'Ghép đặc biệt! +1 lần đổi', duelWin: 'Bạn thắng!', duelLose: 'AI thắng',
        duelDraw: 'Hòa!', duelFinalScore: 'Bạn {player} : {ai} AI', duelBack: 'Quay lại'
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
