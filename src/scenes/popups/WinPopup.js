import { localizeButton, localizedLabel } from '../../ui/LocalizedUI';
import Phaser from 'phaser';
import { ObjectiveItem } from '../../ui/ObjectiveItem';
import PlayerDataManager from '../../managers/PlayerDataManager';
import AudioManager from '../../managers/AudioManager';
import { SOUND_KEYS } from '../../utils/SoundAssets';

export class WinPopup extends Phaser.Scene {
  constructor() {
    super({ key: 'WinPopup' });
    this.levelId = 1;
    this.stars = 1;
    this.objectives = null;
    this.results = null; // [{ target, type, amount }]
  }

  init(data) {
    // Ép kiểu parseInt để đảm bảo luôn là số (tránh lỗi "1" + 1 = "11" trên Host)
    this.levelId = parseInt(data?.levelId ?? 1, 10);
    
    // Sửa: Math.max(0, ...) cho phép 0 sao
    this.stars = Math.max(0, Math.min(3, parseInt(data?.stars ?? 0, 10))); 
    
    this.objectives = data?.objectives ?? null;
    this.results = data?.results ?? null;

    // --- LƯU TIẾN ĐỘ NGAY KHI THẮNG ---
    // Gọi Manager để tính toán mở khóa level tiếp theo và Lưu xuống localStorage ngay lập tức
    console.log(`[WinPopup] Saving progress for Level ${this.levelId} (Type: ${typeof this.levelId}) with ${this.stars} stars`);
    PlayerDataManager.completeLevel(this.levelId, this.stars);
  }

  create() {
    const { width, height } = this.scale;
    localizedLabel(this, width / 2, 250, 'victory', 240, 48, 6);

    // Tạm dừng các scene bên dưới
    if (this.scene.isActive('GameScene')) this.scene.pause('GameScene');
    if (this.scene.isActive('UIScene')) this.scene.pause('UIScene');

    // Phát âm thanh chiến thắng
    const sfxVolume = AudioManager.getSoundVolume();
    if (sfxVolume > 0 && this.cache.audio.exists(SOUND_KEYS.WIN_GAME)) {
      this.sound.play(SOUND_KEYS.WIN_GAME, { volume: sfxVolume });
    }

    // Overlay mờ
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();

    // Background UI Victory
    const bg = this.add.image(width / 2, height / 2, 'victory_background')
      .setOrigin(0.5)
      .setDepth(1);
    if (bg.width && bg.height) {
      const bgScale = Math.min(width / bg.width, height / bg.height) * 0.95;
      bg.setScale(bgScale);
    }
    // Hiển thị số level (chỉ số, không chữ), đặt hơi trên cụm sao
    this.add.text(314, 345, `${this.levelId}`, {
      fontFamily: 'UTMCookies',
      fontSize: '18px',
      color: '#fff5f4',
      stroke: '#b43827',
      strokeThickness: 3,
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5);
    // Hiển thị sao
    const starY = 445;
    const starSpacing = 90;
    for (let i = 0; i < 3; i++) {
      const isOn = i < this.stars;
      const key = isOn ? 'star_on' : 'star_off';
      const star = this.add.image(width / 2 + (i - 1) * starSpacing, starY, key)
        .setOrigin(0.5)
        .setScale(0.4)
        .setDepth(2)
        .setAlpha(isOn ? 1 : 0.7);
      if (isOn) {
        this.tweens.add({ targets: star, scale: 0.14, yoyo: true, duration: 180, ease: 'Sine.easeOut' });
      }
    }

    // Buttons dùng lại từ PreloaderScene assets (Pause UI)
    const continueButton = this.add.image(width / 2, 685, 'pause_continue')
      .setOrigin(0.5)
      .setScale(0.35)
      .setInteractive({ useHandCursor: true })
      .setDepth(2);
    localizeButton(this, continueButton, 'continue');
    continueButton.on('pointerdown', () => {
      this.goToMenu();
    });

    const replayButton = this.add.image(width / 2, 760, 'pause_restart')
      .setOrigin(0.5)
      .setScale(0.35)
      .setInteractive({ useHandCursor: true })
      .setDepth(2);
    localizeButton(this, replayButton, 'restart');
    replayButton.on('pointerdown', () => {
      if (PlayerDataManager.getLives() > 0) {
        PlayerDataManager.updateLives(-1);

        if (this.scene.isPaused('GameScene')) {
          this.scene.stop('GameScene');
        }
        if (this.scene.isPaused('UIScene')) {
          this.scene.stop('UIScene');
        }
        this.scene.stop();
        this.scene.start('LevelLoaderScene', { levelId: this.levelId });
      } else {
        console.log('Không đủ mạng để replay!');
        this.scene.launch('ShopPopup');
      }
    });

    // Hiển thị danh sách mission đã hoàn thành (giống LevelReviewPopup)
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

    const findResult = (target, type) => {
      if (!this.results) return null;
      return this.results.find(r => r.target === target && r.type === type) || null;
    };

    this.objectives.forEach((objData, index) => {
      if (index >= positions.length) return;
      const pos = positions[index];
      const item = new ObjectiveItem(this, pos.x, pos.y, objData);
      item.setDepth(3);

      // Với WinPopup, coi như đã hoàn thành: hiển thị số đã thu thập (nếu có)
      const result = findResult(objData.target, objData.type);
      if (result && item.countText) {
        item.countText.setText(`${result.amount}`);
      }
      item.markAsCompleted();
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
    
    // Truyền levelId vừa thắng về MapScene
    this.scene.start('MapScene', { 
        completedLevelId: this.levelId  // Truyền ID level vừa hoàn thành
    });
  }
}


