---
title: "SecureVol: process allowlist for mounted VeraCrypt volumes on Windows"
description: "How a local Windows minifilter, service, installer, and Dear ImGui admin panel turned into a working allowlist for already-mounted encrypted containers."
pubDate: 2026-04-25
updatedDate: 2026-04-26
tags: ["windows", "security", "veracrypt", "drivers"]
draft: false
language: "ru"
translationKey: "securevol-veracrypt-volume-isolation"
---

## Контекст

VeraCrypt хорошо решает задачу хранения данных в зашифрованном виде. Но после монтирования контейнера Windows видит обычный том с обычной файловой системой. С этого момента проблема меняется: данные уже расшифрованы, и важно не только кто имеет доступ как пользователь, а какие процессы могут читать и писать файлы на этом томе.

Идея SecureVol простая: защищать уже примонтированный VeraCrypt volume через явный allowlist процессов. Например, Chrome может работать с профилем на защищенном диске, Telegram может хранить portable data там же, а Notepad, Explorer, случайные helper-процессы и все остальное получают `ACCESS_DENIED`.

Проект получился локальным defensive-инструментом для Windows 11:

- kernel minifilter driver на WDK / Filter Manager;
- user-mode service на .NET 8;
- CLI для диагностики и администрирования;
- native admin UI на Win32/DX11 и upstream Dear ImGui;
- GUI installer с embedded payload и auto-update через GitHub Releases.

Исходный код: [securevol-windows](https://github.com/nayutalienx/securevol-windows).

## Что именно защищается

SecureVol не пытается конкурировать с VeraCrypt. VeraCrypt защищает данные на диске, когда контейнер закрыт. SecureVol добавляет runtime gate, когда контейнер уже примонтирован и доступен Windows.

Политика строится вокруг нескольких признаков приложения:

- нормализованный путь к executable;
- Windows user, под которым запущен процесс;
- SHA-256 executable, если нужно жестко зафиксировать конкретную версию;
- Authenticode publisher, если нужно доверять подписанным обновлениям;
- флаг требования валидной подписи.

Важно: `publisher` в allow rule проверяется по Authenticode certificate publisher, который Windows извлекает из подписи executable. Это не `FileDescription`, не `CompanyName` из version metadata, не имя папки и не то, как приложение себя называет. Например, для portable Telegram правильным publisher оказался `Telegram FZ-LLC`; произвольное `tg llc` приводило к `PublisherMismatch`.

## Архитектура

Kernel-драйвер оставлен маленьким. Он не считает хэши, не парсит подписи и не занимается сложной политикой. Его задача:

- подключиться как minifilter;
- смотреть `IRP_MJ_CREATE` для защищенного тома;
- определить process id инициатора;
- спросить user-mode service о решении или взять cached verdict;
- отказать неизвестным процессам на защищенном volume.

Вся тяжелая логика живет в user mode:

- чтение `policy.json`;
- нормализация путей;
- вычисление SHA-256;
- проверка Authenticode;
- сопоставление пользователя;
- structured logs;
- diagnostics upload / clipboard fallback;
- управление состоянием защиты.

Такой дизайн оказался практичнее, чем пытаться делать “умный” kernel-драйвер. В kernel-mode меньше кода, меньше блокирующих операций и меньше мест, где можно повесить систему.

## Почему не ACL

NTFS ACL отвечает на вопрос “какой security principal может открыть файл”. Но задача была другая: “какой процесс, запущенный тем же пользователем, может открыть файл”.

Если один и тот же пользователь запускает Chrome, Notepad, терминал, sync client и Telegram, обычные ACL плохо отделяют один процесс от другого. Отдельный local user помогает, но не закрывает весь UX: приложения обновляются, спавнят child-процессы, работают через updater, открывают файлы по reparse paths и иногда запускаются из portable-папок.

Поэтому периметр был перенесен ниже: на filesystem open path, через minifilter.

## Что оказалось сложным

Самый сложный код был не там, где сначала ожидалось. Драйверная часть была опасной, но довольно прямолинейной: attach, communication port, pre-create callback, cache, deny path. Больше всего времени съели productization и edge cases вокруг Windows.

### 1. Установка driver package

На developer-машине все выглядело проще: WDK стоит, test-signing включен, cert создан, `fltmc load` работает. На новой машине всплыли реальные проблемы:

- WDK toolset не всегда появляется после установки ожидаемым образом;
- driver package может staged через `pnputil`, но `fltmc load` все равно не находит `.sys`;
- test-signed driver требует корректного режима test-signing и reboot;
- service может держать старые файлы в `Program Files`, особенно self-contained .NET payload;
- repair/uninstall не должен убивать сам installer;
- нельзя считать install успешным, если driver не загружен и service не отвечает.

В итоге installer пришлось делать не как “copy files and pray”, а как отдельный setup host с явными стадиями, логированием, проверкой прав администратора, cleanup старых процессов, repair mode и понятным install summary.

### 2. Service и mount timing

VeraCrypt volume может быть не примонтирован при старте системы. Значит защита не может зависеть от того, что `A:` уже существует в момент загрузки.

Правильное поведение:

- service стартует автоматически;
- policy хранит volume GUID / mount point;
- если volume отсутствует, service не падает;
- когда volume появляется позже, защита re-arm'ится;
- после reboot и повторного mount защита снова должна примениться без ручного repair.

Это был один из важных багов: после reboot контейнер снова монтировался открытым. Исправление потребовало сделать delayed mount rearm, а не однократную настройку в installer.

### 3. Admin UI не должен зависеть от идеального backend

Первая версия UI слишком сильно верила live backend path. Если pipe зависал или service отвечал медленно, кнопки `On`, `Off`, `Add`, `Remove`, diagnostics превращались в UX-ловушки.

Пришлось поменять модель:

- UI показывает local snapshot, даже если backend временно недоступен;
- операции пишут policy locally и затем пытаются push в driver;
- ошибки копируются в clipboard;
- diagnostics имеет fallback;
- в UI видно release tag, чтобы не гадать, обновился ли binary;
- все админские операции требуют elevated запуск.

Отдельный вывод: для такого инструмента “просто показать timeout” недостаточно. Пользователь должен получить конкретное состояние: policy saved, driver push failed, service down, port up/down, generation, protected volume, recent denies.

### 4. Dear ImGui оказался удачным выбором, но не магией

Сначала admin surface был слишком похож на web dashboard: крупные панели, много пустого пространства, плохая компактность. Для маленького служебного окна это было неправильно.

Upstream `ocornut/imgui` через Win32/DX11 подошел лучше:

- быстрый native UI;
- минимум зависимостей;
- удобно делать компактные таблицы;
- легко показывать raw technical state;
- не нужно тащить web stack ради админки драйвера.

Но ImGui тоже требует аккуратной верстки. Если просто набросать панели, кнопки не влезают, scroll ведет себя плохо, а модальное окно превращается в кашу. Финальная версия стала compact-first: rules table сверху, rule details отдельно, system/denies/tools в scrollable “More”.

### 5. Telegram и symlink paths

Chrome завелся относительно предсказуемо. Telegram оказался полезным тестом на реальные path edge cases.

Portable Telegram может лежать внутри VeraCrypt volume, но запускаться через внешнюю папку с symlink/junction. Для политики это означает, что путь процесса может быть не тем, который визуально ожидается. В deny logs одновременно могут появляться:

- путь через external launcher folder;
- путь внутри `A:\...`;
- updater executable;
- разные publisher/signature результаты.

Практическое решение: добавлять allow rules для фактических executable paths, которые SecureVol видит в диагностике, и не придумывать publisher вручную. Если publisher включен, он должен быть точным Authenticode publisher.

## Текущий результат

К финальной версии проект делает то, ради чего начинался:

- защищает конкретный примонтированный VeraCrypt volume;
- deny-by-default работает только для configured volume;
- allowlist реально пропускает разрешенные приложения;
- `On` / `Off` переключают enforcement;
- защита переживает unmount/remount;
- защита поднимается после reboot, когда контейнер снова монтируется;
- Chrome можно запускать с профилем на защищенном volume;
- Telegram можно довести через правильные правила path/user/publisher;
- installer умеет install/repair/uninstall/update;
- admin UI показывает release tag, state и diagnostics.

Это не sandbox и не EDR. Admin/SYSTEM/kernel compromise вне scope. Если злоумышленник контролирует kernel или администратора, он может обойти локальные политики. SecureVol закрывает другой класс проблемы: обычные same-user процессы не должны автоматически получать доступ к расшифрованному контейнеру только потому, что он примонтирован.

## Выводы

Главный технический вывод: для runtime-защиты mounted encrypted volume правильная точка контроля находится не в VeraCrypt и не в NTFS ACL, а на filesystem access path. На Windows это естественно приводит к minifilter.

Главный продуктовый вывод: driver — это только половина проекта. Чтобы инструмент реально работал на другой машине, нужны installer, repair story, logs, diagnostics, update path, reboot behavior и понятный UI. Без этого даже правильный kernel decision path будет восприниматься как “не работает”.

Главный UX-вывод: security tooling должно быть предельно явным. Если правило не сработало из-за `PublisherMismatch`, пользователь должен видеть именно это, а не угадывать, что “Telegram почему-то не открывается”.

SecureVol получился небольшим, но настоящим Windows-системным проектом: с драйвером, сервисом, native UI, установщиком и реальными проблемами эксплуатации. Самое ценное в нем не только то, что он блокирует доступ к mounted VeraCrypt volume, а то, что он показывает полный путь от идеи “давайте allowlist процессов” до работающего локального инструмента.
