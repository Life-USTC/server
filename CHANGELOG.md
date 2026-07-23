## [1.77.6](https://github.com/Life-USTC/server/compare/v1.77.5...v1.77.6) (2026-07-23)


### Bug Fixes

* **dashboard:** use native grid lanes for semesters ([#619](https://github.com/Life-USTC/server/issues/619)) ([cadef7f](https://github.com/Life-USTC/server/commit/cadef7f44ea59b6ed01f478daaf92fdc54cafe6c))

## [1.77.5](https://github.com/Life-USTC/server/compare/v1.77.4...v1.77.5) (2026-07-23)


### Bug Fixes

* **dashboard:** constrain subscription table content ([#618](https://github.com/Life-USTC/server/issues/618)) ([2310ba1](https://github.com/Life-USTC/server/commit/2310ba18d270f3193d2f786aa9c1e3e6482fb869))

## [1.77.4](https://github.com/Life-USTC/server/compare/v1.77.3...v1.77.4) (2026-07-23)


### Bug Fixes

* **observability:** close worker telemetry gaps ([#617](https://github.com/Life-USTC/server/issues/617)) ([11b843e](https://github.com/Life-USTC/server/commit/11b843e837502960f4fdf31834b6e098958fb0be))

## [1.77.3](https://github.com/Life-USTC/server/compare/v1.77.2...v1.77.3) (2026-07-23)


### Bug Fixes

* **worker:** harden MCP observability and limits ([#615](https://github.com/Life-USTC/server/issues/615)) ([6ad477a](https://github.com/Life-USTC/server/commit/6ad477a935910cba08fbf3c07d1d4d54f786d18a))

## [1.77.2](https://github.com/Life-USTC/server/compare/v1.77.1...v1.77.2) (2026-07-23)


### Bug Fixes

* **db:** require exact RLS transaction clients ([#613](https://github.com/Life-USTC/server/issues/613)) ([ab20189](https://github.com/Life-USTC/server/commit/ab2018923767887b8e466695609b4b4463a4aafc)), closes [#610](https://github.com/Life-USTC/server/issues/610)
* **graphql:** account for document preflight lifecycle ([#612](https://github.com/Life-USTC/server/issues/612)) ([58d0963](https://github.com/Life-USTC/server/commit/58d09637af2955cb04f482c9eb9e1926b2fc8353)), closes [#611](https://github.com/Life-USTC/server/issues/611)
* **ui:** restore preferences to topbar ([#609](https://github.com/Life-USTC/server/issues/609)) ([bd76692](https://github.com/Life-USTC/server/commit/bd766929984311f8984872ed02e938fea33c51d1))

## [1.77.1](https://github.com/Life-USTC/server/compare/v1.77.0...v1.77.1) (2026-07-22)


### Bug Fixes

* **mcp:** guide conditional GraphQL operations ([#605](https://github.com/Life-USTC/server/issues/605)) ([d6e8426](https://github.com/Life-USTC/server/commit/d6e8426ed190c1d5cbbd5286923c9a2880e29d12))
* **ui:** unify responsive navigation and filters ([#606](https://github.com/Life-USTC/server/issues/606)) ([0a05040](https://github.com/Life-USTC/server/commit/0a05040e485ccf8e7102b577abe556350fb7c2be))

# [1.77.0](https://github.com/Life-USTC/server/compare/v1.76.0...v1.77.0) (2026-07-22)


### Features

* **db:** activate personal preference RLS ([#600](https://github.com/Life-USTC/server/issues/600)) ([961fa6d](https://github.com/Life-USTC/server/commit/961fa6dd053ba208ecff15a60a48060f3f1987f1))

# [1.76.0](https://github.com/Life-USTC/server/compare/v1.75.0...v1.76.0) (2026-07-22)


### Features

* **db:** activate Todo row-level security ([#598](https://github.com/Life-USTC/server/issues/598)) ([5b16b66](https://github.com/Life-USTC/server/commit/5b16b66e8f30bd4c8518fa59feb55c58b0120fdc))

# [1.75.0](https://github.com/Life-USTC/server/compare/v1.74.5...v1.75.0) (2026-07-22)


### Features

* **mcp:** execute scoped GraphQL documents ([#591](https://github.com/Life-USTC/server/issues/591)) ([5ebf10f](https://github.com/Life-USTC/server/commit/5ebf10f104a37a529759966bad73b13703f7dd4c))

## [1.74.5](https://github.com/Life-USTC/server/compare/v1.74.4...v1.74.5) (2026-07-22)


### Performance Improvements

* **todos:** bound batch database concurrency ([#592](https://github.com/Life-USTC/server/issues/592)) ([a18d1ae](https://github.com/Life-USTC/server/commit/a18d1ae00e0d71d2eb78bf1f3b6790ed270207af))

## [1.74.4](https://github.com/Life-USTC/server/compare/v1.74.3...v1.74.4) (2026-07-22)


### Bug Fixes

* **static-loader:** disambiguate conflicting campus IDs ([#594](https://github.com/Life-USTC/server/issues/594)) ([2b58c56](https://github.com/Life-USTC/server/commit/2b58c567b6f231e4531ae8dc1eebe4a28f3b389f))

## [1.74.3](https://github.com/Life-USTC/server/compare/v1.74.2...v1.74.3) (2026-07-21)


### Bug Fixes

* **ui:** cover visual matrix regressions ([5356ee6](https://github.com/Life-USTC/server/commit/5356ee64bf4f457724ec0945149c1e42bfe8f797))

## [1.74.2](https://github.com/Life-USTC/server/compare/v1.74.1...v1.74.2) (2026-07-21)


### Bug Fixes

* **loader:** bound join sync query depth ([#589](https://github.com/Life-USTC/server/issues/589)) ([10f81c3](https://github.com/Life-USTC/server/commit/10f81c3cea29cbfb3c74a4924eb8a4cd11c15ca4))

## [1.74.1](https://github.com/Life-USTC/server/compare/v1.74.0...v1.74.1) (2026-07-21)


### Bug Fixes

* **loader:** reassign stale admin class ids safely ([#587](https://github.com/Life-USTC/server/issues/587)) ([09e24b6](https://github.com/Life-USTC/server/commit/09e24b67678a3abf65b48a04482d5372f13223d1))

# [1.74.0](https://github.com/Life-USTC/server/compare/v1.73.0...v1.74.0) (2026-07-19)


### Features

* **oauth:** let users revoke app authorizations ([#572](https://github.com/Life-USTC/server/issues/572)) ([3f8b962](https://github.com/Life-USTC/server/commit/3f8b96270cc9841621167a14f86c0b7e9a99d1bb))

# [1.73.0](https://github.com/Life-USTC/server/compare/v1.72.0...v1.73.0) (2026-07-19)


### Features

* **graphql:** complete ordinary mutation parity ([#570](https://github.com/Life-USTC/server/issues/570)) ([7036648](https://github.com/Life-USTC/server/commit/7036648527b83ab72aa2995007b4ca4426265f70))

# [1.72.0](https://github.com/Life-USTC/server/compare/v1.71.1...v1.72.0) (2026-07-19)


### Features

* **mcp:** run registered GraphQL operations ([#568](https://github.com/Life-USTC/server/issues/568)) ([f9ddc61](https://github.com/Life-USTC/server/commit/f9ddc616ac6f8e385b9b12f75d1ad102040c7699))

## [1.71.1](https://github.com/Life-USTC/server/compare/v1.71.0...v1.71.1) (2026-07-19)


### Performance Improvements

* **web:** keep anonymous home lightweight ([#566](https://github.com/Life-USTC/server/issues/566)) ([d812d2d](https://github.com/Life-USTC/server/commit/d812d2dd690fc5736d0b5b05b7e513df2946460b))

# [1.71.0](https://github.com/Life-USTC/server/compare/v1.70.1...v1.71.0) (2026-07-19)


### Features

* **auth:** add passkey sign-in and management UI ([#564](https://github.com/Life-USTC/server/issues/564)) ([d0aef80](https://github.com/Life-USTC/server/commit/d0aef80bd7369f0e39f8aeda6f06e71f25813aad))

## [1.70.1](https://github.com/Life-USTC/server/compare/v1.70.0...v1.70.1) (2026-07-19)


### Bug Fixes

* **ci:** preserve queued E2E report publishers ([#567](https://github.com/Life-USTC/server/issues/567)) ([c53887f](https://github.com/Life-USTC/server/commit/c53887f837fd5d5b44118cb59185f2d5916057d5))

# [1.70.0](https://github.com/Life-USTC/server/compare/v1.69.0...v1.70.0) (2026-07-19)


### Features

* **web:** add semantic public tool routes ([#561](https://github.com/Life-USTC/server/issues/561)) ([53f03f6](https://github.com/Life-USTC/server/commit/53f03f6ced3395f90eed18e67a4294d06ce0d0b0))

# [1.69.0](https://github.com/Life-USTC/server/compare/v1.68.0...v1.69.0) (2026-07-19)


### Features

* **graphql:** add batch business mutations ([#563](https://github.com/Life-USTC/server/issues/563)) ([276f3ec](https://github.com/Life-USTC/server/commit/276f3ec70340a14b42fee75860ae1cdd6057110b))

# [1.68.0](https://github.com/Life-USTC/server/compare/v1.67.0...v1.68.0) (2026-07-19)


### Features

* **auth:** support passkey authentication ([#557](https://github.com/Life-USTC/server/issues/557)) ([83dd9d8](https://github.com/Life-USTC/server/commit/83dd9d8feb16b956e2f5ece75f1e80cc1531227e))

# [1.67.0](https://github.com/Life-USTC/server/compare/v1.66.0...v1.67.0) (2026-07-19)


### Features

* **settings:** move account controls to sidebar ([#558](https://github.com/Life-USTC/server/issues/558)) ([db8c236](https://github.com/Life-USTC/server/commit/db8c2360c3bca8960eb37f71e5527e109dd43436)), closes [#545](https://github.com/Life-USTC/server/issues/545)

# [1.66.0](https://github.com/Life-USTC/server/compare/v1.65.1...v1.66.0) (2026-07-19)


### Features

* **graphql:** add homework CRUD mutations ([#560](https://github.com/Life-USTC/server/issues/560)) ([ae11392](https://github.com/Life-USTC/server/commit/ae1139241a28f42c2f0636f64142ff85cbd96a57))

## [1.65.1](https://github.com/Life-USTC/server/compare/v1.65.0...v1.65.1) (2026-07-19)


### Bug Fixes

* **auth:** prune expired auth records ([#503](https://github.com/Life-USTC/server/issues/503)) ([6c70cc9](https://github.com/Life-USTC/server/commit/6c70cc9f4337e80b5880e0c23aa4f5d97106e624)), closes [#485](https://github.com/Life-USTC/server/issues/485)

# [1.65.0](https://github.com/Life-USTC/server/compare/v1.64.11...v1.65.0) (2026-07-19)


### Features

* **graphql:** add description upsert mutation ([#555](https://github.com/Life-USTC/server/issues/555)) ([8fa061c](https://github.com/Life-USTC/server/commit/8fa061cf486f5548f1fbc08ccf4448bb6e16de4f))

## [1.64.11](https://github.com/Life-USTC/server/compare/v1.64.10...v1.64.11) (2026-07-19)


### Bug Fixes

* **seo:** localize catalog social metadata ([#553](https://github.com/Life-USTC/server/issues/553)) ([a47237c](https://github.com/Life-USTC/server/commit/a47237cd3daa32e653c746b613154a69444b9c43))

## [1.64.10](https://github.com/Life-USTC/server/compare/v1.64.9...v1.64.10) (2026-07-19)


### Performance Improvements

* **dashboard:** remove unused public summary queries ([#552](https://github.com/Life-USTC/server/issues/552)) ([0da7af1](https://github.com/Life-USTC/server/commit/0da7af18f8aa4e81749e6f4a89a59bb829d4c290))

## [1.64.9](https://github.com/Life-USTC/server/compare/v1.64.8...v1.64.9) (2026-07-19)


### Performance Improvements

* **api:** split browser and Cloudflare cache policy ([#540](https://github.com/Life-USTC/server/issues/540)) ([10ebcbc](https://github.com/Life-USTC/server/commit/10ebcbcb0b7bfedb04663e5089a1c4e2bd81e335))

## [1.64.8](https://github.com/Life-USTC/server/compare/v1.64.7...v1.64.8) (2026-07-19)


### Bug Fixes

* **ui:** tolerate unavailable browser storage ([#537](https://github.com/Life-USTC/server/issues/537)) ([eadd270](https://github.com/Life-USTC/server/commit/eadd270b9007928f38beabd45bd1482e15352453))

## [1.64.7](https://github.com/Life-USTC/server/compare/v1.64.6...v1.64.7) (2026-07-19)


### Bug Fixes

* **a11y:** expose sidebar expanded state ([#535](https://github.com/Life-USTC/server/issues/535)) ([31cefe9](https://github.com/Life-USTC/server/commit/31cefe9271d4a9f05dc269a2fa7449aadb8c1e0d))

## [1.64.6](https://github.com/Life-USTC/server/compare/v1.64.5...v1.64.6) (2026-07-19)


### Performance Improvements

* **ssr:** reuse hook auth in detail loaders ([#536](https://github.com/Life-USTC/server/issues/536)) ([0c262ad](https://github.com/Life-USTC/server/commit/0c262adc146afaa4b9e7dae376cc628b4d78e74f))


### Reverts

* Revert "feat(ops): add database recovery gate ([#474](https://github.com/Life-USTC/server/issues/474))" ([#534](https://github.com/Life-USTC/server/issues/534)) ([117750b](https://github.com/Life-USTC/server/commit/117750bdb54cc3b41f45d47a1907591f8bd48d77))

## [1.64.5](https://github.com/Life-USTC/server/compare/v1.64.4...v1.64.5) (2026-07-19)


### Bug Fixes

* **bus:** expose narrow timetable scrolling ([1338321](https://github.com/Life-USTC/server/commit/13383211a11dc929d89d9edca4f874324729a99d))
* **bus:** harden responsive route surfaces ([7be1587](https://github.com/Life-USTC/server/commit/7be15877005116890d7d60b87a49267f2240ee05))
* **ui:** polish dashboard and bus layouts ([7c5bd43](https://github.com/Life-USTC/server/commit/7c5bd43c501a3ac59a0b6705aa96e61d741ea75a))

## [1.64.4](https://github.com/Life-USTC/server/compare/v1.64.3...v1.64.4) (2026-07-19)


### Bug Fixes

* **a11y:** keep skip link overlay fixed ([aa4bc58](https://github.com/Life-USTC/server/commit/aa4bc587829670f10f216444c16c5f892ec820a5))
* **ui:** contain mobile navigation overflow ([48e8fa1](https://github.com/Life-USTC/server/commit/48e8fa177877be75a34aec76a9f3aec324a5f077))
* **ui:** contain narrow detail controls ([ce3d4a4](https://github.com/Life-USTC/server/commit/ce3d4a45a5807fffb87093131232acc0cba7fe72))
* **ui:** improve mobile shell accessibility ([5242767](https://github.com/Life-USTC/server/commit/52427670fdf0d93e775c68aa4aa65ae6b4e70243))
* **ui:** show bidirectional nav overflow cues ([f332ad6](https://github.com/Life-USTC/server/commit/f332ad6bc616832eb6817287ba2c4fc51c174c83))

## [1.64.3](https://github.com/Life-USTC/server/compare/v1.64.2...v1.64.3) (2026-07-19)


### Bug Fixes

* **api:** remove redundant request hot-path work ([bb84de4](https://github.com/Life-USTC/server/commit/bb84de40ae9cabf63746f2043e885d057ad19475))

## [1.64.2](https://github.com/Life-USTC/server/compare/v1.64.1...v1.64.2) (2026-07-19)


### Performance Improvements

* **dashboard:** split anonymous home from signed workspace ([#528](https://github.com/Life-USTC/server/issues/528)) ([1f95f1a](https://github.com/Life-USTC/server/commit/1f95f1ae6c3217aa354dca20519289b8f4444e9b))

## [1.64.1](https://github.com/Life-USTC/server/compare/v1.64.0...v1.64.1) (2026-07-19)


### Bug Fixes

* **seo:** declare SSR response language ([#527](https://github.com/Life-USTC/server/issues/527)) ([e94ebd8](https://github.com/Life-USTC/server/commit/e94ebd815930a846545616be0b5146a7e7708d84))


### Performance Improvements

* **seo:** cache crawler discovery documents ([#529](https://github.com/Life-USTC/server/issues/529)) ([2ad51e8](https://github.com/Life-USTC/server/commit/2ad51e8d0b432ef0565429210cc4e07c1d3b7532))

# [1.64.0](https://github.com/Life-USTC/server/compare/v1.63.2...v1.64.0) (2026-07-19)


### Bug Fixes

* **calendar:** persist personal feed exports ([#524](https://github.com/Life-USTC/server/issues/524)) ([7af7e39](https://github.com/Life-USTC/server/commit/7af7e3982bee7ada6f58587e99a2e2c23e5e5348))
* close infrastructure reliability gaps ([44fe108](https://github.com/Life-USTC/server/commit/44fe108bac1f47dcc3792a355bd75eb52465cee0))
* **static-loader:** avoid unchanged row rewrites ([d90e418](https://github.com/Life-USTC/server/commit/d90e4180ea55b08c4ef3a044129977ffc6642eb5))
* **ui:** apply theme before paint and optimize shell icon ([#522](https://github.com/Life-USTC/server/issues/522)) ([ee5eca3](https://github.com/Life-USTC/server/commit/ee5eca314ef29c64b8d938d1b250439902a7e0c8))


### Features

* **observability:** measure SSR page performance ([#521](https://github.com/Life-USTC/server/issues/521)) ([a7df149](https://github.com/Life-USTC/server/commit/a7df14945cbac69d3e115edf4ec1905f2b44ffc9))

## [1.63.2](https://github.com/Life-USTC/server/compare/v1.63.1...v1.63.2) (2026-07-19)


### Bug Fixes

* **mcp:** align compact markdown output schemas ([cdad8bb](https://github.com/Life-USTC/server/commit/cdad8bb7ef3def607e7f45d966837b7410f5055f))


### Performance Improvements

* **markdown:** avoid parser during read hydration ([c215ea5](https://github.com/Life-USTC/server/commit/c215ea5a0b4dbe44f14231ec7058a8f638d240ef))

## [1.63.1](https://github.com/Life-USTC/server/compare/v1.63.0...v1.63.1) (2026-07-19)


### Bug Fixes

* **api:** isolate localized catalog caches ([fe6771c](https://github.com/Life-USTC/server/commit/fe6771c414c26236179ddc0389cc8570b7f7c4d0))


### Performance Improvements

* trim detail page SSR critical paths ([7ee8169](https://github.com/Life-USTC/server/commit/7ee8169210e05aa90c80d45da8be6056b0f2bb2b))

# [1.63.0](https://github.com/Life-USTC/server/compare/v1.62.0...v1.63.0) (2026-07-19)


### Features

* **seo:** add AI discovery policy ([#509](https://github.com/Life-USTC/server/issues/509)) ([c255f13](https://github.com/Life-USTC/server/commit/c255f13def50fec4986b782f69a092833eeb1f6c))
* **seo:** add catalog structured data ([#510](https://github.com/Life-USTC/server/issues/510)) ([c9e2fb6](https://github.com/Life-USTC/server/commit/c9e2fb6aecbfa9ef9b7ea114d2cacaaff9562b33))


### Performance Improvements

* **sitemap:** cache generated document ([#508](https://github.com/Life-USTC/server/issues/508)) ([737e35a](https://github.com/Life-USTC/server/commit/737e35a7d4dd042538093c3462383c8c3c45e0c5))

# [1.62.0](https://github.com/Life-USTC/server/compare/v1.61.2...v1.62.0) (2026-07-17)


### Features

* **static-loader:** retire stale Sections safely ([#476](https://github.com/Life-USTC/server/issues/476)) ([3928bf1](https://github.com/Life-USTC/server/commit/3928bf1ba410f440a6f5b2cfc92701e3e00f09fa))

## [1.61.2](https://github.com/Life-USTC/server/compare/v1.61.1...v1.61.2) (2026-07-17)


### Bug Fixes

* **static-loader:** reconcile empty section teacher sets ([#478](https://github.com/Life-USTC/server/issues/478)) ([58fde7f](https://github.com/Life-USTC/server/commit/58fde7f29f30aa3b1de9540d2ba217333a6bd3cc))

## [1.61.1](https://github.com/Life-USTC/server/compare/v1.61.0...v1.61.1) (2026-07-17)


### Bug Fixes

* **db:** align section lifecycle schema ([#475](https://github.com/Life-USTC/server/issues/475)) ([92f5ba8](https://github.com/Life-USTC/server/commit/92f5ba83c5b759b1715ad5a017646aa78941ed68))

# [1.61.0](https://github.com/Life-USTC/server/compare/v1.60.0...v1.61.0) (2026-07-17)


### Features

* **db:** add section lifecycle storage ([#473](https://github.com/Life-USTC/server/issues/473)) ([0187e87](https://github.com/Life-USTC/server/commit/0187e878a1f109e19d6b28ff5a968ea5386f4910))
* **ops:** add database recovery gate ([#474](https://github.com/Life-USTC/server/issues/474)) ([b8d1030](https://github.com/Life-USTC/server/commit/b8d10309ced9445ef6409bbc1c12ab696a999caa))

# [1.60.0](https://github.com/Life-USTC/server/compare/v1.59.1...v1.60.0) (2026-07-17)


### Features

* **graphql:** add scoped personal mutations ([#472](https://github.com/Life-USTC/server/issues/472)) ([7588069](https://github.com/Life-USTC/server/commit/758806949891eda724c48a8391440d8adb4de906))

## [1.59.1](https://github.com/Life-USTC/server/compare/v1.59.0...v1.59.1) (2026-07-17)


### Performance Improvements

* **static-loader:** batch course reconciliation ([#470](https://github.com/Life-USTC/server/issues/470)) ([c8fef8b](https://github.com/Life-USTC/server/commit/c8fef8bfe9dbc0ca934371ba4009f565aeaeb72c))

# [1.59.0](https://github.com/Life-USTC/server/compare/v1.58.0...v1.59.0) (2026-07-17)


### Features

* **graphql:** add authenticated viewer queries ([#469](https://github.com/Life-USTC/server/issues/469)) ([dfd8fbd](https://github.com/Life-USTC/server/commit/dfd8fbd42c48b27f304f5f19d8f5aaaf3976f965))

# [1.58.0](https://github.com/Life-USTC/server/compare/v1.57.0...v1.58.0) (2026-07-17)


### Features

* **graphql:** add operation observability ([#465](https://github.com/Life-USTC/server/issues/465)) ([e6fa181](https://github.com/Life-USTC/server/commit/e6fa1815f3a62d2be970682053a537c4e243bf76))

# [1.57.0](https://github.com/Life-USTC/server/compare/v1.56.1...v1.57.0) (2026-07-17)


### Features

* **graphql:** add public query foundation ([#464](https://github.com/Life-USTC/server/issues/464)) ([185dcba](https://github.com/Life-USTC/server/commit/185dcba4cd5532a5bacfa6d34ce02404c1566636))

## [1.56.1](https://github.com/Life-USTC/server/compare/v1.56.0...v1.56.1) (2026-07-17)


### Bug Fixes

* **static-loader:** merge legacy course duplicates ([#458](https://github.com/Life-USTC/server/issues/458)) ([f58214b](https://github.com/Life-USTC/server/commit/f58214b1706001437550123b62726b2ffc7d4f00))

# [1.56.0](https://github.com/Life-USTC/server/compare/v1.55.3...v1.56.0) (2026-07-17)


### Features

* **db:** add course alias storage ([#463](https://github.com/Life-USTC/server/issues/463)) ([c57b58d](https://github.com/Life-USTC/server/commit/c57b58d0fefdc088f4625bab5529740e8b8efcf6))

## [1.55.3](https://github.com/Life-USTC/server/compare/v1.55.2...v1.55.3) (2026-07-17)


### Bug Fixes

* **shell:** simplify responsive navigation ([#462](https://github.com/Life-USTC/server/issues/462)) ([1aca8ea](https://github.com/Life-USTC/server/commit/1aca8ea479b4a83397eb01d4c15508fcafd7e4cf))

## [1.55.2](https://github.com/Life-USTC/server/compare/v1.55.1...v1.55.2) (2026-07-17)


### Bug Fixes

* **loader:** preserve imported teacher and class identities ([#456](https://github.com/Life-USTC/server/issues/456)) ([ffb0c7b](https://github.com/Life-USTC/server/commit/ffb0c7bf3e9d63791946a1f374d7bd4889040da3))

## [1.55.1](https://github.com/Life-USTC/server/compare/v1.55.0...v1.55.1) (2026-07-17)


### Bug Fixes

* **dashboard:** improve mobile planning views ([#459](https://github.com/Life-USTC/server/issues/459)) ([b799cd5](https://github.com/Life-USTC/server/commit/b799cd5f15a2c05ecd2609afcdfd7bc7b167f1ad))

# [1.55.0](https://github.com/Life-USTC/server/compare/v1.54.1...v1.55.0) (2026-07-17)


### Features

* **ui:** improve responsive public and admin workflows ([#455](https://github.com/Life-USTC/server/issues/455)) ([f4eecea](https://github.com/Life-USTC/server/commit/f4eecea2b6a67b9bfcef71341d00a2d15a620d0b))

## [1.54.1](https://github.com/Life-USTC/server/compare/v1.54.0...v1.54.1) (2026-07-17)


### Bug Fixes

* harden static snapshot imports ([#454](https://github.com/Life-USTC/server/issues/454)) ([22c544d](https://github.com/Life-USTC/server/commit/22c544dc3b93d3e1206d2c1122b15b9aa98eac29))
* **static-loader:** preserve campus and room meetings ([#453](https://github.com/Life-USTC/server/issues/453)) ([748b9f3](https://github.com/Life-USTC/server/commit/748b9f3ad1d82b8d9cb76589b12ba34b33efaa0f))
* **ui:** improve workspace and profile UX ([#457](https://github.com/Life-USTC/server/issues/457)) ([dc3c185](https://github.com/Life-USTC/server/commit/dc3c185f418fe180b8bcb116d11d499d76fd810e))

# [1.54.0](https://github.com/Life-USTC/server/compare/v1.53.2...v1.54.0) (2026-07-16)


### Features

* **api:** add application mutation rate limits ([#444](https://github.com/Life-USTC/server/issues/444)) ([51ed1e7](https://github.com/Life-USTC/server/commit/51ed1e757f401fefd73367460b3a04e61dddbc85))

## [1.53.2](https://github.com/Life-USTC/server/compare/v1.53.1...v1.53.2) (2026-07-15)


### Bug Fixes

* **loader:** preserve course identity across source IDs ([#443](https://github.com/Life-USTC/server/issues/443)) ([94b5826](https://github.com/Life-USTC/server/commit/94b58266def2d31fa3b2fb2d7f0f8de1e31be56c)), closes [#395](https://github.com/Life-USTC/server/issues/395)

## [1.53.1](https://github.com/Life-USTC/server/compare/v1.53.0...v1.53.1) (2026-07-15)


### Bug Fixes

* **api-docs:** make the reference reachable on mobile ([#442](https://github.com/Life-USTC/server/issues/442)) ([a9b92f7](https://github.com/Life-USTC/server/commit/a9b92f7f4e14486e8d8d171c2f5fdcbebc967ec6)), closes [#374](https://github.com/Life-USTC/server/issues/374)

# [1.53.0](https://github.com/Life-USTC/server/compare/v1.52.0...v1.53.0) (2026-07-15)


### Features

* **homework:** add advisory writing guide ([#441](https://github.com/Life-USTC/server/issues/441)) ([895a584](https://github.com/Life-USTC/server/commit/895a5841aa822f12d742e82020dead08933659c3)), closes [#344](https://github.com/Life-USTC/server/issues/344)

# [1.52.0](https://github.com/Life-USTC/server/compare/v1.51.7...v1.52.0) (2026-07-15)


### Features

* **metadata:** add social sharing cards ([#440](https://github.com/Life-USTC/server/issues/440)) ([707be37](https://github.com/Life-USTC/server/commit/707be371d3612135181a380ac2fb25d2248901ed)), closes [#403](https://github.com/Life-USTC/server/issues/403)

## [1.51.7](https://github.com/Life-USTC/server/compare/v1.51.6...v1.51.7) (2026-07-15)


### Bug Fixes

* **dashboard:** add semantic page identity ([#439](https://github.com/Life-USTC/server/issues/439)) ([6493d6b](https://github.com/Life-USTC/server/commit/6493d6bc95413c18a337b4214a335d028943aa9b)), closes [#376](https://github.com/Life-USTC/server/issues/376)

## [1.51.6](https://github.com/Life-USTC/server/compare/v1.51.5...v1.51.6) (2026-07-15)


### Bug Fixes

* **i18n:** polish localized interface copy ([#438](https://github.com/Life-USTC/server/issues/438)) ([4f2504f](https://github.com/Life-USTC/server/commit/4f2504f146dbc8737b387edda7baf7eb8b6d41ff)), closes [#401](https://github.com/Life-USTC/server/issues/401)

## [1.51.5](https://github.com/Life-USTC/server/compare/v1.51.4...v1.51.5) (2026-07-15)


### Bug Fixes

* **oauth:** clarify device code entry ([#437](https://github.com/Life-USTC/server/issues/437)) ([c61869c](https://github.com/Life-USTC/server/commit/c61869c3b9c9cb1a4459eba91035f20e4de4d323))

## [1.51.4](https://github.com/Life-USTC/server/compare/v1.51.3...v1.51.4) (2026-07-15)


### Bug Fixes

* **catalog:** improve mobile discovery and pagination ([#435](https://github.com/Life-USTC/server/issues/435)) ([30dc400](https://github.com/Life-USTC/server/commit/30dc400ad172e51c316a830837dad5bc13bcda8e))
* **subscriptions:** reject unscoped batch replacement ([c54e918](https://github.com/Life-USTC/server/commit/c54e9180466ade42ff96f073a37b3bddfc553b16))

## [1.51.3](https://github.com/Life-USTC/server/compare/v1.51.2...v1.51.3) (2026-07-15)


### Bug Fixes

* **subscriptions:** preserve cross-semester history ([29fd6e8](https://github.com/Life-USTC/server/commit/29fd6e8ba75af4b6aec848a0571d8eed2d1613ea))

## [1.51.2](https://github.com/Life-USTC/server/compare/v1.51.1...v1.51.2) (2026-07-15)


### Bug Fixes

* **mcp:** enforce canonical structured outputs ([#433](https://github.com/Life-USTC/server/issues/433)) ([7f6c2b4](https://github.com/Life-USTC/server/commit/7f6c2b482d537eff6c1ab39899dbb050f161dfce)), closes [#405](https://github.com/Life-USTC/server/issues/405) [#406](https://github.com/Life-USTC/server/issues/406) [#415](https://github.com/Life-USTC/server/issues/415)

## [1.51.1](https://github.com/Life-USTC/server/compare/v1.51.0...v1.51.1) (2026-07-15)


### Bug Fixes

* **dashboard:** keep past-term data discoverable ([#432](https://github.com/Life-USTC/server/issues/432)) ([5da15f2](https://github.com/Life-USTC/server/commit/5da15f28e9a72d10ee41345f1d8b77ef7a1854a9))

# [1.51.0](https://github.com/Life-USTC/server/compare/v1.50.1...v1.51.0) (2026-07-14)


### Features

* **api:** standardize paginated list responses ([#429](https://github.com/Life-USTC/server/issues/429)) ([fa0c69d](https://github.com/Life-USTC/server/commit/fa0c69d3cfd1ab810b5cd46fa959d261ad7e08db)), closes [#363](https://github.com/Life-USTC/server/issues/363) [#407](https://github.com/Life-USTC/server/issues/407)

## [1.50.1](https://github.com/Life-USTC/server/compare/v1.50.0...v1.50.1) (2026-07-14)


### Bug Fixes

* **api:** align pagination query names ([#427](https://github.com/Life-USTC/server/issues/427)) ([496c8a6](https://github.com/Life-USTC/server/commit/496c8a63eb40e702c25293ab4205f4f9b1329ae1)), closes [#413](https://github.com/Life-USTC/server/issues/413)

# [1.50.0](https://github.com/Life-USTC/server/compare/v1.49.6...v1.50.0) (2026-07-14)


### Features

* **api:** return 201 for created resources ([#426](https://github.com/Life-USTC/server/issues/426)) ([ad91c93](https://github.com/Life-USTC/server/commit/ad91c93128d64df22af8f9f108ed49e1f3035368)), closes [#411](https://github.com/Life-USTC/server/issues/411)

## [1.49.6](https://github.com/Life-USTC/server/compare/v1.49.5...v1.49.6) (2026-07-14)


### Bug Fixes

* **seed:** make scenario loading repeatable ([#424](https://github.com/Life-USTC/server/issues/424)) ([3bb3cf9](https://github.com/Life-USTC/server/commit/3bb3cf97eb02e854ab5096642a73550f86b83db6))
* **uploads:** keep list reads side-effect free ([#422](https://github.com/Life-USTC/server/issues/422)) ([d87c3aa](https://github.com/Life-USTC/server/commit/d87c3aac13d1512e0b2098185e61f08cd5fe360d))

## [1.49.5](https://github.com/Life-USTC/server/compare/v1.49.4...v1.49.5) (2026-07-14)


### Bug Fixes

* **build:** emit font assets for CSP ([#419](https://github.com/Life-USTC/server/issues/419)) ([3ecda3b](https://github.com/Life-USTC/server/commit/3ecda3b07f7746a4ee1bbcc2c809c4d09ada42aa)), closes [#397](https://github.com/Life-USTC/server/issues/397)
* **catalog:** prevent mobile page overflow ([#420](https://github.com/Life-USTC/server/issues/420)) ([f283bf2](https://github.com/Life-USTC/server/commit/f283bf25adf1c328886a2ec685664f109c152724)), closes [#396](https://github.com/Life-USTC/server/issues/396)
* **mcp:** install tools/list wrapper once ([#418](https://github.com/Life-USTC/server/issues/418)) ([288d20c](https://github.com/Life-USTC/server/commit/288d20ce94298742c6062ff2fc9980dc26c25273)), closes [#409](https://github.com/Life-USTC/server/issues/409)

## [1.49.4](https://github.com/Life-USTC/server/compare/v1.49.3...v1.49.4) (2026-07-14)


### Bug Fixes

* **api:** return JSON for unknown routes ([#416](https://github.com/Life-USTC/server/issues/416)) ([16cc9ba](https://github.com/Life-USTC/server/commit/16cc9ba9587d30a5e12c0dd19545e1c191aebbab)), closes [#402](https://github.com/Life-USTC/server/issues/402)
* **calendar:** serialize DTSTAMP in UTC ([#417](https://github.com/Life-USTC/server/issues/417)) ([c541157](https://github.com/Life-USTC/server/commit/c541157328b14b5f3f9e0988775562905b1fcaa7)), closes [#404](https://github.com/Life-USTC/server/issues/404)

## [1.49.3](https://github.com/Life-USTC/server/compare/v1.49.2...v1.49.3) (2026-07-14)


### Bug Fixes

* **bus:** keep transit map legible on mobile ([#392](https://github.com/Life-USTC/server/issues/392)) ([f645d48](https://github.com/Life-USTC/server/commit/f645d4818b0578798b7c5569454170d0d29bff43))
* **calendar:** remove dead links from section events ([#394](https://github.com/Life-USTC/server/issues/394)) ([0dc931c](https://github.com/Life-USTC/server/commit/0dc931c9507d071a8b60c8520252ab994d972db4))
* **catalog:** contain sections table overflow ([#393](https://github.com/Life-USTC/server/issues/393)) ([4946d10](https://github.com/Life-USTC/server/commit/4946d10ed15798285bc5e014bc81aa2e98049df7))
* **ci:** gate database migrations on CI ([#391](https://github.com/Life-USTC/server/issues/391)) ([251ef88](https://github.com/Life-USTC/server/commit/251ef888ee0346a7d4a111ef3207626889994615))

## [1.49.2](https://github.com/Life-USTC/server/compare/v1.49.1...v1.49.2) (2026-07-14)


### Bug Fixes

* **ci:** fail exhausted retry loops ([#390](https://github.com/Life-USTC/server/issues/390)) ([a957acb](https://github.com/Life-USTC/server/commit/a957acb4af3748711fd77caeaae9e509c619befa))

## [1.49.1](https://github.com/Life-USTC/server/compare/v1.49.0...v1.49.1) (2026-07-07)


### Bug Fixes

* keep sidebar groups open and disable collapse trigger in icon mode ([4344303](https://github.com/Life-USTC/server/commit/43443034f9ce66a2c9998ed4e2114df665bc25c9)), closes [#350](https://github.com/Life-USTC/server/issues/350)

# [1.49.0](https://github.com/Life-USTC/server/compare/v1.48.2...v1.49.0) (2026-07-07)


### Bug Fixes

* **AppSidebar:** split parent link and collapsible trigger ([26a5c02](https://github.com/Life-USTC/server/commit/26a5c02b90c0c46ac5698f98f857d7d8adc47235))
* collapse Dashboard pages into a sidebar submenu ([ff16ba1](https://github.com/Life-USTC/server/commit/ff16ba1e1ca9994c09e373497d488e4d642c563e)), closes [#349](https://github.com/Life-USTC/server/issues/349)
* **shell:** expand dashboard submenu and restore dashboard badge counts in sidebar ([df98251](https://github.com/Life-USTC/server/commit/df98251202391094f0de86085a4886e3ce99637a))
* **shell:** restore scroll reset and sidebar visibility with ScrollArea ([9ba704a](https://github.com/Life-USTC/server/commit/9ba704a0760eb5009b06d4284eeb90102e4cd51b))
* **shell:** revert content ScrollArea to avoid layout regression ([274677f](https://github.com/Life-USTC/server/commit/274677fa569b0f7c8fa14ed72c73cf6f888f708b))
* **shell:** support collapsible items in AppSidebar for admin tools ([4caec7b](https://github.com/Life-USTC/server/commit/4caec7bcac1c41ed225434a78d67ca6abd51c7d3))
* show admin tools in sidebar for admin users ([42730b7](https://github.com/Life-USTC/server/commit/42730b7d6f9c094e15b5313952696f0d6d86caf4)), closes [#348](https://github.com/Life-USTC/server/issues/348)
* **sidebar:** keep nested link menus expanded and fix dashboard trigger locator ([50ec6df](https://github.com/Life-USTC/server/commit/50ec6df430874228e88f665a767c19c51e252bff))
* sync AppSidebar with fix-sidebar-secondary-pages ([#355](https://github.com/Life-USTC/server/issues/355)) ([b231a4b](https://github.com/Life-USTC/server/commit/b231a4ba648da01a787a96252b4fcb94b6f38c78))
* wrap main content slot in ScrollArea and avoid double scroll in detail pages ([6e8c5f3](https://github.com/Life-USTC/server/commit/6e8c5f390a1fe5e6f4004b4c8476285e4aafebd1)), closes [#347](https://github.com/Life-USTC/server/issues/347)


### Features

* **mcp:** filter subscribed data by semester ([1bab725](https://github.com/Life-USTC/server/commit/1bab725f6f15e414a4ec0a35e73ea7ed2e962eb7))
* **shell:** add dynamic secondary links for detail pages and subscriptions ([b053e83](https://github.com/Life-USTC/server/commit/b053e83f19b9a690ca0930e01463b02135bc1800))

## [1.48.2](https://github.com/Life-USTC/server/compare/v1.48.1...v1.48.2) (2026-07-07)


### Bug Fixes

* **detail:** unify PageHeader/SectionDetailHeader background with bg-card ([547a805](https://github.com/Life-USTC/server/commit/547a80521359145e33354ad131198c1330484a43))
* remove unused DetailPinnedSummary component ([56c3658](https://github.com/Life-USTC/server/commit/56c3658705e5c24fbd1790dd713d0080f3032629))
* unify section detail header style with PageHeader ([68ba8c9](https://github.com/Life-USTC/server/commit/68ba8c9b9b2564691c6e2287c736eaf4df27a7a4)), closes [#346](https://github.com/Life-USTC/server/issues/346)

## [1.48.1](https://github.com/Life-USTC/server/compare/v1.48.0...v1.48.1) (2026-07-07)


### Bug Fixes

* **loader:** deploy migrations in docker entrypoint ([48f6b8d](https://github.com/Life-USTC/server/commit/48f6b8dfdc6dd1caed3041bef220d71338984093))
* **loader:** upsert AdminClass by unique nameCn ([b8a01a7](https://github.com/Life-USTC/server/commit/b8a01a79bfd4c3ad59750c03c363437dd0972ac5))


### Performance Improvements

* **loader:** replace row-by-row Prisma upserts with bulk SQL ([737eccd](https://github.com/Life-USTC/server/commit/737eccda154f844a7ab14a09a5e7c383dd2952e0))

# [1.48.0](https://github.com/Life-USTC/server/compare/v1.47.0...v1.48.0) (2026-07-07)


### Bug Fixes

* **loader:** correct SectionTeacher retire and schedule-teacher join mapping ([bd959cd](https://github.com/Life-USTC/server/commit/bd959cdfa01e918520a0cbf0c6d422500eee1a5d))
* **loader:** deduplicate teacher titles by nameCn before upsert ([f0e65d0](https://github.com/Life-USTC/server/commit/f0e65d0c81482989bbb63f2247bf0a50af1d6c58))
* **loader:** harden snapshot CLI and update CI smoke test ([683a152](https://github.com/Life-USTC/server/commit/683a152caade58cdb7b7251c7238ec81335f853f))


### Features

* **static-loader:** add prisma-based static import CLI ([315b149](https://github.com/Life-USTC/server/commit/315b14965e1b80f2293629a0874ff6c0aa1d671f))

# [1.47.0](https://github.com/Life-USTC/server/compare/v1.46.0...v1.47.0) (2026-07-06)


### Bug Fixes

* **audit:** import order, trailing newline, built-in glob, class directives ([33f2558](https://github.com/Life-USTC/server/commit/33f25583666b2964f16eb62f4667a4790cafb09d))
* **audit:** sort file list for reproducible output ([e3b7bcb](https://github.com/Life-USTC/server/commit/e3b7bcbe24da2551466fad1ce092ce6390d97e68))
* **classifier:** template literals, helper calls, tabular-nums, space utilities ([7694f2d](https://github.com/Life-USTC/server/commit/7694f2d70d8b4df49bc8e1f8acada89d6c701e63))
* **dashboard:** restore sessionHref prop removed during cleanup ([13ca235](https://github.com/Life-USTC/server/commit/13ca235e587b79d956351661066662fb145498bc))
* **lint:** add shadcn class usage baseline allowlist ([744faed](https://github.com/Life-USTC/server/commit/744faedd4dc05114044f29c3890a8852bf347900))
* **review:** address code review feedback for shadcn styling cleanup ([9231b29](https://github.com/Life-USTC/server/commit/9231b294d649f27a154caff6f74aed4ad9270edd))


### Features

* **ci:** add shadcn class usage lint guard ([9a9b6ba](https://github.com/Life-USTC/server/commit/9a9b6ba1d75a9537f30d84b7c3ed76e6bb586344))

# [1.46.0](https://github.com/Life-USTC/server/compare/v1.45.1...v1.46.0) (2026-07-06)


### Bug Fixes

* add shadcn module export declarations ([5c41ffb](https://github.com/Life-USTC/server/commit/5c41ffbe91596ab800b16a17c098e2066f864e17))
* align public web e2e with alert dialogs ([5d27ec3](https://github.com/Life-USTC/server/commit/5d27ec359ef99f0282732e06c1229eede2362844))
* align scroll area sizing with shadcn docs ([df0d0d4](https://github.com/Life-USTC/server/commit/df0d0d4048c99adcbc5f7c49db48e44385e5b8a9))
* align shadcn component semantics ([be34a89](https://github.com/Life-USTC/server/commit/be34a896b54a9d0e0432c04835125be1cb5d0c61))
* align shadcn component usage ([f0fe904](https://github.com/Life-USTC/server/commit/f0fe90487a180f4243227424bbeb90b01adbd3ad))
* align shadcn component usage ([4f0a241](https://github.com/Life-USTC/server/commit/4f0a241c2daf16f8401de6f6b4e8efb05dfe736f))
* align shell header and simplify theme trigger ([9354582](https://github.com/Life-USTC/server/commit/93545822102ca1d5caaa7a3032d9b49a8a6a743f))
* align sidebar composition with shadcn docs ([7f10691](https://github.com/Life-USTC/server/commit/7f10691da1baa5b68f0e17ee29f2f5094d85f047))
* align stock shadcn dialog behavior ([cf67c26](https://github.com/Life-USTC/server/commit/cf67c2679b91cab9b9cdd103d30e3855c38e9f90))
* allow nullable mcp output messages ([cd4a20a](https://github.com/Life-USTC/server/commit/cd4a20a4b3c74f39e7ef6ff47ad35723a8f0d188))
* avoid duplicate homework shortcut labels ([55351e0](https://github.com/Life-USTC/server/commit/55351e00eebfa5a70b6d27a0c38fbe8cfa155f13))
* disambiguate dashboard utility nav labels ([1c314ae](https://github.com/Life-USTC/server/commit/1c314ae12ec3ff2a1123368f26fe5c29b8fddade))
* import shadcn tailwind variants ([10d8863](https://github.com/Life-USTC/server/commit/10d88634f66fb29ed77b44598e649ff47f707ba5))
* inline detail nav counters ([79ee757](https://github.com/Life-USTC/server/commit/79ee7577fc0358073067b6340f6575a2b751d0ce))
* normalize secondary sidebar active state ([bf6e082](https://github.com/Life-USTC/server/commit/bf6e082dd860ce41cf317ed07be1c37eff69fd7c))
* pin detail workspace panes ([4cb93f9](https://github.com/Life-USTC/server/commit/4cb93f9d8370fa63f0d7aa27b3799756a14fe57d))
* preserve dashboard navigation semantics ([ec357d4](https://github.com/Life-USTC/server/commit/ec357d41739d13366980c05877331ea243c353bd))
* preserve shell sidebar semantics ([077fa8d](https://github.com/Life-USTC/server/commit/077fa8d4f69609529a97e754fd25efd60b79156e))
* redesign OAuth authorize consent screen ([77a4f69](https://github.com/Life-USTC/server/commit/77a4f69790cff52438716496620e194613080642))
* refine detail header contrast ([13ec6b6](https://github.com/Life-USTC/server/commit/13ec6b6d95ada5971f33d1885287e3db9a7fe382))
* refine detail sidebar layout ([0d58e5e](https://github.com/Life-USTC/server/commit/0d58e5e9779ada14a01300c0c73dec43f24e3149))
* refine detail workspace density ([34a0900](https://github.com/Life-USTC/server/commit/34a0900ecdf4a993b6b5eca59b1b045067f9284c))
* refine settings and dashboard visual hierarchy ([89d18a8](https://github.com/Life-USTC/server/commit/89d18a8c76e7e0cc64c357d92d78058c43375ac2))
* remove breadcrumbs ([a54a9bd](https://github.com/Life-USTC/server/commit/a54a9bd0ff643869771ac7e4b65570fe8e35a8cd))
* remove detail workspace border treatment ([c14bde3](https://github.com/Life-USTC/server/commit/c14bde3a83f48ed2093031f921486001b5703b1f))
* remove detail workspace clipping ([34a635d](https://github.com/Life-USTC/server/commit/34a635d465523425a7a95544663dd6e9cb2d7d6f))
* restore content scroll reset on navigation ([b251988](https://github.com/Life-USTC/server/commit/b25198886a0ebf8976f35a1729e0fb71d1fb7079))
* restore detail nav counter pills ([a0bfdd0](https://github.com/Life-USTC/server/commit/a0bfdd0091829b4761adbbad20d2aabb13243e6d))
* restore route title heading semantics ([a75d2c9](https://github.com/Life-USTC/server/commit/a75d2c97456f74f111769219d3ee766081c553cd))
* satisfy item import ordering ([7051f3e](https://github.com/Life-USTC/server/commit/7051f3ec66a64345abd88e851894f5c640c1180c))
* show exam count as nav pill ([8c8e479](https://github.com/Life-USTC/server/commit/8c8e479d10eb75f46265c14418c18c42a11f7ee5))
* simplify detail sticky header ([308467f](https://github.com/Life-USTC/server/commit/308467f1a14e240586c6b7b04e813831555d2023))
* soften sidebar active states ([06cee6d](https://github.com/Life-USTC/server/commit/06cee6dd06cddd35806646f0c69c985b93e315d0))
* stabilize dashboard and detail layouts ([4af69e4](https://github.com/Life-USTC/server/commit/4af69e47c4e23d9be8f6af161ef98148a82a392b))
* use native shadcn sidebar controls ([b40b1df](https://github.com/Life-USTC/server/commit/b40b1dfd7991371daa28659a20bcb62ba6c916a2))
* use stock shadcn sidebar ([649eb08](https://github.com/Life-USTC/server/commit/649eb08c09f5ad083865587f477c1e2556c3cbba))


### Features

* add catalog filter sidebars ([b964441](https://github.com/Life-USTC/server/commit/b964441deed5b53f62596509eb72c6ddca9272b1))
* add collapsible sidebars ([af9c130](https://github.com/Life-USTC/server/commit/af9c13084f824b9e660d7f7bbefc5fd5a39e6cb0))
* add native sidebar rail affordance ([60561e6](https://github.com/Life-USTC/server/commit/60561e68e9b31880a50b614ebda1ffbb263d24c3))
* align UI with shadcn design system ([10c0923](https://github.com/Life-USTC/server/commit/10c09237ec26c633fa75025531a293d0bc616437))
* move sidebar toggles to bottom ([1081bae](https://github.com/Life-USTC/server/commit/1081baed3c0870dd20ae8708bc4e0bb079791d9d))
* pin detail page summary and section nav ([0800140](https://github.com/Life-USTC/server/commit/0800140f47aae003b3338b6b377c5b0ae7ea0782))
* preview collapsed sidebars on hover ([b5d472e](https://github.com/Life-USTC/server/commit/b5d472e2489fbe143386e6bd0440202995c37c22))
* redesign app shell as dashboard ([3586350](https://github.com/Life-USTC/server/commit/35863504666d4ab96e7e6012a6b238ed99ce9a3b))
* redesign detail pages with section nav ([4fd41a9](https://github.com/Life-USTC/server/commit/4fd41a953ccb1d89d9a1971cfa84cbc2238efbe6))
* refine dashboard shell and mobile app page ([98c1c43](https://github.com/Life-USTC/server/commit/98c1c43d7ba0e3bc7837a38cb1619215b013360b))
* route detail sections through secondary nav ([6feddb1](https://github.com/Life-USTC/server/commit/6feddb14c31def5702fd5ad45666900bbf5bee2f))

## [1.45.1](https://github.com/Life-USTC/server/compare/v1.45.0...v1.45.1) (2026-07-03)


### Bug Fixes

* verify static loader runtime ([e09b2e0](https://github.com/Life-USTC/server/commit/e09b2e008406dc17a6bd1ceac8de3a435c242c2b))

# [1.45.0](https://github.com/Life-USTC/server/compare/v1.44.3...v1.45.0) (2026-07-03)


### Features

* import static sqlite snapshot in loader ([882fd90](https://github.com/Life-USTC/server/commit/882fd904c40cc62c494d0cb5ccbea32d1c020e73))

## [1.44.3](https://github.com/Life-USTC/server/compare/v1.44.2...v1.44.3) (2026-07-03)


### Bug Fixes

* keep mcp transport stateless ([d8eef92](https://github.com/Life-USTC/server/commit/d8eef9287c0ebb497c56967175592b717095b45a))

## [1.44.2](https://github.com/Life-USTC/server/compare/v1.44.1...v1.44.2) (2026-07-02)


### Bug Fixes

* **oauth:** avoid slow consent redirect retries ([ef20b37](https://github.com/Life-USTC/server/commit/ef20b374ff956d370545488c76c94e57c9609854))

## [1.44.1](https://github.com/Life-USTC/server/compare/v1.44.0...v1.44.1) (2026-07-02)


### Bug Fixes

* **oauth:** narrow device grant raw prisma client ([ee04fec](https://github.com/Life-USTC/server/commit/ee04fec56417f5159c7e4cea50313e5e1f0b17f8))
* **oauth:** require device approval update to commit ([f683d2e](https://github.com/Life-USTC/server/commit/f683d2ea00e3551b58d8b0ba79b0ea1f7b8c18d0))
* **oauth:** support device grant prisma mocks ([04c1207](https://github.com/Life-USTC/server/commit/04c12073308fc3cbf9332a8b49af68efce8acdf2))

# [1.44.0](https://github.com/Life-USTC/server/compare/v1.43.0...v1.44.0) (2026-07-02)


### Features

* cache personal iCal feeds ([ed8ca87](https://github.com/Life-USTC/server/commit/ed8ca876c540d287432dbdeb50eb9399d54fb47f))

# [1.43.0](https://github.com/Life-USTC/server/compare/v1.42.1...v1.43.0) (2026-07-02)


### Features

* add cloudflare analytics engine metrics ([38a464b](https://github.com/Life-USTC/server/commit/38a464b4092fe30695aeecf2f4a30992c77e2611))
* extend analytics engine observability ([8eff75b](https://github.com/Life-USTC/server/commit/8eff75b419fbf7548a62d0025cf5fbfaa822f757))

## [1.42.1](https://github.com/Life-USTC/server/compare/v1.42.0...v1.42.1) (2026-06-30)


### Bug Fixes

* **ci:** update e2e report commit comments ([e6294cf](https://github.com/Life-USTC/server/commit/e6294cf791da90b7b8db47dcf60b11344b07ad9d))
* **oauth:** advertise canonical protected resource scopes ([d68b774](https://github.com/Life-USTC/server/commit/d68b7743d240257115d46e93b8021e5025dfa85f))

# [1.42.0](https://github.com/Life-USTC/server/compare/v1.41.0...v1.42.0) (2026-06-30)


### Bug Fixes

* **oauth:** re-export scope helpers and update protected-resource discovery ([9991cec](https://github.com/Life-USTC/server/commit/9991cec3ea0051855f311f56820669bc7b440ae9))
* **oauth:** restore legacy scope tolerance and accept feature MCP scopes end-to-end ([09bbef3](https://github.com/Life-USTC/server/commit/09bbef38fa20b77ba47f3fd49786e738e7587c12))
* **openapi:** correct /api/metrics tag/security and add .well-known Location headers ([27df0ea](https://github.com/Life-USTC/server/commit/27df0eac1d98a020a6cfe7c1aaf9890f7f10d023))
* **openapi:** discover .well-known routes and function-declaration handlers ([201ca88](https://github.com/Life-USTC/server/commit/201ca882b58943a23889a8c56e8d059d1e69ef73))


### Features

* **api:** align scopes and subscription contracts ([cd4b8ca](https://github.com/Life-USTC/server/commit/cd4b8cac35a53965b1089c97658eab53788dd1d4))
* **auth:** verify access tokens with jose and feature scopes ([743a286](https://github.com/Life-USTC/server/commit/743a28617212eaf55c323cfbf106093c70b7dc9e))
* **comments:** add DELETE /api/comments/batch ([6ad583e](https://github.com/Life-USTC/server/commit/6ad583eb816907688bacd3730dad861d94f54236))
* **dashboard-links:** add batch pin endpoint ([445a60b](https://github.com/Life-USTC/server/commit/445a60b2248736400805c19593257f47734f20af))
* **mcp:** enforce per-tool feature scopes ([d3c5854](https://github.com/Life-USTC/server/commit/d3c585415848727d58bfcb867b3e8716a6279472))
* **oauth:** advertise and allow feature-level scopes in provider ([9fb4431](https://github.com/Life-USTC/server/commit/9fb4431211b8ecf8998bb1517b2353f882a75064))
* **oauth:** define feature-level scope registry ([e15907b](https://github.com/Life-USTC/server/commit/e15907b3c641c87233e6144354708e067a3408ad))
* **openapi:** implement JSDoc/Zod to OpenAPI generator ([8172aca](https://github.com/Life-USTC/server/commit/8172aca70873c6fdf557845073563b3e2dbb3b52))
* **todos:** add DELETE /api/todos/batch ([d92e7f5](https://github.com/Life-USTC/server/commit/d92e7f58c0ea1c177a33fa37676de368618d60ab))
* **todos:** add PATCH /api/todos/batch ([0362161](https://github.com/Life-USTC/server/commit/036216167fa9b25661aa9bfdd3488a588c1d13be))

# [1.41.0](https://github.com/Life-USTC/server/compare/v1.40.0...v1.41.0) (2026-06-29)


### Features

* **seo,ui:** dynamic sitemap and simplify section calendar tab ([8dff74c](https://github.com/Life-USTC/server/commit/8dff74cfc4f6f79b8f3802076714c6f95313ef0d))

# [1.40.0](https://github.com/Life-USTC/server/compare/v1.39.33...v1.40.0) (2026-06-28)


### Features

* **ci:** publish merged Playwright HTML report to e2e-snapshot-artifacts ([6d73196](https://github.com/Life-USTC/server/commit/6d73196431d5ef201700ad728efcc1b8ad665b24))
* **tests:** add mobile-size screenshots to E2E suite ([758bb05](https://github.com/Life-USTC/server/commit/758bb052a3e95babe8912413afd389137fcdd04b))

## [1.39.33](https://github.com/Life-USTC/server/compare/v1.39.32...v1.39.33) (2026-06-27)


### Bug Fixes

* **dashboard:** reflect todo toggle/delete state immediately without stale invalidation ([f4a9b0b](https://github.com/Life-USTC/server/commit/f4a9b0becde3873eda7a1ae0fbe3007a47fee25d))

## [1.39.32](https://github.com/Life-USTC/server/compare/v1.39.31...v1.39.32) (2026-06-27)


### Bug Fixes

* **ci:** upload full .svelte-kit artifact and move prisma seed to config ([7c48bef](https://github.com/Life-USTC/server/commit/7c48bef9aab2f4904a079ce4b7e70b018aab08f2))
* **prisma:** use shell script wrapper for seed command ([01487d7](https://github.com/Life-USTC/server/commit/01487d7cb6579681faf1235c6f8191d1cd58df30))
* **wrangler:** use DATABASE_URL env var for E2E hyperdrive local connection ([0c66d9b](https://github.com/Life-USTC/server/commit/0c66d9b0fb822721b5b685768c0063a92d08232f))

## [1.39.31](https://github.com/Life-USTC/server/compare/v1.39.30...v1.39.31) (2026-06-26)


### Bug Fixes

* **comments:** make homework permalinks target-aware ([680d43f](https://github.com/Life-USTC/server/commit/680d43f68549e855393d66ee58b705bb7902020f))

## [1.39.30](https://github.com/Life-USTC/server/compare/v1.39.29...v1.39.30) (2026-06-26)


### Bug Fixes

* **db:** await cloudflare runtime context ([18ef613](https://github.com/Life-USTC/server/commit/18ef613d9f67ce49064939d57e271121ece7be59))
* **db:** clear cloudflare prisma request cache ([c94383a](https://github.com/Life-USTC/server/commit/c94383ae945f93d804f63fd0a3473f5dedbab4be))
* **db:** reuse prisma within cloudflare requests ([ffa1cad](https://github.com/Life-USTC/server/commit/ffa1cadb33c0713ec4b0bc3fc2547727a8783e4a))

## [1.39.29](https://github.com/Life-USTC/server/compare/v1.39.28...v1.39.29) (2026-06-26)


### Bug Fixes

* **audit:** move writes into shared mutations ([f3e0ea6](https://github.com/Life-USTC/server/commit/f3e0ea65a9a906307af78fb7568a7a7efa698994))
* **openapi:** document admin 403 and calendar media ([37b8da0](https://github.com/Life-USTC/server/commit/37b8da0e0e871db0ece81c63da62ed2a3c4f6e5b))

## [1.39.28](https://github.com/Life-USTC/server/compare/v1.39.27...v1.39.28) (2026-06-26)


### Bug Fixes

* **tools:** clean up local tooling defaults ([62adbf7](https://github.com/Life-USTC/server/commit/62adbf73f5acb04ca4c70b28bc687e9b822a44e2))

## [1.39.27](https://github.com/Life-USTC/server/compare/v1.39.26...v1.39.27) (2026-06-26)


### Bug Fixes

* **snapshot:** align section tab selector ([0e4ebfc](https://github.com/Life-USTC/server/commit/0e4ebfc2f0dc2a27176034a1818b680575179302))
* **ui:** improve accessibility semantics ([a09fa00](https://github.com/Life-USTC/server/commit/a09fa00e7cabdf6ef02ebad4edb2cbc010febb5c))

## [1.39.26](https://github.com/Life-USTC/server/compare/v1.39.25...v1.39.26) (2026-06-26)


### Bug Fixes

* **homeworks:** share timestamp defaults ([74a0f8f](https://github.com/Life-USTC/server/commit/74a0f8f590294e59776a4a42b4437c276ee10472))
* **section:** navigate calendar today to current month ([81cb2c2](https://github.com/Life-USTC/server/commit/81cb2c2987029791bfd6562f207e8e6270ffac7c))

## [1.39.25](https://github.com/Life-USTC/server/compare/v1.39.24...v1.39.25) (2026-06-26)


### Bug Fixes

* **api:** align REST auth parsing and OpenAPI docs ([a73d8f8](https://github.com/Life-USTC/server/commit/a73d8f827a2ca18e78800fa63d8455ed2dbfb33e))

## [1.39.24](https://github.com/Life-USTC/server/compare/v1.39.23...v1.39.24) (2026-06-26)


### Bug Fixes

* **admin:** make audit trails durable ([9dd6c01](https://github.com/Life-USTC/server/commit/9dd6c01bf28e4cf5f5ea2f715394d1a41e6024c9))
* **comments:** align privacy and guard writes ([b6f04bd](https://github.com/Life-USTC/server/commit/b6f04bd6a191e0fe582baa603678b16a24e6a660))
* **dashboard:** stabilize bus SSR time ([4422cb3](https://github.com/Life-USTC/server/commit/4422cb3245bdad4964d69d1cf66f25e5fb8e4764))
* **snapshot:** harden workflow tooling ([542068a](https://github.com/Life-USTC/server/commit/542068a3e4b988694d33309566dd2b84a0b207d1))

## [1.39.23](https://github.com/Life-USTC/server/compare/v1.39.22...v1.39.23) (2026-06-26)


### Bug Fixes

* **api:** align mcp query contract validation ([331e441](https://github.com/Life-USTC/server/commit/331e4415263ba653d82b9c9514b400253dad2809))
* **e2e:** use copied worker entrypoint ([8661335](https://github.com/Life-USTC/server/commit/86613356a3eb43c39466c97010d6b3d1afc69a05))

## [1.39.22](https://github.com/Life-USTC/server/compare/v1.39.21...v1.39.22) (2026-06-26)


### Bug Fixes

* **audit:** harden scheduling and profile username races ([139eddc](https://github.com/Life-USTC/server/commit/139eddc044c691ff83e409f3c81f2776255ae5c5))
* **dashboard:** improve dashboard and comment UI i18n ([8096b6b](https://github.com/Life-USTC/server/commit/8096b6b55f999f71c034b73800e6bda7db0cc136))

## [1.39.21](https://github.com/Life-USTC/server/compare/v1.39.20...v1.39.21) (2026-06-26)


### Bug Fixes

* harden upload delete and mcp rename ([764c819](https://github.com/Life-USTC/server/commit/764c81938cdab12ed58d4acdb189c26c3a92a330))
* reject unsafe loader semesters ([058c552](https://github.com/Life-USTC/server/commit/058c55293f4389d8f2e259a597feabd9466a9806))
* validate static loader options ([4ba45b1](https://github.com/Life-USTC/server/commit/4ba45b16e4e7dfc0e5cbb100d236afb446a6b5d7))

## [1.39.20](https://github.com/Life-USTC/server/compare/v1.39.19...v1.39.20) (2026-06-26)


### Bug Fixes

* **dashboard:** sync calendar navigation and homework errors ([4c6560a](https://github.com/Life-USTC/server/commit/4c6560a7de06c8bd41332860869d9c4c78d21ad3))
* **ui:** align accessible control semantics ([a54ecd0](https://github.com/Life-USTC/server/commit/a54ecd05509c0b35c200ea14ccc8f9a9ceb90da8))

## [1.39.19](https://github.com/Life-USTC/server/compare/v1.39.18...v1.39.19) (2026-06-26)


### Bug Fixes

* **audit/admin:** harden writes and username races ([8c1b89b](https://github.com/Life-USTC/server/commit/8c1b89b8bdec3650b072cc59d2254d8131ae86d4))
* **audit:** lazy-load request event access ([4caa1bc](https://github.com/Life-USTC/server/commit/4caa1bc55f1afe531794235df15dc22381c25623))
* **upload:** harden completion and filenames ([440b903](https://github.com/Life-USTC/server/commit/440b903cf7c4afc034d5273bd7fcfc19494f7e82))
* **upload:** share filename control character helper ([e0e05de](https://github.com/Life-USTC/server/commit/e0e05def61036acaf8cf396be9673632f4f24eff))

## [1.39.18](https://github.com/Life-USTC/server/compare/v1.39.17...v1.39.18) (2026-06-26)


### Bug Fixes

* **api:** align schema ownership boundary ([4af6b01](https://github.com/Life-USTC/server/commit/4af6b010961114da0a76dde7ef68c5e1733bcfe1))
* **tools:** use AST readers for source checks ([5abd662](https://github.com/Life-USTC/server/commit/5abd6629ffcf7900fe33c71e2e247c049fe47c8b))

## [1.39.17](https://github.com/Life-USTC/server/compare/v1.39.16...v1.39.17) (2026-06-26)


### Bug Fixes

* **ci:** trigger copilot setup for setup inputs ([907962b](https://github.com/Life-USTC/server/commit/907962b491235d71cb3276f6604a1556258aabf8))
* **test:** run snapshot prerequisites locally ([4eb60d2](https://github.com/Life-USTC/server/commit/4eb60d21d53c5ef8c4730805312e5c8936373981))

## [1.39.16](https://github.com/Life-USTC/server/compare/v1.39.15...v1.39.16) (2026-06-26)


### Bug Fixes

* **test:** restore page e2e mutations ([47ae3d6](https://github.com/Life-USTC/server/commit/47ae3d62763b932576bec30bd7b47e136625b064))

## [1.39.15](https://github.com/Life-USTC/server/compare/v1.39.14...v1.39.15) (2026-06-26)


### Bug Fixes

* **ci:** harden e2e snapshot artifact flow ([d85deb3](https://github.com/Life-USTC/server/commit/d85deb3c89da2ff014d2c1aa8d1dc61dc606935e))

## [1.39.14](https://github.com/Life-USTC/server/compare/v1.39.13...v1.39.14) (2026-06-26)


### Bug Fixes

* **test:** centralize e2e audit cleanup ([8c00d68](https://github.com/Life-USTC/server/commit/8c00d68162582ef84d30de23295678956b29e2df))

## [1.39.13](https://github.com/Life-USTC/server/compare/v1.39.12...v1.39.13) (2026-06-26)


### Bug Fixes

* **admin:** enforce single open suspension ([9aa2391](https://github.com/Life-USTC/server/commit/9aa23913745d734eaf69ce706b3534ade026f9d7))

## [1.39.12](https://github.com/Life-USTC/server/compare/v1.39.11...v1.39.12) (2026-06-26)


### Bug Fixes

* **auth:** reconcile debug credential users ([7d9f5aa](https://github.com/Life-USTC/server/commit/7d9f5aa65e513bb00059b9486f32b7daab361c44))

## [1.39.11](https://github.com/Life-USTC/server/compare/v1.39.10...v1.39.11) (2026-06-26)


### Bug Fixes

* **comments:** lock softbanned owner deletes ([8b733f8](https://github.com/Life-USTC/server/commit/8b733f8f6c52b3c321ba015f076a9b0c76478ba4))

## [1.39.10](https://github.com/Life-USTC/server/compare/v1.39.9...v1.39.10) (2026-06-26)


### Bug Fixes

* **auth:** call oauth consent provider directly ([9078848](https://github.com/Life-USTC/server/commit/9078848bf7cfb106720bd5178c17b27f2847c02f))
* **auth:** validate oauth consent origin ([e5ecdcc](https://github.com/Life-USTC/server/commit/e5ecdccb6ce983b1adb70e14c3c30acdf10b1596))

## [1.39.9](https://github.com/Life-USTC/server/compare/v1.39.8...v1.39.9) (2026-06-26)


### Bug Fixes

* **ci:** isolate e2e worker artifact contract ([c8b5357](https://github.com/Life-USTC/server/commit/c8b53574c57882afe6ddf854fc42e255fc94e92b))
* **ci:** prepare e2e shard metadata ([ad3684b](https://github.com/Life-USTC/server/commit/ad3684b9d2d1ceea2c09c22ffda4bc33d041dc15))
* **loader:** allow teacherless snapshot rows ([6c2a831](https://github.com/Life-USTC/server/commit/6c2a831f0c0f692d0d8ba9ec1530bb885b9a571e))
* **loader:** guard static import invariants ([d705cff](https://github.com/Life-USTC/server/commit/d705cff15cfe4437e9c87cc9048ca9aeee8077c7))

## [1.39.8](https://github.com/Life-USTC/server/compare/v1.39.7...v1.39.8) (2026-06-26)


### Bug Fixes

* **auth:** enforce scoped oauth rest access ([b39a02f](https://github.com/Life-USTC/server/commit/b39a02fbc8f92dca76fba1115437b29c00b46dcb))
* **auth:** reject unapproved refresh resources ([044cabd](https://github.com/Life-USTC/server/commit/044cabd84409da5c34c04ef97ceb74e6e7796f6a))

## [1.39.7](https://github.com/Life-USTC/server/compare/v1.39.6...v1.39.7) (2026-06-26)


### Bug Fixes

* **seed:** keep date-only fixtures at UTC midnight ([1f6953f](https://github.com/Life-USTC/server/commit/1f6953f7bec4db7da86fa1935a04698d4cb6b5dc))
* **seed:** make dev timestamps timezone stable ([06ac901](https://github.com/Life-USTC/server/commit/06ac901a4f184e3ab7eb457311d903d818f118ed))

## [1.39.6](https://github.com/Life-USTC/server/compare/v1.39.5...v1.39.6) (2026-06-26)


### Bug Fixes

* **bus:** keep version topology self-contained ([e681d2e](https://github.com/Life-USTC/server/commit/e681d2e4b8cb976a8e4fd3d136cea9697832bef3))
* **ui:** reset target scoped panels on navigation ([790622f](https://github.com/Life-USTC/server/commit/790622f1866317601b91c68b2e04d35524b4e9d1))

## [1.39.5](https://github.com/Life-USTC/server/compare/v1.39.4...v1.39.5) (2026-06-25)


### Bug Fixes

* **catalog:** preserve alphanumeric section code imports ([54643f4](https://github.com/Life-USTC/server/commit/54643f451b4812bcbc3f9d4bff14b95c896219b4))
* **subscriptions:** allow numeric dotted import codes ([1e67a54](https://github.com/Life-USTC/server/commit/1e67a54c1230dea32a2be70a196801c7fe0eac0d))
* **subscriptions:** filter prose from code import tokens ([6aac5f6](https://github.com/Life-USTC/server/commit/6aac5f6a3c3973f29e4a4c7ffb28f691d605b69f))
* **subscriptions:** share section code token parsing ([6943501](https://github.com/Life-USTC/server/commit/69435018e4b8902342152cbf2cf587d3562d6f79))
* **subscriptions:** trim pasted code delimiters ([00000df](https://github.com/Life-USTC/server/commit/00000df073efb0788442370b35ef0be403a8180e))

## [1.39.4](https://github.com/Life-USTC/server/compare/v1.39.3...v1.39.4) (2026-06-25)


### Bug Fixes

* **api:** align comment create target identifiers ([7adedc7](https://github.com/Life-USTC/server/commit/7adedc7c79808f3cefdc09735451be256dbab661))
* **api:** document comment jw id constraints ([2465e6f](https://github.com/Life-USTC/server/commit/2465e6feeaa3ec52565556c9cc1268735a97713f))
* **api:** reject malformed comment jw ids ([94ec8d4](https://github.com/Life-USTC/server/commit/94ec8d4ef772f6d534020c76b5dfa21468c70777))
* **api:** validate section teacher comment ids ([24e21eb](https://github.com/Life-USTC/server/commit/24e21ebfaaf80d1e92a923f1d2eafe97bee2ddaa))
* **contracts:** account for implicit head routes ([549e9c5](https://github.com/Life-USTC/server/commit/549e9c5bc1dd09bbb9fd7330ddded0334f78804d))
* **contracts:** document oauth preflight routes ([ebca2e8](https://github.com/Life-USTC/server/commit/ebca2e88108f0620b6c0c2f6042649ab725a2ea8))
* **contracts:** include preflight route parity ([4cacfea](https://github.com/Life-USTC/server/commit/4cacfeafa6a6bc5831857af1fdbca1a4a48a0f01))

## [1.39.3](https://github.com/Life-USTC/server/compare/v1.39.2...v1.39.3) (2026-06-25)


### Bug Fixes

* **logs:** redact calendar feed path tokens ([42d34af](https://github.com/Life-USTC/server/commit/42d34afc8472f42a28dda5abc98e3a0a4b7f3f34))

## [1.39.2](https://github.com/Life-USTC/server/compare/v1.39.1...v1.39.2) (2026-06-25)


### Bug Fixes

* **ci:** avoid duplicate pull request ci runs ([9545e8a](https://github.com/Life-USTC/server/commit/9545e8aaac777bd0690e78bbb0df42620733d130))
* **ci:** gate release and snapshot previews ([a9e093a](https://github.com/Life-USTC/server/commit/a9e093af4bc8c0536b2c1b68a0b984d78ef71dcd))
* **ci:** keep snapshot failure comments ([73762bf](https://github.com/Life-USTC/server/commit/73762bf0ec8435c019be7a60983b66f9f1cd5ce0))
* **loader:** preserve static section fields ([11feeee](https://github.com/Life-USTC/server/commit/11feeeed270adc0d2baf00a6b747a9a07ad39c0a))

## [1.39.1](https://github.com/Life-USTC/server/compare/v1.39.0...v1.39.1) (2026-06-25)


### Bug Fixes

* **auth:** bind device grants to API resources ([26cf57b](https://github.com/Life-USTC/server/commit/26cf57bddc7788d975c552e5bbd314aaad2f75f9))
* **oauth:** avoid refresh tokens for resource-bound device grants ([7bd7ef8](https://github.com/Life-USTC/server/commit/7bd7ef8ed4641f66dc063dcfebfe18334e3b07e2))
* **oauth:** show device grant resources before approval ([3ce3a5d](https://github.com/Life-USTC/server/commit/3ce3a5d5d7dde1a06d5d43c4364d71d2ebfba842))

# [1.39.0](https://github.com/Life-USTC/server/compare/v1.38.1...v1.39.0) (2026-06-25)


### Features

* **mcp:** close upload and homework parity gaps ([a780d20](https://github.com/Life-USTC/server/commit/a780d2090ea766aa24f2c7f69d6893671a014a7c))

## [1.38.1](https://github.com/Life-USTC/server/compare/v1.38.0...v1.38.1) (2026-06-25)


### Bug Fixes

* **mcp:** add ordinary comment write tools ([22293e2](https://github.com/Life-USTC/server/commit/22293e2004d1cc1d6e2f222c1357f008b6d98bb4))

# [1.38.0](https://github.com/Life-USTC/server/compare/v1.37.27...v1.38.0) (2026-06-25)


### Bug Fixes

* **mcp:** narrow dashboard link output ([11251d8](https://github.com/Life-USTC/server/commit/11251d8da3de60165f11725fe5e662e3380fe635))


### Features

* **mcp:** add dashboard link tools ([ad766d2](https://github.com/Life-USTC/server/commit/ad766d24b78e86b7191b3a27ca88fbe840321371))

## [1.37.27](https://github.com/Life-USTC/server/compare/v1.37.26...v1.37.27) (2026-06-25)


### Bug Fixes

* **mcp:** add bus preference tools ([2525993](https://github.com/Life-USTC/server/commit/2525993db6ba6baa4b93bf95fe2071b51bd4f0da))

## [1.37.26](https://github.com/Life-USTC/server/compare/v1.37.25...v1.37.26) (2026-06-25)


### Bug Fixes

* **dashboard:** align legacy subscription route redirect ([ec53ec1](https://github.com/Life-USTC/server/commit/ec53ec1fc43a4d3ef91306b02cc8c8ccc5a6fbe5))

## [1.37.25](https://github.com/Life-USTC/server/compare/v1.37.24...v1.37.25) (2026-06-25)


### Bug Fixes

* **calendar:** make feed token creation atomic ([757eb00](https://github.com/Life-USTC/server/commit/757eb00d934359c2d48bab2add96d853f62f6201))

## [1.37.24](https://github.com/Life-USTC/server/compare/v1.37.23...v1.37.24) (2026-06-25)


### Bug Fixes

* **auth:** keep admin rest session-only ([ac1c293](https://github.com/Life-USTC/server/commit/ac1c2939c47fe9f6595298fe371c9278f12c1a2f))
* **auth:** reject falsy DCR grants ([ac06136](https://github.com/Life-USTC/server/commit/ac06136513f6451af63c131ec328bb43eed32105))
* **auth:** reject unsupported DCR grants ([f3927bc](https://github.com/Life-USTC/server/commit/f3927bca41494a3dc8d64e84b66822e76c195ce8))
* **auth:** support device DCR grants ([cb00f0d](https://github.com/Life-USTC/server/commit/cb00f0df8f23e1b689b912bc6695aa0fed17709a))
* **auth:** support device-only DCR ([968acc7](https://github.com/Life-USTC/server/commit/968acc7fb479ab2007c8eedd175e0075a385aa42))

## [1.37.23](https://github.com/Life-USTC/server/compare/v1.37.22...v1.37.23) (2026-06-25)


### Bug Fixes

* **dashboard:** address accessibility defects ([85a9338](https://github.com/Life-USTC/server/commit/85a933888878e7454d5a667b12fb20c44a6b966f))
* **ui:** avoid duplicate datetime picker labels ([c1a8154](https://github.com/Life-USTC/server/commit/c1a81546ac2ff5a2635811b535ddc4a31ef9dc99))
* **ui:** label datetime picker group ([d98f050](https://github.com/Life-USTC/server/commit/d98f0508b60ab79366c650e79a940ce18bad30fb))

## [1.37.22](https://github.com/Life-USTC/server/compare/v1.37.21...v1.37.22) (2026-06-25)


### Bug Fixes

* **data:** enforce import invariants ([6da7b6e](https://github.com/Life-USTC/server/commit/6da7b6e49b9f2acda857cc76d5d00a91a9599c85))
* **loader:** preserve canonical course variant ([e0cc793](https://github.com/Life-USTC/server/commit/e0cc7935596aaff1027729e3b213c1d33b5fe17b))
* **loader:** protect canonical course ids ([ef3af09](https://github.com/Life-USTC/server/commit/ef3af09d21afc1c87a4b405568a9dbadd2ec5eaa))

## [1.37.21](https://github.com/Life-USTC/server/compare/v1.37.20...v1.37.21) (2026-06-25)


### Bug Fixes

* **api:** align contract metadata ([5c8cb51](https://github.com/Life-USTC/server/commit/5c8cb51a9512afd54c078577a70bc66e77c4b1e8))

## [1.37.20](https://github.com/Life-USTC/server/compare/v1.37.19...v1.37.20) (2026-06-25)


### Bug Fixes

* **tooling:** align worker runtime validation ([7a4ff0e](https://github.com/Life-USTC/server/commit/7a4ff0e6093cc0ef28eb19ef01fe750a30ce1c2c))

## [1.37.19](https://github.com/Life-USTC/server/compare/v1.37.18...v1.37.19) (2026-06-25)


### Bug Fixes

* **api:** enforce collaborative invariants ([f9ae4ab](https://github.com/Life-USTC/server/commit/f9ae4ab8280fa2ead93064a64fb153c78ce9cc1e))
* **db:** remediate duplicate comment attachments ([a478969](https://github.com/Life-USTC/server/commit/a47896949149fd3c9a1d4c61145dc7990a25979e))
* **db:** simplify comment attachment constraint ([64d8bc3](https://github.com/Life-USTC/server/commit/64d8bc370db81932d0c4d85a96a7254a29866c4a))


### Reverts

* Revert "fix(db): remediate duplicate comment attachments" ([ec13d8b](https://github.com/Life-USTC/server/commit/ec13d8bda2d1c12c8ff456d7e965b1a1d2f92a15))

## [1.37.18](https://github.com/Life-USTC/server/compare/v1.37.17...v1.37.18) (2026-06-25)


### Bug Fixes

* **ui:** use accessible menu and row actions ([50f50a0](https://github.com/Life-USTC/server/commit/50f50a04cbbb2bf6086e552f840d12d5656a93f2))

## [1.37.17](https://github.com/Life-USTC/server/compare/v1.37.16...v1.37.17) (2026-06-25)


### Bug Fixes

* **static-loader:** align metadata identity ([31c677c](https://github.com/Life-USTC/server/commit/31c677c93cd19bddf4964f719d295218c25496d8))
* **time:** centralize campus date helpers ([9ea4b32](https://github.com/Life-USTC/server/commit/9ea4b32fde69140280c9cb536bd91805a2444431))

## [1.37.16](https://github.com/Life-USTC/server/compare/v1.37.15...v1.37.16) (2026-06-25)


### Bug Fixes

* **api:** align contract metadata ([11a0aa6](https://github.com/Life-USTC/server/commit/11a0aa6957cf7c64d24ad846cbf997e05e5594d6))

## [1.37.15](https://github.com/Life-USTC/server/compare/v1.37.14...v1.37.15) (2026-06-25)


### Bug Fixes

* **ui:** stabilize comment uploads and dashboard pins ([df3fccf](https://github.com/Life-USTC/server/commit/df3fccfab0a6626a1d3d9457fcc56a9a30fac308))

## [1.37.14](https://github.com/Life-USTC/server/compare/v1.37.13...v1.37.14) (2026-06-25)


### Bug Fixes

* harden bus imports and preferences ([96e85de](https://github.com/Life-USTC/server/commit/96e85dec414e84ba25547498365fe411c9eaf631))

## [1.37.13](https://github.com/Life-USTC/server/compare/v1.37.12...v1.37.13) (2026-06-25)


### Reverts

* Revert "fix(api): align contract metadata" ([d118a82](https://github.com/Life-USTC/server/commit/d118a8286091a23e0a1132f34724eb9f2ab54733))

## [1.37.12](https://github.com/Life-USTC/server/compare/v1.37.11...v1.37.12) (2026-06-25)


### Bug Fixes

* **api:** align contract metadata ([03ab4f0](https://github.com/Life-USTC/server/commit/03ab4f0450771f1b9a37e3fdebbe397f29290076))

## [1.37.11](https://github.com/Life-USTC/server/compare/v1.37.10...v1.37.11) (2026-06-25)


### Reverts

* Revert "chore(release): 1.37.10 [skip ci]" ([8c28640](https://github.com/Life-USTC/server/commit/8c28640974dab9975878873569f0ae30dc2f3898))
* Revert "fix: harden bus imports and preferences" ([7727aed](https://github.com/Life-USTC/server/commit/7727aedb010e8cc896141d72522c720a9b651b18))

## [1.37.8](https://github.com/Life-USTC/server/compare/v1.37.7...v1.37.8) (2026-06-25)


### Bug Fixes

* **admin:** make final admin guard atomic ([eaaef5f](https://github.com/Life-USTC/server/commit/eaaef5f4ccc8b3cfe374fb919c0ac0c255dd29d0))

## [1.37.7](https://github.com/Life-USTC/server/compare/v1.37.6...v1.37.7) (2026-06-24)


### Bug Fixes

* **api:** align REST and MCP surface gates ([7add15f](https://github.com/Life-USTC/server/commit/7add15f25a47c40b84ff9aaeaa4ec9b7c185136d))
* **api:** narrow description OpenAPI override type ([57f0f68](https://github.com/Life-USTC/server/commit/57f0f684f7d8b9df77ef00e185bb3a9a3d2bccec))
* **api:** type description OpenAPI override ([b54a253](https://github.com/Life-USTC/server/commit/b54a253fa3b5b8d308400055b9ef5d5c7b17231e))

## [1.37.6](https://github.com/Life-USTC/server/compare/v1.37.5...v1.37.6) (2026-06-24)


### Bug Fixes

* **openapi:** document calendar feed token auth ([5f1a525](https://github.com/Life-USTC/server/commit/5f1a52592e427ddd095b677a870b5c7ff481874c))

## [1.37.5](https://github.com/Life-USTC/server/compare/v1.37.4...v1.37.5) (2026-06-24)


### Bug Fixes

* **openapi:** document protected route security ([8f979de](https://github.com/Life-USTC/server/commit/8f979de4a089e085db8f0679e9d00469b20073a2))

## [1.37.4](https://github.com/Life-USTC/server/compare/v1.37.3...v1.37.4) (2026-06-24)


### Bug Fixes

* **profile:** expose public profile API and MCP parity ([61565ec](https://github.com/Life-USTC/server/commit/61565ec5be7393ef1e4ed4590ef7a3c410f4caef))

## [1.37.3](https://github.com/Life-USTC/server/compare/v1.37.2...v1.37.3) (2026-06-24)


### Bug Fixes

* **mcp:** expose description tools ([276dc01](https://github.com/Life-USTC/server/commit/276dc018dc733f4d4ed760a3b2259c1e8f698d80))

## [1.37.2](https://github.com/Life-USTC/server/compare/v1.37.1...v1.37.2) (2026-06-24)


### Bug Fixes

* **api:** align public rest and mcp surfaces ([3ef828b](https://github.com/Life-USTC/server/commit/3ef828bd6ebcfd179a044a07f456c28e43baaa5c))

## [1.37.1](https://github.com/Life-USTC/server/compare/v1.37.0...v1.37.1) (2026-06-24)


### Bug Fixes

* **mcp:** align section detail payload ([ca0f0c1](https://github.com/Life-USTC/server/commit/ca0f0c161ab6b5a52cba8d3094e4913d324ed420))
* **mcp:** serialize section detail schedules ([eff670c](https://github.com/Life-USTC/server/commit/eff670c485cc7ee53dbe9edbd8a7c6c0d83989f1))

# [1.37.0](https://github.com/Life-USTC/server/compare/v1.36.16...v1.37.0) (2026-06-24)


### Bug Fixes

* **comments:** keep read targets non-mutating ([f1078fa](https://github.com/Life-USTC/server/commit/f1078fa88f697aa24d1897fcd81a84652d22eca3))
* **comments:** load empty section teacher targets ([a2ac5c1](https://github.com/Life-USTC/server/commit/a2ac5c1657cc67f64d64e59704934b354ae38557))
* **comments:** return missing pair as not found ([4997dd1](https://github.com/Life-USTC/server/commit/4997dd188ba351cc4d778577fe530fe10f607c57))


### Features

* **mcp:** expose comment read tools ([58c3a9f](https://github.com/Life-USTC/server/commit/58c3a9f0a84de23573f7656ac55e55bd3027e86e))

## [1.36.16](https://github.com/Life-USTC/server/compare/v1.36.15...v1.36.16) (2026-06-24)


### Bug Fixes

* **api:** align shared access gates ([5305fd8](https://github.com/Life-USTC/server/commit/5305fd8382e6387a9528691b4c7cfe14f488e353))

## [1.36.15](https://github.com/Life-USTC/server/compare/v1.36.14...v1.36.15) (2026-06-24)


### Bug Fixes

* **profile:** share callback and username flow ([33f9944](https://github.com/Life-USTC/server/commit/33f994462437c451c50cc2f37b406c20433c5002))

## [1.36.14](https://github.com/Life-USTC/server/compare/v1.36.13...v1.36.14) (2026-06-24)


### Bug Fixes

* **overview:** share REST and MCP read model ([3079fb8](https://github.com/Life-USTC/server/commit/3079fb89c8e6c9da98092b2a352c865a81560849))

## [1.36.13](https://github.com/Life-USTC/server/compare/v1.36.12...v1.36.13) (2026-06-22)


### Bug Fixes

* **subscriptions:** append selected imports server-side ([316aba9](https://github.com/Life-USTC/server/commit/316aba9efb7eb9a13efd5ca6b3d70a3c9c77de3e))

## [1.36.12](https://github.com/Life-USTC/server/compare/v1.36.11...v1.36.12) (2026-06-22)


### Bug Fixes

* **homeworks:** share client update flows ([716dbb4](https://github.com/Life-USTC/server/commit/716dbb4563a39e725b5a5e3a47351f8b56759744))

## [1.36.11](https://github.com/Life-USTC/server/compare/v1.36.10...v1.36.11) (2026-06-22)


### Bug Fixes

* **subscriptions:** share import client parsing ([4b898b2](https://github.com/Life-USTC/server/commit/4b898b2e1b24c67115d6be3bd9b18c90edc7b5af))

## [1.36.10](https://github.com/Life-USTC/server/compare/v1.36.9...v1.36.10) (2026-06-22)


### Bug Fixes

* **api:** observe readiness responses ([62a1e47](https://github.com/Life-USTC/server/commit/62a1e47a0da40716031f13a0b9986744b21c3e47))

## [1.36.9](https://github.com/Life-USTC/server/compare/v1.36.8...v1.36.9) (2026-06-22)


### Bug Fixes

* **api:** share client error messages ([7f8240d](https://github.com/Life-USTC/server/commit/7f8240d3ecba3056eac06157f731216ee67b2e86))

## [1.36.8](https://github.com/Life-USTC/server/compare/v1.36.7...v1.36.8) (2026-06-22)


### Bug Fixes

* **openapi:** align request bodies ([2325e42](https://github.com/Life-USTC/server/commit/2325e4267634c9a7c5995b09564375fe71146d07))

## [1.36.7](https://github.com/Life-USTC/server/compare/v1.36.6...v1.36.7) (2026-06-22)


### Bug Fixes

* **dashboard:** consolidate form validation ([e1efd10](https://github.com/Life-USTC/server/commit/e1efd10d4c86d784592139c92ebdf62c00abf422))

## [1.36.6](https://github.com/Life-USTC/server/compare/v1.36.5...v1.36.6) (2026-06-22)


### Bug Fixes

* **api:** preserve oauth error headers ([6782152](https://github.com/Life-USTC/server/commit/67821526a825c72b82b18c3b334848fa69c2c9c6))

## [1.36.5](https://github.com/Life-USTC/server/compare/v1.36.4...v1.36.5) (2026-06-22)


### Bug Fixes

* **tooling:** simplify shared tooling and surface drift ([f12905e](https://github.com/Life-USTC/server/commit/f12905ec27e01a3228201fdf913cd1c6558a7db6))

## [1.36.4](https://github.com/Life-USTC/server/compare/v1.36.3...v1.36.4) (2026-06-22)


### Bug Fixes

* **api:** align admin users and oauth schemas ([881440d](https://github.com/Life-USTC/server/commit/881440d0f38d95038e4e48913c6d801c5128d02b))

## [1.36.3](https://github.com/Life-USTC/server/compare/v1.36.2...v1.36.3) (2026-06-22)


### Bug Fixes

* **api:** align service gates and public parity ([d34cdfd](https://github.com/Life-USTC/server/commit/d34cdfd4bcc576a471941c9704b432ea7fd137cf))
* **api:** document admin auth responses ([bccf861](https://github.com/Life-USTC/server/commit/bccf86124c0b7a6cca39bd435129fa2e25fe4fd8))
* **api:** resolve surface parity follow-ups ([44e243e](https://github.com/Life-USTC/server/commit/44e243e68b58d1fc8256f0fbd989800d8c7269cd))

## [1.36.2](https://github.com/Life-USTC/server/compare/v1.36.1...v1.36.2) (2026-06-22)


### Bug Fixes

* **api:** align locale and snapshot tooling ([c876b9b](https://github.com/Life-USTC/server/commit/c876b9b67e20cafb6f5d208c12597c59730a3cb6))
* **api:** vary localized detail responses ([011816a](https://github.com/Life-USTC/server/commit/011816a07ca4e895f22fbd58749d5f4c191cfadd))
* **tooling:** keep snapshot teardown nonfatal ([e3f52ad](https://github.com/Life-USTC/server/commit/e3f52adefce834ead12d5d70ba738ca5acf1ca0f))
* **tooling:** prevent snapshot capture teardown hangs ([bbe0ecc](https://github.com/Life-USTC/server/commit/bbe0ecca053bb453ffff6eeae5920276888e892c))

## [1.36.1](https://github.com/Life-USTC/server/compare/v1.36.0...v1.36.1) (2026-06-21)


### Bug Fixes

* **verify:** prepare app before convention checks ([e29f7dc](https://github.com/Life-USTC/server/commit/e29f7dca4c2e1d5ba51a0161cf29d06e78963856))

# [1.36.0](https://github.com/Life-USTC/server/compare/v1.35.0...v1.36.0) (2026-06-21)


### Bug Fixes

* **bus:** keep upcoming departures first ([6f22044](https://github.com/Life-USTC/server/commit/6f22044de828e1c50ce50e2543ebe400ba6fdfbf))
* **overview:** filter ended same-day exams ([9c36038](https://github.com/Life-USTC/server/commit/9c36038c9375408d8a001004d00e4a6519dccf69))


### Features

* **api:** add lightweight client REST surfaces ([f0dc3e7](https://github.com/Life-USTC/server/commit/f0dc3e7c973ee0f55696822aa9193e016d7799aa))

# [1.35.0](https://github.com/Life-USTC/server/compare/v1.34.1...v1.35.0) (2026-06-21)


### Features

* **api:** align todo and homework surface responses ([f67a5f6](https://github.com/Life-USTC/server/commit/f67a5f60c274e571e204e8987ef82e43c47de2c4))

## [1.34.1](https://github.com/Life-USTC/server/compare/v1.34.0...v1.34.1) (2026-06-21)


### Bug Fixes

* **admin:** reject overflowing suspension dates ([915056d](https://github.com/Life-USTC/server/commit/915056d03afb0a3faee77f75f78a716880fe3f0d))
* **agent:** resolve audit follow-ups ([3d3d891](https://github.com/Life-USTC/server/commit/3d3d89148a20b3d699319194579e06efb478d764))
* **ci:** scope section tab selectors ([456a986](https://github.com/Life-USTC/server/commit/456a98678e62b40afc3ccdc101263d68ceb60a2c))
* **ci:** update snapshot tab selector ([0956f60](https://github.com/Life-USTC/server/commit/0956f60af25f1c16788361b5935394518d74caad))
* **dev:** document local environment fallback ([d4bd2c5](https://github.com/Life-USTC/server/commit/d4bd2c50212d1207f08f27cd3ca2adc5b3819c84))
* **dev:** resolve local routing and reviews ([850f2eb](https://github.com/Life-USTC/server/commit/850f2eb068e87e12d89b7e554c47a66e133ffd2a))
* **homeworks:** share update intent across surfaces ([bae2831](https://github.com/Life-USTC/server/commit/bae28313dc98b80fca851bc447f528cec3a18b4a))
* **mcp:** clear todo content on explicit null ([9840cec](https://github.com/Life-USTC/server/commit/9840cecf7e635ad47ed6e5d1d8495605e7fdcc4c))
* **review:** harden menus and date validation ([9f5e974](https://github.com/Life-USTC/server/commit/9f5e97420dd52fcd516cb687b818876842f2181d))
* **time:** reject ambiguous numeric dates ([89ecd12](https://github.com/Life-USTC/server/commit/89ecd12e65f45b5a8de77ba1bdf891e27ee22bf6))
* **time:** reject unsupported date formats ([1914f8a](https://github.com/Life-USTC/server/commit/1914f8a45b5d1ac10495034263489f9bb292f32d))
* **time:** reject unsupported numeric dates ([800f2f6](https://github.com/Life-USTC/server/commit/800f2f6e9612367220f1f5014ec4d4f96048f48d))
* **ui:** separate datetime picker button label ([2a6ce30](https://github.com/Life-USTC/server/commit/2a6ce30bd7535e5f500b9a722d7ba7d2d4bd27a3))
* **upload:** restore oversized reservation status ([4dffd04](https://github.com/Life-USTC/server/commit/4dffd04d0dbea21aff12f3781087e8317f5b49a5))

# [1.34.0](https://github.com/Life-USTC/server/compare/v1.33.6...v1.34.0) (2026-06-19)


### Features

* **api:** add batch homework completions ([28c02df](https://github.com/Life-USTC/server/commit/28c02df84c33348f023430b397feebc934e9963d))

## [1.33.6](https://github.com/Life-USTC/server/compare/v1.33.5...v1.33.6) (2026-06-19)


### Bug Fixes

* **ci:** resolve e2e workflow failures ([fbb8dab](https://github.com/Life-USTC/server/commit/fbb8dab652f1e0077a7cf5400aa4a88992d8db29))
* **dashboard:** enforce homework write auth ([37f1a64](https://github.com/Life-USTC/server/commit/37f1a64bbb889a711a432fdff48b572dde879503))
* **db:** cache cloudflare prisma clients ([88e7169](https://github.com/Life-USTC/server/commit/88e71696ed92425cd0ea25fe11ec997d7fa224fb))
* **skills:** quote pr workflow metadata ([ca2d9ca](https://github.com/Life-USTC/server/commit/ca2d9ca5b8053f7cd4b49fd54f03b9d0930ce654))

## [1.33.5](https://github.com/Life-USTC/server/compare/v1.33.4...v1.33.5) (2026-06-19)


### Bug Fixes

* **ci:** stabilize snapshot artifact publishing ([3f6620e](https://github.com/Life-USTC/server/commit/3f6620e887998d3669c12f95a375b7a79dabad77))

## [1.33.4](https://github.com/Life-USTC/server/compare/v1.33.3...v1.33.4) (2026-06-14)


### Bug Fixes

* **snapshots:** split artifact capture phases ([cb2200b](https://github.com/Life-USTC/server/commit/cb2200b9447852babe50eea50b7eab547904e2ee))

## [1.33.3](https://github.com/Life-USTC/server/compare/v1.33.2...v1.33.3) (2026-06-14)


### Bug Fixes

* **snapshots:** use tool prisma for cleanup ([cd702b4](https://github.com/Life-USTC/server/commit/cd702b4b29729d9dc1743300d12dbca72398ab33))

## [1.33.2](https://github.com/Life-USTC/server/compare/v1.33.1...v1.33.2) (2026-06-14)


### Bug Fixes

* **e2e:** use node prisma fixtures for worker tests ([94337a3](https://github.com/Life-USTC/server/commit/94337a3cbd130cb361044185b5ca146f65832e67))

## [1.33.1](https://github.com/Life-USTC/server/compare/v1.33.0...v1.33.1) (2026-06-14)


### Bug Fixes

* **ci:** restore worker e2e artifact in place ([8c1c3fa](https://github.com/Life-USTC/server/commit/8c1c3fa89507a4d7cf1e01290b9fa26e1a76bda1))

# [1.33.0](https://github.com/Life-USTC/server/compare/v1.32.0...v1.33.0) (2026-06-14)


### Bug Fixes

* **auth:** address PR review comments ([c99069c](https://github.com/Life-USTC/server/commit/c99069cecb65f251b3771afae6f2daf8c1ed79a2))
* **auth:** remove redundant cookie assignment ([3f20d6d](https://github.com/Life-USTC/server/commit/3f20d6d9d6db601d7465c3f051854873f5fba423))
* **ci:** handle missing snapshot artifact URL ([ff99dc7](https://github.com/Life-USTC/server/commit/ff99dc74dedd70b7d04fa7085847f8ed7817df2b))
* **ci:** sync SvelteKit before Prisma generation ([8fed2c0](https://github.com/Life-USTC/server/commit/8fed2c0aa2873fdcb6cc97bdf2c79bbd81419604))
* **ci:** use node prisma client for node adapter ([6f21335](https://github.com/Life-USTC/server/commit/6f21335e043afc3c13a050f7ee40cb0bc3051cfa))
* **cloudflare:** address migration review ([77570dd](https://github.com/Life-USTC/server/commit/77570ddb2b9b567d4df5331fb3db9dfe00e52350))
* **cloudflare:** preserve stale catalog assets ([66b7926](https://github.com/Life-USTC/server/commit/66b79263275452627efa0ad074e2fa352af97ef5))
* **cloudflare:** prevent stale html caching ([d6491fb](https://github.com/Life-USTC/server/commit/d6491fb7f1bb7be458eaf25a8501d1e5952ff02f))
* **config:** trust explicit form origins ([54de1d2](https://github.com/Life-USTC/server/commit/54de1d2acf8f057c528b0aee991a20fa0aa6725b))
* **deploy:** keep prisma tooling node compatible ([d2a1c13](https://github.com/Life-USTC/server/commit/d2a1c13dbf4ec786a21cb20c4746d67ac2e62142))
* **deploy:** pass cloudflare runtime env without virtual imports ([8622f8b](https://github.com/Life-USTC/server/commit/8622f8b746f89c000255fe7fb344be2c18310613))
* **e2e:** align dashboard alias coverage ([e5f71a6](https://github.com/Life-USTC/server/commit/e5f71a6bee7429c8503471263d42025760c6dbf2))
* **e2e:** align public route expectations ([77922a5](https://github.com/Life-USTC/server/commit/77922a5f6ca5233dd1cbc53170870cb31f85fe05))
* **e2e:** authenticate dashboard link alias test ([1778dd9](https://github.com/Life-USTC/server/commit/1778dd929f5151e3239881720b71044fedd8aa67))
* **e2e:** build node standalone artifacts explicitly ([43b212b](https://github.com/Life-USTC/server/commit/43b212bf8b842d223d10167a56a17c69a9216484))
* **env:** track environment helpers ([c5a52ae](https://github.com/Life-USTC/server/commit/c5a52ae8f1c06037c0120347b7a2b9f9f18dce69))
* **log:** preserve node file log sink ([efdccec](https://github.com/Life-USTC/server/commit/efdccec120a1107ff1c4badd5136570bff168907))
* **public:** keep page cache internal ([0e68351](https://github.com/Life-USTC/server/commit/0e683513cd203547518ef1ec9213f017a4d5cf1f))
* **public:** prevent catalog page browser caching ([808f695](https://github.com/Life-USTC/server/commit/808f695b5c97607f55374e41f3065832d88496fd))
* **runtime:** address remaining PR review comments ([9e5172d](https://github.com/Life-USTC/server/commit/9e5172db53d71e138e8a87e3d37d65a2453617c2))
* **runtime:** avoid mutating immutable responses ([cd06927](https://github.com/Life-USTC/server/commit/cd06927818df79aeda0db8059a279a5294cc0104))
* **runtime:** enforce CSRF in SvelteKit hook ([007550b](https://github.com/Life-USTC/server/commit/007550bfa66904756a885018f56a8d1a3b3f5154))
* **runtime:** harden cloudflare deploy ([2537a2a](https://github.com/Life-USTC/server/commit/2537a2accd9a1a08cccb6da3f048bd71666bf70d))
* **runtime:** improve cloudflare storage and tracing ([c77e319](https://github.com/Life-USTC/server/commit/c77e3194fecfaeede40d745d5a0b8834f0cba73e))
* **snapshots:** sync section homework selectors ([63adc23](https://github.com/Life-USTC/server/commit/63adc237a4887298273960f67a572faf851e3e3f))
* **time:** use Node-compatible dayjs imports ([9696785](https://github.com/Life-USTC/server/commit/969678577c016b3b4c14bdafdae7e19ed9f59d65))
* **tools:** avoid app alias in Prisma helper ([b420444](https://github.com/Life-USTC/server/commit/b4204442a1f076fa4582c9128f64da1231c33135))
* **tools:** use node prisma client for loaders ([d2b21d1](https://github.com/Life-USTC/server/commit/d2b21d183b331aeb9b883ba4fe787d1298ea625d))


### Features

* **app:** migrate app to SvelteKit ([da0a081](https://github.com/Life-USTC/server/commit/da0a081a4a79cd62bf520ce124a67aeb2d0f582b))
* **deploy:** deploy sveltekit app on cloudflare workers ([534f3bd](https://github.com/Life-USTC/server/commit/534f3bdce7711042672819991d441fea86466cdb))


### Performance Improvements

* **api:** select section summary fields ([b088b1e](https://github.com/Life-USTC/server/commit/b088b1ee768347325671f7cbc0cc49dfdf9237b6))
* **dashboard:** avoid current term section lookup ([6392ed4](https://github.com/Life-USTC/server/commit/6392ed486d90af7088d41ef4c50ea8f90c06c526))
* **dashboard:** overlap overview link loading ([5c0c902](https://github.com/Life-USTC/server/commit/5c0c9024c48aea35117026ce5e700ddd60d5928a))
* **dashboard:** reduce subscription tab markup ([667c310](https://github.com/Life-USTC/server/commit/667c31050c21a88848d19e848d01113da69fac1d))
* **dashboard:** reuse page auth session ([693d607](https://github.com/Life-USTC/server/commit/693d60708ca6871759053441a68807de0c23c2a6))
* **dashboard:** reuse subscription ids for tabs ([a8710c1](https://github.com/Life-USTC/server/commit/a8710c1fce061d4468f2766627b72bcbbaef7f24))
* **dashboard:** scope overview detail queries ([0298df1](https://github.com/Life-USTC/server/commit/0298df1212e9ea7cf65d2ff187a0285a60e87a8e))
* **public:** cache anonymous catalog pages ([3da905d](https://github.com/Life-USTC/server/commit/3da905deaf7f9a5ff4a7b409506d483971248261))
* **public:** cache catalog list data briefly ([8005319](https://github.com/Life-USTC/server/commit/8005319ee4dfc6208f41d88628a641af36263e56))
* **public:** reduce catalog list markup ([c774eab](https://github.com/Life-USTC/server/commit/c774eabf8d64a585b4a857856ed580e1dae358ad))
* **runtime:** trim section list payloads ([bd59d1a](https://github.com/Life-USTC/server/commit/bd59d1a924044589cfd16db12f47fb775b444cfe))


### Reverts

* **public:** remove catalog page cache ([325d5bf](https://github.com/Life-USTC/server/commit/325d5bf79b995258f634d4b5c4caccc584153661))

# [1.32.0](https://github.com/Life-USTC/server-nextjs/compare/v1.31.0...v1.32.0) (2026-06-07)


### Bug Fixes

* **observability:** address review feedback ([6fb110b](https://github.com/Life-USTC/server-nextjs/commit/6fb110b5aed61ee5d09891743385ad30e6a3f407))


### Features

* **observability:** add production telemetry ([72d264d](https://github.com/Life-USTC/server-nextjs/commit/72d264d7c2dfbe8b753d553b0139a1eaed2029e1))

# [1.31.0](https://github.com/Life-USTC/server-nextjs/compare/v1.30.4...v1.31.0) (2026-06-06)


### Features

* **observability:** add MCP telemetry and metrics ([8a33050](https://github.com/Life-USTC/server-nextjs/commit/8a33050ac41b100d18297f9f8d3a6da97cf19302))

## [1.30.4](https://github.com/Life-USTC/server-nextjs/compare/v1.30.3...v1.30.4) (2026-06-06)


### Bug Fixes

* **mcp:** preserve resource binding on token refresh ([9b0eb0b](https://github.com/Life-USTC/server-nextjs/commit/9b0eb0be9ddc5f0c6127881eebe4859064764beb))

## [1.30.3](https://github.com/Life-USTC/server-nextjs/compare/v1.30.2...v1.30.3) (2026-06-01)


### Bug Fixes

* **openapi:** harden generated client contract ([a7b2037](https://github.com/Life-USTC/server-nextjs/commit/a7b2037876ff1854965c470f8650dc8b82cbf68e))

## [1.30.2](https://github.com/Life-USTC/server-nextjs/compare/v1.30.1...v1.30.2) (2026-06-01)


### Reverts

* Revert "fix(openapi): harden generated client contract" ([bc0a574](https://github.com/Life-USTC/server-nextjs/commit/bc0a5746ab54cfd33b6f7ecbdf3932872c488a22))

## [1.30.1](https://github.com/Life-USTC/server-nextjs/compare/v1.30.0...v1.30.1) (2026-06-01)


### Bug Fixes

* **openapi:** harden generated client contract ([773e523](https://github.com/Life-USTC/server-nextjs/commit/773e52306fc94a41ca24d70105c85c02c60b035e))

# [1.30.0](https://github.com/Life-USTC/server-nextjs/compare/v1.29.3...v1.30.0) (2026-05-29)


### Bug Fixes

* **ci:** restore e2e bootstrap and head-only snapshots ([d7bd9b6](https://github.com/Life-USTC/server-nextjs/commit/d7bd9b6e374125b726865f10c042702fb4685533))
* **mcp:** simplify calendar feed redaction guard ([cf865fa](https://github.com/Life-USTC/server-nextjs/commit/cf865fa216e43fd017a846e4a9b0ddfcd4ce1f12))
* **testing:** stabilize bus seed and page snapshots ([84269e0](https://github.com/Life-USTC/server-nextjs/commit/84269e0c539fbc232978f2f474edb6c627c3e7ec))


### Features

* **mcp:** improve compact results and recovery hints ([af5c72d](https://github.com/Life-USTC/server-nextjs/commit/af5c72d6ea956361f878ac4fed9cad066dd7ddfe))
* **ui:** polish dashboards, mobile lists, and detail flows ([c04344b](https://github.com/Life-USTC/server-nextjs/commit/c04344bc154f77c5ae78d2a71dd7575014a08ee4))

## [1.29.3](https://github.com/Life-USTC/server-nextjs/compare/v1.29.2...v1.29.3) (2026-05-18)


### Performance Improvements

* **home:** optimize dashboard and bus queries ([49bf97e](https://github.com/Life-USTC/server-nextjs/commit/49bf97ec6481b5d3ed5c0e0bc7d758f88e49e4f0))

## [1.29.2](https://github.com/Life-USTC/server-nextjs/compare/v1.29.1...v1.29.2) (2026-05-16)


### Bug Fixes

* **e2e:** address calendar snapshot reviews ([69db189](https://github.com/Life-USTC/server-nextjs/commit/69db1891a89e22f906462ea93ffb57d891243a1c))
* **e2e:** anchor dashboard snapshots ([b3f8747](https://github.com/Life-USTC/server-nextjs/commit/b3f874770af782d5744abbef59d24f7b9d430afa))
* **e2e:** fold snapshot page entries ([28ccc50](https://github.com/Life-USTC/server-nextjs/commit/28ccc50ff7acf4c8b1bce470b08ff6ae49dbaee1))
* **e2e:** improve snapshot comment layout ([cc57768](https://github.com/Life-USTC/server-nextjs/commit/cc57768a4e4d58d776b0eb7c622b8ef4c7976977))
* **e2e:** indent snapshot route tree ([50a1283](https://github.com/Life-USTC/server-nextjs/commit/50a1283237e0619e86d1e166965043c260732c3d))
* **e2e:** render snapshot artifacts as tree ([eeb5563](https://github.com/Life-USTC/server-nextjs/commit/eeb5563a1ca4dfa0b330fccfc5ddd8169e978a65))
* **e2e:** simplify screenshot tree labels ([b98b1fc](https://github.com/Life-USTC/server-nextjs/commit/b98b1fca75db8b51585d17e6db79a4a9e4825476))
* **e2e:** simplify snapshot route layout ([13101dc](https://github.com/Life-USTC/server-nextjs/commit/13101dc1fe162d6ffb28059420266f39cc9d1c7f))
* **e2e:** stabilize anchored dashboard tabs ([a4edacf](https://github.com/Life-USTC/server-nextjs/commit/a4edacf3b21faac4895a018e259b849a44146b02))
* **e2e:** use nested lists for snapshot comment ([0a818e7](https://github.com/Life-USTC/server-nextjs/commit/0a818e70218150e20a5a4841233a184586c7c220))

## [1.29.1](https://github.com/Life-USTC/server-nextjs/compare/v1.29.0...v1.29.1) (2026-05-14)


### Bug Fixes

* **e2e:** mark expected snapshot statuses ([aa829b1](https://github.com/Life-USTC/server-nextjs/commit/aa829b1d0f96a29cba3c3b77148ac88223ca2bc8))

# [1.29.0](https://github.com/Life-USTC/server-nextjs/compare/v1.28.1...v1.29.0) (2026-05-11)


### Features

* **bus-ui:** improve planner and route table readability ([c903b0a](https://github.com/Life-USTC/server-nextjs/commit/c903b0aed6b42ba25f0dce0d526441823c4b99c3))
* **oauth-device:** preserve verification state through signin ([9e1efe4](https://github.com/Life-USTC/server-nextjs/commit/9e1efe4643603309222819b3228d843301695067))

## [1.28.1](https://github.com/Life-USTC/server-nextjs/compare/v1.28.0...v1.28.1) (2026-05-06)


### Bug Fixes

* **ci:** install release tools with bun ([ac08490](https://github.com/Life-USTC/server-nextjs/commit/ac084903e7ad42a849e97f1b9b28d6eab7564acf))
* **ci:** pin bun semantic release runner ([40afcdd](https://github.com/Life-USTC/server-nextjs/commit/40afcdd08b0ad4850142746c1ddb5e42f2e92c84))
* **ci:** stabilize bun action checks ([b9fae6c](https://github.com/Life-USTC/server-nextjs/commit/b9fae6c01b6a4bb1a2daf7414750d3ba862adcae))

# [1.28.0](https://github.com/Life-USTC/server-nextjs/compare/v1.27.1...v1.28.0) (2026-05-05)


### Features

* **mcp:** transport hardening, compact payloads, flexible dates, integration harness ([5df17be](https://github.com/Life-USTC/server-nextjs/commit/5df17beeba2901f08ec619f647222a25832fd339))

## [1.27.1](https://github.com/Life-USTC/server-nextjs/compare/v1.27.0...v1.27.1) (2026-04-28)


### Bug Fixes

* **mcp:** preserve raw bus and calendar summaries ([5bdf4b7](https://github.com/Life-USTC/server-nextjs/commit/5bdf4b7dbe486c04ba5ef57a0b9356ddffc6297d))

# [1.27.0](https://github.com/Life-USTC/server-nextjs/compare/v1.26.0...v1.27.0) (2026-04-27)


### Features

* **tools:** add route-perf benchmark script ([be6ed84](https://github.com/Life-USTC/server-nextjs/commit/be6ed84fc6975b00c913cd7502fb925137596fb7))


### Performance Improvements

* **db:** eliminate sequential DB round-trips on section/calendar/dashboard routes ([a0a316e](https://github.com/Life-USTC/server-nextjs/commit/a0a316e31806d1b5c1ed5f966ef30ae637fb7903))

# [1.26.0](https://github.com/Life-USTC/server-nextjs/compare/v1.25.12...v1.26.0) (2026-04-25)


### Features

* **mcp:** add unset_my_homework_completion tool and document subscriptions/homeworks route ([f41c8b8](https://github.com/Life-USTC/server-nextjs/commit/f41c8b8c57f38a863ead2d85952d3754b6ece6da))

## [1.25.12](https://github.com/Life-USTC/server-nextjs/compare/v1.25.11...v1.25.12) (2026-04-25)


### Bug Fixes

* **auth:** update GithubProfile.email type to string | null for better-auth 1.6.9 ([363f7d0](https://github.com/Life-USTC/server-nextjs/commit/363f7d02b2a874e060cf2d56a2b12465d7dffeea))

## [1.25.11](https://github.com/Life-USTC/server-nextjs/compare/v1.25.10...v1.25.11) (2026-04-24)


### Bug Fixes

* **docker:** merge public/ contents to fix nested directory in standalone ([e13e53e](https://github.com/Life-USTC/server-nextjs/commit/e13e53ec2ae3cf91790e671ea02993c208353a54))

## [1.25.10](https://github.com/Life-USTC/server-nextjs/compare/v1.25.9...v1.25.10) (2026-04-24)


### Bug Fixes

* **docker:** copy prisma.config.ts into runtime image ([263d0aa](https://github.com/Life-USTC/server-nextjs/commit/263d0aa8d3df236a859fadbb4dae77f41833eed2))

## [1.25.9](https://github.com/Life-USTC/server-nextjs/compare/v1.25.8...v1.25.9) (2026-04-24)


### Bug Fixes

* **ci:** restore local and GitHub validation ([793ff93](https://github.com/Life-USTC/server-nextjs/commit/793ff9350d05842295424a803733d6f70413d9df))

## [1.25.8](https://github.com/Life-USTC/server-nextjs/compare/v1.25.7...v1.25.8) (2026-04-22)


### Performance Improvements

* **tools:** harden static import pipeline ([dcfbfdc](https://github.com/Life-USTC/server-nextjs/commit/dcfbfdcb1f20f935498734ce07509df2fe15eec7))

## [1.25.7](https://github.com/Life-USTC/server-nextjs/compare/v1.25.6...v1.25.7) (2026-04-22)


### Bug Fixes

* **auth:** resolve oauth proxy host inference ([a364b70](https://github.com/Life-USTC/server-nextjs/commit/a364b70584bea0e8ed6b1e58b417a556fdbb4674))

## [1.25.6](https://github.com/Life-USTC/server-nextjs/compare/v1.25.5...v1.25.6) (2026-04-22)


### Bug Fixes

* **auth:** align oauth discovery metadata endpoints ([101f688](https://github.com/Life-USTC/server-nextjs/commit/101f6888e9313606ab1b9cb0a8194b3c3828627b))

## [1.25.5](https://github.com/Life-USTC/server-nextjs/compare/v1.25.4...v1.25.5) (2026-04-22)


### Bug Fixes

* **bus:** align planner time and preference data ([6603576](https://github.com/Life-USTC/server-nextjs/commit/6603576b2d0a69229c2a760a255c71afac0a9fae))

## [1.25.4](https://github.com/Life-USTC/server-nextjs/compare/v1.25.3...v1.25.4) (2026-04-21)


### Bug Fixes

* **auth:** trace loopback oauth redirect mismatches ([fe21dda](https://github.com/Life-USTC/server-nextjs/commit/fe21dda76c5b4857181ca4b2ff130449d8a94326))

## [1.25.3](https://github.com/Life-USTC/server-nextjs/compare/v1.25.2...v1.25.3) (2026-04-21)


### Bug Fixes

* **auth:** support OAuth proxy for preview hosts ([ccc2adf](https://github.com/Life-USTC/server-nextjs/commit/ccc2adf03e53280bfac954a6fee601df558ce834))

## [1.25.2](https://github.com/Life-USTC/server-nextjs/compare/v1.25.1...v1.25.2) (2026-04-21)


### Bug Fixes

* **auth:** separate deployment and canonical origins ([8e4c57f](https://github.com/Life-USTC/server-nextjs/commit/8e4c57f6c723e5b32aa6f93da4db89b195788cf9))

## [1.25.1](https://github.com/Life-USTC/server-nextjs/compare/v1.25.0...v1.25.1) (2026-04-20)


### Performance Improvements

* **dashboard:** optimize Prisma queries with select, date filtering, and tab-aware skipping ([03e7df5](https://github.com/Life-USTC/server-nextjs/commit/03e7df585e42eeb9faad5930557e854bdff29358))

# [1.25.0](https://github.com/Life-USTC/server-nextjs/compare/v1.24.0...v1.25.0) (2026-04-19)


### Features

* **api:** openapi 3.0 compat, combined endpoints, server-side filtering, JWT issuer fix ([8163f8c](https://github.com/Life-USTC/server-nextjs/commit/8163f8cf9ac1bb11a234e6a5f277435ad96a79c7))

# [1.24.0](https://github.com/Life-USTC/server-nextjs/compare/v1.23.5...v1.24.0) (2026-04-19)


### Features

* **api:** support multi-section homework query via sectionIds param ([8e546a6](https://github.com/Life-USTC/server-nextjs/commit/8e546a64e8f3984c3eee6ee335d29659ea89a926))

## [1.23.5](https://github.com/Life-USTC/server-nextjs/compare/v1.23.4...v1.23.5) (2026-04-19)


### Bug Fixes

* **auth:** use site origin for device verification URIs ([1ad1198](https://github.com/Life-USTC/server-nextjs/commit/1ad1198e457c1a31a1739cf74b1352a4b5cd9384))

## [1.23.4](https://github.com/Life-USTC/server-nextjs/compare/v1.23.3...v1.23.4) (2026-04-19)


### Bug Fixes

* **auth:** sign webhook session cookie with HMAC like Better Auth ([ca2e0ff](https://github.com/Life-USTC/server-nextjs/commit/ca2e0ff4e5ec05e9396c85f5a4c2ef92c308cdde))

## [1.23.3](https://github.com/Life-USTC/server-nextjs/compare/v1.23.2...v1.23.3) (2026-04-19)


### Bug Fixes

* **auth:** add username lookup to webhook login ([f8286ff](https://github.com/Life-USTC/server-nextjs/commit/f8286ff82ed47028289a18526f4baca6d8cb1bcb))

## [1.23.2](https://github.com/Life-USTC/server-nextjs/compare/v1.23.1...v1.23.2) (2026-04-19)


### Bug Fixes

* **auth:** support user name lookup in webhook login ([958cd80](https://github.com/Life-USTC/server-nextjs/commit/958cd808bf6784ab6429884040f99b96f4ec6a77))

## [1.23.1](https://github.com/Life-USTC/server-nextjs/compare/v1.23.0...v1.23.1) (2026-04-19)


### Bug Fixes

* **auth:** correct device_authorization_endpoint URL in discovery metadata ([c302d49](https://github.com/Life-USTC/server-nextjs/commit/c302d494754e488740f0a47ce9c0cd2f7b84e603))

# [1.23.0](https://github.com/Life-USTC/server-nextjs/compare/v1.22.2...v1.23.0) (2026-04-19)


### Features

* **auth:** implement RFC 8628 device code flow, webhook login, and Vercel OAuth fix ([60d510d](https://github.com/Life-USTC/server-nextjs/commit/60d510ddef96c76dafca1002ec5e7bfc8cf9fb9f))

## [1.22.2](https://github.com/Life-USTC/server-nextjs/compare/v1.22.1...v1.22.2) (2026-04-18)


### Bug Fixes

* **auth:** resolve JWKS double-path and audience mismatch in JWT verification ([631529b](https://github.com/Life-USTC/server-nextjs/commit/631529ba8201146b95ba98a29171d5dead0f5da9))

## [1.22.1](https://github.com/Life-USTC/server-nextjs/compare/v1.22.0...v1.22.1) (2026-04-18)


### Bug Fixes

* **oauth:** harden validAudiences with URL-normalized origin ([1b66f42](https://github.com/Life-USTC/server-nextjs/commit/1b66f42f062539c5018e6c27f4b80a9fcdc44133))

# [1.22.0](https://github.com/Life-USTC/server-nextjs/compare/v1.21.1...v1.22.0) (2026-04-18)


### Features

* **oauth:** add more debug logging ([ebbaf8f](https://github.com/Life-USTC/server-nextjs/commit/ebbaf8ff73fb082cc0b511b2d3de6903a75cd981))

## [1.21.1](https://github.com/Life-USTC/server-nextjs/compare/v1.21.0...v1.21.1) (2026-04-18)


### Bug Fixes

* **deploy:** set BETTER_AUTH_URL in production docker-compose ([ca3e2e6](https://github.com/Life-USTC/server-nextjs/commit/ca3e2e64da8bd1b459c0a6332faa72bd879db497))

# [1.21.0](https://github.com/Life-USTC/server-nextjs/compare/v1.20.0...v1.21.0) (2026-04-17)


### Features

* **tools:** add seed-debug-users script for E2E testing ([b7f3f83](https://github.com/Life-USTC/server-nextjs/commit/b7f3f83b4be4f44c399df50c7fdb87ad87e95b8f))

# [1.20.0](https://github.com/Life-USTC/server-nextjs/compare/v1.19.0...v1.20.0) (2026-04-17)


### Features

* **api:** add /api/me endpoint for bearer-token user profile ([5e4f363](https://github.com/Life-USTC/server-nextjs/commit/5e4f363500636438157fb1b82f4977e2ee14565d))

# [1.19.0](https://github.com/Life-USTC/server-nextjs/compare/v1.18.8...v1.19.0) (2026-04-17)


### Features

* **tools:** add iOS OAuth2 client registration script ([f0f9199](https://github.com/Life-USTC/server-nextjs/commit/f0f9199a46d973150e29162e46d77537cd5b0390))

## [1.18.8](https://github.com/Life-USTC/server-nextjs/compare/v1.18.7...v1.18.8) (2026-04-17)


### Bug Fixes

* **storage:** align docker and s3 runtime setup ([3157833](https://github.com/Life-USTC/server-nextjs/commit/3157833031b29e320c908d87cde28e8f1e5adf9d))

## [1.18.7](https://github.com/Life-USTC/server-nextjs/compare/v1.18.6...v1.18.7) (2026-04-17)


### Bug Fixes

* **build:** keep dev seed in docker context ([7a21480](https://github.com/Life-USTC/server-nextjs/commit/7a2148092002a2e15f4e77555c3b2ff9579a35bb))

## [1.18.6](https://github.com/Life-USTC/server-nextjs/compare/v1.18.5...v1.18.6) (2026-04-17)


### Bug Fixes

* **ci:** create the e2e bucket with aws cli ([6c45290](https://github.com/Life-USTC/server-nextjs/commit/6c45290acb32809fdf590d801c0da9906875009a))
* **ci:** harden minio e2e setup ([1bd7834](https://github.com/Life-USTC/server-nextjs/commit/1bd78341904a47c4b8fd468e16e7ae4bfb8a7bcb))
* **ci:** provision storage for upload e2e ([c9ef0ee](https://github.com/Life-USTC/server-nextjs/commit/c9ef0eec51d59b47fa25501f998792ee49e13f42))
* **ci:** remove duplicate proxy env ([9dc4c24](https://github.com/Life-USTC/server-nextjs/commit/9dc4c24295930e990da78221589af13cfa17144a))
* **ci:** use a valid minio image tag ([37bfa6a](https://github.com/Life-USTC/server-nextjs/commit/37bfa6a6e9a98dd5aeb98950b589238a52db2c34))
* **e2e:** pass storage env to playwright web server ([faa1fc6](https://github.com/Life-USTC/server-nextjs/commit/faa1fc6e72a32c8e05c5e092e24d24b90c4e693d))
* **storage:** force path-style urls for custom endpoints ([37533b4](https://github.com/Life-USTC/server-nextjs/commit/37533b4987f28be5ee592a8aba297ef822d27a8c))
* **storage:** handle endpoint resolution ([ac7cf38](https://github.com/Life-USTC/server-nextjs/commit/ac7cf38249ae95e49aad13c8ad5a8a9ee6c8725d))
* **storage:** use lazy bucket resolution in upload routes ([4041684](https://github.com/Life-USTC/server-nextjs/commit/4041684af890c95bf74b8b0f9ae7df5419960db3))

## [1.18.5](https://github.com/Life-USTC/server-nextjs/compare/v1.18.4...v1.18.5) (2026-04-17)


### Bug Fixes

* **api:** align detail routes with MCP tools using localized Prisma client ([5043b7d](https://github.com/Life-USTC/server-nextjs/commit/5043b7d23edddf2e151041404eb76ac5e68b78f3))
* **api:** restore build and contracts ([1d9565c](https://github.com/Life-USTC/server-nextjs/commit/1d9565cff40d3f2ae3a6056166a3d0ea2f22a385))
* **security:** address P1/P2 review issues in storage, auth, and openapi ([33dd232](https://github.com/Life-USTC/server-nextjs/commit/33dd23296761252da520737706792253b2f34ee5))
* **security:** reject any token carrying mcp:tools scope from REST API auth ([4353f3c](https://github.com/Life-USTC/server-nextjs/commit/4353f3cb5664372baaed12c5c3e0f86d648f9f1d))

## [1.18.4](https://github.com/Life-USTC/server-nextjs/compare/v1.18.3...v1.18.4) (2026-04-15)


### Bug Fixes

* **ui:** remove card hover lift and use completion buttons ([c562a2a](https://github.com/Life-USTC/server-nextjs/commit/c562a2aca52fc7845c8fc7f70be2ea4b7b82c5cb))

## [1.18.3](https://github.com/Life-USTC/server-nextjs/compare/v1.18.2...v1.18.3) (2026-04-15)


### Bug Fixes

* use link flow for account connections ([9ce6dff](https://github.com/Life-USTC/server-nextjs/commit/9ce6dffde851663ada7cc87be02278f7c4ed7b8c))

## [1.18.2](https://github.com/Life-USTC/server-nextjs/compare/v1.18.1...v1.18.2) (2026-04-13)


### Bug Fixes

* handle sparse oidc profiles ([167f9f4](https://github.com/Life-USTC/server-nextjs/commit/167f9f468db222ed6b6f5a55d8b3825e632ba50d))

## [1.18.1](https://github.com/Life-USTC/server-nextjs/compare/v1.18.0...v1.18.1) (2026-04-13)


### Bug Fixes

* align feature implementation with product model ([c16a4e1](https://github.com/Life-USTC/server-nextjs/commit/c16a4e171aa069b2dee8755c0da35248aa9bf4a2))

# [1.18.0](https://github.com/Life-USTC/server-nextjs/compare/v1.17.0...v1.18.0) (2026-04-10)


### Bug Fixes

* **security:** harden content security policy ([1310edd](https://github.com/Life-USTC/server-nextjs/commit/1310edd5e1874d99662380e898a693e916f5a09e))


### Features

* **static:** import published sqlite snapshot ([a3fb095](https://github.com/Life-USTC/server-nextjs/commit/a3fb095996e61353adc816fde7893d660bf95fd2))


### Performance Improvements

* **home:** reduce dashboard data fanout ([ac7f75f](https://github.com/Life-USTC/server-nextjs/commit/ac7f75fb0d744f55c5ad6840e1cccb74ad747b0d))

# [1.17.0](https://github.com/Life-USTC/server-nextjs/compare/v1.16.0...v1.17.0) (2026-04-10)


### Bug Fixes

* **ux:** add required field indicators and inline form validation ([ceb24a0](https://github.com/Life-USTC/server-nextjs/commit/ceb24a037efc08e97c2a539c63f4cc7d68992c95))


### Features

* **config:** add Zod-based environment variable validation ([7759f7e](https://github.com/Life-USTC/server-nextjs/commit/7759f7eaf45b69e07fa10a36c44d766a55040d9d))
* **error:** add error boundaries for sections, courses, oauth, and bus-map ([eaffe38](https://github.com/Life-USTC/server-nextjs/commit/eaffe38a38eb202938cad79942c431387955e884))
* **security:** add Content-Security-Policy header ([341a5c2](https://github.com/Life-USTC/server-nextjs/commit/341a5c2711a2fbcae29da1573ca820950a110266))


### Performance Improvements

* **bus-map:** lazy-load bus transit map component ([cd07a9c](https://github.com/Life-USTC/server-nextjs/commit/cd07a9c002bdcabd34dc9b9a07d0904e87e64305))
* **profile:** merge duplicate user queries into single DB call ([780aa10](https://github.com/Life-USTC/server-nextjs/commit/780aa10eee034099af47c9f1f8fec0b041f21a2a))

# [1.16.0](https://github.com/Life-USTC/server-nextjs/compare/v1.15.1...v1.16.0) (2026-04-10)


### Features

* **analytics:** add Google Analytics and update legal pages ([aefbe8f](https://github.com/Life-USTC/server-nextjs/commit/aefbe8feb73e0df28e2ce6c522a40dba7cf9aff6))

## [1.15.1](https://github.com/Life-USTC/server-nextjs/compare/v1.15.0...v1.15.1) (2026-04-10)


### Bug Fixes

* **test:** repair 4 broken unit tests ([75b51e7](https://github.com/Life-USTC/server-nextjs/commit/75b51e79232c83f1dad4e379dac789c36af05efd))

# [1.15.0](https://github.com/Life-USTC/server-nextjs/compare/v1.14.0...v1.15.0) (2026-04-09)


### Bug Fixes

* **a11y:** add keyboard focus support to bus transit map legend ([8b0ae98](https://github.com/Life-USTC/server-nextjs/commit/8b0ae985bc2683a880f11a7bd264307e768c0460))
* **error-handling:** improve error handling in auth, dashboard-links, and consent form ([4f73b6e](https://github.com/Life-USTC/server-nextjs/commit/4f73b6e352fb7a3fe3a532306aeae208a9dd70ff))


### Features

* **security:** add HTTP security headers, robots.txt, and sitemap.xml ([0b34b59](https://github.com/Life-USTC/server-nextjs/commit/0b34b59915ed107bc31bf89568ea4c211893e997))
* **seo:** add Open Graph and Twitter Card meta tags ([cf32e6f](https://github.com/Life-USTC/server-nextjs/commit/cf32e6f428cc1b440cab065dc1bba341201be8b3))

# [1.14.0](https://github.com/Life-USTC/server-nextjs/compare/v1.13.3...v1.14.0) (2026-04-09)


### Bug Fixes

* **i18n:** remove orphaned keys and align en-us/zh-cn ([5aed8f5](https://github.com/Life-USTC/server-nextjs/commit/5aed8f5746ae26401bb11df8162e2a188af140ca))


### Features

* **ux:** add loading and error states for key routes ([0a5e7a0](https://github.com/Life-USTC/server-nextjs/commit/0a5e7a049e577c7020afdd0d883651d1367ab01b))


### Performance Improvements

* **db:** add composite indexes for common query patterns ([04e4571](https://github.com/Life-USTC/server-nextjs/commit/04e457120af08bea0b7f42af9a5a66513226dd2c))

## [1.13.3](https://github.com/Life-USTC/server-nextjs/compare/v1.13.2...v1.13.3) (2026-04-09)


### Bug Fixes

* **test:** replace waitForTimeout with proper Playwright waits in bus E2E ([d6f52b5](https://github.com/Life-USTC/server-nextjs/commit/d6f52b535f34bc5232b60645e4b8b1c36452de3d))

## [1.13.2](https://github.com/Life-USTC/server-nextjs/compare/v1.13.1...v1.13.2) (2026-04-09)


### Bug Fixes

* **time:** parse date-only strings as UTC midnight to prevent day-1 offset ([65cbc40](https://github.com/Life-USTC/server-nextjs/commit/65cbc401e1c7d8b797444ccffa73398420ea3c3f))

## [1.13.1](https://github.com/Life-USTC/server-nextjs/compare/v1.13.0...v1.13.1) (2026-04-06)


### Bug Fixes

* **docker:** bundle tools at build time for production image ([f4c9e7f](https://github.com/Life-USTC/server-nextjs/commit/f4c9e7f15fa1bf3df6dd28ed60e8d98344888f39))

# [1.13.0](https://github.com/Life-USTC/server-nextjs/compare/v1.12.0...v1.13.0) (2026-04-06)


### Features

* **bus:** metro-style transit map with bus icons, remove preference status icons ([9e9091d](https://github.com/Life-USTC/server-nextjs/commit/9e9091dd4c3a32ed2a854e90248af399714737aa))

# [1.12.0](https://github.com/Life-USTC/server-nextjs/compare/v1.11.0...v1.12.0) (2026-04-05)


### Features

* **bus:** toggle preferences with auto-save, transit map curves ([66a7e52](https://github.com/Life-USTC/server-nextjs/commit/66a7e521700a0ee653762cd65de3c23a5c5a85be))

# [1.11.0](https://github.com/Life-USTC/server-nextjs/compare/v1.10.0...v1.11.0) (2026-04-05)


### Features

* **bus:** preference popover, map layout, comprehensive tests ([6729eab](https://github.com/Life-USTC/server-nextjs/commit/6729eab12a53a8ddfec882c814c0335c56f62c2e))

# [1.10.0](https://github.com/Life-USTC/server-nextjs/compare/v1.9.1...v1.10.0) (2026-04-05)


### Features

* **bus:** mobile compact cards, MCP tools, transit map page ([d72bf84](https://github.com/Life-USTC/server-nextjs/commit/d72bf846ce770ca61d9cfdfb5def9f0450b3acd6))

## [1.9.1](https://github.com/Life-USTC/server-nextjs/compare/v1.9.0...v1.9.1) (2026-04-05)


### Bug Fixes

* **bus:** dayType toggle now refetches server data via router.push ([efaad77](https://github.com/Life-USTC/server-nextjs/commit/efaad77c09d486eafeac7ce3c768bf4280791f77))

# [1.9.0](https://github.com/Life-USTC/server-nextjs/compare/v1.8.1...v1.9.0) (2026-04-05)


### Features

* **bus:** redesign preferences as inline recommended section ([95f9f00](https://github.com/Life-USTC/server-nextjs/commit/95f9f00761077717c4484890e7163e340f439e85))

## [1.8.1](https://github.com/Life-USTC/server-nextjs/compare/v1.8.0...v1.8.1) (2026-04-05)


### Bug Fixes

* **bus:** exclude terminal stops from filter, add inline departed toggle, add bus cron ([fd5f98e](https://github.com/Life-USTC/server-nextjs/commit/fd5f98e232b396f1fc6162e89798cc79cca0da1e))

# [1.8.0](https://github.com/Life-USTC/server-nextjs/compare/v1.7.0...v1.8.0) (2026-04-05)


### Bug Fixes

* **ci:** move clear-e2e-suspensions to tools/ and remove waitForTimeout ([53395cf](https://github.com/Life-USTC/server-nextjs/commit/53395cf1db335db846aa67cb5d0537aea2f022aa))


### Features

* **bus:** redesign UI with cards, tables, pinned routes, and grouped tabs ([0348fa8](https://github.com/Life-USTC/server-nextjs/commit/0348fa810b0457d9513d5218841b0368012e0717))

# [1.7.0](https://github.com/Life-USTC/server-nextjs/compare/v1.6.0...v1.7.0) (2026-04-05)


### Features

* **bus:** drop /bus page, fix ID display, use dashboard toolbar style ([aa2a4e4](https://github.com/Life-USTC/server-nextjs/commit/aa2a4e49fe2a496d54130716af2667e1fb8d842e))

# [1.6.0](https://github.com/Life-USTC/server-nextjs/compare/v1.5.1...v1.6.0) (2026-04-04)


### Bug Fixes

* **bus:** update i18n labels and move notice to bottom ([2b551a5](https://github.com/Life-USTC/server-nextjs/commit/2b551a50e9e71423ec4ba318f1ae7ccae36de55f))


### Features

* **admin:** add bus timetable management page ([6a7b964](https://github.com/Life-USTC/server-nextjs/commit/6a7b964178c9692165d3873e69811dddf1cdadd0))

## [1.5.1](https://github.com/Life-USTC/server-nextjs/compare/v1.5.0...v1.5.1) (2026-04-04)


### Bug Fixes

* **bus:** two-column layout and correct origin filter ([a6de352](https://github.com/Life-USTC/server-nextjs/commit/a6de35287f37cdd8279baa9aaa07d520913f9862))

# [1.5.0](https://github.com/Life-USTC/server-nextjs/compare/v1.4.0...v1.5.0) (2026-04-04)


### Features

* **bus:** redesign bus panel UI for clarity and consistency ([a39314b](https://github.com/Life-USTC/server-nextjs/commit/a39314b94f20cc297089927395e2b43c99b1ce5a))

# [1.4.0](https://github.com/Life-USTC/server-nextjs/compare/v1.3.0...v1.4.0) (2026-04-04)


### Features

* **bus:** add shuttle bus schedule with preferences and dashboard ([2c24107](https://github.com/Life-USTC/server-nextjs/commit/2c241075a5617bb561742109ee1ba4c54d3d3848))

# [1.3.0](https://github.com/Life-USTC/server-nextjs/compare/v1.2.2...v1.3.0) (2026-04-02)


### Bug Fixes

* **profile:** tighten yearly activity heatmap ([37fae41](https://github.com/Life-USTC/server-nextjs/commit/37fae41132b5a6dca24e6d42c6561dcf5452dc04))
* **ui:** refine app shell and settings navigation ([f8febd0](https://github.com/Life-USTC/server-nextjs/commit/f8febd0af2f829b8796760356c84054ef45abbf4))


### Features

* **home:** add public dashboard and mobile app entry ([a7adbf6](https://github.com/Life-USTC/server-nextjs/commit/a7adbf60aff902da2783bdfff5502f868b702d9d))

## [1.2.2](https://github.com/Life-USTC/server-nextjs/compare/v1.2.1...v1.2.2) (2026-04-01)


### Bug Fixes

* **ui:** unify dashboard tab filter controls ([a4ef876](https://github.com/Life-USTC/server-nextjs/commit/a4ef8765aa3c3b52c66ef08bc1c3bc92a3da9256))

## [1.2.1](https://github.com/Life-USTC/server-nextjs/compare/v1.2.0...v1.2.1) (2026-04-01)


### Bug Fixes

* **auth:** request openid scope for ustc oauth ([fff46fe](https://github.com/Life-USTC/server-nextjs/commit/fff46fe0ecb79fe6a0c8b6c280efc63c8d9d3f2e))
* **ui:** simplify user menu actions ([541d940](https://github.com/Life-USTC/server-nextjs/commit/541d9406d4a3560bd8aca7129e6aeecc2247f1a6))

# [1.2.0](https://github.com/Life-USTC/server-nextjs/compare/v1.1.1...v1.2.0) (2026-04-01)


### Bug Fixes

* **ui:** align web design with interface guidelines ([6f4abf3](https://github.com/Life-USTC/server-nextjs/commit/6f4abf30ce6a4ffd67382aeffe09864f179121bd))


### Features

* **admin:** expand moderation and user management tools ([5b5c232](https://github.com/Life-USTC/server-nextjs/commit/5b5c232309af40d43edcd7ec787a4b4338168813))
* **app:** refresh dashboard and content workflows ([58a64b4](https://github.com/Life-USTC/server-nextjs/commit/58a64b4c925801ab911342641c049279aaa6e6a4))
* **oauth:** improve DCR naming and admin client controls ([0e0573f](https://github.com/Life-USTC/server-nextjs/commit/0e0573fdad163a04efbb2f075ffab01ac7213130))

## [1.1.1](https://github.com/Life-USTC/server-nextjs/compare/v1.1.0...v1.1.1) (2026-03-29)


### Bug Fixes

* **e2e:** harden oauth start assertions and bun eval stability ([843f45c](https://github.com/Life-USTC/server-nextjs/commit/843f45c4c5ad47dd5222aa9a3ff4a575b5847535))

# [1.1.0](https://github.com/Life-USTC/server-nextjs/compare/v1.0.0...v1.1.0) (2026-03-28)


### Features

* **time:** unify Asia/Shanghai serialization and local UI timezone ([5354e74](https://github.com/Life-USTC/server-nextjs/commit/5354e74e79dc6675392a43c25857234e264e5629))

# [1.0.0](https://github.com/Life-USTC/server-nextjs/compare/v0.57.0...v1.0.0) (2026-03-26)


* feat(mcp)!: replace showAllDetailedProperties with mode ([b342339](https://github.com/Life-USTC/server-nextjs/commit/b342339a4c621b28250df6a71868f3556edd6123))


### Features

* **legal:** link terms and privacy ([4c379d6](https://github.com/Life-USTC/server-nextjs/commit/4c379d6694e5c34eb3d682d1a63af0ff1b393fe7))


### BREAKING CHANGES

* MCP tools no longer accept showAllDetailedProperties/
showAllDetailedProrties. Use mode="summary"|"default"|"full".

Made-with: Cursor

# [0.57.0](https://github.com/Life-USTC/server-nextjs/compare/v0.56.0...v0.57.0) (2026-03-26)


### Features

* **i18n:** centralize locale config and add legal pages ([1eddc87](https://github.com/Life-USTC/server-nextjs/commit/1eddc87be278ab2aef4e8b52a19e7b063f98ba8d))

# [0.56.0](https://github.com/Life-USTC/server-nextjs/compare/v0.55.4...v0.56.0) (2026-03-26)


### Features

* **mcp:** compact tool payloads and add homework write tools ([e1af9f6](https://github.com/Life-USTC/server-nextjs/commit/e1af9f66729c50afcd17b30924de44ba51d7a1f6))

## [0.55.4](https://github.com/Life-USTC/server-nextjs/compare/v0.55.3...v0.55.4) (2026-03-25)


### Bug Fixes

* **mcp:** validate opaque OAuth access tokens for ChatGPT-style token exchange ([1badd7d](https://github.com/Life-USTC/server-nextjs/commit/1badd7d99614ae6f8437275ee0afdacdbc141991))

## [0.55.3](https://github.com/Life-USTC/server-nextjs/compare/v0.55.2...v0.55.3) (2026-03-25)


### Bug Fixes

* **auth:** absolute OAuth UI URLs and proxy-safe MCP JWT ([f65266b](https://github.com/Life-USTC/server-nextjs/commit/f65266b52a9f8bddb07cfafd93a9dd85bfb92b1d))

## [0.55.2](https://github.com/Life-USTC/server-nextjs/compare/v0.55.1...v0.55.2) (2026-03-25)


### Bug Fixes

* **mcp:** verify JWTs with BETTER_AUTH_URL and rewrite /api/mcp/ ([80d15a1](https://github.com/Life-USTC/server-nextjs/commit/80d15a1f2cd225d0a105a5537da0b89dd392898c))

## [0.55.1](https://github.com/Life-USTC/server-nextjs/compare/v0.55.0...v0.55.1) (2026-03-25)


### Bug Fixes

* **auth:** hash DCR client secrets and restore public PKCE clients ([949c69d](https://github.com/Life-USTC/server-nextjs/commit/949c69dc197d1bb21ed1a70091ac0378110b1324))

# [0.55.0](https://github.com/Life-USTC/server-nextjs/compare/v0.54.0...v0.55.0) (2026-03-25)


### Features

* **oauth:** enrich production debug logs for OAuth and MCP ([7fe7770](https://github.com/Life-USTC/server-nextjs/commit/7fe7770ab17135e8450a7f6dec0388d6cc78b93b))

# [0.54.0](https://github.com/Life-USTC/server-nextjs/compare/v0.53.2...v0.54.0) (2026-03-25)


### Features

* **oauth:** add opt-in structured OAuth debug logging ([55af12d](https://github.com/Life-USTC/server-nextjs/commit/55af12de94f5e660490473eff6e7cb84686d1ad1))

## [0.53.2](https://github.com/Life-USTC/server-nextjs/compare/v0.53.1...v0.53.2) (2026-03-25)


### Bug Fixes

* **oauth:** return client_secret for dynamic registration ([8295e91](https://github.com/Life-USTC/server-nextjs/commit/8295e91f42621cfe1c4d2f452d587c369fcc24ea))

## [0.53.1](https://github.com/Life-USTC/server-nextjs/compare/v0.53.0...v0.53.1) (2026-03-25)


### Bug Fixes

* **mcp:** point protected-resource metadata at oauth issuer ([8a0d290](https://github.com/Life-USTC/server-nextjs/commit/8a0d2909277093ee353ac0946c94ce513a0e7fb4))

# [0.53.0](https://github.com/Life-USTC/server-nextjs/compare/v0.52.0...v0.53.0) (2026-03-25)


### Features

* **oauth:** migrate to better-auth oauth-provider ([eb115dd](https://github.com/Life-USTC/server-nextjs/commit/eb115dd596f9f5533472cefb3bcf05bca433faf4))

# [0.52.0](https://github.com/Life-USTC/server-nextjs/compare/v0.51.2...v0.52.0) (2026-03-25)


### Features

* **oauth:** allow public dynamic clients refresh_token ([50aba67](https://github.com/Life-USTC/server-nextjs/commit/50aba67fe27a93c3afe2f22a9d6f89263e7c7f37))

## [0.51.2](https://github.com/Life-USTC/server-nextjs/compare/v0.51.1...v0.51.2) (2026-03-25)


### Bug Fixes

* **ci/cd:** add DATABASE_URL for prebuild in check ([71943ce](https://github.com/Life-USTC/server-nextjs/commit/71943ced3847155322858c253e42d60a4237b06e))

## [0.51.1](https://github.com/Life-USTC/server-nextjs/compare/v0.51.0...v0.51.1) (2026-03-25)


### Bug Fixes

* **ci:** align docker build env and workflow checks ([5d30af7](https://github.com/Life-USTC/server-nextjs/commit/5d30af79df970b86828b6c9129ae058d875aadb1))

# [0.51.0](https://github.com/Life-USTC/server-nextjs/compare/v0.50.0...v0.51.0) (2026-03-25)


### Features

* **auth:** migrate to Better Auth OIDC and harden OAuth ([334d7e5](https://github.com/Life-USTC/server-nextjs/commit/334d7e5b653f4c2c669eeda6af185cdf20cfc348))

# [0.50.0](https://github.com/Life-USTC/server-nextjs/compare/v0.49.0...v0.50.0) (2026-03-24)


### Features

* **mcp:** add overview timeline and todo toolchain ([fd5229e](https://github.com/Life-USTC/server-nextjs/commit/fd5229e14c2d040ce36fcdd2bf6df7c48f18be0f))

# [0.49.0](https://github.com/Life-USTC/server-nextjs/compare/v0.48.2...v0.49.0) (2026-03-24)


### Features

* **mcp:** add section homework schedule and exam query tools ([408f1f1](https://github.com/Life-USTC/server-nextjs/commit/408f1f117c86540e164e8e6d17da4438690461ea))

## [0.48.2](https://github.com/Life-USTC/server-nextjs/compare/v0.48.1...v0.48.2) (2026-03-24)


### Bug Fixes

* **mcp:** update according to spec ([f08262d](https://github.com/Life-USTC/server-nextjs/commit/f08262d6da482141f7e5d5803c170ac1aefa2ecc))

## [0.48.1](https://github.com/Life-USTC/server-nextjs/compare/v0.48.0...v0.48.1) (2026-03-24)


### Bug Fixes

* **oauth:** harden auth flows and admin ui ([9e994b3](https://github.com/Life-USTC/server-nextjs/commit/9e994b3a6eb83839f2c42378401a7c0e5caf1ed8))

# [0.48.0](https://github.com/Life-USTC/server-nextjs/compare/v0.47.0...v0.48.0) (2026-03-23)


### Features

* **oauth:** support refresh tokens and improve admin ui ([e143cef](https://github.com/Life-USTC/server-nextjs/commit/e143ceff2a1d831e46764449de0de542c378f13d))

# [0.47.0](https://github.com/Life-USTC/server-nextjs/compare/v0.46.0...v0.47.0) (2026-03-23)


### Features

* **oauth:** support confidential dynamic registration ([6a57566](https://github.com/Life-USTC/server-nextjs/commit/6a575660ff5b512b2a00d572583928b144f91de8))

# [0.46.0](https://github.com/Life-USTC/server-nextjs/compare/v0.45.3...v0.46.0) (2026-03-21)


### Features

* **oauth:** add dynamic client registration ([b0a3a3e](https://github.com/Life-USTC/server-nextjs/commit/b0a3a3ed16c5a3066bd2d800434f242fd59b030e))

## [0.45.3](https://github.com/Life-USTC/server-nextjs/compare/v0.45.2...v0.45.3) (2026-03-20)


### Bug Fixes

* **e2e:** relax oauth invalid-client readiness ([8450f97](https://github.com/Life-USTC/server-nextjs/commit/8450f97706b78fc306015671e11b6951d8b383fd))
* **mcp:** use public origin for oauth metadata ([9299674](https://github.com/Life-USTC/server-nextjs/commit/92996748e3ef27bac83ed41950d18bc6086a40d2))

## [0.45.2](https://github.com/Life-USTC/server-nextjs/compare/v0.45.1...v0.45.2) (2026-03-20)


### Bug Fixes

* **e2e:** stabilize flaky settings and dashboard link tests ([c5b3aef](https://github.com/Life-USTC/server-nextjs/commit/c5b3aefd85ac176e0e65a2f4bfef12bd8c57f6c4))

## [0.45.1](https://github.com/Life-USTC/server-nextjs/compare/v0.45.0...v0.45.1) (2026-03-20)


### Bug Fixes

* **e2e:** retry post-login session checks ([5b16f35](https://github.com/Life-USTC/server-nextjs/commit/5b16f357488c304bd6d1773d5130bd482c29036b))

# [0.45.0](https://github.com/Life-USTC/server-nextjs/compare/v0.44.0...v0.45.0) (2026-03-20)


### Bug Fixes

* **e2e:** retry post-login session checks ([cfb191d](https://github.com/Life-USTC/server-nextjs/commit/cfb191d33a1382ba6c749f46b5c87019bca1f629))


### Features

* **mcp:** add oauth-protected server support ([08adec2](https://github.com/Life-USTC/server-nextjs/commit/08adec2befdf873390c7c95e5d960c971b64d0f3))

# [0.44.0](https://github.com/Life-USTC/server-nextjs/compare/v0.43.1...v0.44.0) (2026-03-20)


### Features

* **api:** include homework and todos in user calendar feed ([4a3807e](https://github.com/Life-USTC/server-nextjs/commit/4a3807e5fd6f589975cfaf2fd7c7f7dfbd7f8af8))

## [0.43.1](https://github.com/Life-USTC/server-nextjs/compare/v0.43.0...v0.43.1) (2026-03-18)


### Bug Fixes

* **e2e:** stabilize test and build flows ([4572ba8](https://github.com/Life-USTC/server-nextjs/commit/4572ba819d8fc259c62a1c526bd6d0f51b0919de))

# [0.43.0](https://github.com/Life-USTC/server-nextjs/compare/v0.42.0...v0.43.0) (2026-03-18)


### Features

* **calendar:** enhance calendar functionality with new event types and improved data handling ([c943b4d](https://github.com/Life-USTC/server-nextjs/commit/c943b4d86679c0dc1232782db0fffb527e413eeb))

# [0.42.0](https://github.com/Life-USTC/server-nextjs/compare/v0.41.0...v0.42.0) (2026-03-15)


### Features

* enhance settings and dashboard sections with new components and layout ([0df6dbc](https://github.com/Life-USTC/server-nextjs/commit/0df6dbcc182237a21d18d9f5ae167dc2ddaad9d2))

# [0.41.0](https://github.com/Life-USTC/server-nextjs/compare/v0.40.0...v0.41.0) (2026-03-12)


### Features

* profile completion flow + OAuth 2.0 provider ([#21](https://github.com/Life-USTC/server-nextjs/issues/21)) ([c63fa4d](https://github.com/Life-USTC/server-nextjs/commit/c63fa4d845217bba5f1d27d4f2596f30ec48853f))

# [0.40.0](https://github.com/Life-USTC/server-nextjs/compare/v0.39.0...v0.40.0) (2026-03-05)


### Features

* add TODO support ([95c3108](https://github.com/Life-USTC/server-nextjs/commit/95c3108fbeb2dbac8246e2589610c819575b0d37))

# [0.39.0](https://github.com/Life-USTC/server-nextjs/compare/v0.38.0...v0.39.0) (2026-03-03)


### Features

* **home:** add exam filters (Upcoming/Ended/All) on Exams tab ([#15](https://github.com/Life-USTC/server-nextjs/issues/15)) ([4ddf060](https://github.com/Life-USTC/server-nextjs/commit/4ddf060e13534789402f6e2a99e63512b45ad188))

# [0.38.0](https://github.com/Life-USTC/server-nextjs/compare/v0.37.1...v0.38.0) (2026-02-28)


### Features

* unify home tabs and user calendar feeds ([0c60b43](https://github.com/Life-USTC/server-nextjs/commit/0c60b43c76a5ca871839b4a503753f5a2ec2e956))

## [0.37.1](https://github.com/Life-USTC/server-nextjs/compare/v0.37.0...v0.37.1) (2026-02-27)


### Bug Fixes

* **e2e:** avoid commit waitUntil in waitForLoadState ([abd4684](https://github.com/Life-USTC/server-nextjs/commit/abd4684ad66220116849d5fdb2e91b063c0ef5f6))
* **openapi:** keep postprocess typesafe for build ([025c401](https://github.com/Life-USTC/server-nextjs/commit/025c401d02c2a6bc3a769a42cfd863691f906eb2))
* **storage:** narrow mock send types for build ([fe3e8a3](https://github.com/Life-USTC/server-nextjs/commit/fe3e8a3e7f4710b1ece01d592b7a431aac84fba8))

## [0.37.1](https://github.com/Life-USTC/server-nextjs/compare/v0.37.0...v0.37.1) (2026-02-27)


### Bug Fixes

* **e2e:** avoid commit waitUntil in waitForLoadState ([abd4684](https://github.com/Life-USTC/server-nextjs/commit/abd4684ad66220116849d5fdb2e91b063c0ef5f6))
* **openapi:** keep postprocess typesafe for build ([025c401](https://github.com/Life-USTC/server-nextjs/commit/025c401d02c2a6bc3a769a42cfd863691f906eb2))
* **storage:** narrow mock send types for build ([fe3e8a3](https://github.com/Life-USTC/server-nextjs/commit/fe3e8a3e7f4710b1ece01d592b7a431aac84fba8))

# [0.37.0](https://github.com/Life-USTC/server-nextjs/compare/v0.36.0...v0.37.0) (2026-02-25)


### Bug Fixes

* **build:** resolve zod variant import path for turbopack ([c959f6b](https://github.com/Life-USTC/server-nextjs/commit/c959f6b50e1552ada8d386f9399877003dcba1d2))
* **subscriptions:** broaden bulk import section code regex ([0895684](https://github.com/Life-USTC/server-nextjs/commit/0895684c5d1d7051c130dea4976228f0aa5e6b17))
* **uploads:** use storage helper and restrict downloads ([a0b695f](https://github.com/Life-USTC/server-nextjs/commit/a0b695fe37b922a05bc9c1dcc72ddb275b943954))


### Features

* **admin:** add cancel action to moderation dialog ([6f9f48e](https://github.com/Life-USTC/server-nextjs/commit/6f9f48e102d752bfbfbe2b99b41074341ef4d409))
* **profile:** allow hyphens in usernames ([864b233](https://github.com/Life-USTC/server-nextjs/commit/864b23394c6428cf21e64242d36a37019a839810))

## [0.36.1](https://github.com/Life-USTC/server-nextjs/compare/v0.36.0...v0.36.1) (2026-02-23)


### Bug Fixes

* **build:** resolve zod variant import path for turbopack ([c959f6b](https://github.com/Life-USTC/server-nextjs/commit/c959f6b50e1552ada8d386f9399877003dcba1d2))

# [0.36.0](https://github.com/Life-USTC/server-nextjs/compare/v0.35.0...v0.36.0) (2026-02-23)


### Features

* **api:** add zod validation and openapi endpoint ([a448f71](https://github.com/Life-USTC/server-nextjs/commit/a448f711c11d3897df35297793b93207626a74a4))
* **api:** apply zod validation across write endpoints ([74c931d](https://github.com/Life-USTC/server-nextjs/commit/74c931d7a52ed9ad98b4d1b737b7ea87beefbb58))
* **api:** validate query params and add interactive docs page ([f34a277](https://github.com/Life-USTC/server-nextjs/commit/f34a277e08f332b3a5471914943456de36e98083))
* **auth:** add dev admin sign-in provider for local testing ([6217f0d](https://github.com/Life-USTC/server-nextjs/commit/6217f0d3141f86711fc76880eb6cd93b89e2a76e))
* **homeworks:** add dashboard creation flow and reusable homework cards ([5130b26](https://github.com/Life-USTC/server-nextjs/commit/5130b26f2652231349375bfdc962e143baec6aa7))

# [0.35.0](https://github.com/Life-USTC/server-nextjs/compare/v0.34.0...v0.35.0) (2026-02-09)


### Features

* **app:** add dashboard/settings routes and profile flows ([fbe23a2](https://github.com/Life-USTC/server-nextjs/commit/fbe23a2f490e4898831b0e3ac77d1997b3772732))
* **comments:** streamline moderation and thread rendering ([e56d20a](https://github.com/Life-USTC/server-nextjs/commit/e56d20a4485d1c64a35752e68dbb564557cb1723))

# [0.34.0](https://github.com/Life-USTC/server-nextjs/compare/v0.33.0...v0.34.0) (2026-02-01)


### Bug Fixes

* **courses:** pass plain filter options ([f48745a](https://github.com/Life-USTC/server-nextjs/commit/f48745a95ffef15e4b7a2093f934f81aa9ee9673))


### Features

* **homeworks:** add section homework tracking ([4135add](https://github.com/Life-USTC/server-nextjs/commit/4135add9880fc37e16befa26f88803d13093974d))
* **homeworks:** track completion status ([c860851](https://github.com/Life-USTC/server-nextjs/commit/c860851a55cc37264bdf94d754c8b39a47b6432d))
* **ui:** rename subscriptions and preload content ([5a459e1](https://github.com/Life-USTC/server-nextjs/commit/5a459e1bc3f42d550f42869179fb3151365db38c))

# [0.33.0](https://github.com/Life-USTC/server-nextjs/compare/v0.32.0...v0.33.0) (2026-01-29)


### Features

* add descriptions API and comment UI updates ([817f2bc](https://github.com/Life-USTC/server-nextjs/commit/817f2bc67fd6910e1ada858e3284a4d0b42065ed))

# [0.32.0](https://github.com/Life-USTC/server-nextjs/compare/v0.31.0...v0.32.0) (2026-01-29)


### Features

* add basic comment structure ([4b75ba0](https://github.com/Life-USTC/server-nextjs/commit/4b75ba0845a29dc483aa0f34ea893c6d4f3fb793))
* **comments:** enhance comment functionality with reactions, visibility options, and user suspension handling ([49a9ee5](https://github.com/Life-USTC/server-nextjs/commit/49a9ee50d230c19cad2d63b0ad9ac55405b0b26f))

# [0.31.0](https://github.com/Life-USTC/server-nextjs/compare/v0.30.0...v0.31.0) (2026-01-24)


### Features

* **i18n:** centralize localized names ([57b9e62](https://github.com/Life-USTC/server-nextjs/commit/57b9e62c52bdf633fa1ef9bd2ca4350b4251b38c))

# [0.30.0](https://github.com/Life-USTC/server-nextjs/compare/v0.29.0...v0.30.0) (2026-01-24)


### Features

* add upload ability ([c0ebdc6](https://github.com/Life-USTC/server-nextjs/commit/c0ebdc6e20e75cd419ade2cfc85b56a6644bc799))
* **metadata:** add title and favicon ([868e474](https://github.com/Life-USTC/server-nextjs/commit/868e47433a67def104085592973193cccb3231e7))

# [0.30.0](https://github.com/Life-USTC/server-nextjs/compare/v0.29.0...v0.30.0) (2026-01-23)


### Features

* add upload ability ([c0ebdc6](https://github.com/Life-USTC/server-nextjs/commit/c0ebdc6e20e75cd419ade2cfc85b56a6644bc799))

# [0.29.0](https://github.com/Life-USTC/server-nextjs/compare/v0.28.1...v0.29.0) (2026-01-22)


### Features

* **subscriptions:** support semester-scoped bulk import ([ac0346e](https://github.com/Life-USTC/server-nextjs/commit/ac0346ed694086f362ee3290ad3e278c82afc135))

## [0.28.1](https://github.com/Life-USTC/server-nextjs/compare/v0.28.0...v0.28.1) (2026-01-22)


### Bug Fixes

* **schedule:** derive units from time slots ([6eca613](https://github.com/Life-USTC/server-nextjs/commit/6eca613d372b392b635d68f45733f5ab7715ff17))

# [0.28.0](https://github.com/Life-USTC/server-nextjs/compare/v0.27.0...v0.28.0) (2026-01-22)


### Features

* **subscriptions:** add calendar preview ([e4522a2](https://github.com/Life-USTC/server-nextjs/commit/e4522a210e80ae7b1ebf0ed77596f4e108dbde66))

# [0.27.0](https://github.com/Life-USTC/server-nextjs/compare/v0.26.3...v0.27.0) (2026-01-22)


### Features

* **section:** add calendar view for events ([4abaafd](https://github.com/Life-USTC/server-nextjs/commit/4abaafd3f918689e565eb0af15f3c9f6eaa39352))

## [0.26.3](https://github.com/Life-USTC/server-nextjs/compare/v0.26.2...v0.26.3) (2026-01-21)


### Bug Fixes

* **ui:** use gap-x-2 instead of gap-2 for horizontal-only spacing ([54710b6](https://github.com/Life-USTC/server-nextjs/commit/54710b6914c47b2902dcb3e87c73b0ff1679910b))

## [0.26.2](https://github.com/Life-USTC/server-nextjs/compare/v0.26.1...v0.26.2) (2026-01-21)


### Bug Fixes

* **section:** use checkmark instead of duplicating label for UG&Grad ([134da16](https://github.com/Life-USTC/server-nextjs/commit/134da167989aedfb251cbe744bb8a3fa85f788d2))

## [0.26.1](https://github.com/Life-USTC/server-nextjs/compare/v0.26.0...v0.26.1) (2026-01-21)


### Bug Fixes

* **i18n:** correct "本研贯通" label from "Graduate" to "UG & Grad" ([44bd124](https://github.com/Life-USTC/server-nextjs/commit/44bd124914956da3c39ed91e3542e201dda7db8b))

# [0.26.0](https://github.com/Life-USTC/server-nextjs/compare/v0.25.1...v0.26.0) (2026-01-21)


### Features

* **teachers:** add teachers browse page and API endpoint ([aad6b8c](https://github.com/Life-USTC/server-nextjs/commit/aad6b8ca0d1988588a1a9319aa533f2a5a146a97))

## [0.25.1](https://github.com/Life-USTC/server-nextjs/compare/v0.25.0...v0.25.1) (2026-01-20)


### Bug Fixes

* **ui:** remove duplicate DialogBackdrop from dialog components ([ff7c90d](https://github.com/Life-USTC/server-nextjs/commit/ff7c90dac011fd0d750458421f834e79a4f0864a))

# [0.25.0](https://github.com/Life-USTC/server-nextjs/compare/v0.24.0...v0.25.0) (2026-01-20)


### Bug Fixes

* **auth:** impl getUserByAccount ([5861baf](https://github.com/Life-USTC/server-nextjs/commit/5861bafb64be97cc0447d61da7fc545a9a0878fe))
* **image:** use unoptimized, fix ustc logo ([87457eb](https://github.com/Life-USTC/server-nextjs/commit/87457eb8cf01cf1a2cd50a9a5a295cc36bfcd6c7))


### Features

* **subscriptions:** add bulk import and migrate to server actions ([b142537](https://github.com/Life-USTC/server-nextjs/commit/b142537fc96b08608563220b35879df146932279))

## [0.24.1](https://github.com/Life-USTC/server-nextjs/compare/v0.24.0...v0.24.1) (2026-01-20)


### Bug Fixes

* **auth:** impl getUserByAccount ([5861baf](https://github.com/Life-USTC/server-nextjs/commit/5861bafb64be97cc0447d61da7fc545a9a0878fe))
* **image:** use unoptimized, fix ustc logo ([87457eb](https://github.com/Life-USTC/server-nextjs/commit/87457eb8cf01cf1a2cd50a9a5a295cc36bfcd6c7))

# [0.24.0](https://github.com/Life-USTC/server-nextjs/compare/v0.23.2...v0.24.0) (2026-01-20)


### Features

* **auth:** Implement User model, OAuth2, and Profile page ([#8](https://github.com/Life-USTC/server-nextjs/issues/8)) ([2e94322](https://github.com/Life-USTC/server-nextjs/commit/2e94322dcec26b2136d8f800e6d344ec99eaa3d9))

## [0.23.2](https://github.com/Life-USTC/server-nextjs/compare/v0.23.1...v0.23.2) (2026-01-03)


### Bug Fixes

* try remove address for Apple Calendar ([4502fdf](https://github.com/Life-USTC/server-nextjs/commit/4502fdf61b34007a22e8e0d0d942ebb703fc4b23))

## [0.23.1](https://github.com/Life-USTC/server-nextjs/compare/v0.23.0...v0.23.1) (2026-01-03)


### Bug Fixes

* event location things ([47ba8d5](https://github.com/Life-USTC/server-nextjs/commit/47ba8d54a59728a79357f8454e8a1fc296be727e))

# [0.23.0](https://github.com/Life-USTC/server-nextjs/compare/v0.22.0...v0.23.0) (2026-01-03)


### Features

* update calendar generation functions to support async operations and add location-based image retrieval ([e9ada7d](https://github.com/Life-USTC/server-nextjs/commit/e9ada7d85b432cd61260abc717494a07eb06ebca))

# [0.22.0](https://github.com/Life-USTC/server-nextjs/compare/v0.21.0...v0.22.0) (2026-01-02)


### Features

* clear existing exam rooms before creating new ones ([624cdbe](https://github.com/Life-USTC/server-nextjs/commit/624cdbe57a37bf907d6b39c8c96936a8840ee547))

# [0.21.0](https://github.com/Life-USTC/server-nextjs/compare/v0.20.0...v0.21.0) (2026-01-02)


### Features

* add bulk section import with current semester matching and toast notifications ([5434b8b](https://github.com/Life-USTC/server-nextjs/commit/5434b8bb7b27a11e4d7922000d8ead55bde957d1))

# [0.20.0](https://github.com/Life-USTC/server-nextjs/compare/v0.19.0...v0.20.0) (2026-01-02)


### Features

* refactor Schedule model to support multiple teachers; update related queries and migration ([dbf29d0](https://github.com/Life-USTC/server-nextjs/commit/dbf29d09b984de4ef890ccb669d15f3327cd72e3))

# [0.19.0](https://github.com/Life-USTC/server-nextjs/compare/v0.18.1...v0.19.0) (2025-12-31)


### Features

* add commander dependency and update Dockerfile for git installation; enhance load-from-static script with semester code filtering; add cron job for periodic execution ([6d822ca](https://github.com/Life-USTC/server-nextjs/commit/6d822ca57cf0d7b4e1c56803663724603e4ae5b0))

## [0.18.1](https://github.com/Life-USTC/server-nextjs/compare/v0.18.0...v0.18.1) (2025-12-31)


### Bug Fixes

* use redirect ([45a0911](https://github.com/Life-USTC/server-nextjs/commit/45a09115e7c889f4acbb9872e43448fedafe429d))

# [0.18.0](https://github.com/Life-USTC/server-nextjs/compare/v0.17.1...v0.18.0) (2025-12-30)


### Features

* add dotenv-expand for environment variable expansion ([e91c513](https://github.com/Life-USTC/server-nextjs/commit/e91c513ca4371c7d8073231cb9cd4da0e1127e5f))

## [0.17.1](https://github.com/Life-USTC/server-nextjs/compare/v0.17.0...v0.17.1) (2025-12-30)


### Bug Fixes

* nextjs host issue ([954e254](https://github.com/Life-USTC/server-nextjs/commit/954e2542180acbc7e61eea985acbe236ab6a936a))

# [0.17.0](https://github.com/Life-USTC/server-nextjs/compare/v0.16.0...v0.17.0) (2025-12-29)


### Features

* add jose library for JWT handling ([8eef4d3](https://github.com/Life-USTC/server-nextjs/commit/8eef4d3a28fd09591c78ae247e0aedd81eccacd2))

# [0.16.0](https://github.com/Life-USTC/server-nextjs/compare/v0.15.0...v0.16.0) (2025-12-29)


### Features

* add anonymous calendar subscription system with JWT authentication ([0b30a20](https://github.com/Life-USTC/server-nextjs/commit/0b30a202fbb3ed9252889b4e29d9d5bd62a0d789))

# [0.15.0](https://github.com/Life-USTC/server-nextjs/compare/v0.14.0...v0.15.0) (2025-12-28)


### Features

* add exam events to section iCalendar export ([2670e0c](https://github.com/Life-USTC/server-nextjs/commit/2670e0cc196203935da96f1ef90ad07b5c625e35))

# [0.14.0](https://github.com/Life-USTC/server-nextjs/compare/v0.13.0...v0.14.0) (2025-12-28)


### Features

* move navigation to bottom bar with sticky footer layout ([2690d0a](https://github.com/Life-USTC/server-nextjs/commit/2690d0aeea2d958ecbaef2424d6f94098c027998))

# [0.13.0](https://github.com/Life-USTC/server-nextjs/compare/v0.12.0...v0.13.0) (2025-12-28)


### Features

* improve time formatting and UI layout ([23a673d](https://github.com/Life-USTC/server-nextjs/commit/23a673d0d0f7b2a0c3e9cc0518071cea60395544))

# [0.12.0](https://github.com/Life-USTC/server-nextjs/compare/v0.11.0...v0.12.0) (2025-12-28)


### Features

* add table view, advanced search, and UI enhancements ([5e31855](https://github.com/Life-USTC/server-nextjs/commit/5e31855897946c27a842eb1845f99bb6ad8a99c7))

# [0.11.0](https://github.com/Life-USTC/server-nextjs/compare/v0.10.0...v0.11.0) (2025-12-28)


### Features

* use cookies instead of [locale] for i18n ([a1068b6](https://github.com/Life-USTC/server-nextjs/commit/a1068b69033ba08ec400d0c9ec2f44825cee2780))

# [0.10.0](https://github.com/Life-USTC/server-nextjs/compare/v0.9.0...v0.10.0) (2025-12-28)


### Features

* add exam management functionality ([f6e2537](https://github.com/Life-USTC/server-nextjs/commit/f6e25373104ea4da256c1c06d1e10d7c35362473))

# [0.9.0](https://github.com/Life-USTC/server-nextjs/compare/v0.8.0...v0.9.0) (2025-12-28)


### Features

* add calendar button to section detail page ([584b721](https://github.com/Life-USTC/server-nextjs/commit/584b7212b8fa1aacdb8b5c321e6c06f16a5b050f)), closes [#123](https://github.com/Life-USTC/server-nextjs/issues/123)
* extend schema with teacher assignments and enhanced section metadata ([aef5fb6](https://github.com/Life-USTC/server-nextjs/commit/aef5fb62425b4c6718f1aa9c76ed6bdc521aa4dc))


### Performance Improvements

* add jwId indexes and handle null campus data ([b9b12b9](https://github.com/Life-USTC/server-nextjs/commit/b9b12b964dbd428c6d036ab5ab0d8cde34c8fee9))

# [0.8.0](https://github.com/Life-USTC/server-nextjs/compare/v0.7.0...v0.8.0) (2025-12-27)


### Bug Fixes

* use teacher: for search ([b2f76d0](https://github.com/Life-USTC/server-nextjs/commit/b2f76d03f4396d46281322e68999e3263eca3b5e))


### Features

* add advanced search syntax for sections ([d53a592](https://github.com/Life-USTC/server-nextjs/commit/d53a592e1640ccd927ed25632598e55fc9653ab3))
* migrate to Coss UI components and standardize styling ([13cef33](https://github.com/Life-USTC/server-nextjs/commit/13cef3378672cfc03a3a80550cfbb2d0c2edcb30))
* replace language selector with menu component ([4bdb99a](https://github.com/Life-USTC/server-nextjs/commit/4bdb99aa1913a1bcbb19545b6c07e8ad1831f7ea))
* use cossui ([b57f5c7](https://github.com/Life-USTC/server-nextjs/commit/b57f5c77816b30fc8c8c9d6cd93a0d089a5e324f))

# [0.7.0](https://github.com/Life-USTC/server-nextjs/compare/v0.6.1...v0.7.0) (2025-12-27)


### Features

* implement section calendar generation and update section page logic ([78f5911](https://github.com/Life-USTC/server-nextjs/commit/78f5911bc27bb0b4ab5f851f4e03682400b223d7))

## [0.6.1](https://github.com/Life-USTC/server-nextjs/compare/v0.6.0...v0.6.1) (2025-12-20)


### Bug Fixes

* root not-found page ([a2d0b81](https://github.com/Life-USTC/server-nextjs/commit/a2d0b8178bfc9046130d70b26833d79786111c17))
* update iCal calendar name, description, and URL format ([ec8e750](https://github.com/Life-USTC/server-nextjs/commit/ec8e75085b764901f04bd6c6a91547b2466ad9a8))
* update path for schedule data directory in loadSchedules function ([66191f3](https://github.com/Life-USTC/server-nextjs/commit/66191f35ed2dc2f7125371ceb3dc3d9fc883eb4e))

# [0.6.0](https://github.com/Life-USTC/server-nextjs/compare/v0.5.2...v0.6.0) (2025-12-19)


### Bug Fixes

* make API endpoints dynamic ([ba9fb3e](https://github.com/Life-USTC/server-nextjs/commit/ba9fb3ecc511b678509ffd7c44463bb35a3b2ccd))
* update 404 page translations ([f67db3d](https://github.com/Life-USTC/server-nextjs/commit/f67db3deaddbc89540085cec7d2421b5bb99841f))


### Features

* add loading and error pages for locales ([c1ad826](https://github.com/Life-USTC/server-nextjs/commit/c1ad826c954ac430b14643274205d67170622208))
* add localized metadata support ([0debe55](https://github.com/Life-USTC/server-nextjs/commit/0debe550ea81c278bf8550847e8a3c67c633d2ec))
* implement localized 404 pages ([405039c](https://github.com/Life-USTC/server-nextjs/commit/405039c45c337d842329ac47f19ecd0579f64e6f))
* migrate Tailwind config to TypeScript ([221f787](https://github.com/Life-USTC/server-nextjs/commit/221f78728ff15d550d3f773a47ff9621f297ebdd))

## [0.5.2](https://github.com/Life-USTC/server-nextjs/compare/v0.5.1...v0.5.2) (2025-12-17)


### Bug Fixes

* deps issue in load-from-static ([4939b60](https://github.com/Life-USTC/server-nextjs/commit/4939b60a877ead0e63bc3153c93c1f02c2182ea4))
* missing COPY in Dockerfile ([f93c9e6](https://github.com/Life-USTC/server-nextjs/commit/f93c9e668ec8b9d8a455969fe48860b19a1aec22))

## [0.5.1](https://github.com/Life-USTC/server-nextjs/compare/v0.5.0...v0.5.1) (2025-12-17)


### Bug Fixes

* add back load-from-static ([9cd636a](https://github.com/Life-USTC/server-nextjs/commit/9cd636a8d76cc561cccd97f3e0a576377dbc8cd3))

# [0.5.0](https://github.com/Life-USTC/server-nextjs/compare/v0.4.0...v0.5.0) (2025-12-17)


### Features

* add English and Chinese translation files ([55fbafa](https://github.com/Life-USTC/server-nextjs/commit/55fbafa92b7a49625c916e2e8c6bae6dcbb8d985))
* add i18n routing and middleware configuration ([1c29d2a](https://github.com/Life-USTC/server-nextjs/commit/1c29d2a558903e0dc22b70d3cdf62474c66a7b91))
* add language switcher component ([7184d4a](https://github.com/Life-USTC/server-nextjs/commit/7184d4a1ccb050d6ff8ae5e95114ccad38e0afc5))
* add next-intl for internationalization support ([a680f50](https://github.com/Life-USTC/server-nextjs/commit/a680f506e6b65e3efc4d003dc3951c1f9ca06617))
* wrap App Store download image in a link for direct access ([47ece35](https://github.com/Life-USTC/server-nextjs/commit/47ece3528116f10a8c36d2457232eec3b47c1133))

# [0.4.0](https://github.com/Life-USTC/server-nextjs/compare/v0.3.2...v0.4.0) (2025-12-16)


### Bug Fixes

* add hydration safety to theme toggle ([28c48e2](https://github.com/Life-USTC/server-nextjs/commit/28c48e271238f1c5809c6946c2e22408fe585355))


### Features

* add homepage assets ([76f8a2f](https://github.com/Life-USTC/server-nextjs/commit/76f8a2f531410087d5b15d65000311368509a2bb))

## [0.3.2](https://github.com/Life-USTC/server-nextjs/compare/v0.3.1...v0.3.2) (2025-12-16)


### Bug Fixes

* color design ([#3](https://github.com/Life-USTC/server-nextjs/issues/3)) ([3662c6c](https://github.com/Life-USTC/server-nextjs/commit/3662c6c0548dc2f5374c5ff7e20d5dfe2648edaa))

## [0.3.1](https://github.com/Life-USTC/server-nextjs/compare/v0.3.0...v0.3.1) (2025-12-15)


### Bug Fixes

* use dynamic in homeview ([0925307](https://github.com/Life-USTC/server-nextjs/commit/0925307aa49f70f23b97f78ba824c95fea5a2dbc))

# [0.3.0](https://github.com/Life-USTC/server-nextjs/compare/v0.2.0...v0.3.0) (2025-12-15)


### Features

* add webview with Ant Design ([#2](https://github.com/Life-USTC/server-nextjs/issues/2)) ([7d3b412](https://github.com/Life-USTC/server-nextjs/commit/7d3b412848a3d14f072c73f1177d2e3379470409))

# [0.2.0](https://github.com/Life-USTC/server-nextjs/compare/v0.1.0...v0.2.0) (2025-12-12)


### Bug Fixes

* **ci:** ownership in docker build ([12c0e27](https://github.com/Life-USTC/server-nextjs/commit/12c0e2778255bce9bf90d6c7ff931b4491f03494))
* **ci:** prisma generate ([0a938ad](https://github.com/Life-USTC/server-nextjs/commit/0a938ade110d4ad72faf8ec671943f337f46beaa))


### Features

* add webhook API for data loading ([#1](https://github.com/Life-USTC/server-nextjs/issues/1)) ([2c87e56](https://github.com/Life-USTC/server-nextjs/commit/2c87e566a8729aecef214407123e677c98f14f73))

## [0.1.1](https://github.com/Life-USTC/server-nextjs/compare/v0.1.0...v0.1.1) (2025-12-12)


### Bug Fixes

* **ci:** ownership in docker build ([12c0e27](https://github.com/Life-USTC/server-nextjs/commit/12c0e2778255bce9bf90d6c7ff931b4491f03494))
* **ci:** prisma generate ([0a938ad](https://github.com/Life-USTC/server-nextjs/commit/0a938ade110d4ad72faf8ec671943f337f46beaa))
