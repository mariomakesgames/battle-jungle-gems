// src/main.js
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene'; // <--- Import Scene mới
import { PreloaderScene } from './scenes/PreloaderScene';
import { MapScene } from './scenes/MapScene';
import { DemoScene } from './scenes/DemoScene';
import { LevelLoaderScene } from './scenes/LevelLoaderScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { SettingsPopup } from './scenes/popups/SettingsPopup';
import { PausePopup } from './scenes/popups/PausePopup';
import { WinPopup } from './scenes/popups/WinPopup';
import { LevelReviewPopup } from './scenes/popups/LevelReviewPopup';
import { LosePopup } from './scenes/popups/LosePopup';
import { SpinPopup } from './scenes/popups/SpinPopup';
import { ShopPopup } from './scenes/popups/ShopPopup';
import { FriendPopup } from './scenes/popups/FriendPopup';
import { AIDuelScene } from './scenes/AIDuelScene';

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#1b1e27',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 576,
    height: 1024,
  },
  // --- THÊM TitleScene VÀO DANH SÁCH (Sau BootScene, Trước PreloaderScene) ---
  scene: [
      BootScene, 
      TitleScene, // <--- Đặt ở đây
      AIDuelScene,
      PreloaderScene, 
      DemoScene, 
      MapScene, 
      LevelLoaderScene, 
      GameScene, 
      UIScene, 
      SettingsPopup, 
      PausePopup, 
      WinPopup, 
      LosePopup, 
      LevelReviewPopup, 
      SpinPopup, 
      ShopPopup, 
      FriendPopup
  ] 
};

// Khởi tạo game ngay lập tức, không chờ nút HTML
const game = new Phaser.Game(config);

if (typeof window !== 'undefined') {
  window.game = game;
  console.log('[Main] Game instance assigned to window.game');
}
