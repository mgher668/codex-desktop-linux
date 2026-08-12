# ChatGPT Community for Linux

`codex-desktop` 是 OpenAI 官方 Linux ChatGPT 桌面应用的社区自定义发行版。
它验证并重新打包官方签名软件包，同时提供默认关闭的 Linux 扩展、deb、RPM、
pacman、AppImage、Nix 和事务式更新。

应用菜单中的名称是 **ChatGPT Community**，图标带有蓝色 `C`；软件包名、
命令名和安装目录仍为 `codex-desktop`、`codex-desktop` 和
`/opt/codex-desktop`。

唯一的上游来源是 OpenAI 签名的 Linux `.deb`。官方 Electron runtime 和原生
模块会被直接复用，不再重建。

默认构建不会修改官方 `resources/app.asar`。

```bash
git clone https://github.com/ilysenko/codex-desktop-linux.git
cd codex-desktop-linux
bash scripts/install-deps.sh
make install-native
```

如需先交互式选择可选扩展，请运行 `make setup-native`，然后运行
`make install-native`。`make bootstrap-native` 会一次性安装构建依赖、构建、
打包并安装。

构建器通过 OpenAI 已签名的 stable APT 元数据选择当前 `amd64` 或 `arm64`
软件包，并校验固定密钥、索引摘要、软件包摘要、control metadata 与必要的
Linux payload。也可以指定你信任的已下载软件包：

```bash
UPSTREAM_DEB=/path/to/chatgpt_<version>_<arch>.deb make build-app
```

显式提供本地 `.deb` 时会校验包结构并记录 SHA-256，但会跳过仓库发现，
因此软件包来源真实性由调用者负责。

输出包名仍为 `codex-desktop`，安装到 `/opt/codex-desktop`，可与官方
`chatgpt` 共存。但两者共享上游 `Codex` 用户配置，不应同时运行。

```bash
make deb
make rpm
make pacman
make appimage
nix build .#codex-desktop
```

所有扩展默认关闭。运行 `make setup-native` 进行交互式配置，或者将需要的 ID
写入被 git 忽略的 `linux-features/features.json`，然后运行
`make install-native`。已退役的已知 ID 会被忽略，未知 ID 仍会报错。默认
core patch registry 为空。

从旧 Linux 移植版升级后的首次 Community 启动，只会修复已知的旧 Browser
和 Chrome bundled-plugin 缓存。若浏览器集成已加载，请完全退出所有 ChatGPT
进程，再启动 ChatGPT Community。

原生包可包含 `codex-update-manager`。它使用同一签名源检查更新，只重建已启用
扩展，并在应用退出后事务式安装候选版本；支持回滚。

详细信息见 [架构](docs/architecture.md)、[构建与打包](docs/build-and-packaging.md)、
[Linux 扩展](docs/linux-features-architecture.md) 和 [更新器](docs/updater.md)。

本项目由社区维护，并非 OpenAI 官方产品。
