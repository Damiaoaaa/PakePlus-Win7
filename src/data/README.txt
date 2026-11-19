待机视频更换说明
================

目标文件名：standby.mp4

打包安装后，软件根目录（与 exe 同级）会使用：
  data\standby.mp4

行为：
1. 启动时若根目录没有 data，会自动创建
2. 若 data\standby.mp4 不存在，会尝试从内置 assets\standby.mp4 复制过去
3. 之后播放优先使用 data\standby.mp4

换视频：退出软件后，直接替换 data\standby.mp4，再打开即可。
注意：PakePlus 需勾选 TauriApi，自动创建/复制才会生效。
