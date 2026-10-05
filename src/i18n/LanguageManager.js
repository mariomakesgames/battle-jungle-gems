export const LANGUAGES = [
    { code: 'zh-CN', label: '简体中文' },
    { code: 'en', label: 'English' },
    { code: 'vi', label: 'Tiếng Việt' }
];

const messages = {
    'zh-CN': {
        start: '开始游戏', language: '语言', settings: '设置', pause: '暂停',
        beautyMode: '美女图鉴', beautyIntro: '消除宝石，逐步揭开写真。\n过关后收藏完整图片，再挑战下一张。',
        beautyGarden: '林间晨光', beautySunset: '落日花园', beautyCity: '都市夜色',
        beautyCoast: '海岸微风', beautyForest: '绿林漫步', beautyMeadow: '花田午后', beautyAutumn: '金色秋日',
        beautyBlossom: '樱花时节', beautySnow: '冬日雪景', beautyStarlight: '星空之夜',
        beautyPreviousPage: '上一页', beautyNextPage: '下一页', beautyPage: '{page} / {total}',
        beautyLevelGoal: '目标 {score} 分 · {moves} 次有效交换', beautyCollected: '已收藏', beautyReady: '待挑战',
        beautyLocked: '先通关第 {level} 张', beautyView: '查看图片', beautyChallenge: '开始揭图',
        beautyCollectionCount: '已收藏 {count} / {total} 张', beautySaveHint: '已解锁图片可在图鉴中重看。',
        beautyScore: '得分 {score} / {target}', beautyMoves: '剩余 {count} 步', beautyRevealProgress: '图片已揭开 {percent}%',
        beautyRules: '消除得分越多，图片揭开越多。\n连锁和特殊宝石加速揭图；无效交换不扣步数。',
        beautyHint: '提示交换', beautyUnlocked: '写真解锁！', beautyNext: '挑战下一张', beautyAlbum: '返回图鉴',
        beautyReplay: '重新挑战', beautyAllCollected: '全部收藏完成', beautyFailed: '步数用完了',
        beautyTryAgain: '再试一次，连锁和特殊宝石能更快揭图。', beautyImageError: '图片加载失败，请重试。',
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
        duelDraw: '平局！', duelFinalScore: '你 {player} : {ai} AI', duelBack: '返回',
        duelTutorial: '玩法教学', duelTutorialStep: '第 {step} / {total} 步',
        duelTutorialNext: '下一步', duelTutorialSkip: '跳过引导', duelTutorialPlay: '继续对战',
        duelTutorialIntroTitle: '一起学会 AI 对战',
        duelTutorialIntroBody: '你和 AI 共用同一棋盘，轮流操作。\n每回合有 2 次有效交换机会。',
        duelTutorialSwapTitle: '先试一次普通三消',
        duelTutorialSwapBody: '交换黄色框中的两颗宝石，让上方的 3 颗红宝石连成一行。',
        duelTutorialBonusTitle: '特殊匹配奖励机会',
        duelTutorialBonusBody: '再交换黄色框中的宝石，凑出 4 连。\n4 连、5 连或 T/L 形匹配可奖励 1 次交换。',
        duelTutorialAITitle: '现在看 AI 的回合',
        duelTutorialAIBody: '正式对战中，你用完机会后轮到 AI。\n棋盘变暗时不能操作，等它恢复亮度再继续。',
        duelTutorialFinishTitle: '准备好对战了！',
        duelTutorialFinishBody: '双方打满 10 轮后，总分高者获胜。\n连锁得分归当前操作者；无效交换不扣次数。',
        duelTutorialPractice: '这是练习棋盘，放心试试。',
        duelTutorialGesture: '可依次点击两颗宝石，也可拖动交换。',
        duelTutorialNoScore: '教学过程不计入正式比分。',
        duelTutorialSwapDone: '三消成功！机会从 2 次变成 1 次。',
        duelTutorialBonusDone: '4 连成功！用 1 次、奖 1 次，仍剩 1 次。',
        duelTutorialAIDone: 'AI 也要消耗机会，特殊匹配同样能获奖励。',
        duelTutorialAICounter: 'AI 本回合还可交换 {count} 次',
        onlineDuel: '双人联机', onlineHost: '房主', onlineGuest: '好友', onlineHostYou: '房主（你）', onlineGuestYou: '好友（你）',
        onlineTheirTurn: '对方的回合', onlineLose: '对方获胜', onlineFinalScore: '房主 {player} : {ai} 好友',
        onlineRules: '两人轮流，每回合 2 次有效交换，10 轮后比总分。\n特殊匹配奖励 1 次；轮到对方时棋盘变暗。',
        onlineRematch: '再来一局', onlineRematchHint: '双方都点击“再来一局”即可重开。', onlineWaitingRematch: '等待对方同意重开…',
        linkIntro: '邀请一位好友，共用棋盘轮流对战。\n两人需要各自打开游戏，并交换连接码。',
        linkChoose: '选择创建对战或加入好友。', linkCreate: '创建对战', linkJoin: '加入好友',
        linkGenerating: '正在生成连接码…', linkConnecting: '正在建立连接…', linkConnect: '连接好友', linkMakeReply: '生成回复码',
        linkHostSteps: '① 把你的邀请连接码发给好友。\n② 好友加入后会生成回复码，把它粘贴到下方，再点击“连接好友”。',
        linkGuestSteps: '① 粘贴房主发来的邀请连接码。\n② 生成回复码并发回房主，等房主确认后自动进入对战。',
        linkInviteOutput: '发给好友的邀请连接码', linkReplyOutput: '发回房主的回复码',
        linkInviteInput: '粘贴房主的邀请连接码', linkReplyInput: '粘贴好友的回复码', linkPaste: '在这里粘贴完整连接码',
        linkPasteInvite: '粘贴邀请连接码后生成回复。', linkSendInvite: '邀请码已就绪，请发给好友。', linkSendReply: '回复码已就绪，请发回房主。',
        linkCopy: '复制连接码', linkCopied: '已复制，请发给对方。', linkCopyManual: '已选中连接码，请手动复制。',
        linkInvalidCode: '连接码不正确，请确认粘贴了完整的对应连接码。', linkFailed: '连接未成功，请重试或重新创建对战。',
        linkUnsupported: '此浏览器不支持联机，请使用较新的浏览器并通过 HTTPS 打开游戏。', linkConfigError: '联机配置有误，请联系游戏管理员。',
        linkDisconnected: '连接已中断，暂时无法操作。可等待恢复或返回重新连接。', linkWaitingSync: '等待对方连接或同步…',
        linkBackLobby: '返回连接', linkNetworkHelp: '连接成功后会自动进入对战。若一直连不上，可换个网络重试。'
    },
    en: {
        start: 'START', language: 'Language', settings: 'Settings', pause: 'Paused',
        beautyMode: 'Portrait gallery', beautyIntro: 'Match gems to reveal each portrait.\nClear its goal to collect it and unlock the next.',
        beautyGarden: 'Morning in the garden', beautySunset: 'Golden-hour garden', beautyCity: 'City at twilight',
        beautyCoast: 'Ocean breeze', beautyForest: 'Woodland stroll', beautyMeadow: 'Wildflower afternoon', beautyAutumn: 'Golden autumn',
        beautyBlossom: 'Cherry blossom season', beautySnow: 'Winter wonderland', beautyStarlight: 'Under the stars',
        beautyPreviousPage: 'Previous', beautyNextPage: 'Next', beautyPage: '{page} / {total}',
        beautyLevelGoal: 'Goal: {score} points · {moves} valid swaps', beautyCollected: 'Collected', beautyReady: 'Ready to play',
        beautyLocked: 'Clear portrait {level} first', beautyView: 'View portrait', beautyChallenge: 'Start revealing',
        beautyCollectionCount: 'Collected {count} / {total}', beautySaveHint: 'Revisit unlocked portraits in your gallery.',
        beautyScore: 'Score {score} / {target}', beautyMoves: '{count} moves left', beautyRevealProgress: '{percent}% revealed',
        beautyRules: 'Each match reveals more of the portrait.\nCascades and powers help. Invalid swaps cost no moves.',
        beautyHint: 'Show a move', beautyUnlocked: 'Portrait unlocked!', beautyNext: 'Next portrait', beautyAlbum: 'Back to gallery',
        beautyReplay: 'Play again', beautyAllCollected: 'Collection complete', beautyFailed: 'Out of moves',
        beautyTryAgain: 'Try cascades and power gems to reveal more.', beautyImageError: 'Portrait failed to load. Please retry.',
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
        duelDraw: 'Draw!', duelFinalScore: 'You {player} : {ai} AI', duelBack: 'Back',
        duelTutorial: 'How to play', duelTutorialStep: 'Step {step} / {total}',
        duelTutorialNext: 'Next', duelTutorialSkip: 'Skip tutorial', duelTutorialPlay: 'Continue duel',
        duelTutorialIntroTitle: 'Learn to play against AI',
        duelTutorialIntroBody: 'You and AI take turns on one shared board.\nEach turn starts with 2 valid swaps.',
        duelTutorialSwapTitle: 'Try a match of three',
        duelTutorialSwapBody: 'Swap the two highlighted gems to line up 3 red gems in the top row.',
        duelTutorialBonusTitle: 'Earn an extra swap',
        duelTutorialBonusBody: 'Swap the highlighted pair to match 4.\nMatching 4+, T or L shapes earns +1 swap.',
        duelTutorialAITitle: 'Watch the AI turn',
        duelTutorialAIBody: 'In a duel, AI goes after you spend your swaps.\nA dim board means wait. Play when it brightens.',
        duelTutorialFinishTitle: 'Ready for a duel!',
        duelTutorialFinishBody: 'Highest score after 10 rounds wins.\nCascades score for the acting side. Invalid swaps are free.',
        duelTutorialPractice: 'This is a practice board. Give it a try!',
        duelTutorialGesture: 'Tap both gems or drag one onto the other.',
        duelTutorialNoScore: 'Practice does not change your duel score.',
        duelTutorialSwapDone: 'Matched 3! Your swaps drop from 2 to 1.',
        duelTutorialBonusDone: 'Matched 4! Spend 1, earn 1: still 1 swap left.',
        duelTutorialAIDone: 'AI spends swaps too, and can earn the same bonus.',
        duelTutorialAICounter: 'AI has {count} swaps left this turn',
        onlineDuel: 'Play with a friend', onlineHost: 'Host', onlineGuest: 'Friend', onlineHostYou: 'Host (you)', onlineGuestYou: 'Friend (you)',
        onlineTheirTurn: "Opponent's turn", onlineLose: 'Opponent wins', onlineFinalScore: 'Host {player} : {ai} Friend',
        onlineRules: '2 valid swaps per turn. Highest score after 10 rounds wins.\nSpecial matches earn +1 swap. A dim board means wait.',
        onlineRematch: 'Play again', onlineRematchHint: 'Both players choose Play again to start a new match.', onlineWaitingRematch: 'Waiting for your friend to agree…',
        linkIntro: 'Invite a friend and take turns on a shared board.\nBoth players open the game and exchange connection codes.',
        linkChoose: 'Create a match or join a friend.', linkCreate: 'Create match', linkJoin: 'Join friend',
        linkGenerating: 'Generating connection code…', linkConnecting: 'Connecting…', linkConnect: 'Connect friend', linkMakeReply: 'Generate reply',
        linkHostSteps: '1. Send your invitation code to your friend.\n2. Paste their reply below and choose Connect friend.',
        linkGuestSteps: '1. Paste the invitation from your host.\n2. Generate a reply and send it back. The match opens when your host confirms.',
        linkInviteOutput: 'Invitation code to send', linkReplyOutput: 'Reply code to send back',
        linkInviteInput: 'Paste the host invitation', linkReplyInput: 'Paste your friend’s reply', linkPaste: 'Paste the complete connection code here',
        linkPasteInvite: 'Paste the invitation to generate your reply.', linkSendInvite: 'Invitation ready. Send it to your friend.', linkSendReply: 'Reply ready. Send it back to your host.',
        linkCopy: 'Copy code', linkCopied: 'Copied. Send it to the other player.', linkCopyManual: 'Code selected. Copy it manually.',
        linkInvalidCode: 'Invalid code. Paste the complete invitation or reply in the correct place.', linkFailed: 'Connection failed. Retry or create a new match.',
        linkUnsupported: 'Use a recent browser and open the game over HTTPS to connect.', linkConfigError: 'Connection configuration is invalid. Contact the game administrator.',
        linkDisconnected: 'Connection lost. Moves are locked. Wait for recovery or return to reconnect.', linkWaitingSync: 'Waiting for connection or sync…',
        linkBackLobby: 'Reconnect', linkNetworkHelp: 'The match opens when connected. If connection stalls, try another network.'
    },
    vi: {
        start: 'BẮT ĐẦU', language: 'Ngôn ngữ', settings: 'Cài đặt', pause: 'Tạm dừng',
        beautyMode: 'Bộ sưu tập mỹ nhân', beautyIntro: 'Ghép ngọc để dần mở ảnh.\nĐạt mục tiêu để sưu tập và mở ảnh tiếp theo.',
        beautyGarden: 'Nắng sớm trong vườn', beautySunset: 'Khu vườn hoàng hôn', beautyCity: 'Thành phố về đêm',
        beautyCoast: 'Gió biển', beautyForest: 'Dạo bước trong rừng', beautyMeadow: 'Chiều bên đồng hoa', beautyAutumn: 'Mùa thu vàng',
        beautyBlossom: 'Mùa hoa anh đào', beautySnow: 'Khung cảnh mùa đông', beautyStarlight: 'Dưới trời sao',
        beautyPreviousPage: 'Trang trước', beautyNextPage: 'Trang sau', beautyPage: '{page} / {total}',
        beautyLevelGoal: 'Mục tiêu {score} điểm · {moves} lần đổi hợp lệ', beautyCollected: 'Đã sưu tập', beautyReady: 'Sẵn sàng',
        beautyLocked: 'Hoàn thành ảnh {level} trước', beautyView: 'Xem ảnh', beautyChallenge: 'Bắt đầu mở ảnh',
        beautyCollectionCount: 'Đã sưu tập {count} / {total}', beautySaveHint: 'Xem lại ảnh đã mở trong bộ sưu tập.',
        beautyScore: 'Điểm {score} / {target}', beautyMoves: 'Còn {count} lượt', beautyRevealProgress: 'Đã mở {percent}% ảnh',
        beautyRules: 'Điểm càng cao, ảnh càng hiện rõ.\nChuỗi và ngọc đặc biệt giúp mở nhanh. Đổi lỗi không mất lượt.',
        beautyHint: 'Gợi ý đổi', beautyUnlocked: 'Đã mở ảnh!', beautyNext: 'Ảnh tiếp theo', beautyAlbum: 'Về bộ sưu tập',
        beautyReplay: 'Chơi lại', beautyAllCollected: 'Đã sưu tập tất cả', beautyFailed: 'Hết lượt',
        beautyTryAgain: 'Thử tạo chuỗi và ngọc đặc biệt để mở ảnh nhanh hơn.', beautyImageError: 'Không tải được ảnh. Hãy thử lại.',
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
        duelDraw: 'Hòa!', duelFinalScore: 'Bạn {player} : {ai} AI', duelBack: 'Quay lại',
        duelTutorial: 'Hướng dẫn', duelTutorialStep: 'Bước {step} / {total}',
        duelTutorialNext: 'Tiếp theo', duelTutorialSkip: 'Bỏ qua', duelTutorialPlay: 'Tiếp tục đấu',
        duelTutorialIntroTitle: 'Học cách đấu với AI',
        duelTutorialIntroBody: 'Bạn và AI luân phiên trên cùng bàn cờ.\nMỗi lượt có 2 lần đổi hợp lệ.',
        duelTutorialSwapTitle: 'Thử ghép 3 viên',
        duelTutorialSwapBody: 'Đổi hai viên trong khung vàng để ghép 3 viên đỏ ở hàng trên.',
        duelTutorialBonusTitle: 'Nhận thêm lần đổi',
        duelTutorialBonusBody: 'Đổi cặp được đánh dấu để ghép 4 viên.\nGhép 4+, chữ T hoặc L được thưởng +1 lần đổi.',
        duelTutorialAITitle: 'Xem lượt của AI',
        duelTutorialAIBody: 'Hết lần đổi thì đến lượt AI.\nBàn cờ tối nghĩa là hãy đợi; sáng lại thì chơi tiếp.',
        duelTutorialFinishTitle: 'Sẵn sàng thi đấu!',
        duelTutorialFinishBody: 'Sau 10 vòng, tổng điểm cao hơn thắng.\nĐiểm chuỗi thuộc người đang chơi. Đổi lỗi không mất lượt.',
        duelTutorialPractice: 'Đây là bàn luyện tập. Hãy thử nhé!',
        duelTutorialGesture: 'Chạm hai viên hoặc kéo viên này sang viên kia.',
        duelTutorialNoScore: 'Luyện tập không ảnh hưởng điểm thi đấu.',
        duelTutorialSwapDone: 'Ghép 3 thành công! Còn 1 trong 2 lần đổi.',
        duelTutorialBonusDone: 'Ghép 4! Dùng 1, nhận 1: vẫn còn 1 lần đổi.',
        duelTutorialAIDone: 'AI cũng dùng lần đổi và nhận thưởng như bạn.',
        duelTutorialAICounter: 'AI còn {count} lần đổi trong lượt',
        onlineDuel: 'Đấu với bạn', onlineHost: 'Chủ phòng', onlineGuest: 'Bạn chơi', onlineHostYou: 'Chủ phòng (bạn)', onlineGuestYou: 'Bạn chơi (bạn)',
        onlineTheirTurn: 'Lượt của đối thủ', onlineLose: 'Đối thủ thắng', onlineFinalScore: 'Chủ {player} : {ai} Bạn chơi',
        onlineRules: 'Mỗi lượt 2 lần đổi hợp lệ. Điểm cao hơn sau 10 vòng thắng.\nGhép đặc biệt: +1 lần đổi. Bàn cờ tối nghĩa là hãy đợi.',
        onlineRematch: 'Đấu lại', onlineRematchHint: 'Cả hai chọn Đấu lại để bắt đầu ván mới.', onlineWaitingRematch: 'Đang chờ bạn chơi đồng ý…',
        linkIntro: 'Mời bạn chơi và luân phiên trên cùng bàn cờ.\nCả hai mở trò chơi và trao đổi mã kết nối.',
        linkChoose: 'Tạo trận hoặc tham gia với bạn.', linkCreate: 'Tạo trận', linkJoin: 'Tham gia',
        linkGenerating: 'Đang tạo mã kết nối…', linkConnecting: 'Đang kết nối…', linkConnect: 'Kết nối bạn', linkMakeReply: 'Tạo mã trả lời',
        linkHostSteps: '1. Gửi mã mời cho bạn chơi.\n2. Dán mã trả lời của họ bên dưới rồi chọn Kết nối bạn.',
        linkGuestSteps: '1. Dán mã mời từ chủ phòng.\n2. Tạo mã trả lời và gửi lại. Trận mở khi chủ phòng xác nhận.',
        linkInviteOutput: 'Mã mời gửi cho bạn', linkReplyOutput: 'Mã trả lời gửi lại chủ',
        linkInviteInput: 'Dán mã mời của chủ phòng', linkReplyInput: 'Dán mã trả lời của bạn chơi', linkPaste: 'Dán toàn bộ mã kết nối tại đây',
        linkPasteInvite: 'Dán mã mời để tạo mã trả lời.', linkSendInvite: 'Mã mời sẵn sàng. Gửi cho bạn chơi.', linkSendReply: 'Mã trả lời sẵn sàng. Gửi lại chủ phòng.',
        linkCopy: 'Sao chép mã', linkCopied: 'Đã sao chép. Gửi cho người còn lại.', linkCopyManual: 'Đã chọn mã. Hãy sao chép thủ công.',
        linkInvalidCode: 'Mã không hợp lệ. Dán toàn bộ mã mời hoặc mã trả lời vào đúng ô.', linkFailed: 'Kết nối thất bại. Thử lại hoặc tạo trận mới.',
        linkUnsupported: 'Dùng trình duyệt mới và mở trò chơi qua HTTPS để kết nối.', linkConfigError: 'Cấu hình kết nối lỗi. Liên hệ quản trị trò chơi.',
        linkDisconnected: 'Mất kết nối. Không thể đổi. Đợi phục hồi hoặc quay lại để kết nối lại.', linkWaitingSync: 'Đang chờ kết nối hoặc đồng bộ…',
        linkBackLobby: 'Kết nối lại', linkNetworkHelp: 'Trận mở khi kết nối thành công. Nếu chờ lâu, hãy thử mạng khác.'
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
            ? saved : 'en';
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
