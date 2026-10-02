import { localizeButton, localizedLabel } from '../../ui/LocalizedUI';
import Phaser from 'phaser';
import { ObjectiveItem } from '../../ui/ObjectiveItem';
import PlayerDataManager from '../../managers/PlayerDataManager';
import AudioManager from '../../managers/AudioManager';
import { SOUND_KEYS } from '../../utils/SoundAssets';

export class LosePopup extends Phaser.Scene {
  constructor() {
    super({ key: 'LosePopup' });
    this.levelId = 1;
    this.stars = 0; // Luôn 0 sao khi thua
    this.objectives = null;
    this.results = null; // [{ target, type, amount }]
  }

  init(data) {
    this.levelId = data?.levelId ?? 1;
    // Ép về 0 sao cho lose
    this.stars = 0;
    this.objectives = data?.objectives ?? null;
    this.results = data?.results ?? null;
  }

  create() {
    const { width, height } = this.scale;
    localizedLabel(this, width / 2, 250, 'defeat', 240, 48, 6);

    // Tạm dừng các scene bên dưới
    if (this.scene.isActive('GameScene')) this.scene.pause('GameScene');
    if (this.scene.isActive('UIScene')) this.scene.pause('UIScene');

    // Phát âm thanh thua cuộc
    const sfxVolume = AudioManager.getSoundVolume();
    if (sfxVolume > 0 && this.cache.audio.exists(SOUND_KEYS.LOSE_GAME)) {
      this.sound.play(SOUND_KEYS.LOSE_GAME, { volume: sfxVolume });
    }

    // Overlay mờ
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();

    // Background UI giống WinPopup
    const bg = this.add.image(width / 2, height / 2, 'lose_background')
      .setOrigin(0.5)
      .setDepth(1);
    if (bg.width && bg.height) {
      const bgScale = Math.min(width / bg.width, height / bg.height) * 0.95;
      bg.setScale(bgScale);
    }

    // Hiển thị sao (0 sao => tất cả tắt) - giống WinPopup
    const starY = 445;
    const starSpacing = 90;

    // Hiển thị số level (chỉ số, không chữ), đặt hơi trên cụm sao
    this.add.text(314, 345, `${this.levelId}`, {
      fontFamily: 'UTMCookies',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#b43827',
      strokeThickness: 3,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);

    for (let i = 0; i < 3; i++) {
      const isOn = i < this.stars; // luôn false
      const key = isOn ? 'star_on' : 'star_off';
      this.add.image(width / 2 + (i - 1) * starSpacing, starY, key)
        .setOrigin(0.5)
        .setScale(0.4)
        .setDepth(2)
        .setAlpha(isOn ? 1 : 0.7);
    }

    // Nút Continue (về bản đồ)
    const continueButton = this.add.image(width / 2, 685, 'pause_continue')
      .setOrigin(0.5)
      .setScale(0.35)
      .setInteractive({ useHandCursor: true })
      .setDepth(2);
    localizeButton(this, continueButton, 'continue');
    continueButton.on('pointerdown', () => {
      this.goToMenu();
    });

    // Nút Replay (chơi lại level)
    const replayButton = this.add.image(width / 2, 760, 'pause_restart')
      .setOrigin(0.5)
      .setScale(0.35)
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    localizeButton(this, replayButton, 'restart');
    replayButton.on('pointerdown', () => {
      // Tắt tương tác ngay để tránh double click / spam
      replayButton.disableInteractive();

      if (PlayerDataManager.getLives() > 0) {
        PlayerDataManager.updateLives(-1);

        // Thêm delay nhỏ để tránh lỗi WebGL "imagedraw" khi stop/start scene ngay trong pointerdown
        this.time.delayedCall(100, () => {
          // Dừng các scene game và UI dưới nền
          this.scene.stop('GameScene');
          this.scene.stop('UIScene');

          // Start lại LevelLoaderScene (tự stop LosePopup hiện tại)
          this.scene.start('LevelLoaderScene', { levelId: this.levelId });
        });
      } else {
        console.log('Không đủ mạng để replay!');
        this.scene.launch('ShopPopup');

        // Nếu không đủ mạng thì cho phép bấm lại nút
        replayButton.setInteractive({ useHandCursor: true });
      }
    });

    // Hiển thị danh sách mission và tiến độ đạt được
    this.createObjectivesPanel(width, height, bg);
  }

  createObjectivesPanel(width, height, bg) {
    if (!this.objectives || !Array.isArray(this.objectives)) return;

    const missionY = 567;
    const positions = [
      { x: 188, y: missionY },
      { x: 260, y: missionY },
      { x: 334, y: missionY },
      { x: 400, y: missionY }
    ];

    // << THÊM MỚI: Bảng màu cho gem >>
    const GEM_COLOR_MAP = {
      'red': '#FF4136',    // Màu đỏ
      'green': '#2ECC40',  // Màu xanh lá
      'blue': '#0074D9',   // Màu xanh dương
      'purple': '#B10DC9', // Màu tím
      'yellow': '#FFDC00', // Màu vàng
      'orange': '#FF851B', // Màu cam
      'default': '#FFFFFF' // Màu trắng cho blocker/powerup
    };
    // << KẾT THÚC THÊM MỚI >>

    const findResultAmount = (target, type) => {
      if (!this.results) return 0;
      const found = this.results.find(r => r.target === target && r.type === type);
      return found ? (found.amount ?? 0) : 0;
    };

    this.objectives.forEach((objData, index) => {
      if (index >= positions.length) return;
      const pos = positions[index];

      // Item hiển thị icon và số còn lại mặc định
      const item = new ObjectiveItem(this, pos.x, pos.y, objData);
      item.setDepth(3);
      // Ẩn số remaining mặc định ở góc phải (bỏ số 3)
      if (item.countText) item.countText.setVisible(false);

      const achieved = findResultAmount(objData.target, objData.type);
      const target = objData.count ?? item.initialCount ?? 0;
      const remaining = Math.max(0, target - achieved);

      // Hiển thị số nhiệm vụ còn lại ngay tại vị trí count gốc
      if (remaining > 0) {
        
        // << 1. SỬA ĐỔI: Chuyển icon thành màu xám >>
        if (item.icon) {
          item.icon.setTint(0x888888); // Tint màu xám
        }

        // << 2. SỬA ĐỔI: Hiển thị "achieved / target" thay vì "remaining" >>

        // Xác định màu cho text "achieved"
        let achievedColor = GEM_COLOR_MAP.default;
        if (objData.target === 'gem' && GEM_COLOR_MAP[objData.type]) {
          achievedColor = GEM_COLOR_MAP[objData.type];
        }

        // Style chung cho text
        const textStyle = {
          fontFamily: 'UTMCookies',
          fontSize: '25px',
          color: '#FFFFFF', // Màu trắng cho "/" và "target"
          stroke: '#000000',
          strokeThickness: 5,
          fontWeight: 'bold'
        };

        const textX = pos.x + 30;
        const textY = pos.y + 30;

        // Thêm text "/ target" (ví dụ: "/10") - Căn lề phải
        const targetText = this.add.text(textX, textY, `/${target}`, textStyle)
          .setOrigin(1, 1) // Căn lề phải
          .setDepth(4);

        // Thêm text "achieved" (ví dụ: "7") - Đặt bên trái text target
        // và tô màu đặc biệt
        const achievedTextStyle = { ...textStyle, color: achievedColor };
        this.add.text(targetText.x - targetText.width, textY, `${achieved}`, achievedTextStyle)
          .setOrigin(1, 1) // Căn lề phải (vào bên trái của targetText)
          .setDepth(4);
      } else {
        // Đã đủ, đánh dấu hoàn thành (giữ nguyên)
        item.markAsCompleted();
      }
    });
  }

  stopUnderScenes() {
    if (this.scene.isActive('GameScene')) this.scene.stop('GameScene');
    if (this.scene.isActive('UIScene')) this.scene.stop('UIScene');
    if (this.scene.isActive('LevelLoaderScene')) this.scene.stop('LevelLoaderScene');
    this.scene.stop();
  }

  goToMenu() {
    const scenesToStop = [
      'GameScene',
      'UIScene',
      'LevelLoaderScene',
      'PausePopup',
      'LevelReviewPopup',
      'WinPopup',
      'LosePopup'
    ];
    scenesToStop.forEach(key => {
      if (this.scene.isActive(key) || this.scene.isPaused(key)) {
        this.scene.stop(key);
      }
    });
    this.scene.start('MapScene');
  }
}


