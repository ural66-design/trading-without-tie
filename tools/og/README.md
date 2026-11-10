# OG-баннеры Vladimir1

Шаблон и тексты находятся в `banner.html` и `banners.json`. Генератор использует Node.js, Playwright, Chrome и Sharp, а также шрифты и портрет из `site/assets/`.

Из корня репозитория для всех 44 JPEG запустите `node tools/og/generate.cjs site/assets/og --all`. Для одного русского макета укажите папку вывода и его идентификатор из `banners.json`, например `node tools/og/generate.cjs previews home`. В этом режиме генератор также сохраняет превью шириной 500 px.
