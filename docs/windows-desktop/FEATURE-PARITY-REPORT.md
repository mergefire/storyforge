# Windows Desktop Feature Parity Report

- Source freeze: `52819e7`
- Scanner: v1 (TypeScript AST; production modules are never executed)
- Registered actions: **1589**
- Routes: 4; visible sidebar leaves: 36; workspace dispatch cases: 44; UI handlers: 1379; runtime/background calls: 126
- Gate: any added/deleted/unmapped action, duplicate actionId/FP ID, UNKNOWN, or BLOCKED status fails `npm run check:desktop-parity`.

## Explicit exclusions

| Source | Reason |
| --- | --- |
| `src/components/settings/NS0EvalPanel.tsx` | 开发评测面板，不进入生产导航或稳定桌面身份 |
| `src/runtime/tauri/dev-smoke.ts` | 仅供 dev identity 的合成实机验收钩子 |

## Acceptance registry

| actionId | FP ID | Kind | Source | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| `dispatch:02f64cf34785394f` | `FP-DISPATCH-892D680FAFA7` | dispatch | `src/pages/WorkspacePage.tsx:214` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:037b4f300a379032` | `FP-DISPATCH-0FF9113D4D9F` | dispatch | `src/pages/WorkspacePage.tsx:206` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:0743512ad9a23267` | `FP-DISPATCH-59E58133F3DD` | dispatch | `src/pages/WorkspacePage.tsx:208` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:0bb701977b7c132c` | `FP-DISPATCH-C98E9CE08C5D` | dispatch | `src/pages/WorkspacePage.tsx:224` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:0d5992691c102ef1` | `FP-DISPATCH-08C87D34EECE` | dispatch | `src/pages/WorkspacePage.tsx:228` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:12e886edfc1e4bda` | `FP-DISPATCH-341E8973E233` | dispatch | `src/pages/WorkspacePage.tsx:236` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:1b426fb93da35c3b` | `FP-DISPATCH-2F2736789871` | dispatch | `src/pages/WorkspacePage.tsx:226` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:2296ac91cc276ec1` | `FP-DISPATCH-C74A66AABFD5` | dispatch | `src/pages/WorkspacePage.tsx:240` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:25d11e4cf3066c0e` | `FP-DISPATCH-CA1001719148` | dispatch | `src/pages/WorkspacePage.tsx:187` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:268abb2548e388a8` | `FP-DISPATCH-FEDC01816BDB` | dispatch | `src/pages/WorkspacePage.tsx:216` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:2a63da2cb967e95d` | `FP-DISPATCH-558D6F7E5ACF` | dispatch | `src/pages/WorkspacePage.tsx:275` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:2e26cca37113387a` | `FP-DISPATCH-DC4595573C46` | dispatch | `src/pages/WorkspacePage.tsx:266` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:2e3133a1538a993e` | `FP-DISPATCH-DDCA2D8FF2FC` | dispatch | `src/pages/WorkspacePage.tsx:258` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:3686525e2c835bf8` | `FP-DISPATCH-1FD46C4E41F2` | dispatch | `src/pages/WorkspacePage.tsx:254` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:464b6ca75d8277ea` | `FP-DISPATCH-81D95340AB7A` | dispatch | `src/pages/WorkspacePage.tsx:242` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:47bcef60c114f3fb` | `FP-DISPATCH-503B9C2FBA49` | dispatch | `src/pages/WorkspacePage.tsx:276` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:485c763dfbd3690c` | `FP-DISPATCH-456E1A001E99` | dispatch | `src/pages/WorkspacePage.tsx:212` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:4bd8fcc137a1566c` | `FP-DISPATCH-483249E7848C` | dispatch | `src/pages/WorkspacePage.tsx:197` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:58dd64865b328bef` | `FP-DISPATCH-A8EEA6906FE5` | dispatch | `src/pages/WorkspacePage.tsx:220` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:5c7497f4e9e948db` | `FP-DISPATCH-68E9D3BA59E2` | dispatch | `src/pages/WorkspacePage.tsx:179` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:6590166563191138` | `FP-DISPATCH-316095666719` | dispatch | `src/pages/WorkspacePage.tsx:171` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:686a388bbb7f3c55` | `FP-DISPATCH-FCBC22657E8D` | dispatch | `src/pages/WorkspacePage.tsx:202` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:68d1b15fca330b2f` | `FP-DISPATCH-566ED167B421` | dispatch | `src/pages/WorkspacePage.tsx:210` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:7705e57279979a09` | `FP-DISPATCH-780369A54B29` | dispatch | `src/pages/WorkspacePage.tsx:189` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:7825f672ec1486ce` | `FP-DISPATCH-F9822FEFF321` | dispatch | `src/pages/WorkspacePage.tsx:270` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:7e56512586bd4acc` | `FP-DISPATCH-ACE32651C9F1` | dispatch | `src/pages/WorkspacePage.tsx:244` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:835de7a81a88993b` | `FP-DISPATCH-09536F720C73` | dispatch | `src/pages/WorkspacePage.tsx:230` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:8a04095ad844b408` | `FP-DISPATCH-4BBF00E47A7E` | dispatch | `src/pages/WorkspacePage.tsx:268` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:91fa277bb8a9043f` | `FP-DISPATCH-CE6EBDDC4822` | dispatch | `src/pages/WorkspacePage.tsx:191` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:9a211e18ba03b4a1` | `FP-DISPATCH-C0D6F9CC3FDF` | dispatch | `src/pages/WorkspacePage.tsx:238` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:9f3da3b85c0f1595` | `FP-DISPATCH-68FB3972095C` | dispatch | `src/pages/WorkspacePage.tsx:272` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:b447401146a42375` | `FP-DISPATCH-8BCE54901982` | dispatch | `src/pages/WorkspacePage.tsx:222` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:c6afd89d46ad12fb` | `FP-DISPATCH-476313F52590` | dispatch | `src/pages/WorkspacePage.tsx:232` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:c761db9a5faafc38` | `FP-DISPATCH-9BDA31041410` | dispatch | `src/pages/WorkspacePage.tsx:262` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:ce93aad01d572f94` | `FP-DISPATCH-1D0054F5EEAD` | dispatch | `src/pages/WorkspacePage.tsx:195` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:d030e61c46cabdc8` | `FP-DISPATCH-1C6E9CA7989C` | dispatch | `src/pages/WorkspacePage.tsx:183` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:d1b5c8300539af78` | `FP-DISPATCH-8FB0837B463B` | dispatch | `src/pages/WorkspacePage.tsx:246` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:db2cea40ce35fead` | `FP-DISPATCH-158B26261E43` | dispatch | `src/pages/WorkspacePage.tsx:175` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:dca649c109aad9fb` | `FP-DISPATCH-DD6B908F70F7` | dispatch | `src/pages/WorkspacePage.tsx:185` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:e0afdda51388fffa` | `FP-DISPATCH-A5D54A030450` | dispatch | `src/pages/WorkspacePage.tsx:173` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:ed2c78182c307c00` | `FP-DISPATCH-E672496DFD9D` | dispatch | `src/pages/WorkspacePage.tsx:274` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:eedad2995d0ced93` | `FP-DISPATCH-F3A2AACAAE8D` | dispatch | `src/pages/WorkspacePage.tsx:193` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:ef7da0fd5332485b` | `FP-DISPATCH-749257C79C1E` | dispatch | `src/pages/WorkspacePage.tsx:201` | REGISTERED_M1 | npm run check:desktop-routes |
| `dispatch:f39fcee271a87f48` | `FP-DISPATCH-7B63F47CB985` | dispatch | `src/pages/WorkspacePage.tsx:234` | REGISTERED_M1 | npm run check:desktop-routes |
| `route:5bc3cb2557f34f7a` | `FP-ROUTE-81C605791E51` | route | `src/App.tsx:34` | REGISTERED_M1 | npm run check:desktop-routes |
| `route:5f13a158ffec937b` | `FP-ROUTE-AFB399254B95` | route | `src/App.tsx:33` | REGISTERED_M1 | npm run check:desktop-routes |
| `route:a547df4c0d21dfc6` | `FP-ROUTE-731FC6E0F5A8` | route | `src/App.tsx:35` | REGISTERED_M1 | npm run check:desktop-routes |
| `route:e6a0a181362ef48a` | `FP-ROUTE-DDD17877C226` | route | `src/App.tsx:32` | REGISTERED_M1 | npm run check:desktop-routes |
| `runtime:003a498012d3e9e8` | `FP-RUNTIME-B9BA9FB34994` | runtime | `src/lib/export/json-export.ts:120` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:02253ca5254e4964` | `FP-RUNTIME-7318E5091F27` | runtime | `src/stores/ai-config.ts:337` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:0448c9370b75f7a5` | `FP-RUNTIME-9FDCDFF3C149` | runtime | `src/components/geography/GeographyPanel.tsx:145` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:0537fb24b728ac7e` | `FP-RUNTIME-6867495FAE07` | runtime | `src/runtime/web/index.ts:502` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:05bd72cec6d9224e` | `FP-RUNTIME-1ABEBA99FAC5` | runtime | `src/stores/ai-config.ts:593` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:06f1d50cf64967ee` | `FP-RUNTIME-DF327DE4524D` | runtime | `src/components/shared/PanelLayout.tsx:79` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:0767b9b237d89f9e` | `FP-RUNTIME-CB914DEB6025` | runtime | `src/components/geography/WorldMapVoronoi.tsx:180` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:07d166c79d767d18` | `FP-RUNTIME-1D110956C85B` | runtime | `src/components/data/DataManagementPanel.tsx:217` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:0bc98e06981068c0` | `FP-RUNTIME-E623471EDBC0` | runtime | `src/lib/ai/adapters/embedding-adapter.ts:50` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:0bde393d799b15ba` | `FP-RUNTIME-9DB16B56E280` | runtime | `src/components/system/import/ImportProgressPanel.tsx:22` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:0cd73196103195fb` | `FP-RUNTIME-7316CC4675F2` | runtime | `src/components/data/DataManagementPanel.tsx:205` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:12652b79ab844eaf` | `FP-RUNTIME-9597A9B6C9A5` | runtime | `src/components/relations/CharacterRelationPanel.tsx:163` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:130f3fcba1915e5e` | `FP-RUNTIME-406237A8347C` | runtime | `src/hooks/useGistAutoBackup.ts:18` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:1413bca62eee8663` | `FP-RUNTIME-4EFBFBE9A8C2` | runtime | `src/runtime/tauri/index.ts:274` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:175364d131f80b34` | `FP-RUNTIME-D0217643E381` | runtime | `src/pages/HomePage.tsx:123` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:1794e01e141f801e` | `FP-RUNTIME-1FD705D2D22D` | runtime | `src/components/geography/WorldMapVoronoi.tsx:209` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:190a72330dce7e7c` | `FP-RUNTIME-DB931FE10847` | runtime | `src/pages/HomePage.tsx:73` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:1fb021e9f393e1b2` | `FP-RUNTIME-17B7A73512CD` | runtime | `src/stores/ai-config.ts:449` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:20c9657d45a32cf7` | `FP-RUNTIME-DA14A90A2E98` | runtime | `src/components/data/CloudBackupCard.tsx:34` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:23e90d363e5962e1` | `FP-RUNTIME-664B60442902` | runtime | `src/components/geography/WorldMapVoronoi.tsx:211` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:269a34a041890693` | `FP-RUNTIME-FD873181AA4F` | runtime | `src/components/system/ImportDocPanel.tsx:112` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:273d708a5311570d` | `FP-RUNTIME-174F8194B8C8` | runtime | `src/components/data/DataManagementPanel.tsx:89` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:289328bd5e682676` | `FP-RUNTIME-AF0AB3BB3532` | runtime | `src/components/settings/prompt/WorkflowRunner.tsx:439` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:291f5d0776e6019e` | `FP-RUNTIME-0A9BA808DD10` | runtime | `src/lib/ai/adapters/embedding-adapter.ts:61` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:29f4227779c9721d` | `FP-RUNTIME-0F60FDE52F72` | runtime | `src/runtime/web/index.ts:501` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:2a263c5d977c6a63` | `FP-RUNTIME-4A384817BA23` | runtime | `src/stores/ai-config.ts:374` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:2b3ae1ce1e275478` | `FP-RUNTIME-3CDF6648B5E5` | runtime | `src/stores/ai-config.ts:511` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:2c75413ae11e4c07` | `FP-RUNTIME-E8B370A0B49A` | runtime | `src/lib/export/gist-export.ts:125` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:2dacf52b32bdfaab` | `FP-RUNTIME-C2796B393E7A` | runtime | `src/lib/ai/model-list.ts:107` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:2df21761ac0a0b8d` | `FP-RUNTIME-85E70D08B70B` | runtime | `src/components/geography/WorldMapVoronoi.tsx:83` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:2eb78315ce63d7ce` | `FP-RUNTIME-B7D2A9743F5A` | runtime | `src/components/data/DataManagementPanel.tsx:102` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:2ef2658c4ded2e5a` | `FP-RUNTIME-DEDC64D1BE59` | runtime | `src/stores/ai-config.ts:384` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:310cc0e775b2034d` | `FP-RUNTIME-191BFD9D38D5` | runtime | `src/components/relations/RelationGraph.tsx:71` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:3152acc6ee56626b` | `FP-RUNTIME-E78175ED7188` | runtime | `src/hooks/useFolderAutoBackup.ts:28` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:319defa37fd39229` | `FP-RUNTIME-EF33648FE12C` | runtime | `src/runtime/web/index.ts:1381` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:37b1be66f19cd9cf` | `FP-RUNTIME-01185D7D7327` | runtime | `src/lib/pwa/register-service-worker.ts:7` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:38db98bf70cbc9e5` | `FP-RUNTIME-39304849EE29` | runtime | `src/components/shared/PanelLayout.tsx:55` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:3a2428ab2d1334ee` | `FP-RUNTIME-FA93F932D003` | runtime | `src/stores/ai-config.ts:412` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:3a8d9aead5d96333` | `FP-RUNTIME-C0B6A38718BD` | runtime | `src/hooks/useAutoBackup.ts:22` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:3cc95c4e165b389e` | `FP-RUNTIME-96FECB761679` | runtime | `src/stores/ai-config.ts:281` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:3db01760c2502371` | `FP-RUNTIME-52362F9C8CE9` | runtime | `src/stores/ai-config.ts:556` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:425c98bf6ab52e36` | `FP-RUNTIME-3C9A07F98ADD` | runtime | `src/components/settings/AIConfigPanel.tsx:166` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:44f7b1cb12e2ba62` | `FP-RUNTIME-1642FFB8A3BC` | runtime | `src/lib/ai/client.ts:501` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:46c8fdfacb97cc60` | `FP-RUNTIME-A1DB2CAF244C` | runtime | `src/hooks/useAutoSave.ts:37` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:47f77644f1d3e755` | `FP-RUNTIME-DE7D866F6156` | runtime | `src/components/geography/WorldMapVoronoi.tsx:210` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:4b52aaaf0bc4389b` | `FP-RUNTIME-475841F50FF2` | runtime | `src/lib/ai/runtime-transport.ts:63` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:4b65d6dd1538d9e8` | `FP-RUNTIME-6E704DCA70A6` | runtime | `src/components/editor/RichEditor.tsx:575` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:4d56e4836b8a99d9` | `FP-RUNTIME-A1C2A399BABF` | runtime | `src/lib/runtime-file.ts:35` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:515f252620e12092` | `FP-RUNTIME-0CF1F2635ECB` | runtime | `src/lib/ai/runtime-transport.ts:98` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:5673dddb2837c2cd` | `FP-RUNTIME-D531B91635C9` | runtime | `src/components/settings/AIConfigPanel.tsx:122` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:56de9677721cf84e` | `FP-RUNTIME-C22B3A79A862` | runtime | `src/components/project/InspirationPanel.tsx:76` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:56ff5487142962c7` | `FP-RUNTIME-2E48F52815A9` | runtime | `src/stores/ai-config.ts:622` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:59b8b024ffe7b5cd` | `FP-RUNTIME-2E282639C9EB` | runtime | `src/components/world-group/WorldGroupSwitcher.tsx:21` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:59dd198d00a16757` | `FP-RUNTIME-72783E25D9BC` | runtime | `src/components/character/CharacterDimensionFields.tsx:80` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:5d2ae2fa27b5538a` | `FP-RUNTIME-5DFC2F687B16` | runtime | `src/components/geography/WorldMapVoronoi.tsx:212` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:5e5408bab860bca5` | `FP-RUNTIME-884652ADD2B4` | runtime | `src/stores/ai-config.ts:521` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:63bc97e7fe8f756f` | `FP-RUNTIME-33E8F67BDFAA` | runtime | `src/stores/ai-config.ts:643` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:640d38fe588c7575` | `FP-RUNTIME-94FF8FAC487D` | runtime | `src/hooks/useBeforeUnload.ts:19` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:66f26ef9bd21d33c` | `FP-RUNTIME-7A78F4FEA7F1` | runtime | `src/lib/ai/client.ts:318` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:67139ed13001c23c` | `FP-RUNTIME-CD4118C04E85` | runtime | `src/components/geography/WorldMapVoronoi.tsx:213` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:6e628289ebaa5f2b` | `FP-RUNTIME-DE404884DF73` | runtime | `src/components/editor/ChapterAIAssistantPanel.tsx:265` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:6e8566c771480724` | `FP-RUNTIME-FAC0B63DF5CC` | runtime | `src/stores/ai-config.ts:492` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:705e9e198bac0a24` | `FP-RUNTIME-D676DF6B0DA4` | runtime | `src/stores/ai-config.ts:634` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:770c348f88039406` | `FP-RUNTIME-3785FDBDA316` | runtime | `src/components/geography/WorldMapVoronoi.tsx:265` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:77eb82bdba2f837e` | `FP-RUNTIME-BB7E4F6DC926` | runtime | `src/stores/ai-config.ts:303` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:78876d1b0a0ee3c8` | `FP-RUNTIME-979F00826179` | runtime | `src/runtime/web/index.ts:504` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:7b0e38ae6792412b` | `FP-RUNTIME-F819428C428F` | runtime | `src/components/settings/prompt/WorkflowRunner.tsx:439` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:7eeaf7866c4f34c1` | `FP-RUNTIME-689FE5E97964` | runtime | `src/pages/HomePage.tsx:93` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:80ee047e498c8987` | `FP-RUNTIME-34CAF64AA034` | runtime | `src/components/shared/Toast.tsx:33` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:83dc2c566f83f41d` | `FP-RUNTIME-DE24E14919FA` | runtime | `src/stores/ai-config.ts:418` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:86027aa22d7e66cd` | `FP-RUNTIME-83CC51E5D181` | runtime | `src/components/geography/GeographyPanel.tsx:147` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:88170101520ac1d3` | `FP-RUNTIME-50950FA1362B` | runtime | `src/components/scene/SceneVerifyPanel.tsx:50` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:88fa53ee7e49a640` | `FP-RUNTIME-1CACF16838B2` | runtime | `src/lib/export/gist-export.ts:91` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:8a14f33818ff08c5` | `FP-RUNTIME-B1DB9C5153B1` | runtime | `src/components/editor/ChapterAIAssistantPanel.tsx:635` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:8a753abc7ec4dcf3` | `FP-RUNTIME-0BE75C40B175` | runtime | `src/components/editor/RichEditor.tsx:597` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:8e61018b9128ab3a` | `FP-RUNTIME-08AAC5792A65` | runtime | `src/lib/ai/runtime-transport.ts:67` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:8f1c9c7a1a1d8f44` | `FP-RUNTIME-EB7FF629A61E` | runtime | `src/pages/HomePage.tsx:69` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:90270a427d81dd48` | `FP-RUNTIME-7E23F2672E95` | runtime | `src/lib/export/context-snapshot.ts:180` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:91773bf7aead7b0f` | `FP-RUNTIME-7142842E098C` | runtime | `src/runtime/web/index.ts:492` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:94535d131042625f` | `FP-RUNTIME-B02DD75CFBF8` | runtime | `src/lib/reference-analysis/pipeline.ts:456` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:94546e09c4461a0b` | `FP-RUNTIME-D7CD9DB8224C` | runtime | `src/components/editor/ChapterAIAssistantPanel.tsx:266` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:9a4c62528b82dd75` | `FP-RUNTIME-1603B6F80FDA` | runtime | `src/lib/export/gist-export.ts:51` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:9de464c106a2b9cf` | `FP-RUNTIME-CD8863FC40F4` | runtime | `src/runtime/tauri/index.ts:124` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:9e4f467d6eda391d` | `FP-RUNTIME-640FF4F0E15C` | runtime | `src/lib/diagnostics/local-diagnostic-report.ts:86` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:9ed0a66aa5ac140f` | `FP-RUNTIME-9AEBA953EA02` | runtime | `src/lib/ai/runtime-transport.ts:84` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:9f2dee5e1688ad10` | `FP-RUNTIME-3662D7B8753A` | runtime | `src/stores/ai-config.ts:279` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:a1c37512d45fdb66` | `FP-RUNTIME-E17AFAE687A1` | runtime | `src/components/data/DataManagementPanel.tsx:91` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:a2b00a75fd6740a6` | `FP-RUNTIME-FA137FA59535` | runtime | `src/lib/import/pipeline.ts:363` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:a33e1adecec7d85e` | `FP-RUNTIME-D175B44533A7` | runtime | `src/lib/export/gist-export.ts:77` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:a460cfa8b0049493` | `FP-RUNTIME-257E3343CE52` | runtime | `src/lib/ai/model-list.ts:98` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:a4d125d421ff087f` | `FP-RUNTIME-1FA0E8D3B726` | runtime | `src/hooks/useFolderAutoBackup.ts:40` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:a5b16e986ad433ab` | `FP-RUNTIME-D0ED04FEAAA1` | runtime | `src/components/data/DataManagementPanel.tsx:189` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:a969aa162c71c681` | `FP-RUNTIME-4DA50E365F5A` | runtime | `src/components/data/DataManagementPanel.tsx:171` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:aaa7b703c69e147d` | `FP-RUNTIME-EFE30B06B01B` | runtime | `src/stores/ai-config.ts:308` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:ac875fe6642409e8` | `FP-RUNTIME-B0EB04C5AFB4` | runtime | `src/components/geography/WorldMapVoronoi.tsx:274` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:af4df24ff6aaff7b` | `FP-RUNTIME-8D728FD7F368` | runtime | `src/components/settings/prompt/WorkflowRunner.tsx:441` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:b2bf170b8a0fe155` | `FP-RUNTIME-4EF0A22EF427` | runtime | `src/lib/export/gist-export.ts:44` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:b5726486958b8e59` | `FP-RUNTIME-8604B287999D` | runtime | `src/components/shared/PanelLayout.tsx:78` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:b6950414d3a78e99` | `FP-RUNTIME-1C9A3AB5EB3F` | runtime | `src/runtime/web/index.ts:503` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:b769b2ef6ce56082` | `FP-RUNTIME-E2BCCD4D14D7` | runtime | `src/lib/storage/folder-backup.ts:34` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:b7d5583a6d64a92b` | `FP-RUNTIME-7849063DF057` | runtime | `src/lib/export/gist-export.ts:55` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:b9e679db095dc7fe` | `FP-RUNTIME-D382866D3EE3` | runtime | `src/stores/ai-config.ts:327` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:ba6137ac0e8bbb8d` | `FP-RUNTIME-D954A69EDA9A` | runtime | `src/lib/export/gist-export.ts:109` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:ba7825b50446c08a` | `FP-RUNTIME-F2D509ACD21D` | runtime | `src/lib/export/gist-export.ts:118` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:be38d0b78a5cc015` | `FP-RUNTIME-6B43E9FEE0C9` | runtime | `src/components/system/ImportDocPanel.tsx:113` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:c04822cf57b2c9d6` | `FP-RUNTIME-9F6DFA4615BD` | runtime | `src/lib/ai/runtime-transport.ts:185` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:c16648a98179057b` | `FP-RUNTIME-0EAFB4AC5A79` | runtime | `src/lib/ai/adapters/embedding-adapter.ts:51` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:c512f311cf68a5a5` | `FP-RUNTIME-9B00622479E1` | runtime | `src/lib/runtime-file.ts:22` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:c6533dad75113356` | `FP-RUNTIME-438DCCA0C5A2` | runtime | `src/components/geography/WorldMapVoronoi.tsx:277` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:c78164c1de358d16` | `FP-RUNTIME-9782FEB8834F` | runtime | `src/components/data/DataManagementPanel.tsx:167` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:c95846fb7223a4aa` | `FP-RUNTIME-F86EC38B66F4` | runtime | `src/lib/export/gist-export.ts:87` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:c9e6ace4e4b649c2` | `FP-RUNTIME-FC43569ED98B` | runtime | `src/stores/ai-config.ts:429` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:d2fcfa0bcd1cf847` | `FP-RUNTIME-A0E4FD188729` | runtime | `src/lib/storage/folder-backup.ts:50` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:d82d931668734645` | `FP-RUNTIME-8F462D068F11` | runtime | `src/runtime/tauri/index.ts:186` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:ddfe8e71f842c228` | `FP-RUNTIME-16099B340E88` | runtime | `src/lib/ai/adapters/embedding-adapter.ts:53` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:de35558c06f8dc76` | `FP-RUNTIME-FC21FE4B9CED` | runtime | `src/lib/ai/client.ts:331` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:de725efa50d0d62c` | `FP-RUNTIME-AACA70D259B0` | runtime | `src/lib/ai/client.ts:493` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:e18b7a3e04aa84ad` | `FP-RUNTIME-31B64F3D99CB` | runtime | `src/lib/ai/runtime-transport.ts:191` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:e7e5439e4b94f5cf` | `FP-RUNTIME-8D8A48479630` | runtime | `src/lib/diagnostics/local-diagnostic-report.ts:83` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:ea53cf86ca77bd1e` | `FP-RUNTIME-67E822999B0D` | runtime | `src/lib/export/text-export.ts:189` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:ebe79dc9fd5a588a` | `FP-RUNTIME-A50204CFA634` | runtime | `src/lib/export/gist-export.ts:131` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:ef9385cf9b2d9262` | `FP-RUNTIME-04A1584F94CB` | runtime | `src/lib/export/gist-export.ts:145` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:f32b4d8d0f4fb4bb` | `FP-RUNTIME-2DE6FF1756F7` | runtime | `src/stores/ai-config.ts:413` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:f5316a99f60f4541` | `FP-RUNTIME-5977C2A796F6` | runtime | `src/components/outline/DetailedOutlinePanel.tsx:296` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:ff72085055abdba7` | `FP-RUNTIME-0FA99FFCE177` | runtime | `src/components/system/ImportDocPanel.tsx:110` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `runtime:ff845f073593e9fb` | `FP-RUNTIME-F6DCB8A4AE60` | runtime | `src/components/editor/ChaptersListPanel.tsx:65` | REGISTERED_M1 | tests/desktop-contract/tauri-runtime.test.ts |
| `sidebar:016810f4ad7756ee` | `FP-SIDEBAR-B8BA23FC30F0` | sidebar | `src/components/layout/sidebar-tree.ts:199` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:065f1b78d87bc508` | `FP-SIDEBAR-A5029DDE9F5C` | sidebar | `src/components/layout/sidebar-tree.ts:164` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:077d51086f6388d4` | `FP-SIDEBAR-052954B7550E` | sidebar | `src/components/layout/sidebar-tree.ts:183` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:0b33f5483ae6f802` | `FP-SIDEBAR-61802C9DB57C` | sidebar | `src/components/layout/sidebar-tree.ts:185` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:12db3129f5ee7d8e` | `FP-SIDEBAR-4343B7D17047` | sidebar | `src/components/layout/sidebar-tree.ts:146` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:175295f486eb83c3` | `FP-SIDEBAR-22C4650A747F` | sidebar | `src/components/layout/sidebar-tree.ts:160` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:1d06bbcf8626f800` | `FP-SIDEBAR-DD18E4A6E6D6` | sidebar | `src/components/layout/sidebar-tree.ts:161` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:2403383568d3a4ef` | `FP-SIDEBAR-1E6B88608221` | sidebar | `src/components/layout/sidebar-tree.ts:193` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:2bd636adec9ff93c` | `FP-SIDEBAR-EC55EA51D3F7` | sidebar | `src/components/layout/sidebar-tree.ts:173` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:2e915a50a10e1a53` | `FP-SIDEBAR-CC982BF07743` | sidebar | `src/components/layout/sidebar-tree.ts:181` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:2ffd6fdd4911125e` | `FP-SIDEBAR-9AA5F861810C` | sidebar | `src/components/layout/sidebar-tree.ts:145` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:319d85f3bdbf2e65` | `FP-SIDEBAR-A043541E2DA9` | sidebar | `src/components/layout/sidebar-tree.ts:147` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:376486d31e3853e5` | `FP-SIDEBAR-A7A455B37E09` | sidebar | `src/components/layout/sidebar-tree.ts:202` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:392bce8da35efe2a` | `FP-SIDEBAR-570209E65467` | sidebar | `src/components/layout/sidebar-tree.ts:182` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:459b116bdb83fcd3` | `FP-SIDEBAR-E67C74402C23` | sidebar | `src/components/layout/sidebar-tree.ts:130` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:45ed646f91b1e13c` | `FP-SIDEBAR-55A4B6DE166A` | sidebar | `src/components/layout/sidebar-tree.ts:201` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:4a33f4b926d02658` | `FP-SIDEBAR-C7D902DEF02B` | sidebar | `src/components/layout/sidebar-tree.ts:129` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:5dd46b1897f31ba6` | `FP-SIDEBAR-030E3F6A7525` | sidebar | `src/components/layout/sidebar-tree.ts:180` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:6e9c76e7cb33e896` | `FP-SIDEBAR-562FBEBB9E5A` | sidebar | `src/components/layout/sidebar-tree.ts:178` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:717972bb7fe0b5cc` | `FP-SIDEBAR-5C9A48AECCFE` | sidebar | `src/components/layout/sidebar-tree.ts:148` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:7bed4e3626baf034` | `FP-SIDEBAR-ABA7601AF033` | sidebar | `src/components/layout/sidebar-tree.ts:179` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:7e2138f631d6723e` | `FP-SIDEBAR-6D7E79544B43` | sidebar | `src/components/layout/sidebar-tree.ts:175` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:850eaa469a8875c0` | `FP-SIDEBAR-CAC1293B242E` | sidebar | `src/components/layout/sidebar-tree.ts:128` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:8713a0de36fafdc2` | `FP-SIDEBAR-A63EA79F7F46` | sidebar | `src/components/layout/sidebar-tree.ts:203` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:9ee9d4ca4f4cfe2d` | `FP-SIDEBAR-80CC4ECD9A1E` | sidebar | `src/components/layout/sidebar-tree.ts:149` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:a60288ca5a68aae9` | `FP-SIDEBAR-16AFD7FE884E` | sidebar | `src/components/layout/sidebar-tree.ts:184` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:b41daffbb36f9e35` | `FP-SIDEBAR-22E31D3D13D2` | sidebar | `src/components/layout/sidebar-tree.ts:177` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:c123372fccce6561` | `FP-SIDEBAR-046F861200FF` | sidebar | `src/components/layout/sidebar-tree.ts:174` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:c58c94f09125fd23` | `FP-SIDEBAR-2EB58158FA1B` | sidebar | `src/components/layout/sidebar-tree.ts:162` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:ca7dad49ed487ac4` | `FP-SIDEBAR-109273D429B9` | sidebar | `src/components/layout/sidebar-tree.ts:159` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:cc45dab311dfb160` | `FP-SIDEBAR-769F4EA53772` | sidebar | `src/components/layout/sidebar-tree.ts:163` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:ce2245bdb3fedb60` | `FP-SIDEBAR-1E828977D3A8` | sidebar | `src/components/layout/sidebar-tree.ts:176` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:ce564b275a84548e` | `FP-SIDEBAR-AE01220B6DBC` | sidebar | `src/components/layout/sidebar-tree.ts:144` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:cfccfc3bdb8061f1` | `FP-SIDEBAR-C4CD5CA8B5F5` | sidebar | `src/components/layout/sidebar-tree.ts:137` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:da89166d80f7a859` | `FP-SIDEBAR-27BDAF168544` | sidebar | `src/components/layout/sidebar-tree.ts:200` | REGISTERED_M1 | npm run check:desktop-routes |
| `sidebar:eec13f7045657a4a` | `FP-SIDEBAR-009C37571089` | sidebar | `src/components/layout/sidebar-tree.ts:152` | REGISTERED_M1 | npm run check:desktop-routes |
| `ui:001c8e65ce0c68b0` | `FP-UI-A1D4CD449578` | ui | `src/components/scene/SceneVerifyPanel.tsx:109` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0067a157a79bd12d` | `FP-UI-DB20C49A2316` | ui | `src/components/state/StateDiffModal.tsx:119` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:009a2ea44b3aefe4` | `FP-UI-13E2D3FDEBC2` | ui | `src/components/character/CharacterPanel.tsx:535` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:00b5f9b113b68c91` | `FP-UI-7DBDACC452EF` | ui | `src/components/system/ImportDocPanel.tsx:562` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:00bf3eaa80ff4a1f` | `FP-UI-3CA476E4FCC9` | ui | `src/pages/WorkspacePage.tsx:223` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:01304013eeb82e56` | `FP-UI-26EBEC72AD9A` | ui | `src/components/settings/AIConfigPanel.tsx:335` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0149394480b6be22` | `FP-UI-3430392A35BF` | ui | `src/components/outline/OutlineChapterTree.tsx:275` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:01676b1518e15393` | `FP-UI-D0E97F44798A` | ui | `src/components/history/HistoryAgentWorkspace.tsx:120` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:016a56eae16af738` | `FP-UI-9ED5503A754E` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:140` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:01b1129f3ef03497` | `FP-UI-60CF17BC32ED` | ui | `src/components/relations/CharacterRelationPanel.tsx:295` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:01b5430a51e1e3aa` | `FP-UI-4217D9DADCD8` | ui | `src/components/outline/OutlineChapterTree.tsx:239` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:01de2aecc3e2aae6` | `FP-UI-6DC58D75C458` | ui | `src/components/system/import/ImportConfirmModal.tsx:282` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:02010195805269cd` | `FP-UI-A8C9A0A5CA2A` | ui | `src/components/history/HistoryKeywordCard.tsx:220` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:020cc47457bf688b` | `FP-UI-1AF895D6CAEB` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:300` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0210375aef249c28` | `FP-UI-ADAF5B88E260` | ui | `src/components/history/HistoryTimelineEventCard.tsx:296` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:023a63327dc40020` | `FP-UI-873FB2E12616` | ui | `src/components/outline/OutlineVolumeDetail.tsx:241` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:02555e8e7e308436` | `FP-UI-8CAF2044D982` | ui | `src/components/history/HistoryPanel.tsx:268` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:02bae4875e2315af` | `FP-UI-B6C5663350ED` | ui | `src/components/relations/CharacterRelationPanel.tsx:246` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:02ddc7a3e9a9ec20` | `FP-UI-30F1001B8187` | ui | `src/components/editor/EmotionBeatCard.tsx:180` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:03236a773ff0a278` | `FP-UI-BEF720023479` | ui | `src/components/history/HistoryKeywordCard.tsx:223` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:03271a2ae94dc293` | `FP-UI-9C7FDF8923A3` | ui | `src/components/shared/Dialog.tsx:142` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0359ab64bccd1045` | `FP-UI-8AA047292031` | ui | `src/components/relations/CharacterRelationPanel.tsx:200` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:03cf9dc896296c52` | `FP-UI-165E0C7D60F6` | ui | `src/components/history/HistoryPanel.tsx:413` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0489eac3b29867bf` | `FP-UI-593656779927` | ui | `src/components/shared/InlineEdit.tsx:142` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:055198b9bf989609` | `FP-UI-B7169FF2B866` | ui | `src/components/outline/ScenePanel.tsx:221` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0582ebc17a57bab4` | `FP-UI-B815A966370F` | ui | `src/components/codex/CodexPanel.tsx:439` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:05f87b81f4333e1e` | `FP-UI-58912F6365C6` | ui | `src/components/editor/NotePanel.tsx:56` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0607c2428f8b5af4` | `FP-UI-F075AF2388AD` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:343` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:06208d712a5f8bbf` | `FP-UI-822E19C46A91` | ui | `src/components/history/HistoryTimelineEventCard.tsx:114` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:066e30a5746bc829` | `FP-UI-5E1D65919155` | ui | `src/components/editor/FindReplacePanel.tsx:276` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:067366709a0f250e` | `FP-UI-B92B219F1884` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:256` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:06c36b75f37c953d` | `FP-UI-8BD9C8050557` | ui | `src/components/scene/SceneVerifyPanel.tsx:131` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:06cb2608c3d1efa4` | `FP-UI-902D0A20B3F3` | ui | `src/components/outline/StoryArcPanel.tsx:393` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:071736c02df62c5f` | `FP-UI-9F3289EDF2E9` | ui | `src/components/settings/prompt/PromptManagerPanel.tsx:248` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:07225fce8a20ed88` | `FP-UI-84D839A1E431` | ui | `src/components/codex/CodexPanel.tsx:746` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:078738998456687b` | `FP-UI-3CB968E6FA14` | ui | `src/components/editor/EmotionBeatCard.tsx:213` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:078aac09f738fd83` | `FP-UI-872A7B4EC345` | ui | `src/components/outline/OutlineGenerationResultPanel.tsx:53` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:07a07c473b8912f0` | `FP-UI-6A038175A5FA` | ui | `src/components/project/InspirationPanel.tsx:559` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:07ad72dda34f07ab` | `FP-UI-3CD0BE3AA29F` | ui | `src/components/geography/WorldTreeSidebar.tsx:256` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:07da461bc8787540` | `FP-UI-C53FFD1633E9` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:356` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:07e262636c2fc711` | `FP-UI-77E0324B1F22` | ui | `src/components/codex/CodexPanel.tsx:680` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:07fe44ea962cdc48` | `FP-UI-51AB57FCEC63` | ui | `src/components/outline/OutlineVolumeDetail.tsx:214` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0847183aa8066b29` | `FP-UI-18DE76217A3C` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:388` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:085dda6deb0fa340` | `FP-UI-6A3901EF44F1` | ui | `src/components/location/LocationPanel.tsx:357` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:088ff80cb0143ffc` | `FP-UI-50F7E2887CF4` | ui | `src/components/history/HistoryTimelineEventCard.tsx:149` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:08ebd3e3d396a9af` | `FP-UI-5265202221ED` | ui | `src/components/world-group/WorldGroupDetail.tsx:203` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:090362e5a317714e` | `FP-UI-840C255366BF` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:247` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:092100bf24e21790` | `FP-UI-85B0076A8CE2` | ui | `src/components/worldview/StoryCorePanel.tsx:246` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:093a214291700024` | `FP-UI-1D1A02480146` | ui | `src/components/outline/OutlineVolumeDetail.tsx:105` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0973306699effe2b` | `FP-UI-C91C6D6C2CEC` | ui | `src/components/style/StyleLearningPanel.tsx:133` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:097785e293e7d3a8` | `FP-UI-114D1DFB03E1` | ui | `src/components/character/CharacterPanel.tsx:214` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:09b404151f145850` | `FP-UI-094540D07DC8` | ui | `src/components/outline/OutlineVolumeDetail.tsx:127` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:09d3e0b4f18589eb` | `FP-UI-472C0FDAEAB6` | ui | `src/components/character/CharacterPanel.tsx:517` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:09da885aa1c53347` | `FP-UI-83EB7D888657` | ui | `src/components/worldview/WorldRulesPanel.tsx:444` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0a63d10263f0486a` | `FP-UI-EE778AD97DE0` | ui | `src/components/outline/OutlineChapterTree.tsx:272` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0ab471d731596e13` | `FP-UI-142BCD300637` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:270` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0aeb73fba7632b1b` | `FP-UI-7B612CD2C9CD` | ui | `src/components/history/HistoryAgentWorkspace.tsx:103` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0b16673767f6236a` | `FP-UI-50D1FDCEC2A5` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:325` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0b35b39e486b622d` | `FP-UI-3BFC6362F329` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:360` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0b3be13a9cf29417` | `FP-UI-FCC66852FA99` | ui | `src/components/settings/prompt/PromptManagerPanel.tsx:281` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0b4d4c000747d98d` | `FP-UI-3E548C9DDDAB` | ui | `src/components/character/CharacterPanel.tsx:220` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0b4e0d9dba76c7de` | `FP-UI-69C48513FF21` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:319` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0b5dce31f754961e` | `FP-UI-1C31D25D5567` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:239` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0b9fe1e04b1902aa` | `FP-UI-51F62BD6B4CF` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:166` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0bd3054c0be3622b` | `FP-UI-9656A151DFC3` | ui | `src/components/world-group/WorldGroupOverview.tsx:366` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0c538e020e860fd9` | `FP-UI-220843C7112B` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:352` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0cd8c3da0e693f95` | `FP-UI-6233ED935B16` | ui | `src/components/world-group/WorldGroupDetail.tsx:258` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0cffb08a9899e6ee` | `FP-UI-8670A66C1B18` | ui | `src/components/geography/GeographyPanel.tsx:218` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0d2de622bc62804c` | `FP-UI-FC36C3CB45AD` | ui | `src/components/editor/RichEditor.tsx:995` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0d76afc91ba7c661` | `FP-UI-77C1DA304618` | ui | `src/components/settings/prompt/PromptWorkflowsPanel.tsx:180` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0dcba3d6af49723f` | `FP-UI-0CE2E05125C7` | ui | `src/components/editor/NotePanel.tsx:79` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0de133cfded00cbf` | `FP-UI-2D245400AA32` | ui | `src/components/character/CharacterNPCPanel.tsx:92` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0dfba9508279fee4` | `FP-UI-3631C149D73B` | ui | `src/components/outline/OutlinePreview.tsx:120` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0e0aa9d804e5d17e` | `FP-UI-74AE952E2783` | ui | `src/components/rules/CreativeRulesPanel.tsx:369` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0e212b9d98e6d560` | `FP-UI-5CD3274800FD` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:195` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0e60b78cdffdb38b` | `FP-UI-36B3FF7C86C2` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:661` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0e7065daac5d6e41` | `FP-UI-C26EE83B22E0` | ui | `src/components/editor/ChapterEditorHeader.tsx:66` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0e886bbc03a83f44` | `FP-UI-DA0ABBA76BEF` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:123` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0f001a800e49edfd` | `FP-UI-A56D088DD00A` | ui | `src/components/outline/OutlineVolumeDetail.tsx:205` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0f14c78fa8047d78` | `FP-UI-3B06D8A3B197` | ui | `src/components/character/CharacterExtraPanel.tsx:55` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0f629484c9e54135` | `FP-UI-8B9DCE5A82AB` | ui | `src/components/shared/PromptRunPanel.tsx:196` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0fc4c0080ec4ddb4` | `FP-UI-E538602034E9` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:112` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:0ff0e2ca61dd3506` | `FP-UI-C8498D7EBB5C` | ui | `src/components/outline/StoryArcPanel.tsx:401` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1018c48d0812c2f5` | `FP-UI-C453ACD3F139` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:206` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1019a3e7d0d79e52` | `FP-UI-2BE0CC23AC8A` | ui | `src/components/shared/PromptRunPanel.tsx:115` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:105422175c5177f7` | `FP-UI-B146F443D65A` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:771` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:10860d2b33f6e86b` | `FP-UI-BC21681311DA` | ui | `src/components/character/CharacterMinorPanel.tsx:91` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:10fb71539eb7ea83` | `FP-UI-81506E3519E4` | ui | `src/components/project/ReferencePanel.tsx:141` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:115b6f0ba7616957` | `FP-UI-D6F870391711` | ui | `src/components/editor/NotePanel.tsx:125` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:116e5d7b11031e46` | `FP-UI-E9019959CCB3` | ui | `src/components/history/HistoryTimelineEventCard.tsx:68` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:117449f33dce9bb3` | `FP-UI-96A9B3794B8F` | ui | `src/components/geography/WorldTreeSidebar.tsx:79` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1178bc3b512e8a7a` | `FP-UI-711742B33E2D` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:197` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1183bb7ff2eddd3e` | `FP-UI-21BF2CBCA135` | ui | `src/components/items/InventoryPanel.tsx:301` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:118a82f99ce15bbf` | `FP-UI-35ED64791D76` | ui | `src/components/editor/FloatingToolbar.tsx:71` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:119bd0b2fe83ac9d` | `FP-UI-3BC653849970` | ui | `src/components/shared/PanelLayout.tsx:117` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:11c14f8c31a3a994` | `FP-UI-373C42A7A5F4` | ui | `src/components/editor/RichEditor.tsx:862` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:12529e5fc2f2e2dd` | `FP-UI-0EB77A08ECE9` | ui | `src/components/outline/OutlineChapterTree.tsx:253` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:12aba69eeed32a4e` | `FP-UI-9E98F1975465` | ui | `src/components/history/HistoryKeywordCard.tsx:101` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:12b1ead604fffbbb` | `FP-UI-F4DF6B4ADC63` | ui | `src/components/relations/CharacterRelationPanel.tsx:226` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:12f0202ee17b7a0f` | `FP-UI-5C58FD3CB30D` | ui | `src/components/character/CharacterMinorPanel.tsx:108` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:131fee00e82f1a91` | `FP-UI-B92084A93367` | ui | `src/components/character/CharacterDimensionFields.tsx:74` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:137bbf316f7f7932` | `FP-UI-BA37A76ECFD5` | ui | `src/components/data/DataManagementPanel.tsx:299` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:138e4485e2291098` | `FP-UI-9EDD618DCAC6` | ui | `src/components/codex/CodexPanel.tsx:433` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:138e74773e47c6cd` | `FP-UI-68A7EFEA5681` | ui | `src/components/character/CharacterPanel.tsx:261` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:13b5d03a7d306799` | `FP-UI-4AAB218466FB` | ui | `src/components/settings/UsageStatsPage.tsx:87` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:13bc70cbf4f339c1` | `FP-UI-C72D90ED41ED` | ui | `src/components/outline/OutlineChapterTree.tsx:131` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:13cee4598221a598` | `FP-UI-DD32BAD15E8B` | ui | `src/components/project/InspirationPanel.tsx:682` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:144aa0c53b21d425` | `FP-UI-5195361BBDB2` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:262` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:14580f70e714cc95` | `FP-UI-925BD76707CE` | ui | `src/components/editor/EmotionBeatCard.tsx:155` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:146538f9703d0c75` | `FP-UI-F266A0AF166A` | ui | `src/components/shared/AIStreamOutput.tsx:153` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:14b1b79675752eb0` | `FP-UI-EB2CD394B415` | ui | `src/components/outline/OutlinePanel.tsx:467` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:14da08fed57017a4` | `FP-UI-AF7BFC38ABD8` | ui | `src/components/worldview/WorldRulesPanel.tsx:432` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:14e574e35d223147` | `FP-UI-88F76D1E4D57` | ui | `src/components/world-group/WorldGroupOverview.tsx:210` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:14f323c02baea175` | `FP-UI-023CB6CA177A` | ui | `src/components/character/CharacterPanel.tsx:212` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:156420988fa4b8da` | `FP-UI-72D96B7F1F7B` | ui | `src/components/shared/InlineEdit.tsx:42` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:158c17f509950680` | `FP-UI-E6862B7D7FFC` | ui | `src/components/outline/OutlineVolumeDetail.tsx:231` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1623afb022b937b7` | `FP-UI-2A5EA55DC3E0` | ui | `src/components/shared/AutoResizeTextarea.tsx:73` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1667e75a9443cc32` | `FP-UI-4D4420CBB218` | ui | `src/components/worldview/WorldRulesPanel.tsx:389` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1677bc7493d9b3a2` | `FP-UI-7600B05CBD0D` | ui | `src/components/outline/OutlineChapterTree.tsx:270` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1735f2954aaf405a` | `FP-UI-79749717CEC8` | ui | `src/components/outline/OutlineVolumeDetail.tsx:246` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:176e3eb2d651857a` | `FP-UI-912F7CD8CE7B` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:390` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:17b86b536a32e9a6` | `FP-UI-E93D055F9B7C` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:511` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:17e2557ddaf4dbec` | `FP-UI-B3502BB9995C` | ui | `src/components/geography/WorldTreeSidebar.tsx:59` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:17f51fa76fc9d52e` | `FP-UI-4628BCA7E63C` | ui | `src/components/migration/FirstRunMigration.tsx:216` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:17f6ac34775b67a1` | `FP-UI-2D04171669C9` | ui | `src/components/geography/WorldTreeSidebar.tsx:179` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1824ea7b77030239` | `FP-UI-32AAD819002C` | ui | `src/components/settings/AIConfigPanel.tsx:527` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:184e129459900fc8` | `FP-UI-364787333076` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:746` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1856643e921e3db1` | `FP-UI-503DD7404C18` | ui | `src/components/settings/AIConfigPanel.tsx:313` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:18680d26eb4c79b7` | `FP-UI-4FE5C4E75B92` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:343` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:18b216c6c978e756` | `FP-UI-137978D985BC` | ui | `src/components/codex/CodexPanel.tsx:451` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:18d78821ac14ef79` | `FP-UI-AE2BBF58EF96` | ui | `src/components/settings/AIConfigPanel.tsx:476` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:18e34cf6aa4062d5` | `FP-UI-1BD391AD5FFC` | ui | `src/components/codex/CodexPanel.tsx:438` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1926faa701203e2a` | `FP-UI-7ED578BF7247` | ui | `src/pages/HomePage.tsx:346` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:195276015c7bf396` | `FP-UI-48177CB9517C` | ui | `src/pages/WorkspacePage.tsx:277` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:19d2d207ac046b21` | `FP-UI-1F08309F3778` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:149` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:19eab3a9e7637553` | `FP-UI-096AADE5C05C` | ui | `src/components/location/LocationPanel.tsx:380` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1a2200e08e7d887d` | `FP-UI-9E1C5872BE4E` | ui | `src/pages/HomePage.tsx:487` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1a6b907d9dca8272` | `FP-UI-89BC1DAEC6D4` | ui | `src/components/settings/AIConfigPanel.tsx:309` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1aa122a413b3dd32` | `FP-UI-CFD293E30392` | ui | `src/components/worldview/StoryCorePanel.tsx:98` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1aaa1398458c9382` | `FP-UI-EF23361A5F41` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:389` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1ae20b092ecb29ca` | `FP-UI-9A6CEAE8E808` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:217` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1af1e3abc0346f57` | `FP-UI-BB5D2E690AA0` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:461` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1b78dd3ff5c7e5df` | `FP-UI-5B5F9D16FEC3` | ui | `src/components/editor/EmotionBeatCard.tsx:187` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1c283717d509f45a` | `FP-UI-EB056669FA41` | ui | `src/pages/WorkspacePage.tsx:306` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1c3fc642e7479b5f` | `FP-UI-D1C46CFF12D3` | ui | `src/components/project/ReferencePanel.tsx:592` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1c4c1200a3fb3c34` | `FP-UI-A5E30B35F44C` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:84` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1c8e3735a0db74b8` | `FP-UI-5373FADB385C` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:524` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1ccbedc74d99ef70` | `FP-UI-9939DB765F29` | ui | `src/components/editor/EmotionBeatCard.tsx:230` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1cda80fae786924a` | `FP-UI-6658FC61C229` | ui | `src/components/codex/CodexPanel.tsx:478` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1cee87a9e8cb1ee2` | `FP-UI-FB88782B18CD` | ui | `src/components/editor/ChapterCandidateReview.tsx:143` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1d07e6154927c79e` | `FP-UI-98847D4D1711` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:387` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1d3c585104899f15` | `FP-UI-6DF7B946F0B1` | ui | `src/components/worldview/PowerSystemPanel.tsx:48` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1d82ebaa1f842120` | `FP-UI-98A157A16479` | ui | `src/components/outline/OutlineGenerationResultPanel.tsx:54` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1df429fcd1863171` | `FP-UI-55C64C72A40C` | ui | `src/components/outline/OutlineStructureMenu.tsx:10` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1e0824927674f402` | `FP-UI-103D375C36F9` | ui | `src/components/outline/OutlineVolumeDetail.tsx:276` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1eb40cd42f823fed` | `FP-UI-30B2485B9458` | ui | `src/components/data/DataManagementPanel.tsx:237` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1f107e7a66546f91` | `FP-UI-7065A523E91A` | ui | `src/components/project/InspirationPanel.tsx:460` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1f74a589582b8348` | `FP-UI-BB65114498E4` | ui | `src/components/outline/StoryArcPanel.tsx:432` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1faf2fd69502824a` | `FP-UI-2FA1429670EC` | ui | `src/components/editor/FindReplacePanel.tsx:297` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:1fe9faa54fe8fb3b` | `FP-UI-C7BA58367F45` | ui | `src/components/geography/GeographyPanel.tsx:184` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:203257aad0d8a471` | `FP-UI-BE7B070C216B` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:168` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2071a1d302207532` | `FP-UI-7770260B6D18` | ui | `src/components/outline/OutlinePanel.tsx:489` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:20946a56b2116a1e` | `FP-UI-2CAC6C89FBBF` | ui | `src/components/editor/ReviewPanel.tsx:198` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2097c1d9f22ddfe8` | `FP-UI-76D289581065` | ui | `src/components/character/CharacterDimensionFields.tsx:172` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:20e1bc07aa8b768c` | `FP-UI-0FBB0572E3CA` | ui | `src/components/history/HistoryKeywordCard.tsx:63` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:20fb202ca9aead48` | `FP-UI-C2B74498E873` | ui | `src/components/location/LocationPanel.tsx:273` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:210b4fbe199eac68` | `FP-UI-25A344705865` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:533` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:21169346d9ddb106` | `FP-UI-4A4E21C0981E` | ui | `src/components/settings/prompt/PromptWorkflowsPanel.tsx:196` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2125bc6b883d1df2` | `FP-UI-A99426F9FC60` | ui | `src/components/system/import/ImportReportModal.tsx:149` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:214b320e6f9bfc55` | `FP-UI-04FA1CEADC78` | ui | `src/components/project/ReferencePanel.tsx:176` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:218f43fe521d4741` | `FP-UI-6BE43C6E4293` | ui | `src/components/worldview/StoryCorePanel.tsx:217` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:21b8982fb64d4cfb` | `FP-UI-1CAB952FB875` | ui | `src/components/editor/EmotionBeatCard.tsx:208` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:21c15894bc494ef0` | `FP-UI-C19A7D0FA39E` | ui | `src/components/codex/CodexPanel.tsx:419` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:21da4ab263ab78ef` | `FP-UI-AED8A3657E64` | ui | `src/components/data/DataManagementPanel.tsx:240` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:21db0d0ab24c6ec2` | `FP-UI-6BF8CA578F0E` | ui | `src/components/character/CharacterDimensionFields.tsx:173` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:21e6219b61b86684` | `FP-UI-5BF9FEED8447` | ui | `src/components/system/import/ImportConfirmModal.tsx:294` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:224b369fa6962351` | `FP-UI-D1A31D77BB88` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:647` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:22564e2d7314c028` | `FP-UI-5664CB07D3AA` | ui | `src/components/settings/AIConfigPanel.tsx:635` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:225f9107468e12b0` | `FP-UI-329377B6F6A7` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:306` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:22b609bb9299e657` | `FP-UI-37E560920FF1` | ui | `src/components/outline/OutlinePanel.tsx:483` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:23686c31ea191f1b` | `FP-UI-80F551C981F0` | ui | `src/components/data/CloudBackupCard.tsx:151` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:236ced35b1d47259` | `FP-UI-83BA3FC19170` | ui | `src/components/foreshadow/ForeshadowKanban.tsx:91` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:23d5e563e909301f` | `FP-UI-718347B99656` | ui | `src/components/outline/OutlineGenerationResultPanel.tsx:81` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2444ce27845953fc` | `FP-UI-249C7363D6CD` | ui | `src/components/system/ImportDocPanel.tsx:703` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:245e4d328a3e629e` | `FP-UI-96650C80E466` | ui | `src/components/editor/ReviewPanel.tsx:221` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:24c216c464add13c` | `FP-UI-2C1503A99435` | ui | `src/components/state/StatePanel.tsx:217` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:24c3a46f7b23b2c8` | `FP-UI-E0876EABB8A1` | ui | `src/pages/WorkspacePage.tsx:269` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:24c85f4b5be8b47f` | `FP-UI-3D8B53F9E353` | ui | `src/components/settings/AIConfigPanel.tsx:724` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:24e62ea6d3d96201` | `FP-UI-1997F14E2DCA` | ui | `src/components/settings/prompt/PromptTemplateList.tsx:109` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2527e5a1b982a0a5` | `FP-UI-D148F132216C` | ui | `src/components/character/CharacterPanel.tsx:472` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:252a0e6d34a0dd32` | `FP-UI-70D4FD051B4A` | ui | `src/components/geography/WorldMapVoronoi.tsx:427` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:256cec8922c03c89` | `FP-UI-BF80EC1E9575` | ui | `src/components/guide/WelcomeGuide.tsx:186` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:257ebdc83ba39d22` | `FP-UI-C81838985109` | ui | `src/components/editor/ChapterEditor.tsx:1817` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:25917a9d03943b3f` | `FP-UI-11C224EE93C6` | ui | `src/components/character/CharacterPanel.tsx:383` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:25c144280d473a73` | `FP-UI-8228A7D16B09` | ui | `src/pages/WorkspacePage.tsx:288` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:26291451b0c849b7` | `FP-UI-6D6E02C85595` | ui | `src/components/geography/GeographyPanel.tsx:163` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2709795bd5305576` | `FP-UI-DC3FCA332621` | ui | `src/components/editor/FindReplacePanel.tsx:229` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:271a79fb3f0b739c` | `FP-UI-9A943FD5E08B` | ui | `src/components/history/HistoryTimelineEventCard.tsx:137` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:273f74f03a8e727a` | `FP-UI-DCB2FD694A9B` | ui | `src/pages/HomePage.tsx:417` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:27409a225f865630` | `FP-UI-E0FA2172547D` | ui | `src/components/settings/AIConfigPanel.tsx:457` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:274e9f8ba94cd882` | `FP-UI-65F1712608F2` | ui | `src/components/history/HistoryPanel.tsx:285` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2788b251a7dedfeb` | `FP-UI-786FD6F85D5F` | ui | `src/components/project/InspirationPanel.tsx:424` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:283764bd7397630d` | `FP-UI-FBFE8E509AEE` | ui | `src/components/shared/PromptRunPanel.tsx:293` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2844e4235ef06f9c` | `FP-UI-F0D200867780` | ui | `src/components/outline/OutlineVolumeDetail.tsx:277` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:28ad24bf2503286d` | `FP-UI-AF6E03332E1E` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:185` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:28f3332633ea9372` | `FP-UI-87BC85D99D94` | ui | `src/components/outline/OutlinePanel.tsx:491` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:28f3c194b4ece46d` | `FP-UI-9FBC804F53FD` | ui | `src/components/shared/AIStreamOutput.tsx:207` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:294b8a405c42b524` | `FP-UI-72924E4C8777` | ui | `src/components/codex/CodexPanel.tsx:674` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:29d90e1d8e259052` | `FP-UI-1231FD8D8920` | ui | `src/components/scene/SceneVerifyPanel.tsx:161` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2a2ae935da50f713` | `FP-UI-29C2A8DE9873` | ui | `src/components/outline/StoryArcPanel.tsx:269` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2a34ac122fa98795` | `FP-UI-8DC14EFD3E09` | ui | `src/components/editor/RichEditor.tsx:1004` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2a50b16d319b4218` | `FP-UI-13412E11852B` | ui | `src/components/shared/AIStreamOutput.tsx:231` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2aa235fc8488bac6` | `FP-UI-44279B042E34` | ui | `src/components/outline/OutlineVolumeSidebar.tsx:166` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2b024cd80322abe4` | `FP-UI-7A13ED9F89FA` | ui | `src/components/guide/WelcomeGuide.tsx:134` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2b0fefc92c39732c` | `FP-UI-C3308BBB721B` | ui | `src/components/history/HistoryPanel.tsx:288` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2b13301ef6d96e5e` | `FP-UI-9FA2432C287E` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:176` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2b48b2d5b8a874f2` | `FP-UI-475F5D82D443` | ui | `src/components/settings/AIConfigPanel.tsx:350` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2b9fe4c89635e308` | `FP-UI-93D9525D3CF0` | ui | `src/components/worldview/WorldRulesPanel.tsx:388` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2bb173b8697c6480` | `FP-UI-57FC57232840` | ui | `src/components/location/LocationPanel.tsx:333` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2c19e5b13f5449c7` | `FP-UI-55F122F245FB` | ui | `src/pages/MigrationExportPage.tsx:86` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2c5cc601e43ca9c8` | `FP-UI-63F6E90CF1A7` | ui | `src/components/relations/CharacterRelationPanel.tsx:208` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2c69f5bf15c742cc` | `FP-UI-08C9E6A4C9F6` | ui | `src/components/history/HistoryPanel.tsx:286` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2c7dc31543feef11` | `FP-UI-1C70F7873914` | ui | `src/components/project/ReferencePanel.tsx:349` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2c978d4ac04ef966` | `FP-UI-4042FEB8AF6F` | ui | `src/components/data/DataManagementPanel.tsx:383` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2cc2b5e3606a135a` | `FP-UI-1649CA410B98` | ui | `src/components/outline/OutlineVolumeDetail.tsx:234` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2d162c917c7c7e69` | `FP-UI-F2699AFCEB1C` | ui | `src/components/outline/OutlineChapterTree.tsx:157` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2d400af8aff60e9e` | `FP-UI-14D456A1D7AD` | ui | `src/App.tsx:22` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2d569086ce1db85c` | `FP-UI-941B1EBE191A` | ui | `src/components/history/HistoryKeywordCard.tsx:186` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2dcab947c1687f00` | `FP-UI-2729A1B05F0B` | ui | `src/components/system/ImportDocPanel.tsx:602` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2e0ee9a07a19fd9e` | `FP-UI-9E20BC9F5606` | ui | `src/components/editor/RichEditor.tsx:1030` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2e117eec8e226a2c` | `FP-UI-7D4AA2E7824B` | ui | `src/components/character/CharacterExtraPanel.tsx:122` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2e28e0e5e7223263` | `FP-UI-9085453280C8` | ui | `src/components/editor/EmotionBeatCard.tsx:245` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2e37ecb9fdf434a8` | `FP-UI-1ABEDBF07AE8` | ui | `src/components/project/AnalysisReportViewer.tsx:170` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2e4d2c7fe304bb75` | `FP-UI-710B3CF69AE1` | ui | `src/components/system/ImportDocPanel.tsx:621` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2e87ac493e57c2ef` | `FP-UI-E88F6B0FB90B` | ui | `src/components/system/import/ImportUploadZone.tsx:83` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2ee3d097ab1331ff` | `FP-UI-B1A3820D6BD3` | ui | `src/components/history/HistoryAgentWorkspace.tsx:132` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2f0227294f95bcec` | `FP-UI-99038D058C0F` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:438` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2f47d3fb88aa7c0c` | `FP-UI-0390361184CA` | ui | `src/components/editor/EmotionBeatCard.tsx:195` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2fb6d05419e4e580` | `FP-UI-BDB46D1479A3` | ui | `src/components/character/CharacterPanel.tsx:547` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2fbce8f1e5c1301c` | `FP-UI-71117B7C87CD` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:395` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:2ffd381e3c484b26` | `FP-UI-DCCCF629CFC0` | ui | `src/components/project/InspirationPanel.tsx:446` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3047ee4b4d4d1947` | `FP-UI-C0ACA725B591` | ui | `src/components/outline/OutlinePanel.tsx:403` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:30b95203660c36cb` | `FP-UI-64F9AF6FA886` | ui | `src/components/style/StyleLearningPanel.tsx:147` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:30e7cf95fac4cb6a` | `FP-UI-64CC3BB0D7F2` | ui | `src/components/rules/CreativeRulesPanel.tsx:213` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3108de85952af978` | `FP-UI-63617C6E8B41` | ui | `src/components/location/LocationPanel.tsx:287` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:315b829a422e174c` | `FP-UI-547008D4DC2D` | ui | `src/components/shared/InlineEdit.tsx:66` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3322af6ba2035d6d` | `FP-UI-E34450E2807A` | ui | `src/components/outline/OutlineVolumeDetail.tsx:113` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:332b9a627bb33c27` | `FP-UI-6FEB680A3FC6` | ui | `src/components/history/HistoryOverviewTab.tsx:40` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:334e0d1df912be95` | `FP-UI-EFB29F054516` | ui | `src/components/project/AnalysisReportViewer.tsx:469` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:339807173a8133c2` | `FP-UI-4BE6D2EF063A` | ui | `src/components/outline/OutlinePanel.tsx:407` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:33fa0b8b38af724c` | `FP-UI-C39223213778` | ui | `src/pages/HomePage.tsx:461` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3406f49e8b7c3b05` | `FP-UI-07EA6EF81166` | ui | `src/components/shared/AutoResizeTextarea.tsx:67` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:342dc81334ed1a58` | `FP-UI-DDC966B16488` | ui | `src/components/history/HistoryPanel.tsx:304` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:342ecbfb44d47a61` | `FP-UI-51B81F37271A` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:275` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:347aeb0095910ed2` | `FP-UI-0B437FD14AA4` | ui | `src/components/outline/OutlineVolumeDetail.tsx:268` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:34b1a97890d2780f` | `FP-UI-54719FD04E60` | ui | `src/components/codex/CodexPanel.tsx:375` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:34c63e25db232275` | `FP-UI-88B8B2177DDE` | ui | `src/components/system/ImportDocPanel.tsx:563` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:34d6f162eab1dec5` | `FP-UI-4C16EE323599` | ui | `src/components/outline/OutlinePanel.tsx:487` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:353a3ad2b9749803` | `FP-UI-9710B0FB384D` | ui | `src/components/settings/EmbeddingConfigCard.tsx:131` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3546cc70876e3e95` | `FP-UI-D1954363D64A` | ui | `src/components/outline/DetailedOutlinePanel.tsx:472` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:358a68b8e1770b39` | `FP-UI-3DC2F7CB08B7` | ui | `src/components/character/CharacterDimensionFields.tsx:184` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:35df5001e994ba70` | `FP-UI-D1A488400503` | ui | `src/components/codex/CodexPanel.tsx:447` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3618b3afeb3266ca` | `FP-UI-57A04D0D452C` | ui | `src/components/world-group/WorldGroupDetail.tsx:166` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3625cc7e36463977` | `FP-UI-1DBB146EE229` | ui | `src/components/outline/OutlinePanel.tsx:496` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:362df4821d714de5` | `FP-UI-0B75F8CC8BB8` | ui | `src/components/settings/EmbeddingConfigCard.tsx:124` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3657d0a42beec050` | `FP-UI-597CD807A0DE` | ui | `src/components/scene/SceneVerifyPanel.tsx:122` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:36c3d17e40320502` | `FP-UI-69A6A62A4F7A` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:137` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:36ddd7a24e27c8ba` | `FP-UI-55CC81C2BB49` | ui | `src/components/outline/ScenePanel.tsx:187` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:371b2317d5fa54d2` | `FP-UI-2CC3FECA0D2C` | ui | `src/components/data/DataManagementPanel.tsx:52` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:37b483d381c4908a` | `FP-UI-4BCA01808F38` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:830` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3802083a55f7887e` | `FP-UI-11ED5527D735` | ui | `src/components/editor/RichEditor.tsx:891` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:380e37064e9ac2d8` | `FP-UI-AB3E80CD6E8F` | ui | `src/components/settings/prompt/PromptWorkflowsPanel.tsx:118` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3833f56437f0e1f4` | `FP-UI-B3D6A80FA5BF` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:262` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:38831a6dd5910c7f` | `FP-UI-4140A5A8F9D9` | ui | `src/components/data/CloudBackupCard.tsx:177` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:38a554c641fedfc8` | `FP-UI-8014A3E08984` | ui | `src/components/outline/OutlineVolumeDetail.tsx:237` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:38b5dc0a3aca0bbf` | `FP-UI-CA6117623925` | ui | `src/pages/WorkspacePage.tsx:322` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:38c84eef6a8eb6b8` | `FP-UI-B88989C9E0F1` | ui | `src/components/editor/ChapterEditor.tsx:1563` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:38cc0cd1705f52fa` | `FP-UI-CBE9CC8336BA` | ui | `src/components/shared/InlineEdit.tsx:38` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:38eb7b05db41f94a` | `FP-UI-24194151E746` | ui | `src/components/outline/OutlinePreview.tsx:108` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:38f180bbc721f905` | `FP-UI-404F85C32903` | ui | `src/components/project/InspirationPanel.tsx:726` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:390ac841dffbc61b` | `FP-UI-3B2C97FB3040` | ui | `src/components/history/HistoryAgentWorkspace.tsx:119` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:393b63522a78745c` | `FP-UI-F04ECAE53E5C` | ui | `src/components/world-group/WorldGroupDetail.tsx:236` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3943204ecd79c9de` | `FP-UI-73097C35135F` | ui | `src/components/worldview/StoryCorePanel.tsx:232` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:396defe99026e959` | `FP-UI-D2DB968549E5` | ui | `src/components/codex/CodexPanel.tsx:364` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:39d19ec6d59e128b` | `FP-UI-B695FB4CC2DC` | ui | `src/components/project/ReferencePanel.tsx:659` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:39e5c86f07f049ae` | `FP-UI-CB2EB765ADBB` | ui | `src/components/outline/OutlineVolumeDetail.tsx:207` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3a003f7b47bf292b` | `FP-UI-D41B3F6B48DB` | ui | `src/components/outline/OutlineVolumeSidebar.tsx:184` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3a1cc40188fdd483` | `FP-UI-2EF7DA23283C` | ui | `src/components/history/HistoryPanel.tsx:246` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3ad0aec8e4e48192` | `FP-UI-BBCB9A72C3E8` | ui | `src/components/settings/UsageStatsPage.tsx:97` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3b73452d57606d3e` | `FP-UI-3BB01563F355` | ui | `src/components/system/import/ImportConfirmModal.tsx:288` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3b96651927dd2d0d` | `FP-UI-57152CAC0D88` | ui | `src/components/layout/Sidebar.tsx:67` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3bbefa5efa0270fc` | `FP-UI-7EC00D24B1A3` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:467` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3be122c37f960293` | `FP-UI-04F95E7A8A16` | ui | `src/components/editor/ChapterEditor.tsx:1826` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3be57a9baf9587d2` | `FP-UI-6D55583CC4C4` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:320` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3bfb1beb04533182` | `FP-UI-58B010B06C41` | ui | `src/components/data/DataManagementPanel.tsx:490` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3c23c56f5b8be51e` | `FP-UI-2ADDAA27501F` | ui | `src/components/location/LocationPanel.tsx:374` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3c2a0c468d9efdf2` | `FP-UI-8C264ED40EA5` | ui | `src/components/world-group/WorldGroupDetail.tsx:219` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3c2af2ce2a5a2ae7` | `FP-UI-EF31A4419453` | ui | `src/components/editor/ChapterEditor.tsx:1561` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3ce47d59e41903a1` | `FP-UI-5ACF6A8A1889` | ui | `src/components/data/DataManagementPanel.tsx:428` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3d58a1d922e93054` | `FP-UI-83768CF8806A` | ui | `src/components/shared/Dialog.tsx:128` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3d937b5395d9dcd5` | `FP-UI-61292D02D70E` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:503` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3dbc305a0c1a73e6` | `FP-UI-DE359C67078A` | ui | `src/components/settings/AIConfigPanel.tsx:437` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3dca39da6f318158` | `FP-UI-564503E46EA0` | ui | `src/components/outline/OutlineGenerationRequestPanel.tsx:45` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3dfcbe80be206eca` | `FP-UI-9CF3A4914935` | ui | `src/components/character/CharacterNPCPanel.tsx:52` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3dffe040ac655001` | `FP-UI-7E31E7644547` | ui | `src/components/editor/FindReplacePanel.tsx:290` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3e2567ddec8e9891` | `FP-UI-2B04F3472918` | ui | `src/components/outline/ScenePanel.tsx:213` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3e3439e56624e186` | `FP-UI-17B901A56F12` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:77` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3e69a52184053ee2` | `FP-UI-99328CDDB607` | ui | `src/components/editor/ChapterEditor.tsx:1655` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3ec009bc48523ab7` | `FP-UI-076F19DB7596` | ui | `src/components/state/StatePanel.tsx:308` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3ed327bfe277551b` | `FP-UI-A3FA9781525D` | ui | `src/components/history/HistoryTimelineEventCard.tsx:293` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3f5c2ff7ee1aa603` | `FP-UI-E1B4D04680DD` | ui | `src/components/editor/ChapterEditor.tsx:1703` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3f6f26661d42e5bf` | `FP-UI-DE9FF05FB86F` | ui | `src/components/shared/AIFieldModeTabs.tsx:21` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3f73fe2683a0c534` | `FP-UI-EE59C623572D` | ui | `src/components/world-group/WorldGroupOverview.tsx:356` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:3f9f18463c0d4024` | `FP-UI-6E3C89526838` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:276` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:40177da86e738d66` | `FP-UI-8FE274A22B8E` | ui | `src/components/world-group/WorldGroupOverview.tsx:351` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4031a7e52a3be518` | `FP-UI-051583B90577` | ui | `src/components/codex/CodexPanel.tsx:584` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4056b35b041825ff` | `FP-UI-741A0361907C` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:809` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:407e1707a92aea95` | `FP-UI-25C226F66D5B` | ui | `src/components/data/CloudBackupCard.tsx:110` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4092a724acde34f4` | `FP-UI-0C784D4E6C58` | ui | `src/components/settings/prompt/PromptManagerPanel.tsx:150` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:409766e56b42b4b2` | `FP-UI-B157980AFB44` | ui | `src/components/editor/RichEditor.tsx:837` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:40c195b86fc2c722` | `FP-UI-E4D45357284A` | ui | `src/components/state/StateDiffModal.tsx:123` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4152b19b8eeabc44` | `FP-UI-45534F62CC0D` | ui | `src/components/settings/EmbeddingConfigCard.tsx:85` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:416745ab14f0ccb7` | `FP-UI-CC669D31405F` | ui | `src/components/project/ReferencePanel.tsx:341` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:41a18e48877ef961` | `FP-UI-8763FC8F5944` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:142` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:41afa71e216120e3` | `FP-UI-734C5BC08775` | ui | `src/components/editor/EmotionBeatCard.tsx:240` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:41e0ccc58aa3f3cc` | `FP-UI-A5A5B1BEA71D` | ui | `src/components/settings/prompt/PromptTemplateList.tsx:129` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:42373c15f8adf5ef` | `FP-UI-7499601A4437` | ui | `src/components/editor/RichEditor.tsx:931` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4281fc52faa55cc5` | `FP-UI-32F93FA6222C` | ui | `src/components/outline/StoryArcPanel.tsx:447` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:42860b35231e5cab` | `FP-UI-AD58053601E8` | ui | `src/components/rules/CreativeRulesPanel.tsx:204` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4302a0826dd69d8b` | `FP-UI-9037F91F9D41` | ui | `src/components/editor/ChapterEditor.tsx:1647` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:43120b1879dccf5c` | `FP-UI-7CAF5C05AF75` | ui | `src/components/scene/SceneVerifyPanel.tsx:162` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:443768b4298bcdef` | `FP-UI-12DC2EA6152A` | ui | `src/components/outline/OutlinePanel.tsx:410` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:444cb9498468b59a` | `FP-UI-7B85BA2B0AC8` | ui | `src/components/geography/GeographyPanel.tsx:271` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:446c00b0b0d5d5ad` | `FP-UI-A9FBBF81D7D0` | ui | `src/components/settings/AIConfigPanel.tsx:482` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4474063d8cbec811` | `FP-UI-C7449C59D279` | ui | `src/components/geography/WorldTreeSidebar.tsx:199` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:448788e878d1ea71` | `FP-UI-14B093D6697E` | ui | `src/components/state/StatePanel.tsx:262` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:448a393b35033160` | `FP-UI-3942191F5000` | ui | `src/components/world-group/WorldGroupOverview.tsx:178` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:44bfc2c08b32a098` | `FP-UI-4318889C51B7` | ui | `src/components/settings/AIConfigPanel.tsx:356` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:44d6dad08b72641f` | `FP-UI-BEE089F78238` | ui | `src/components/outline/OutlineVolumeDetail.tsx:233` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:44ee85eebc4152f4` | `FP-UI-DD6E5372A69A` | ui | `src/components/codex/CodexPanel.tsx:554` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:450c8dc5bb4ddbe3` | `FP-UI-8CCE10FC396D` | ui | `src/components/codex/CodexSearchBar.tsx:58` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:454e6f82e8d59cf1` | `FP-UI-3D2E4ADA8E3C` | ui | `src/components/rules/CreativeRulesPanel.tsx:310` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:45904577dcdaa027` | `FP-UI-3880691C39E6` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:704` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:459535f06722dc69` | `FP-UI-625D9B08BBE0` | ui | `src/components/project/InspirationPanel.tsx:406` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:45e5320509afde81` | `FP-UI-C964BB1C0CF4` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:246` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4630cfdad9957d63` | `FP-UI-45693CDB9460` | ui | `src/components/outline/OutlinePreview.tsx:121` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4656339b6a56c291` | `FP-UI-8D7C9008CBB3` | ui | `src/components/outline/StoryArcPanel.tsx:318` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:467f17a6597da8b6` | `FP-UI-A72834870287` | ui | `src/components/layout/Sidebar.tsx:222` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:468f0371f3e59347` | `FP-UI-FE59FF6B97A6` | ui | `src/components/system/import/ImportUploadZone.tsx:65` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:46cd3ca9e6741899` | `FP-UI-9B398A1231C5` | ui | `src/components/shared/PromptRunPanel.tsx:164` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:47561a65af6bce81` | `FP-UI-D7163BAC5B42` | ui | `src/components/shared/CompositionInput.tsx:35` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:47751b8d9b11a3b3` | `FP-UI-9B086725583D` | ui | `src/components/shared/PromptRunPanel.tsx:261` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:477669230982fdce` | `FP-UI-C9C0C6C96E9D` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:285` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:477fd3cbdde65995` | `FP-UI-C45E6C3FFB11` | ui | `src/components/character/CharacterPanel.tsx:204` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:478607db46dd7889` | `FP-UI-7BA6A5BCA604` | ui | `src/components/editor/ChapterEditor.tsx:1711` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:47bf4f377787f74c` | `FP-UI-AD7F7102B4CD` | ui | `src/components/outline/OutlineChapterTree.tsx:143` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:47daaf2ad6ff0f49` | `FP-UI-9FB220039D71` | ui | `src/components/codex/CodexPanel.tsx:640` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:480855823af3fef0` | `FP-UI-F0C23D020466` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:113` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4827605271a5b320` | `FP-UI-573429CDB669` | ui | `src/pages/WorkspacePage.tsx:249` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4840c74810d51567` | `FP-UI-4D5802830F6B` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:319` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:484c2eac3b30d546` | `FP-UI-84DA361AEDEA` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:221` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4865a88456eff3e7` | `FP-UI-8C13DF2D3128` | ui | `src/components/worldview/WorldRulesPanel.tsx:539` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4866b10f854772ba` | `FP-UI-D47CC0D2206A` | ui | `src/components/settings/EmbeddingConfigCard.tsx:151` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:488551f5f9526ce7` | `FP-UI-ACB9A7886317` | ui | `src/components/geography/WorldMapVoronoi.tsx:350` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4892b8b093c7fc29` | `FP-UI-99B97A8D1914` | ui | `src/components/settings/prompt/PromptManagerPanel.tsx:280` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:48c739f18fd4ff51` | `FP-UI-7925FC11632A` | ui | `src/components/outline/StoryArcPanel.tsx:287` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:48d400f8ce0b23e9` | `FP-UI-7288459689EB` | ui | `src/components/codex/CodexSearchBar.tsx:76` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4904cefa21fb1358` | `FP-UI-7AC54A3D783B` | ui | `src/components/location/LocationPanel.tsx:234` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4926081a76ca5124` | `FP-UI-400B6E2030D0` | ui | `src/components/editor/NotePanel.tsx:41` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4943bc94366ef597` | `FP-UI-75F5529F8682` | ui | `src/components/shared/AIStreamOutput.tsx:218` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:495f12c19d5003b8` | `FP-UI-9C73C1B16F3A` | ui | `src/components/system/ImportDocPanel.tsx:711` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:497d3362086dc96c` | `FP-UI-96C50F7AEDE0` | ui | `src/components/history/HistoryPanel.tsx:219` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:49bc1e88772ca7f6` | `FP-UI-522B7FDD78F0` | ui | `src/components/settings/prompt/PromptWorkflowsPanel.tsx:173` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:49c9d1da9db7b324` | `FP-UI-85EF6902BC60` | ui | `src/components/project/AnalysisReportViewer.tsx:392` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4a4ec1910a0b7ec6` | `FP-UI-6DF6AD87AE27` | ui | `src/components/system/import/ImportReportModal.tsx:59` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4a6a902ac42374c1` | `FP-UI-037138CADCAB` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:152` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4acda194f03296e6` | `FP-UI-1C2F06628B07` | ui | `src/components/world-group/WorldGroupOverview.tsx:262` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4ade5d545f77ff5e` | `FP-UI-264F2B2F1FC4` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:508` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4aedb18a1c2ceed5` | `FP-UI-7DD10A04F1B7` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:345` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4b4bf66c7865d932` | `FP-UI-372A891F2500` | ui | `src/components/system/import/ImportUploadZone.tsx:39` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4b5964ba5ef9924f` | `FP-UI-B354E29FF8C1` | ui | `src/components/character/CharacterDimensionFields.tsx:183` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4b75f3112897662f` | `FP-UI-F2F54FE43D41` | ui | `src/components/history/HistoryAgentWorkspace.tsx:104` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4b81a401dac17902` | `FP-UI-9FF1C8E5E534` | ui | `src/components/shared/PromptRunPanel.tsx:143` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4bc07983d3555da0` | `FP-UI-5F199F9B626C` | ui | `src/components/character/CharacterDimensionPicker.tsx:41` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4bd5fdbbd6c1f3c8` | `FP-UI-6051E8DF06E2` | ui | `src/components/editor/ChapterContextPreview.tsx:55` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4bff50aa621f5c4e` | `FP-UI-6084C88D5821` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:326` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4c1d61ed9a9b070e` | `FP-UI-218F46313F92` | ui | `src/components/shared/PromptRunPanel.tsx:189` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4c38338f2c8cea75` | `FP-UI-EB2F1B821F3B` | ui | `src/components/codex/CodexPanel.tsx:385` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4c52678481d3dd62` | `FP-UI-6E60B14A323F` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:93` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4c54f32ae43936cc` | `FP-UI-6E2EAD1509B9` | ui | `src/components/editor/ChapterEditor.tsx:1816` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4c8102d2677ccb30` | `FP-UI-0340FEFA6C77` | ui | `src/components/worldview/WorldRulesPanel.tsx:525` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4cec501e4f0f0db8` | `FP-UI-057BFC524BC6` | ui | `src/components/shared/AIStreamOutput.tsx:197` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4d73cf0b34e21318` | `FP-UI-8815C2AD23AA` | ui | `src/components/worldview/WorldRulesPanel.tsx:472` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4d8f652b754c9740` | `FP-UI-2F412C487834` | ui | `src/components/history/HistoryTimelineEventCard.tsx:261` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4dc506f46e3c4928` | `FP-UI-CBC4F882AE1A` | ui | `src/components/worldview/PowerSystemPanel.tsx:69` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4df232e67b6b35ec` | `FP-UI-2E3333ED6984` | ui | `src/components/shared/PromptRunPanel.tsx:246` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4dfa1742c03f0b2a` | `FP-UI-4657CD57A24B` | ui | `src/components/character/CharacterPanel.tsx:552` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4e28acc9319a24db` | `FP-UI-C8DB0A837316` | ui | `src/components/outline/StoryArcPanel.tsx:204` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4e3122ee7eda6cea` | `FP-UI-FAFD1129F9C4` | ui | `src/components/system/ImportDocPanel.tsx:620` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4e5a250ae8d6d451` | `FP-UI-EA2F3941D380` | ui | `src/components/project/ReferencePanel.tsx:645` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4eaaa57d936e457b` | `FP-UI-CA4BF4D160B5` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:395` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4ec3ffda34976145` | `FP-UI-FCEC32248638` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:261` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4f1477ff192e3fd7` | `FP-UI-172ED10DB869` | ui | `src/components/editor/RichEditor.tsx:825` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4f1c08d6c222e0aa` | `FP-UI-553395E30F88` | ui | `src/components/history/HistoryTimelineEventCard.tsx:238` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4f482c9d82294e33` | `FP-UI-5E1E4CB3EDDB` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:138` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4f523fcae769fd31` | `FP-UI-469507895F28` | ui | `src/components/settings/AIConfigPanel.tsx:520` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4fde9e08632accb5` | `FP-UI-1A91479F3D72` | ui | `src/components/codex/CodexPanel.tsx:758` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:4fe9fe9af3d940da` | `FP-UI-80468CE515A7` | ui | `src/components/editor/ChaptersListPanel.tsx:226` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:500d1135d883d929` | `FP-UI-FAAD6C14E3FC` | ui | `src/components/system/ImportDocPanel.tsx:653` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5010facee0ab07e0` | `FP-UI-C238AB2C41D2` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:276` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5015b72ec356462d` | `FP-UI-4EF5FAABD956` | ui | `src/components/editor/FindReplacePanel.tsx:360` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:504006a57a06d41d` | `FP-UI-836E46F306E6` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:404` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:50c0da3a319c3d06` | `FP-UI-9F81513938CB` | ui | `src/components/geography/GeographyPanel.tsx:201` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:50ce87413e789165` | `FP-UI-63E5CE6A7284` | ui | `src/components/history/HistoryKeywordCard.tsx:114` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:50d1c954b1e83931` | `FP-UI-847D213776AB` | ui | `src/components/layout/Sidebar.tsx:141` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:50f8da7639933d5f` | `FP-UI-86A87F277A9E` | ui | `src/components/history/HistoryOverviewTab.tsx:28` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:50fdf8222504bf50` | `FP-UI-FCF094A11105` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:487` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5109542b5009ded4` | `FP-UI-1A96DAAE1CDE` | ui | `src/components/character/CharacterPanel.tsx:501` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:511453e6a87798ff` | `FP-UI-DE66C50FB6CD` | ui | `src/components/character/CharacterPanel.tsx:181` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:516487e473c5667f` | `FP-UI-2E3984D543A2` | ui | `src/components/character/CharacterPanel.tsx:354` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:517744b0c9b013ee` | `FP-UI-BCC994A23F61` | ui | `src/components/outline/OutlinePanel.tsx:412` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:51a19790291fb09d` | `FP-UI-9D46B548C0CA` | ui | `src/components/editor/ChaptersListPanel.tsx:246` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:51da00a7e1aaa20a` | `FP-UI-F661B856CD76` | ui | `src/components/outline/DetailedOutlinePanel.tsx:461` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:51df3dfeba0cf3c5` | `FP-UI-26F7C6746035` | ui | `src/components/character/CharacterPanel.tsx:510` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:51fe7719cbb96713` | `FP-UI-9D8DE8686DD1` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:486` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:524e6ba4566e2e28` | `FP-UI-4DCAACC8564D` | ui | `src/components/project/ReferencePanel.tsx:361` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:526ce48e506ae0b6` | `FP-UI-0998E750C862` | ui | `src/components/timeline/StoryTimelinePanel.tsx:194` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:528faaef26118d38` | `FP-UI-61FC2EB722BF` | ui | `src/components/project/AnalysisReportViewer.tsx:199` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:52bed0f8fb05817b` | `FP-UI-C9DD4D5173BC` | ui | `src/components/rules/CreativeRulesPanel.tsx:213` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:532868b487829d1f` | `FP-UI-39A09BF91C85` | ui | `src/components/project/AnalysisReportViewer.tsx:370` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:53c5764c44c789d5` | `FP-UI-4922E594CD45` | ui | `src/components/shared/PromptRunPanel.tsx:271` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:540b18a11835a1bd` | `FP-UI-827502B7D7E1` | ui | `src/components/world-group/WorldGroupDetail.tsx:269` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5418e5e600af1781` | `FP-UI-BDC21442629E` | ui | `src/components/world-group/WorldGroupOverview.tsx:150` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:546e36e299143a63` | `FP-UI-7972846BE653` | ui | `src/components/character/CharacterExtraPanel.tsx:130` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:54aee13ac84b7210` | `FP-UI-36B171FC49A0` | ui | `src/components/rules/CreativeRulesPanel.tsx:174` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:54c3f9cd4d4c862a` | `FP-UI-BCFE687B6F54` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:395` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:55970915f84f6ad1` | `FP-UI-6FB235470127` | ui | `src/components/rules/CreativeRulesPanel.tsx:368` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:55a7102e1cfe9cf0` | `FP-UI-1D6FD1EB3391` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:311` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:55b0e55567ca84e9` | `FP-UI-C070DD5FDCA4` | ui | `src/components/settings/AIConfigPanel.tsx:647` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:55d4f5956e7574dd` | `FP-UI-85DEFE64D815` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:448` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:55f0e7868f19790f` | `FP-UI-28BD82505AFC` | ui | `src/components/data/DataManagementPanel.tsx:66` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:56984aec205cc0d2` | `FP-UI-A712E7EBA85A` | ui | `src/components/history/HistoryTimelineEventCard.tsx:294` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:56bd4a9aa631d38a` | `FP-UI-044356062B47` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:370` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:56e6001a25914a4f` | `FP-UI-4F6B3129C978` | ui | `src/components/editor/ChapterEditor.tsx:1698` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:56ebc0ca13138ef4` | `FP-UI-569E7112230F` | ui | `src/pages/WorkspacePage.tsx:292` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:570b745368ad47fe` | `FP-UI-11DE57C96480` | ui | `src/components/character/CharacterPanel.tsx:282` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5751910f78e2042c` | `FP-UI-2719794F00DC` | ui | `src/components/outline/OutlineVolumeSidebar.tsx:170` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:57709e7e1ade12d2` | `FP-UI-0D2C0F01901C` | ui | `src/components/system/import/ImportReportModal.tsx:158` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:578928265c02075d` | `FP-UI-EC3D9B0E1011` | ui | `src/components/outline/OutlinePanel.tsx:493` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:57a8d2187bed2e48` | `FP-UI-A42D8DCB65D7` | ui | `src/components/outline/OutlinePanel.tsx:409` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:57df2109db2b61bd` | `FP-UI-D8F3C0A4B3A4` | ui | `src/components/worldview/WorldRulesPanel.tsx:498` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5813f49eb5cec515` | `FP-UI-131C70C2AE5B` | ui | `src/components/items/InventoryPanel.tsx:232` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5883f8ab95407ccd` | `FP-UI-C671B965C3CF` | ui | `src/components/geography/WorldTreeSidebar.tsx:175` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:588d80141753b55e` | `FP-UI-881DA8A8B3CB` | ui | `src/components/outline/OutlinePanel.tsx:495` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:58a4164c2be73181` | `FP-UI-09B6C4247DEB` | ui | `src/components/location/LocationPanel.tsx:263` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:58be55d8c534d973` | `FP-UI-C823564B15C0` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:211` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:58fe7cb80fd4615d` | `FP-UI-E66A53E92AF3` | ui | `src/components/outline/OutlineChapterTree.tsx:245` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:59204d1fa4aeef4c` | `FP-UI-5886B3616EA1` | ui | `src/components/location/LocationTagPicker.tsx:43` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5968b6b8cbc0c7c2` | `FP-UI-2DF7C26222B9` | ui | `src/components/rules/CreativeRulesPanel.tsx:267` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:59bfbb5f71169f1d` | `FP-UI-D11021EEAA79` | ui | `src/components/outline/OutlineVolumeDetail.tsx:203` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:59c403dcfb7ed34c` | `FP-UI-0EC59264380F` | ui | `src/components/history/HistoryTimelineEventCard.tsx:158` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:59c5d003c6d6b7c0` | `FP-UI-7DE71619C9A4` | ui | `src/components/rules/CreativeRulesPanel.tsx:258` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:59d29542d63d1193` | `FP-UI-176D9E30AE1D` | ui | `src/components/history/HistoryPanel.tsx:257` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:59f0f2a8bf249ee3` | `FP-UI-F250AAC07F66` | ui | `src/components/outline/OutlineChapterTree.tsx:232` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:59fb518fa28debfd` | `FP-UI-E92BCF092A34` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:549` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:59fcf1d631bcb86a` | `FP-UI-B108FCFC8C02` | ui | `src/components/editor/ChapterMemoryPanel.tsx:96` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5a2b445341f085c6` | `FP-UI-56DF48AD5AE9` | ui | `src/components/editor/ChapterEditor.tsx:1837` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5a779b5cdbcfbbb2` | `FP-UI-3BCCD0250B95` | ui | `src/components/geography/WorldTreeSidebar.tsx:255` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5a92da94ee7a543f` | `FP-UI-945CD052B365` | ui | `src/components/codex/CodexPanel.tsx:283` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5a99b775b00e0178` | `FP-UI-7F38E6F56220` | ui | `src/components/outline/OutlineVolumeDetail.tsx:236` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5aafbb999a59dbb2` | `FP-UI-B440E915A697` | ui | `src/components/shared/CompositionInput.tsx:86` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5ae5cd7c3ff3843c` | `FP-UI-0B35A2828D1D` | ui | `src/components/settings/prompt/PromptManagerPanel.tsx:260` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5af7bc5e03f9034b` | `FP-UI-2D0CDD2753CB` | ui | `src/components/character/CharacterPanel.tsx:490` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5b6ca779765e8f3e` | `FP-UI-052218E4B3E1` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:414` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5b74aaf0e2888d85` | `FP-UI-96843F970955` | ui | `src/components/outline/OutlineVolumeDetail.tsx:235` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5b90172d8a0611be` | `FP-UI-CE83844C6467` | ui | `src/components/settings/AIConfigPanel.tsx:444` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5b9072e92ff87ecd` | `FP-UI-9AE391EABFA0` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:257` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5bc5a335732be169` | `FP-UI-CA08C8125858` | ui | `src/components/settings/prompt/PromptManagerPanel.tsx:274` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5c24295f65d1b919` | `FP-UI-22E3D931690A` | ui | `src/components/location/LocationPanel.tsx:399` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5c38136e0b9c2999` | `FP-UI-DB2CF7080507` | ui | `src/components/history/HistoryPanel.tsx:364` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5c69a0cb49227f13` | `FP-UI-8EF0390CC33C` | ui | `src/components/worldview/PowerSystemPanel.tsx:57` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5d1dcf3c7bdfe2b7` | `FP-UI-2024D18663F1` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:177` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5d25f77b7c28f6ff` | `FP-UI-5315C130E6B2` | ui | `src/components/settings/AIConfigPanel.tsx:762` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5d5af3de7a7cc048` | `FP-UI-E18DF18D7D43` | ui | `src/components/shared/PanelLayout.tsx:100` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5db03b043e9964bc` | `FP-UI-404AEA530235` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:104` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5dcb9e5e743e74e0` | `FP-UI-23AC875E7E24` | ui | `src/components/items/InventoryPanel.tsx:277` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5dd2083286cfeef2` | `FP-UI-F38ABFD588E2` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:242` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5e01b2d4e5a745bd` | `FP-UI-BD67E66ECE9E` | ui | `src/components/layout/Sidebar.tsx:176` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5e4288c241ef5c2e` | `FP-UI-8ADFD8372D3E` | ui | `src/components/project/AnalysisReportViewer.tsx:418` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5e81477ed8cf5de0` | `FP-UI-BD90F6681265` | ui | `src/components/relations/CharacterRelationPanel.tsx:326` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5eaf5712b131e930` | `FP-UI-E59E5BF4F1CD` | ui | `src/components/outline/OutlineVolumeDetail.tsx:204` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5ed55daf487db999` | `FP-UI-49F781650900` | ui | `src/components/editor/ComparePolishPanel.tsx:160` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5f7918d70234b388` | `FP-UI-E9F2010CAB2C` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:149` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5f88dc9a0da0e205` | `FP-UI-41E3EE72D025` | ui | `src/components/editor/RichEditor.tsx:871` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5f899d2477ccf835` | `FP-UI-75F67FAA056B` | ui | `src/components/project/ReferencePanel.tsx:270` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5f9af2aa95888a6b` | `FP-UI-B6DD63A82E18` | ui | `src/components/location/LocationPanel.tsx:254` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:5fdbc071512632ed` | `FP-UI-C59242DEA820` | ui | `src/components/world-group/WorldRelationGraph.tsx:107` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:600f8d62879af9fb` | `FP-UI-CE44AE327740` | ui | `src/components/shared/Dialog.tsx:127` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6022d3e60a327609` | `FP-UI-1DB69039B165` | ui | `src/pages/WorkspacePage.tsx:241` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6030071480a00d6c` | `FP-UI-7D3AC3B150A9` | ui | `src/components/history/HistoryKeywordCard.tsx:219` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:605d351adb5572a0` | `FP-UI-18852F91FC5E` | ui | `src/components/project/AnalysisReportViewer.tsx:214` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:606f17be2ae3db1d` | `FP-UI-28A6457555DD` | ui | `src/components/outline/StoryArcPanel.tsx:157` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6081ec8c4bfcd11e` | `FP-UI-5B917EFF570F` | ui | `src/components/outline/StoryArcPanel.tsx:360` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:60da25bdb3311777` | `FP-UI-7B95BE863209` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:359` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6179efdad6bc6bbd` | `FP-UI-1FC4CD82C875` | ui | `src/components/history/HistoryKeywordCard.tsx:218` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:618e39a8ac85cdd5` | `FP-UI-D9933BBA226F` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:470` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:62068df52e2ad1a1` | `FP-UI-7AA770726162` | ui | `src/components/outline/OutlinePanel.tsx:429` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:620d54d1af8edb9e` | `FP-UI-5EA7A3A90F96` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:386` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:624919719761dbb2` | `FP-UI-98F0BFF14ACE` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:306` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:628df0992bc0c1f6` | `FP-UI-481793C6D0C3` | ui | `src/components/geography/GeographyPanel.tsx:347` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:62aa8912cbd1bf20` | `FP-UI-43EA6CD7C522` | ui | `src/components/outline/StoryArcPanel.tsx:192` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:632121ffc97b9ef2` | `FP-UI-89C296F77150` | ui | `src/components/settings/prompt/PromptManagerPanel.tsx:254` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:63402260e984fbad` | `FP-UI-B82621BD8B3D` | ui | `src/components/character/CharacterPanel.tsx:183` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:63816c13ea45457e` | `FP-UI-FC07EF202D07` | ui | `src/components/outline/StoryArcPanel.tsx:173` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:638b3db7dc7b46fe` | `FP-UI-4D72DA3F0FDF` | ui | `src/components/outline/OutlineVolumeDetail.tsx:172` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6398c6c3eec70186` | `FP-UI-A9F581280CDD` | ui | `src/components/relations/CharacterRelationPanel.tsx:415` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:64689a49c2e222ce` | `FP-UI-C519CE11DD74` | ui | `src/components/outline/StoryArcPanel.tsx:276` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:646cda2d82ff8ccd` | `FP-UI-E69E63B823EA` | ui | `src/pages/HomePage.tsx:227` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:647973d602536c44` | `FP-UI-44F546995D2F` | ui | `src/components/world-group/WorldGroupOverview.tsx:157` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:648cd721de485434` | `FP-UI-08BCB22F517F` | ui | `src/components/outline/ScenePanel.tsx:155` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:64cea54bc48dca83` | `FP-UI-2B04EEDEFCA0` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:351` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:64f3af83c0a474bd` | `FP-UI-3BBC9BC05B77` | ui | `src/components/editor/ChapterEditor.tsx:1824` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:651393369415a7fc` | `FP-UI-28F85A98546E` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:486` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:65590ad177affd2a` | `FP-UI-1D8D39F5A86E` | ui | `src/components/settings/AIConfigPanel.tsx:556` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6625c23768b70fbc` | `FP-UI-855277FB9A40` | ui | `src/components/editor/EmotionBeatCard.tsx:197` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6643b5f54970d5ec` | `FP-UI-E659B15E7D46` | ui | `src/components/editor/ComparePolishPanel.tsx:117` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:66545e0e104bee86` | `FP-UI-D74306249013` | ui | `src/components/outline/StoryArcPanel.tsx:203` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:66582a573f5a412b` | `FP-UI-94F563A9C1CA` | ui | `src/components/project/ReferencePanel.tsx:601` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6662d5fbf5c2d3ec` | `FP-UI-66185CEFE5F8` | ui | `src/components/worldview/WorldRulesPanel.tsx:490` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:66af01a7c25c948d` | `FP-UI-56662810CE8B` | ui | `src/components/world-group/WorldGroupDetail.tsx:247` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:66bb191a0553056d` | `FP-UI-2CB60EE7B2E1` | ui | `src/components/worldview/StoryCorePanel.tsx:228` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:66bbcde21747245f` | `FP-UI-1BC259E75E88` | ui | `src/components/geography/GeographyPanel.tsx:333` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:66e0a0ec279f2935` | `FP-UI-26B8B0DD6806` | ui | `src/components/character/CharacterSupplementAction.tsx:125` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:66ebd9fd4df919f1` | `FP-UI-74F498041F85` | ui | `src/components/project/ProjectInfoPanel.tsx:171` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6773bb6130a8a7da` | `FP-UI-B8E26E8938CF` | ui | `src/components/outline/DetailedOutlinePanel.tsx:417` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:677c58715125802e` | `FP-UI-523DCD47C6CA` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:635` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:677e0556134a520a` | `FP-UI-424291EC2B4F` | ui | `src/components/outline/OutlineChapterTree.tsx:153` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:67a261baf4694c47` | `FP-UI-90024870AAE7` | ui | `src/components/settings/EmbeddingConfigCard.tsx:145` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:67cd7b564310b012` | `FP-UI-36A8B486F395` | ui | `src/components/scene/SceneVerifyPanel.tsx:149` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:67f2f5fd9c8fc2db` | `FP-UI-0E907FFE36FE` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:340` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:682b5d9d82875623` | `FP-UI-5E0B174E682B` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:310` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6871f96ee1e5c9b9` | `FP-UI-CAFBC8FC49CC` | ui | `src/pages/HomePage.tsx:359` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:68b6c3302c8c0973` | `FP-UI-CCB37DD206BF` | ui | `src/components/project/ReferencePanel.tsx:110` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:68e2ade5026fb9f7` | `FP-UI-493B0D0F35C3` | ui | `src/components/system/import/ImportConfirmModal.tsx:234` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:68e30b8146cbc5a2` | `FP-UI-101BCB2AB1F7` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:151` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:68e57ba483898926` | `FP-UI-4675310AD9BD` | ui | `src/components/editor/NotePanel.tsx:80` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:68f7f6ad17a5f734` | `FP-UI-EBE72038E1CE` | ui | `src/components/editor/ChapterEditor.tsx:1523` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6960eb05c1125ac9` | `FP-UI-A71BFF9040D6` | ui | `src/components/history/HistoryPanel.tsx:464` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:69c97b164219a234` | `FP-UI-A8F590719140` | ui | `src/components/migration/FirstRunMigration.tsx:143` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6a1eccf3e6424f90` | `FP-UI-04DB6606E06E` | ui | `src/components/world-group/WorldGroupDetail.tsx:119` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6a2957cb5c3317bc` | `FP-UI-2F6711AE503A` | ui | `src/components/project/AnalysisReportViewer.tsx:184` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6a4192d1d9601964` | `FP-UI-9567D20EC1EB` | ui | `src/components/editor/FindReplacePanel.tsx:331` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6a4a122d12695977` | `FP-UI-485787719C20` | ui | `src/components/editor/RichEditor.tsx:981` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6a5280bdedafe0fa` | `FP-UI-A0D3440F43BF` | ui | `src/components/history/HistoryPanel.tsx:465` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6a5e07259c89e239` | `FP-UI-7F05A54B5727` | ui | `src/components/editor/ChapterMemoryPanel.tsx:88` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6a7608fa574193b6` | `FP-UI-1BB08B7B4A1C` | ui | `src/components/outline/OutlineChapterTree.tsx:148` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6b23a0b186403af0` | `FP-UI-75764079EF01` | ui | `src/components/editor/NotePanel.tsx:78` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6ba6893ecc11ec37` | `FP-UI-F553B0CE1F2F` | ui | `src/components/settings/EmbeddingConfigCard.tsx:95` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6bc1b02d6b098265` | `FP-UI-01DEB9541D30` | ui | `src/components/project/InspirationPanel.tsx:472` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6be3fc8c97679450` | `FP-UI-4460886F6B7D` | ui | `src/components/scene/SceneVerifyPanel.tsx:160` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6c8ed58203ca1358` | `FP-UI-401DC2593F70` | ui | `src/components/items/InventoryPanel.tsx:274` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6d1bfe3d6874b4a3` | `FP-UI-927692E5841D` | ui | `src/components/character/CharacterExtraPanel.tsx:99` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6d74cc035db8a2bb` | `FP-UI-8517F645D819` | ui | `src/components/rules/CreativeRulesPanel.tsx:267` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6d7e1a4ca2c77097` | `FP-UI-2C98C51DC65F` | ui | `src/components/outline/ScenePanel.tsx:207` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6d929a1ddc690276` | `FP-UI-48F80DD7AF72` | ui | `src/components/character/CharacterExtraPanel.tsx:89` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6d98fbc526e91c9a` | `FP-UI-F3E425AD5D5D` | ui | `src/components/project/InspirationPanel.tsx:625` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6d9c59e9da622334` | `FP-UI-46B0E4246235` | ui | `src/components/shared/InlineEdit.tsx:45` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6db5b6a2652520b7` | `FP-UI-01C4F3FE74D5` | ui | `src/components/outline/OutlineVolumeDetail.tsx:266` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6dea88bc6c0625cd` | `FP-UI-9EEFF251677A` | ui | `src/components/outline/OutlineChapterTree.tsx:266` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6e15743c66d196b7` | `FP-UI-0A1467B0C494` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:121` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6e3d7d933aa23282` | `FP-UI-8A90B8105FD4` | ui | `src/components/codex/CodexPanel.tsx:574` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6e43be173fb67d2d` | `FP-UI-B60E7DF98AE0` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:833` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6e69b37d2a72740a` | `FP-UI-8FDA3BE5F4FF` | ui | `src/components/system/import/ImportConfirmModal.tsx:109` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6e6d1807276eb2c5` | `FP-UI-D6027BADBDDA` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:415` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6e774733a475e9bd` | `FP-UI-244C069BEDE2` | ui | `src/components/worldview/WorldRulesPanel.tsx:338` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6e7753b7d57049bc` | `FP-UI-4D577F7E62C8` | ui | `src/components/character/CharacterPanel.tsx:280` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6e7f2f69b00f0ae5` | `FP-UI-998036395C1A` | ui | `src/components/system/ImportDocPanel.tsx:701` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6e9d73baba3e6ed0` | `FP-UI-D5E97EEECB07` | ui | `src/components/system/ImportDocPanel.tsx:560` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6e9e24fd0682252d` | `FP-UI-62B0566E70D2` | ui | `src/components/rules/CreativeRulesPanel.tsx:227` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6ed18f9da225779c` | `FP-UI-621C43213A73` | ui | `src/components/history/HistoryKeywordCard.tsx:217` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6f104d9089e6ff03` | `FP-UI-6BD0F3D71B77` | ui | `src/components/history/HistoryAgentWorkspace.tsx:102` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6f2ee0671e2d34c6` | `FP-UI-D8BDA9435D23` | ui | `src/components/geography/WorldMapVoronoi.tsx:326` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6f7569f591ad1763` | `FP-UI-6A0490FB5891` | ui | `src/components/system/import/ImportUnfinishedBanner.tsx:58` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:6fecce175eb26a8c` | `FP-UI-84892671C305` | ui | `src/components/history/HistoryKeywordCard.tsx:138` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:70535b008bf1d080` | `FP-UI-2B7D753B8FCE` | ui | `src/components/history/HistoryAgentWorkspace.tsx:83` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:70539aec8f0f5da9` | `FP-UI-8658E01BCCC8` | ui | `src/components/migration/FirstRunMigration.tsx:178` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:70bb7a6144c5df30` | `FP-UI-BEC5DD085166` | ui | `src/components/data/DataManagementPanel.tsx:266` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:70cb6f8f2f10050f` | `FP-UI-573D12BAEB20` | ui | `src/components/layout/Sidebar.tsx:186` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:70ff5f8ecf10456f` | `FP-UI-F52294FD15D1` | ui | `src/components/project/InspirationPanel.tsx:595` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7106c4d0f395a5fe` | `FP-UI-F3A829CCFE9C` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:707` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7116ca2bcc5e4b85` | `FP-UI-BF53FA925CB2` | ui | `src/components/outline/OutlineGenerationResultPanel.tsx:70` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7122d5a39dbd4578` | `FP-UI-EF13C75451ED` | ui | `src/components/shared/AutoResizeTextarea.tsx:61` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:712b16256fcb0065` | `FP-UI-50603517A971` | ui | `src/components/codex/CodexPanel.tsx:321` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:712dde55e90cfb8b` | `FP-UI-2DFFA779454D` | ui | `src/components/settings/prompt/PromptManagerPanel.tsx:235` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:71631827fa2c131f` | `FP-UI-EB5065117EC4` | ui | `src/components/state/StatePanel.tsx:234` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:71631b347e0f7d0a` | `FP-UI-9EE6E97E9A7E` | ui | `src/pages/HomePage.tsx:263` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:71906a52ebe4e681` | `FP-UI-9FC2A592C57A` | ui | `src/components/geography/WorldTreeSidebar.tsx:69` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:72218d588efc23e3` | `FP-UI-01245B645973` | ui | `src/components/character/CharacterMinorPanel.tsx:98` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7230deb6055d704a` | `FP-UI-847107D311AB` | ui | `src/components/character/CharacterNPCPanel.tsx:72` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:72b564ad5450bae3` | `FP-UI-D44ACD7DF0F8` | ui | `src/components/style/StyleLearningPanel.tsx:189` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:72bbee3de466c3d8` | `FP-UI-C44BC657CCE6` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:708` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:72fba159d8d6e705` | `FP-UI-47E1FEDA2C94` | ui | `src/components/location/LocationPanel.tsx:279` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7319aa4f954b1473` | `FP-UI-33D8A4EDFB1A` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:810` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7343075c2d65fb41` | `FP-UI-915E05096B29` | ui | `src/components/shared/InlineEdit.tsx:37` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:73486d28929cb5d1` | `FP-UI-17A03D076FCA` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:401` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:734fce0b2a2d0c61` | `FP-UI-1621580787C5` | ui | `src/components/location/LocationPanel.tsx:208` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7363e5aa412bf594` | `FP-UI-27A0103E60F3` | ui | `src/components/history/HistoryPanel.tsx:287` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:737d3250d618a9b5` | `FP-UI-C4CCB81DB7D1` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:98` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7382702d8872b575` | `FP-UI-4EC8138652CD` | ui | `src/components/editor/ChapterCandidateReview.tsx:85` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:73b7bccb7c9d11ce` | `FP-UI-F7732B95206D` | ui | `src/components/editor/EmotionBeatCard.tsx:235` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:73d8e0e5114f8c1a` | `FP-UI-97C2FC41A438` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:120` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:73e90134c2793012` | `FP-UI-FE55D293A47F` | ui | `src/components/settings/AIConfigPanel.tsx:543` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:73ec67293e92e37a` | `FP-UI-E535A5CD5E21` | ui | `src/components/worldview/StoryCorePanel.tsx:212` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:73faf68b9147cd3b` | `FP-UI-14C74B713E21` | ui | `src/components/outline/StoryArcPanel.tsx:317` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:74441f9755c6b87f` | `FP-UI-73EEF40B53FF` | ui | `src/components/history/HistoryPanel.tsx:463` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7468a4ca5fa9b0f0` | `FP-UI-7A4328E83899` | ui | `src/components/editor/ReviewPanel.tsx:205` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:74e4194ecc1b84a9` | `FP-UI-548EC6B4C9FA` | ui | `src/components/system/ImportDocPanel.tsx:561` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:74ee49ac1bc8880e` | `FP-UI-DB39DD3DD70F` | ui | `src/pages/HomePage.tsx:401` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:74fc952bd2552a02` | `FP-UI-2F0D5A7F5713` | ui | `src/components/editor/FloatingToolbar.tsx:77` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:754b57b8a476f12d` | `FP-UI-A49EBA1B0C31` | ui | `src/components/editor/RichEditor.tsx:973` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:75a2b5af8cd5d8ba` | `FP-UI-2E50723599D2` | ui | `src/components/codex/CodexPanel.tsx:705` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:75d53dc01b668b64` | `FP-UI-882AA53CD025` | ui | `src/components/character/CharacterNPCPanel.tsx:116` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7601e4914633b5f2` | `FP-UI-ACFACDE44261` | ui | `src/components/project/InspirationPanel.tsx:459` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:764dd478d10a15c6` | `FP-UI-B44C2D3C5D0A` | ui | `src/components/location/LocationPanel.tsx:167` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:76f87b83ab014aad` | `FP-UI-09A5731D1418` | ui | `src/components/history/HistoryPanel.tsx:459` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7766c74421985872` | `FP-UI-FEF4FE938C14` | ui | `src/components/location/LocationPanel.tsx:243` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7770c6028db1f8f5` | `FP-UI-4C38B1586F44` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:373` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:77af001efa51c10b` | `FP-UI-F4369B9C72C3` | ui | `src/components/codex/CodexPanel.tsx:588` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:77d16040a0e301f8` | `FP-UI-A9D7833E3775` | ui | `src/components/outline/ScenePanel.tsx:136` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:77df1baae9fc8206` | `FP-UI-B98D6E906286` | ui | `src/components/editor/ChapterEditor.tsx:1712` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:77e6a7e47e2b4f97` | `FP-UI-D481D13C5C24` | ui | `src/components/editor/ChapterEditorHeader.tsx:94` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7825157547a75695` | `FP-UI-C5EEE0A982DC` | ui | `src/components/editor/ChapterEditor.tsx:1710` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:782ed57e441dfe30` | `FP-UI-21E32F149B23` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:57` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:784e3ea3a909fbf8` | `FP-UI-8CA41ED10697` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:101` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:78794034207ae002` | `FP-UI-5884122F7198` | ui | `src/components/data/CloudBackupCard.tsx:119` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:78a49f25770a9b30` | `FP-UI-4DDC7740E163` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:352` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:794e148e692c9a44` | `FP-UI-51C2B465C1AD` | ui | `src/components/geography/GeographyPanel.tsx:294` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:796f7e9bfb0c0749` | `FP-UI-01D5A4F6583B` | ui | `src/components/character/CharacterDimensionFields.tsx:184` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:79a247a80d88e9e3` | `FP-UI-D7F1988428AC` | ui | `src/components/outline/DetailedOutlinePanel.tsx:528` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:79bdb7508ddebc30` | `FP-UI-98539BECC020` | ui | `src/components/codex/CodexPanel.tsx:270` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:79fee4f6aa9032b5` | `FP-UI-C92C294D76C5` | ui | `src/components/character/CharacterPanel.tsx:441` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7a2689755eac7f4b` | `FP-UI-396B7984EE1F` | ui | `src/components/outline/OutlineVolumeDetail.tsx:210` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7a7d06fb30819f8f` | `FP-UI-B62B8CA0DF52` | ui | `src/components/facts/FactLibraryPanel.tsx:111` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7a92df0436d68b5a` | `FP-UI-F2C2026A20C0` | ui | `src/components/facts/FactLibraryPanel.tsx:152` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7ae3e8221376b1da` | `FP-UI-FBCA50ECCA1A` | ui | `src/components/outline/OutlinePanel.tsx:437` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7ae5651bc70c815f` | `FP-UI-E2BEDF7F0547` | ui | `src/components/facts/FactLibraryPanel.tsx:148` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7aedd82a08f8c5de` | `FP-UI-9DA125263D57` | ui | `src/components/data/CloudBackupCard.tsx:138` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7b0306017612f971` | `FP-UI-B4867829060B` | ui | `src/components/world-group/WorldGroupDetail.tsx:127` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7bdedb5ab48a1240` | `FP-UI-0A004E20F47E` | ui | `src/components/settings/prompt/PromptExamplesEditor.tsx:197` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7c0bf279b75e1046` | `FP-UI-9BE238B3B5CF` | ui | `src/components/outline/DetailedOutlinePanel.tsx:579` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7c1e5bfb4240d48b` | `FP-UI-9122CF274E41` | ui | `src/components/project/ReferencePanel.tsx:181` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7c5c8277884bb610` | `FP-UI-4F7C588FA082` | ui | `src/components/geography/WorldTreeSidebar.tsx:123` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7c67262dab087234` | `FP-UI-7569530C1DF3` | ui | `src/components/scene/SceneVerifyPanel.tsx:141` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7c8b13f38f78fec4` | `FP-UI-296ABC2B0CD7` | ui | `src/components/outline/OutlineVolumeDetail.tsx:208` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7c8bf5ebb20a6a25` | `FP-UI-3A2CB1A602EC` | ui | `src/components/outline/OutlineVolumeDetail.tsx:270` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7ca6fa8a0fa24eb8` | `FP-UI-164698D4FA1F` | ui | `src/components/geography/GeographyPanel.tsx:355` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7cb4591a9305a1ea` | `FP-UI-E897229E8012` | ui | `src/components/rules/CreativeRulesPanel.tsx:249` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7cd8549c5e2dcfb8` | `FP-UI-9C8A092B7AF4` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:385` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7cd9b8721bf43163` | `FP-UI-BB01CDA3D742` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:122` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7cf87d6518069e89` | `FP-UI-FBFBBE9FF4F5` | ui | `src/components/editor/RichEditor.tsx:923` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7d0a7b86c4237ded` | `FP-UI-A86548E7559B` | ui | `src/components/relations/CharacterRelationPanel.tsx:452` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7d1735fe09efab42` | `FP-UI-DA04FAC5F0F7` | ui | `src/components/geography/WorldMapVoronoi.tsx:437` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7d1adb7499b60c7f` | `FP-UI-331E3D9678FC` | ui | `src/components/shared/PanelLayout.tsx:129` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7d1dc1ab9c7d05aa` | `FP-UI-679B59CE391E` | ui | `src/components/worldview/PowerSystemPanel.tsx:79` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7d3f90c6a6535cdd` | `FP-UI-A13E782D778A` | ui | `src/components/outline/StoryArcPanel.tsx:150` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7d68bad244b32c8c` | `FP-UI-C68A7DA95645` | ui | `src/components/data/CloudBackupCard.tsx:156` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7d6d976a1d03f452` | `FP-UI-95AF66B35799` | ui | `src/components/project/ProjectInfoPanel.tsx:87` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7d81a3f7f04d836b` | `FP-UI-FFBBCD4BFDFA` | ui | `src/components/geography/WorldTreeSidebar.tsx:126` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7e3c69824d095b91` | `FP-UI-5C58FEAE1B84` | ui | `src/components/character/CharacterPanel.tsx:301` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7e3ec51db7eae929` | `FP-UI-723D0250B727` | ui | `src/components/settings/AIConfigPanel.tsx:708` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7e6b1b7cccdff4f7` | `FP-UI-0D0179524121` | ui | `src/components/character/CharacterDimensionPicker.tsx:52` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7e7ec63088d82980` | `FP-UI-E966F9FFE972` | ui | `src/components/migration/FirstRunMigration.tsx:196` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7ea6904bc8d5b9a7` | `FP-UI-CB6C0EB907F6` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:811` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7eab2c35f745a861` | `FP-UI-D5D3841F89EB` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:373` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7ece392b90e4a0ee` | `FP-UI-438D1CEBEC38` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:796` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7ed4401bb85702fa` | `FP-UI-E4577119D80E` | ui | `src/components/facts/FactLibraryPanel.tsx:118` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7f5800f1021b6268` | `FP-UI-194B6473A856` | ui | `src/components/data/DataManagementPanel.tsx:388` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7f63b529ae83f225` | `FP-UI-FD636384042B` | ui | `src/components/history/HistoryTimelineEventCard.tsx:204` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:7f8cc7c482d4cea1` | `FP-UI-9F1DD77C173E` | ui | `src/components/location/LocationPanel.tsx:341` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8032a9bf620011a4` | `FP-UI-13E45B03E987` | ui | `src/components/character/CharacterExtraPanel.tsx:106` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:803d143de6ce8b06` | `FP-UI-BA13523DF4DB` | ui | `src/components/editor/ChapterEditorHeader.tsx:78` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8064ac886edce219` | `FP-UI-765BD1CC0CBF` | ui | `src/components/outline/DetailedOutlinePanel.tsx:437` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:81952ceb4074fcfb` | `FP-UI-48D4651E30E3` | ui | `src/components/outline/OutlineVolumeSidebar.tsx:87` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:81b2751041e3449e` | `FP-UI-89C0C9D1E002` | ui | `src/components/settings/EmbeddingConfigCard.tsx:111` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:821543ed2bc9ac29` | `FP-UI-1AC8463A6724` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:271` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:822ad7e64835d86a` | `FP-UI-7D007348BFB8` | ui | `src/components/rules/CreativeRulesPanel.tsx:350` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:82e4f94f8ea8ac3f` | `FP-UI-76D774615600` | ui | `src/components/codex/CodexPanel.tsx:434` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8302f86948c81ead` | `FP-UI-34ABC1CB61BC` | ui | `src/components/items/InventoryPanel.tsx:318` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:83557693f6ebe969` | `FP-UI-61AF4E38FD20` | ui | `src/components/relations/CharacterRelationPanel.tsx:385` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8379dd8d243cf6c5` | `FP-UI-FEE4D4D502A5` | ui | `src/components/history/HistoryTimelineEventCard.tsx:182` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:837f02ff48e95f0e` | `FP-UI-B673A9EAB2D4` | ui | `src/components/settings/UsageStatsPage.tsx:103` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8386228cbbadb7e5` | `FP-UI-910A3E99079A` | ui | `src/components/codex/CodexPanel.tsx:589` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:83b9c3cc433072ef` | `FP-UI-B3C4B1BF59D3` | ui | `src/pages/HomePage.tsx:149` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:83bc6a3b70ccd301` | `FP-UI-6C328759FE15` | ui | `src/components/settings/prompt/PromptManagerPanel.tsx:140` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:83f2c14aff2c178e` | `FP-UI-B04ADF3560B3` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:600` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8414f58ea44c46bf` | `FP-UI-8458BF143FD4` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:478` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:842b1d8ae025e22a` | `FP-UI-9D27FDC5FBFF` | ui | `src/components/history/HistoryTimelineEventCard.tsx:295` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:84cc787c4cb6219e` | `FP-UI-CDDFCA693FF4` | ui | `src/components/outline/StoryArcPanel.tsx:263` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8501d297e8383c04` | `FP-UI-95AA587188F5` | ui | `src/components/editor/RichEditor.tsx:807` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:85289908a807c05d` | `FP-UI-DBAB569934C5` | ui | `src/components/character/CharacterExtraPanel.tsx:144` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:855425b4a4ae9fb9` | `FP-UI-3A690A759868` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:610` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8562b739b7660839` | `FP-UI-A2CF6FDDD881` | ui | `src/components/outline/OutlineChapterTree.tsx:236` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:85905f0af54cc4d2` | `FP-UI-C34261515E6A` | ui | `src/components/location/LocationPanel.tsx:350` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:85e2a386603dd811` | `FP-UI-76567481EF9D` | ui | `src/components/state/StatePanel.tsx:244` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:85f8900a32b5e23d` | `FP-UI-5034574E0B57` | ui | `src/components/outline/OutlinePanel.tsx:488` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:860ed444266b1478` | `FP-UI-20307FC49CE5` | ui | `src/components/codex/CodexPanel.tsx:313` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:86b5cf1ea1a0f3b5` | `FP-UI-8E9525B13C0B` | ui | `src/components/editor/RichEditor.tsx:1019` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:86df7e7d76ab45a5` | `FP-UI-4A63D9A84B8D` | ui | `src/components/outline/OutlinePanel.tsx:404` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:86f92ddacbf65257` | `FP-UI-1060E8DE8DD5` | ui | `src/components/system/ImportDocPanel.tsx:712` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8724fef06b868a0d` | `FP-UI-2F166C125274` | ui | `src/components/settings/prompt/PromptExamplesEditor.tsx:164` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:872fcacbfd5fd5b2` | `FP-UI-7E748E084861` | ui | `src/components/codex/CodexPanel.tsx:559` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:873ebfdf0223452f` | `FP-UI-B1C641A8635E` | ui | `src/components/worldview/StoryCorePanel.tsx:242` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:87a38b762e1ec564` | `FP-UI-CE4BF5A5DDFC` | ui | `src/components/settings/AIConfigPanel.tsx:586` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:87c2e4cad9d05f40` | `FP-UI-19BCCD65DDBA` | ui | `src/components/geography/WorldTreeSidebar.tsx:124` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:87c54cd4de197d69` | `FP-UI-E6AEAE33E1FE` | ui | `src/components/geography/WorldMapVoronoi.tsx:428` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:87d381776939f480` | `FP-UI-E66EAE4E76C6` | ui | `src/components/system/ImportDocPanel.tsx:700` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:883a9508248abcdf` | `FP-UI-AC5BA81B711D` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:138` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:88434feafde29014` | `FP-UI-2868742A4F2B` | ui | `src/components/world-group/WorldRelationGraph.tsx:175` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8866bd993cc2b077` | `FP-UI-182E4460F2F1` | ui | `src/components/history/HistoryPanel.tsx:468` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:88fda6ec854a5dd7` | `FP-UI-46E6432929A9` | ui | `src/components/project/InspirationPanel.tsx:669` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:88fedf71819f511a` | `FP-UI-0F9023D4B4BB` | ui | `src/components/outline/ScenePanel.tsx:125` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:891bc026060d2e7b` | `FP-UI-47F6F043E93E` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:298` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:89223c97632fffab` | `FP-UI-9E7791DCCFDA` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:350` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:89364731180e071d` | `FP-UI-CC12A83D8811` | ui | `src/components/shared/Dialog.tsx:114` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:89775676f5d23192` | `FP-UI-41CCB195DB60` | ui | `src/components/outline/OutlinePanel.tsx:435` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8986e68219ac29cc` | `FP-UI-66D8FB4741EE` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:639` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8993ac3a3eb0bbce` | `FP-UI-0D5E7188430D` | ui | `src/components/project/InspirationPanel.tsx:544` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:899451834a8de892` | `FP-UI-FED715035F90` | ui | `src/components/world-group/WorldGroupOverview.tsx:312` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:89aeb890d2d3c027` | `FP-UI-81113C821CDC` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:217` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:89e5f0f1aaf855c2` | `FP-UI-77A8910EE203` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:823` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:89e70aff040b51eb` | `FP-UI-4E63962DF64F` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:324` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8a0b39fcd700f823` | `FP-UI-DDD23C928A0A` | ui | `src/components/style/StyleLearningPanel.tsx:190` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8a34ada62dfcd55d` | `FP-UI-FB1BB3297456` | ui | `src/components/codex/CodexPanel.tsx:463` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8a3e3bfecb468a2a` | `FP-UI-DDB6F6A5FFE1` | ui | `src/components/character/CharacterMinorPanel.tsx:82` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8ac54bb1d2898b26` | `FP-UI-2A3DE43C81E3` | ui | `src/components/editor/ChaptersListPanel.tsx:225` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8ad648759413f233` | `FP-UI-A6848BDF0F9A` | ui | `src/components/location/LocationPanel.tsx:418` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8af09a509e558f0a` | `FP-UI-C2F947A74801` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:273` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8af9725df1ead8e8` | `FP-UI-B8773E9606FB` | ui | `src/components/shared/PromptRunPanel.tsx:284` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8b63d3f8f1bfea28` | `FP-UI-7FAACFCA76EF` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:279` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8b662d10dc2ad694` | `FP-UI-32CCB3152EF0` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:370` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8b75fabd9ea7379e` | `FP-UI-15A4A27E7E4B` | ui | `src/components/history/HistoryKeywordCard.tsx:221` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8bf92792354ef047` | `FP-UI-3ABCC0595137` | ui | `src/components/codex/CodexPanel.tsx:688` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8c56d44997e01401` | `FP-UI-F8C01EE5C0A4` | ui | `src/components/codex/CodexPanel.tsx:838` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8c5d59042d7bbe16` | `FP-UI-43B5026EFD83` | ui | `src/components/geography/WorldTreeSidebar.tsx:254` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8c686e841a1f0823` | `FP-UI-7B64AD129009` | ui | `src/components/history/HistoryAgentWorkspace.tsx:71` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8cac5a7b9dfb199e` | `FP-UI-5AAD81D55728` | ui | `src/components/outline/ScenePanel.tsx:154` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8ce049896c32aea7` | `FP-UI-B3F4C3C4CC29` | ui | `src/components/project/InspirationPanel.tsx:637` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8cec89d256a3749f` | `FP-UI-498ADD8FCFDF` | ui | `src/components/editor/ChapterCandidateReview.tsx:94` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8d23fd6857c95a9f` | `FP-UI-06286503E2A1` | ui | `src/components/editor/FindReplacePanel.tsx:322` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8d887b46f858edc0` | `FP-UI-0B6B149CF3A4` | ui | `src/components/outline/DetailedOutlinePanel.tsx:549` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8db27168e6c4aa84` | `FP-UI-6319E3D7F4E6` | ui | `src/components/editor/ReviewPanel.tsx:172` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8dda76b50168cc1c` | `FP-UI-10FD7492BEDD` | ui | `src/components/system/ImportDocPanel.tsx:590` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8e6ac5009c3c628d` | `FP-UI-BEFBD1ED055B` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:134` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8e77fa03705a4c51` | `FP-UI-0E598BA04DDE` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:510` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8ea86f994888eb7d` | `FP-UI-DED0CBCEB3A6` | ui | `src/components/geography/WorldTreeSidebar.tsx:257` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8f858896ade8ab1c` | `FP-UI-8FF26444D2ED` | ui | `src/components/editor/EmotionBeatCard.tsx:204` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8f8fd9fc96aa44d9` | `FP-UI-634CCF6A3FF7` | ui | `src/components/geography/GeographyPanel.tsx:321` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8fabee69bc4bfce0` | `FP-UI-CCF7939692ED` | ui | `src/components/outline/DetailedOutlinePanel.tsx:321` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8fd45d3e37926116` | `FP-UI-7BD6C54BFC06` | ui | `src/components/character/CharacterDimensionFields.tsx:176` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8ffbbf08ad997097` | `FP-UI-CD82BB087A99` | ui | `src/components/editor/RichEditor.tsx:915` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:8fff2835defdb136` | `FP-UI-9AA6ABC01857` | ui | `src/components/history/HistoryAgentWorkspace.tsx:62` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:90e2f833c5857a31` | `FP-UI-4E507016FEF1` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:304` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9141d0b5dbb6b69e` | `FP-UI-527825DD4DEB` | ui | `src/components/outline/OutlinePanel.tsx:494` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:914acf56a7454eaa` | `FP-UI-ECBD31836F79` | ui | `src/components/codex/CodexPanel.tsx:400` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9182304fe2a82d02` | `FP-UI-62D4D07455EC` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:724` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:918aa1883a8a9dd5` | `FP-UI-A1EFB9E4BA00` | ui | `src/components/settings/AIConfigPanel.tsx:387` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:91bf6b541062cad2` | `FP-UI-20D9524A084E` | ui | `src/components/outline/OutlineChapterTree.tsx:124` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:92117873fd5632ac` | `FP-UI-6A4F2526A9F7` | ui | `src/components/editor/FloatingToolbar.tsx:86` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9226dbf56ffccb65` | `FP-UI-A8848B67AD25` | ui | `src/components/outline/OutlineVolumeDetail.tsx:138` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:922db6d3b1527d19` | `FP-UI-5E5536366799` | ui | `src/components/worldview/WorldRulesPanel.tsx:467` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9243b6c5b186d4b5` | `FP-UI-9D453F3DE1D8` | ui | `src/components/outline/OutlineGenerationResultPanel.tsx:80` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:924f78fcf4e840be` | `FP-UI-D9947C840034` | ui | `src/components/editor/NotePanel.tsx:102` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:926bff4e050551f4` | `FP-UI-E62FE1630262` | ui | `src/components/project/AnalysisReportViewer.tsx:327` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9273d0fc4a93e474` | `FP-UI-F280C43D72C4` | ui | `src/components/editor/ChapterEditor.tsx:1827` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:92b5e5e8436aab18` | `FP-UI-A999677A7E01` | ui | `src/components/settings/prompt/PromptWorkflowsPanel.tsx:144` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9326ab570aac0cbf` | `FP-UI-AE6F2ADCB616` | ui | `src/components/project/InspirationPanel.tsx:386` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:93429fea45e9cd1c` | `FP-UI-33EA5D9EBBD7` | ui | `src/components/character/CharacterMinorPanel.tsx:71` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:935ff1072e78b16e` | `FP-UI-0A2CFFBA20EA` | ui | `src/components/outline/OutlineVolumeSidebar.tsx:127` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:939a48e386ac5b9a` | `FP-UI-CD47A3DA0D22` | ui | `src/components/outline/DetailedOutlinePanel.tsx:544` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:93b8b18668ecf47a` | `FP-UI-0A5D4875B9A1` | ui | `src/components/outline/OutlinePanel.tsx:411` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9435786b9222263b` | `FP-UI-D9DC73790695` | ui | `src/components/shared/InlineEdit.tsx:125` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9437f91a442141b2` | `FP-UI-FC034ACDCA22` | ui | `src/components/editor/ChapterEditor.tsx:1736` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:94bb1b3fb96df091` | `FP-UI-2C383F98B76B` | ui | `src/components/character/CharacterMinorPanel.tsx:78` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:94c502aedd093458` | `FP-UI-A92B0CE15553` | ui | `src/components/outline/OutlineStructureMenu.tsx:19` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:94d41a611d82c516` | `FP-UI-456C19300DCE` | ui | `src/components/items/InventoryPanel.tsx:169` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:95113016bfb947c9` | `FP-UI-EA4C82CB8137` | ui | `src/components/relations/CharacterRelationPanel.tsx:486` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:951f426a28024685` | `FP-UI-0542120879DE` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:795` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9527a2f95c096919` | `FP-UI-489B9236E02C` | ui | `src/components/outline/DetailedOutlinePanel.tsx:411` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:953651102b816f6e` | `FP-UI-949A54970FEE` | ui | `src/components/geography/WorldMapVoronoi.tsx:369` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:95d36df463207f37` | `FP-UI-7B46D1EA1BE4` | ui | `src/components/worldview/StoryCorePanel.tsx:241` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:95e26bec7a007336` | `FP-UI-11F29C9B8557` | ui | `src/components/items/InventoryPanel.tsx:289` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9637bcbd202115f9` | `FP-UI-6890361E467A` | ui | `src/components/worldview/WorldRulesPanel.tsx:413` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9643e98b49a022a3` | `FP-UI-D5ABD2201803` | ui | `src/components/outline/ScenePanel.tsx:193` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9665a21da3056e18` | `FP-UI-35269CD76208` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:231` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:969038984efac1ea` | `FP-UI-1E3E0B1A425D` | ui | `src/components/history/HistoryTimelineEventCard.tsx:291` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9697e8610bdd2ad5` | `FP-UI-89E259D968C6` | ui | `src/pages/SettingsRoutePage.tsx:14` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:96e612c99c2a70d0` | `FP-UI-DA710342F1AE` | ui | `src/components/shared/PromptRunPanel.tsx:159` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9714ba8fca666719` | `FP-UI-3B7BD3690DB8` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:103` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:972a1a767f967f47` | `FP-UI-462E9F2C9032` | ui | `src/components/editor/RichEditor.tsx:1029` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:97325642dd9760b6` | `FP-UI-C6FE37E0B7ED` | ui | `src/components/editor/RichEditor.tsx:900` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:97740bc2b888e2dc` | `FP-UI-4CE755E186E1` | ui | `src/components/outline/OutlineGenerationRequestPanel.tsx:52` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:97808d6055482d69` | `FP-UI-528914F95028` | ui | `src/components/history/HistoryTimelineEventCard.tsx:272` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:978edfbfce632b85` | `FP-UI-4C3D6F808089` | ui | `src/components/outline/OutlineVolumeDetail.tsx:230` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:97a2cb5043bc01a5` | `FP-UI-9436CE1260AE` | ui | `src/components/system/VersionHistoryPanel.tsx:85` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:97a94a004b2f6bb8` | `FP-UI-6BEC9526F144` | ui | `src/pages/HomePage.tsx:392` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:97c41f9a400142e7` | `FP-UI-4ADA4501ECB8` | ui | `src/components/shared/InlineEdit.tsx:122` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:97f72b95db7a1cad` | `FP-UI-D92634B8AA9A` | ui | `src/components/editor/ChapterEditor.tsx:1577` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:97fff26d5952c649` | `FP-UI-8FE1BECBB8FE` | ui | `src/pages/HomePage.tsx:350` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9802ad2f08aef4dc` | `FP-UI-FB7E6B41EE29` | ui | `src/components/worldview/StoryCorePanel.tsx:230` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9830267571b86219` | `FP-UI-817E57F84F45` | ui | `src/components/data/CloudBackupCard.tsx:194` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:996dc950ecfc1861` | `FP-UI-16C747DFF67E` | ui | `src/components/project/InspirationPanel.tsx:627` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:99b7b8f4d78595e8` | `FP-UI-C9358AB6D249` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:543` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:99ef4631fc0f8df6` | `FP-UI-7DD1DE39F49E` | ui | `src/components/character/CharacterPanel.tsx:300` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9a5c88695e0c7565` | `FP-UI-D2A7143F523A` | ui | `src/components/history/HistoryPanel.tsx:324` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9a87ee5798863f99` | `FP-UI-EA311377D510` | ui | `src/components/world-group/WorldGroupSwitcher.tsx:45` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9a9e6b3bdfed3fce` | `FP-UI-DD8628FB887E` | ui | `src/components/geography/GeographyPanel.tsx:162` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9ab043b44d0a16d6` | `FP-UI-10A1E6ABB161` | ui | `src/components/settings/prompt/PromptWorkflowsPanel.tsx:109` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9ac599dc3034ed90` | `FP-UI-38C60847039F` | ui | `src/components/character/CharacterPanel.tsx:577` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9ad5ad8812e6b0ec` | `FP-UI-9623D64BEC52` | ui | `src/components/character/CharacterPanel.tsx:331` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9adae6677463631a` | `FP-UI-2C76DD7A33B3` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:794` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9af0bb5d40f5362d` | `FP-UI-8F6AB220E5BE` | ui | `src/components/outline/OutlineChapterTree.tsx:267` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9b0fc3bbc1cc76eb` | `FP-UI-8B5BA052CD36` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:428` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9b1e42e224dec30e` | `FP-UI-EA076FEDF5AD` | ui | `src/components/project/InspirationPanel.tsx:597` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9b46e74ab61dfdc1` | `FP-UI-5E0F0E32F9DF` | ui | `src/components/character/CharacterSupplementAction.tsx:118` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9b7c6ac061a2ac02` | `FP-UI-0AFE989D8258` | ui | `src/components/location/LocationTagPicker.tsx:75` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9b8ad77ea954e369` | `FP-UI-7817895EA38E` | ui | `src/components/outline/OutlineChapterTree.tsx:98` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9b9ccf0553726bf9` | `FP-UI-464AE0027B77` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:725` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9c37a3bd120c1431` | `FP-UI-4D88DE60F1CD` | ui | `src/components/worldview/PowerSystemPanel.tsx:47` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9c45d25fffe1c9d5` | `FP-UI-92B4EBAB82EE` | ui | `src/components/editor/RichEditor.tsx:879` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9c9145de121e35eb` | `FP-UI-CD79DA7BE815` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:386` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9c91eb01f052aee3` | `FP-UI-84804E60B72E` | ui | `src/components/codex/CodexSearchBar.tsx:63` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9d16f60e8440a98f` | `FP-UI-62A8643B12D0` | ui | `src/components/settings/AIConfigPanel.tsx:680` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9d3a75eccc6845ef` | `FP-UI-E9ABA607D63C` | ui | `src/components/character/CharacterPanel.tsx:174` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9d9352624121fe7c` | `FP-UI-3785CFAAC8FB` | ui | `src/components/settings/AIConfigPanel.tsx:567` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9db5c3c2d0cb7a8b` | `FP-UI-7E241F275F04` | ui | `src/components/worldview/WorldRulesPanel.tsx:393` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9dd882eeaab22c3a` | `FP-UI-CBBA03B2F3D9` | ui | `src/components/shared/InlineEdit.tsx:124` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9de7b04dcf741ba2` | `FP-UI-134ADA37663B` | ui | `src/components/facts/FactLibraryPanel.tsx:101` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9e3c617854e5e294` | `FP-UI-E849EB349B8F` | ui | `src/components/worldview/WorldRulesPanel.tsx:365` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9e5a3c0ceb5cc9fe` | `FP-UI-A721E77C2E86` | ui | `src/components/rules/CreativeRulesPanel.tsx:259` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9e68481a7f17e725` | `FP-UI-49C5DB5DBB0D` | ui | `src/components/state/StateDiffModal.tsx:45` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9e9790aa545fe0a2` | `FP-UI-04DFA688B073` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:666` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9ef74f9151219183` | `FP-UI-11268EDDA4FF` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:347` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9f15dba33745eda2` | `FP-UI-AAD4E9B0C325` | ui | `src/components/guide/WelcomeGuide.tsx:111` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9f1aab1d119ac0f1` | `FP-UI-21D3029DD531` | ui | `src/components/history/HistoryKeywordCard.tsx:222` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9f5e7a01001361a5` | `FP-UI-F174498E5578` | ui | `src/components/editor/RichEditor.tsx:965` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9fddefe168817b4d` | `FP-UI-0B60CDB8CF66` | ui | `src/components/editor/ComparePolishPanel.tsx:126` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9fe056190e4c422f` | `FP-UI-4E4FA539B9F4` | ui | `src/components/system/ImportDocPanel.tsx:497` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:9ffc23a4be13ef33` | `FP-UI-4F8CEAE57426` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:317` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a04e3b0ab1065dbd` | `FP-UI-AABC50CB0B17` | ui | `src/components/settings/AIConfigPanel.tsx:304` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a06e9ef700ef5166` | `FP-UI-D25F7CF0D6DD` | ui | `src/components/project/ProjectInfoPanel.tsx:133` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a0730b9a8a910abf` | `FP-UI-57F063AA256F` | ui | `src/components/editor/ChapterCandidateReview.tsx:142` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a0a0dc1de1786c6a` | `FP-UI-8ABC1D8AC133` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:174` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a0d9766ee953bd29` | `FP-UI-3432E5B57444` | ui | `src/components/outline/OutlinePanel.tsx:452` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a100299d85265a5f` | `FP-UI-9BDF505BCF47` | ui | `src/components/outline/OutlineChapterTree.tsx:75` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a1321a5ead231ca3` | `FP-UI-270ED77E6280` | ui | `src/components/location/LocationTreeView.tsx:153` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a17e06b2d9a495a8` | `FP-UI-CCDFEAC9DBBB` | ui | `src/components/outline/OutlineChapterTree.tsx:82` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a1c49c48c0db99fa` | `FP-UI-3D33DCBF4B42` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:378` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a1d2c70273f98824` | `FP-UI-B982CAD03F92` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:360` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a20dc5022d519205` | `FP-UI-D77794D2FDA3` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:153` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a217db4b61c26cb0` | `FP-UI-FCAEA3AC9BDB` | ui | `src/components/character/CharacterDimensionFields.tsx:82` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a220073a7a1e3d08` | `FP-UI-0FC80E78B9FA` | ui | `src/components/codex/CodexPanel.tsx:706` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a2249114f10d5218` | `FP-UI-1D4896187F8B` | ui | `src/components/history/HistoryTimelineEventCard.tsx:123` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a226931871e3fab5` | `FP-UI-924D43071AE2` | ui | `src/components/shared/AIStreamOutput.tsx:247` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a2667806e94c5ca0` | `FP-UI-137D6B815B19` | ui | `src/components/outline/DetailedOutlinePanel.tsx:400` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a270f3b2ae7079cc` | `FP-UI-655A5E111476` | ui | `src/components/history/HistoryTimelineEventCard.tsx:167` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a278346341e86e8d` | `FP-UI-E96C96A62CB0` | ui | `src/components/editor/FindReplacePanel.tsx:283` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a2c5e8e9654ccc9f` | `FP-UI-F8C1601CFCA9` | ui | `src/components/settings/SettingsPage.tsx:47` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a2f097e48065ea65` | `FP-UI-3AA84CDDFB61` | ui | `src/components/history/HistoryPanel.tsx:460` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a3421897a5221225` | `FP-UI-A09B020FF3AA` | ui | `src/components/project/InspirationPanel.tsx:484` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a3884142c1b0c371` | `FP-UI-9854D26CC942` | ui | `src/components/character/CharacterAxesPicker.tsx:39` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a3bc611e738140cf` | `FP-UI-EA37E0444639` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:344` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a3d762aaf0bd5211` | `FP-UI-31E407F7F325` | ui | `src/components/migration/FirstRunMigration.tsx:215` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a3eb8394e753a476` | `FP-UI-113F5F2AB8E1` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:642` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a3f0d9281ed7296f` | `FP-UI-DFEDFF1B8274` | ui | `src/components/editor/ComparePolishPanel.tsx:144` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a3f54dbab887d864` | `FP-UI-60CF421F04F5` | ui | `src/components/system/import/ImportReportModal.tsx:166` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a40f0600d9611997` | `FP-UI-0144EAB626F5` | ui | `src/components/world-group/WorldGroupOverview.tsx:334` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a432828b80d690b3` | `FP-UI-266B62641C55` | ui | `src/components/world-group/WorldGroupOverview.tsx:171` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a43efb3a1076ed8e` | `FP-UI-CA0B933A4EBD` | ui | `src/components/character/CharacterPanel.tsx:238` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a443d7ad7c14e9d2` | `FP-UI-3809C063803E` | ui | `src/components/outline/OutlineChapterTree.tsx:269` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a497a87a9719e372` | `FP-UI-C8C97B1FA4E8` | ui | `src/components/project/AnalysisReportViewer.tsx:400` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a4b40c71dea2dedf` | `FP-UI-A803D38FC6E3` | ui | `src/components/project/AnalysisReportViewer.tsx:237` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a4d7c4f5c91b2b34` | `FP-UI-EAC775F8783B` | ui | `src/components/system/ImportDocPanel.tsx:489` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a55f6653498ef236` | `FP-UI-C876B3CF6A66` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:820` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a56407813378aea5` | `FP-UI-BBE3A8DECFAE` | ui | `src/components/world-group/WorldGroupDetail.tsx:174` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a5c782a9900aecc8` | `FP-UI-6F4E288ED158` | ui | `src/components/data/DataManagementPanel.tsx:67` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a5d551338df60f0e` | `FP-UI-F39EDB9BD636` | ui | `src/components/facts/FactLibraryPanel.tsx:105` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a5e6f47d7e5b6292` | `FP-UI-C8498BC943F6` | ui | `src/components/project/ReferencePanel.tsx:303` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a5eab3797584886d` | `FP-UI-B0733EE9DDF7` | ui | `src/components/outline/OutlineChapterTree.tsx:222` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a601d2f7855e0c58` | `FP-UI-7F4448FA572E` | ui | `src/components/worldview/StoryCorePanel.tsx:201` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a63bb41adb7c8d42` | `FP-UI-743B73B0035B` | ui | `src/components/world-group/WorldGroupOverview.tsx:325` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a69165d4b6fd7897` | `FP-UI-3AA943829DFB` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:523` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a6ad5a60e32b11c0` | `FP-UI-DB05A201DA57` | ui | `src/components/outline/ScenePanel.tsx:171` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a6c460ef65f26f0f` | `FP-UI-61209DA083C0` | ui | `src/components/editor/ChapterEditor.tsx:1511` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a6ce7b54c90a4532` | `FP-UI-EA205C0A690B` | ui | `src/components/outline/OutlineVolumeDetail.tsx:232` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a6ded61dee89f0b5` | `FP-UI-9038A15B19C7` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:358` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a6f91522b4b6fe65` | `FP-UI-4608A9B5D036` | ui | `src/components/editor/ChapterEditor.tsx:1646` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a715ea176279fd74` | `FP-UI-ABD2824CDE0D` | ui | `src/components/state/StatePanel.tsx:228` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a73a0d959251c211` | `FP-UI-A4194926C77D` | ui | `src/components/rules/CreativeRulesPanel.tsx:169` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a7407acd24345a1f` | `FP-UI-B60A2A25B6BC` | ui | `src/components/system/import/ImportConfirmModal.tsx:164` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a7c3fbf22295bc2f` | `FP-UI-8C2AF4F8A5B7` | ui | `src/components/outline/OutlineChapterTree.tsx:254` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a7e53a796f06af7b` | `FP-UI-1A6E37109CC5` | ui | `src/components/project/AnalysisReportViewer.tsx:266` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a7f4482cb0c15884` | `FP-UI-E4B04065C617` | ui | `src/components/system/import/ImportUnfinishedBanner.tsx:82` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a85498e21108f8dd` | `FP-UI-BBFF090223C0` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:189` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a8e8abea35e8d254` | `FP-UI-EDD329F85718` | ui | `src/components/location/LocationTagPicker.tsx:54` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a90d610103c3b7a1` | `FP-UI-C506BA1AEB4A` | ui | `src/components/state/StateDiffModal.tsx:79` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a95374e6edeea789` | `FP-UI-B52906CE4872` | ui | `src/components/shared/InlineEdit.tsx:118` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a9737da6401e196a` | `FP-UI-BAE460A77293` | ui | `src/components/project/ReferencePanel.tsx:700` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a98761af070729c1` | `FP-UI-5B40B7469E46` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:277` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:a9e48a55de736b61` | `FP-UI-AC90A1339717` | ui | `src/components/outline/ScenePanel.tsx:227` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:aa33b19316ffeec8` | `FP-UI-648C6EF8F425` | ui | `src/components/settings/AIConfigPanel.tsx:488` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:aa658b12f211b4da` | `FP-UI-6901601244F2` | ui | `src/components/codex/CodexPanel.tsx:301` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:aa826f2ba9f2f505` | `FP-UI-03ED737FF497` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:107` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:aaab717e4c89e736` | `FP-UI-BD98351C8957` | ui | `src/components/settings/AIConfigPanel.tsx:673` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:aad2c6b5b820ba28` | `FP-UI-39B3B1E4A848` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:726` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ab05dab8b1570857` | `FP-UI-45D0E6C2EDD9` | ui | `src/components/geography/WorldTreeSidebar.tsx:103` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ab391756a179a28e` | `FP-UI-E497DE3CB347` | ui | `src/components/project/ProjectInfoPanel.tsx:105` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ab93daad887e90b3` | `FP-UI-E7F6F9A1389D` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:134` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:abaf7ab59db00a0c` | `FP-UI-9CA99E9FCEFA` | ui | `src/components/geography/WorldTreeSidebar.tsx:197` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:abb011037de1555c` | `FP-UI-B6E10ABCE49A` | ui | `src/components/outline/OutlinePanel.tsx:470` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:abe7bc32241d4af6` | `FP-UI-27E70C7D1A3B` | ui | `src/components/geography/GeographyPanel.tsx:361` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:abf706e71f543693` | `FP-UI-08E536CD877F` | ui | `src/components/shared/ExtractionReviewPanel.tsx:59` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ac40e319e7659840` | `FP-UI-6D764CF5DF68` | ui | `src/components/editor/ChapterCandidateReview.tsx:144` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ac592ca00067f71d` | `FP-UI-17E528986633` | ui | `src/components/character/CharacterSupplementAction.tsx:108` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ac5ce907023d291e` | `FP-UI-827AF71F42ED` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:170` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ac71fb883da8165f` | `FP-UI-9A5FBF89D7CD` | ui | `src/components/shared/Dialog.tsx:150` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ac78e83ca9dfece6` | `FP-UI-7DBE81D23729` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:822` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ac8bdf99d318cc16` | `FP-UI-F0BE8695F0D4` | ui | `src/components/world-group/WorldGroupDetail.tsx:136` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ac92237449991ca9` | `FP-UI-FD14A3B4BE1C` | ui | `src/components/editor/FindReplacePanel.tsx:242` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ac9df65c4fe9f4c4` | `FP-UI-281386EF7528` | ui | `src/components/geography/WorldTreeSidebar.tsx:221` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:acabee83cbeb6934` | `FP-UI-A2D7C049BA96` | ui | `src/components/outline/OutlineChapterTree.tsx:223` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:acb0e909b974f6e6` | `FP-UI-5FF714CF14F9` | ui | `src/components/outline/OutlineChapterTree.tsx:265` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:acca2218f2de7415` | `FP-UI-96AC5744CB36` | ui | `src/components/project/ReferencePanel.tsx:315` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:acca995defe95e80` | `FP-UI-7B8381B0F39E` | ui | `src/components/outline/OutlinePanel.tsx:451` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:acf6ddbff4356f93` | `FP-UI-4AB22FF4DF07` | ui | `src/components/data/DataManagementPanel.tsx:294` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ad003a5225a0e444` | `FP-UI-81833A414214` | ui | `src/components/shared/CompositionInput.tsx:74` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ad992ecd09b63958` | `FP-UI-B7FB296F27D5` | ui | `src/components/outline/OutlinePanel.tsx:406` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ada6fdf4c649e426` | `FP-UI-92D891F9955A` | ui | `src/components/history/HistoryPanel.tsx:391` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ada8224247b5223c` | `FP-UI-7AC5F25EDA55` | ui | `src/components/outline/DetailedOutlinePanel.tsx:471` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:adc0ba1e7fcb8c6c` | `FP-UI-C84D4F29CE9C` | ui | `src/components/shared/InlineEdit.tsx:59` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:adcf7c3b5746fbfc` | `FP-UI-5B55A8A4DEA7` | ui | `src/components/shared/InlineEdit.tsx:117` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ae1be475cce41c6c` | `FP-UI-A95E7CB964C8` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:322` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ae2be002f78b28f7` | `FP-UI-382BFFC74F86` | ui | `src/components/history/HistoryAgentWorkspace.tsx:143` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:aede23379d6e1800` | `FP-UI-50428628FC9C` | ui | `src/components/history/HistoryTimelineEventCard.tsx:217` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:af2b943b75083fab` | `FP-UI-73C3998248F2` | ui | `src/pages/HomePage.tsx:371` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:af2cd0a58b51bc17` | `FP-UI-2647C1C9AC9A` | ui | `src/components/character/CharacterPanel.tsx:250` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:afb96630b94b8166` | `FP-UI-ADCCE59CCED1` | ui | `src/components/outline/OutlinePanel.tsx:469` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:afe45f85741db9e9` | `FP-UI-056136EF2813` | ui | `src/components/character/CharacterPanel.tsx:185` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:afe64372a56c4050` | `FP-UI-E8DAD8002C8A` | ui | `src/components/system/import/ImportReportModal.tsx:174` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:afe94f3869fe364f` | `FP-UI-5EB2229D872C` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:301` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:afef3d9ddc42a0cf` | `FP-UI-EC1B0BF8E25E` | ui | `src/components/history/HistoryTimelineEventCard.tsx:292` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:aff07beb2e66b979` | `FP-UI-15A2756A6DA3` | ui | `src/components/state/StatePanel.tsx:138` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b081f2a2d933cfa1` | `FP-UI-E454BFB9EDFB` | ui | `src/components/world-group/WorldGroupDetail.tsx:189` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b0aaaa71722b386e` | `FP-UI-121D839A3AA7` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:353` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b0d5062a4b6e6b0b` | `FP-UI-D93301B0E767` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:193` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b10bc61f3dcce7dc` | `FP-UI-E9ED6597A42C` | ui | `src/components/outline/OutlinePanel.tsx:450` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b13cb2572bd4ffc8` | `FP-UI-174F58BB2D04` | ui | `src/components/worldview/WorldRulesPanel.tsx:590` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b153abd680ca9618` | `FP-UI-FC9032305341` | ui | `src/components/settings/prompt/PromptWorkflowsPanel.tsx:138` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b15fea12282dd35e` | `FP-UI-1D3618FD7921` | ui | `src/components/history/HistoryPanel.tsx:365` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b163ef4e3b770bc2` | `FP-UI-6C621A9CBCE4` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:451` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b1bb558c8a1844b6` | `FP-UI-D6403A692BB9` | ui | `src/components/settings/prompt/PromptManagerPanel.tsx:216` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b242af603714311d` | `FP-UI-99630997EDB4` | ui | `src/components/shared/ErrorBoundary.tsx:46` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b25ed6974fe17284` | `FP-UI-46520D9282F8` | ui | `src/components/items/InventoryPanel.tsx:292` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b281172cd2fb3b9c` | `FP-UI-E269999E8C3B` | ui | `src/components/character/CharacterPanel.tsx:467` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b2a3859d6f5b2a73` | `FP-UI-973DF6745E78` | ui | `src/components/codex/CodexPanel.tsx:730` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b2c49efda0a63a13` | `FP-UI-39E2FD3C81C3` | ui | `src/components/editor/FindReplacePanel.tsx:264` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b2c769704ad53d81` | `FP-UI-66A8A7BCAD8D` | ui | `src/components/timeline/StoryTimelinePanel.tsx:221` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b2c93e7e403d855b` | `FP-UI-2A92C3814E1E` | ui | `src/components/world-group/WorldGroupOverview.tsx:383` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b2e83fbc73f9b356` | `FP-UI-3121752A9A9D` | ui | `src/components/outline/OutlinePanel.tsx:486` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b2ec03775219b8c8` | `FP-UI-41AE9FF52D68` | ui | `src/components/history/HistoryPanel.tsx:360` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b314ce245cf9d79f` | `FP-UI-31EC7B4A71A5` | ui | `src/components/character/CharacterSupplementAction.tsx:114` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b3d73660e9296f7f` | `FP-UI-361EDC06692A` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:459` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b486769981f05fff` | `FP-UI-72A95A5B3386` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:720` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b496aa244c47c1b6` | `FP-UI-9A3EB8FCADE2` | ui | `src/components/editor/ChapterEditor.tsx:1606` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b4ba9f871fbd4b23` | `FP-UI-0FA3553F5989` | ui | `src/components/editor/ChapterEditorHeader.tsx:86` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b502b17924517a5d` | `FP-UI-F1CC1EEAC879` | ui | `src/components/settings/EmbeddingConfigCard.tsx:136` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b50d03e889917343` | `FP-UI-D53152F0A2AC` | ui | `src/components/settings/prompt/PromptWorkflowsPanel.tsx:132` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b5578b66cdb78ca5` | `FP-UI-DC97572FCC93` | ui | `src/components/codex/CodexPanel.tsx:333` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b5f4b40620e18cdc` | `FP-UI-FD575268AD17` | ui | `src/components/character/CharacterMinorPanel.tsx:47` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b5f9a9531ca0aa8e` | `FP-UI-9A43336980E4` | ui | `src/components/editor/EmotionBeatCard.tsx:199` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b6026de510948d65` | `FP-UI-E6D1D5676194` | ui | `src/components/codex/CodexPanel.tsx:392` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b68493b855a6d52c` | `FP-UI-6C966C353C0C` | ui | `src/components/worldview/StoryCorePanel.tsx:138` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b69b58b607a40f58` | `FP-UI-72A113E565C7` | ui | `src/components/codex/CodexPanel.tsx:811` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b69e7d5f53a5ae6b` | `FP-UI-4D2421A3CC61` | ui | `src/components/project/ReferencePanel.tsx:284` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b71fd61ef10b53e7` | `FP-UI-33338D7C481C` | ui | `src/components/outline/ScenePanel.tsx:140` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b750e3554beea073` | `FP-UI-E07F39B9087F` | ui | `src/components/editor/FloatingToolbar.tsx:57` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b779ed021d46c5a3` | `FP-UI-A80DB2A51560` | ui | `src/components/outline/DetailedOutlinePanel.tsx:424` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b780dc8eff0061a2` | `FP-UI-22FF807D4AE3` | ui | `src/components/rules/CreativeRulesPanel.tsx:168` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b7f4792a67f67447` | `FP-UI-93060177434F` | ui | `src/components/outline/OutlineGenerationResultPanel.tsx:69` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b865ba9a625a5320` | `FP-UI-A796F900DAAD` | ui | `src/components/rules/CreativeRulesPanel.tsx:360` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b8de533d5773178a` | `FP-UI-96A081CA28FD` | ui | `src/components/world-group/WorldGroupOverview.tsx:272` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b8eb058072e628b0` | `FP-UI-489DCDC1AA1C` | ui | `src/components/character/CharacterPanel.tsx:588` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b96e84518b358f2a` | `FP-UI-4A6E368040D8` | ui | `src/components/geography/WorldTreeSidebar.tsx:125` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b9b0fa099bc8ea79` | `FP-UI-9F41E4248D08` | ui | `src/components/editor/FloatingToolbar.tsx:61` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b9d0be6e2683bb0b` | `FP-UI-6BE2468B1235` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:499` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b9ebd9d68341c2b5` | `FP-UI-BB6689D4DA58` | ui | `src/components/guide/WelcomeGuide.tsx:178` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:b9ee463e59cca489` | `FP-UI-BD3EACDDDF2E` | ui | `src/components/character/CharacterExtraPanel.tsx:148` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ba1d1859b959178d` | `FP-UI-35988EDA73ED` | ui | `src/components/outline/DetailedOutlinePanel.tsx:438` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ba8391b17f4893fa` | `FP-UI-DEBE7B5E5645` | ui | `src/components/geography/GeographyPanel.tsx:226` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ba8b3979b46530f4` | `FP-UI-2DD0D6E322FA` | ui | `src/components/project/ProjectInfoPanel.tsx:155` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:baa2ed4e46e6d37a` | `FP-UI-ABB2400ADA26` | ui | `src/components/outline/StoryArcPanel.tsx:205` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:babaea78de9de080` | `FP-UI-53B69BDE1CDC` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:301` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bac8eb8ee01ed250` | `FP-UI-80A346087611` | ui | `src/components/settings/AIConfigPanel.tsx:595` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bb01844d7fe0f060` | `FP-UI-0DDE39B410AA` | ui | `src/components/outline/OutlineVolumeSidebar.tsx:73` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bb13333063449e2b` | `FP-UI-A6690F7A1351` | ui | `src/components/relations/CharacterRelationPanel.tsx:430` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bb421b8b95da726c` | `FP-UI-92977E31DC59` | ui | `src/components/history/HistoryPanel.tsx:469` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bb8d6704ee62c812` | `FP-UI-D7DC70AF46E2` | ui | `src/components/editor/ChapterEditor.tsx:1825` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bc59ee13c80e4453` | `FP-UI-0F20C3912231` | ui | `src/components/relations/RelationGraph.tsx:153` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bd9f3218c593042a` | `FP-UI-52954725FFA9` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:821` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bdc6b16a4b3c9f54` | `FP-UI-4D20CB5642B3` | ui | `src/components/outline/OutlineVolumeDetail.tsx:271` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bdf9b7d8489d0400` | `FP-UI-37A2AE7551DE` | ui | `src/components/items/InventoryPanel.tsx:163` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:be4b0f17dc11fdad` | `FP-UI-3C3ABFC70933` | ui | `src/components/settings/AIConfigPanel.tsx:308` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:be6994d4d9eb9e40` | `FP-UI-4335BA4D3B79` | ui | `src/components/data/DataManagementPanel.tsx:283` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bea93a20e11801d1` | `FP-UI-9D0D8804AAC5` | ui | `src/components/outline/OutlineVolumeDetail.tsx:240` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bebd17fab1058711` | `FP-UI-A74EFBA5262D` | ui | `src/components/editor/ChapterEditor.tsx:1729` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bec9ff8d2af53bf2` | `FP-UI-36CC3D98AD8C` | ui | `src/components/outline/DetailedOutlinePanel.tsx:571` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bee1d5bcf2ead1f2` | `FP-UI-22AA4470B3C9` | ui | `src/pages/WorkspacePage.tsx:231` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bee7b707cecf7796` | `FP-UI-4159B45A5921` | ui | `src/components/project/ReferencePanel.tsx:619` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bef82d9a87d5532c` | `FP-UI-25D7CC2A4316` | ui | `src/components/outline/ScenePanel.tsx:235` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bfac5ab6cb6b22af` | `FP-UI-87CBCC6C3CDB` | ui | `src/components/outline/OutlinePreviewPanel.tsx:23` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:bfd57dba58ccd72e` | `FP-UI-797BE6DF25F6` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:346` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c002fc6466b55a36` | `FP-UI-2DBBC794C5B2` | ui | `src/components/editor/ChapterEditor.tsx:1558` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c0147f638d56cf89` | `FP-UI-F75BE8EEE415` | ui | `src/components/editor/ReviewPanel.tsx:188` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c0c5e4c9f540e493` | `FP-UI-45C9FF55776F` | ui | `src/components/outline/OutlineVolumeDetail.tsx:121` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c0e4e5cf715fed97` | `FP-UI-B265E4903E30` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:159` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c1620e282a44e88b` | `FP-UI-030FBCBD893D` | ui | `src/components/editor/ChapterEditor.tsx:1757` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c198e8632db5d241` | `FP-UI-90C8628A5D2C` | ui | `src/components/outline/DetailedOutlinePanel.tsx:473` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c1b1eae540b30a7c` | `FP-UI-9BF5FFDB4C5C` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:339` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c1d2ff448feda0c1` | `FP-UI-5CEB6906AFB1` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:737` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c1de3647a1e9b218` | `FP-UI-ED41CEE28677` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:326` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c2342d08bac95813` | `FP-UI-967E5124F680` | ui | `src/components/outline/OutlineVolumeDetail.tsx:267` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c2438e929e3da278` | `FP-UI-CE0E578ABACB` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:662` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c2743fd8ac37bfc8` | `FP-UI-6A835627293F` | ui | `src/components/worldview/StoryCorePanel.tsx:209` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c31f966be19faa87` | `FP-UI-645083AE9B88` | ui | `src/components/character/CharacterDimensionFields.tsx:115` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c3306248fcee8714` | `FP-UI-D712118D9496` | ui | `src/components/world-group/WorldGroupOverview.tsx:186` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c34ba477cfdb9580` | `FP-UI-730D7F194E24` | ui | `src/components/editor/ChapterCandidateReview.tsx:146` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c3e34e4838b0b626` | `FP-UI-69AB36C80F20` | ui | `src/components/location/LocationPanel.tsx:381` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c425c308bb53bfc5` | `FP-UI-2C3D2F5B4B84` | ui | `src/components/outline/StoryArcPanel.tsx:437` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c44f3715259005f2` | `FP-UI-53D0EB2B69EF` | ui | `src/components/geography/WorldMapVoronoi.tsx:361` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c496afdf95031b0b` | `FP-UI-5FD1D78F3408` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:133` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c4f099bc8ff1b0e2` | `FP-UI-A0829F43BAA2` | ui | `src/components/history/HistoryPanel.tsx:361` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c5559c87e58dd358` | `FP-UI-D74499E2AEE0` | ui | `src/components/worldview/WorldRulesPanel.tsx:398` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c5687365aaabc70d` | `FP-UI-0C64A0574004` | ui | `src/components/settings/AIConfigPanel.tsx:791` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c5843866900e567a` | `FP-UI-7AFF3F6C087F` | ui | `src/components/foreshadow/ForeshadowKanban.tsx:99` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c5bb6a8c9ea9beeb` | `FP-UI-5CCD4D0E1928` | ui | `src/components/shared/Toast.tsx:96` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c5f6ec74dfe7710b` | `FP-UI-03DCD76E46E1` | ui | `src/components/outline/DetailedOutlinePanel.tsx:534` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c63bbf4f6c7ab50b` | `FP-UI-A7497FF18274` | ui | `src/components/editor/FindReplacePanel.tsx:272` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c64e1d450173fd5c` | `FP-UI-149033EFB85D` | ui | `src/components/outline/OutlinePanel.tsx:471` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c6618f5ce9b3fef6` | `FP-UI-406CCD0209BA` | ui | `src/components/outline/StoryArcPanel.tsx:424` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c663a78b481d1ae1` | `FP-UI-2E3EF8B28D07` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:185` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c690b8653a018d65` | `FP-UI-ED04687CA0FE` | ui | `src/components/outline/OutlineVolumeDetail.tsx:99` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c75c6189842cc0c6` | `FP-UI-D817FEE698CE` | ui | `src/components/codex/CodexPanel.tsx:538` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c770fa07074479b6` | `FP-UI-664BE0566F4E` | ui | `src/components/settings/AIConfigPanel.tsx:303` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c7898cd36d6668fe` | `FP-UI-4079042F273C` | ui | `src/components/project/InspirationPanel.tsx:434` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c7ad965ae1dba572` | `FP-UI-8EA4D420F468` | ui | `src/pages/HomePage.tsx:311` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c7c28e30a9d4cd22` | `FP-UI-B7097D6DC0E7` | ui | `src/components/editor/ChapterEditor.tsx:1755` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c7cdd8d09cfc043d` | `FP-UI-4E6377EFFD8D` | ui | `src/components/system/ImportDocPanel.tsx:594` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c818349810c2b67b` | `FP-UI-D1F5581781FF` | ui | `src/components/rules/CreativeRulesPanel.tsx:359` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c81cd4d68c79f060` | `FP-UI-F8D0A7DBD183` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:735` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c830b3ef5170de65` | `FP-UI-4A5FCB385CEE` | ui | `src/components/timeline/StoryTimelinePanel.tsx:147` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c83c8db705d5cd8d` | `FP-UI-7E902234ED97` | ui | `src/pages/HomePage.tsx:246` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c89c284d9ba6fb78` | `FP-UI-A9708FD5A447` | ui | `src/components/editor/NotePanel.tsx:45` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c8f3d9a35f363fa0` | `FP-UI-2E9B4F4D7771` | ui | `src/components/project/InspirationPanel.tsx:561` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c9270b12487de91e` | `FP-UI-6D1431235DE1` | ui | `src/components/history/HistoryKeywordCard.tsx:92` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c9333a6f35c838fc` | `FP-UI-64432F24F4F3` | ui | `src/components/settings/AIConfigPanel.tsx:292` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c94a7e714f500a22` | `FP-UI-DC38F469B6AE` | ui | `src/components/editor/ChapterEditor.tsx:1562` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c955d3e81c4877e1` | `FP-UI-E988B4BB810A` | ui | `src/components/character/CharacterDimensionPicker.tsx:42` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c9685799b551e4f0` | `FP-UI-EB40A0169CD0` | ui | `src/components/outline/OutlineStructureMenu.tsx:16` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c96a31f4354e686c` | `FP-UI-EB8DA4DDC137` | ui | `src/components/rules/CreativeRulesPanel.tsx:214` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c98d21ed1c1227d2` | `FP-UI-7F9C79CCE6CE` | ui | `src/components/codex/CodexPanel.tsx:566` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c9a8641e580be271` | `FP-UI-0504D636949D` | ui | `src/components/editor/ChapterEditor.tsx:1836` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c9b6c978edc721b5` | `FP-UI-8A97B360851B` | ui | `src/components/history/HistoryKeywordCard.tsx:151` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:c9cc00f869c6a92c` | `FP-UI-1E2171BCEEE4` | ui | `src/components/shared/ExtractionReviewPanel.tsx:50` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ca01c9b86709f630` | `FP-UI-08DF327A9D57` | ui | `src/components/shared/Toast.tsx:49` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ca1162476205ce8a` | `FP-UI-08308A8374A2` | ui | `src/components/project/AnalysisReportViewer.tsx:248` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ca370634be43fb2e` | `FP-UI-30933D1B0346` | ui | `src/components/outline/OutlineVolumeSidebar.tsx:176` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ca575d1afae571c9` | `FP-UI-1576B790F03E` | ui | `src/components/character/CharacterMinorPanel.tsx:100` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:caede152c356cabd` | `FP-UI-F0067F81E29C` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:467` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cb244f082102e7c5` | `FP-UI-066E02ECA14B` | ui | `src/components/system/ImportDocPanel.tsx:627` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cb400294d7875fbb` | `FP-UI-48589C1F38D7` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:372` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cb72e19f8e5faefb` | `FP-UI-984D4B3143CE` | ui | `src/components/system/import/ImportConfirmModal.tsx:257` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cb8d65f549c5728b` | `FP-UI-CCBF5FE8CC0B` | ui | `src/components/editor/ChapterEditor.tsx:1823` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cb9217b72f37f2c8` | `FP-UI-24D1369B40AC` | ui | `src/components/shared/ExtractionReviewPanel.tsx:24` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cbdbcad1649668b0` | `FP-UI-281FA53BE77E` | ui | `src/components/outline/OutlineGenerationRequestPanel.tsx:58` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cc10439ce2ce9f9b` | `FP-UI-FD0871AF63CC` | ui | `src/components/editor/ChaptersListPanel.tsx:247` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cc3cce8b5ebf52e6` | `FP-UI-97CEE1F18D48` | ui | `src/components/migration/FirstRunMigration.tsx:221` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cc910b8e156a1a56` | `FP-UI-86AC142AAA3F` | ui | `src/components/character/CharacterExtraPanel.tsx:114` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ccf3fe7038dc26eb` | `FP-UI-7427469B9141` | ui | `src/components/outline/OutlinePanel.tsx:484` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ccf90744b49a3cd9` | `FP-UI-1F0E85B6464B` | ui | `src/components/outline/OutlineVolumeSidebar.tsx:203` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ccfbb4356825a596` | `FP-UI-8CD5B23DD37F` | ui | `src/components/worldview/PowerSystemPanel.tsx:58` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cd57f19611b9ad7c` | `FP-UI-0C7715813F7D` | ui | `src/components/data/CloudBackupCard.tsx:101` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cd6643d773f6fca5` | `FP-UI-44AA3963CC2C` | ui | `src/components/settings/AIConfigPanel.tsx:342` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cd73b36bedefeefa` | `FP-UI-EA31BEBC399E` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:338` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cd8b350045c0dd3b` | `FP-UI-FA8B2A61CE3B` | ui | `src/components/geography/WorldTreeSidebar.tsx:96` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cdac1b41b8788bc8` | `FP-UI-FFBC5BC1C426` | ui | `src/components/history/HistoryPanel.tsx:230` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ce4b89606b165372` | `FP-UI-2B7A2AF552EF` | ui | `src/components/data/DataManagementPanel.tsx:247` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ce69c4e2568f2862` | `FP-UI-9262BDF5F16E` | ui | `src/components/history/HistoryPanel.tsx:355` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ce826063602b2ad0` | `FP-UI-F00B734548F4` | ui | `src/components/editor/ChapterContextPreview.tsx:72` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cf04c57b515cf323` | `FP-UI-6D1F21D03C1E` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:497` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cf1e8c5725e2b8da` | `FP-UI-654A762CF01C` | ui | `src/components/geography/WorldTreeSidebar.tsx:228` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cf25d2d4d572005d` | `FP-UI-D5B806D06667` | ui | `src/components/data/DataManagementPanel.tsx:306` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cf2b598d25fee4cf` | `FP-UI-755A6AA5A370` | ui | `src/components/character/CharacterPanel.tsx:198` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cf4796ec681f21a7` | `FP-UI-8AB327B8A366` | ui | `src/components/shared/CompositionInput.tsx:73` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cf6f910e4979c898` | `FP-UI-2A9F8DE00215` | ui | `src/components/geography/WorldMapVoronoi.tsx:412` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:cff8c7778b6e0c89` | `FP-UI-91920B808870` | ui | `src/components/system/ImportDocPanel.tsx:672` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d02a23f2ff7fa036` | `FP-UI-52832413A2FB` | ui | `src/components/outline/DetailedOutlinePanel.tsx:357` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d076376d61466ffb` | `FP-UI-0A1BC407086E` | ui | `src/components/relations/CharacterRelationPanel.tsx:399` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d0fb6af62fae6957` | `FP-UI-04A233E51EB7` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:210` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d1342a8596b81bd0` | `FP-UI-4431201A6F4F` | ui | `src/components/codex/CodexPanel.tsx:548` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d1550383f7729b7f` | `FP-UI-62A8E374F66B` | ui | `src/components/outline/OutlineVolumeDetail.tsx:273` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d15f69a27a77f0e9` | `FP-UI-32CF5FA67DDA` | ui | `src/components/character/CharacterExtraPanel.tsx:163` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d16d687bbf61d5a3` | `FP-UI-4810F420DD9E` | ui | `src/components/outline/OutlinePreviewPanel.tsx:19` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d179d6225988cb58` | `FP-UI-BAF9B14D67ED` | ui | `src/components/layout/Sidebar.tsx:103` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d193205c195b4573` | `FP-UI-7D4CC0127589` | ui | `src/components/editor/RichEditor.tsx:948` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d226d12e94eb3781` | `FP-UI-FEF2FDEAC143` | ui | `src/components/history/HistoryKeywordCard.tsx:163` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d2a0d0fdf6df0e99` | `FP-UI-4568BC5E7A66` | ui | `src/components/history/HistoryPanel.tsx:434` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d2b4d71c3969e41b` | `FP-UI-B4540FD83042` | ui | `src/components/worldview/PowerSystemPanel.tsx:80` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d2b68fdbb4099486` | `FP-UI-E5F8904A889A` | ui | `src/components/data/CloudBackupCard.tsx:106` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d2b7133ac0842ae3` | `FP-UI-340DE17ED1D0` | ui | `src/components/shared/PromptRunPanel.tsx:235` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d327615f45163e70` | `FP-UI-1C13967F3C89` | ui | `src/components/settings/AIConfigPanel.tsx:283` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d32fc9b5f3dca04e` | `FP-UI-6D4392AF8025` | ui | `src/components/history/HistoryKeywordCard.tsx:129` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d3c1751203d493ad` | `FP-UI-4A096EC6C9B4` | ui | `src/components/system/ImportDocPanel.tsx:713` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d4555ecab116bc03` | `FP-UI-B9A37CE950FE` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:170` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d45861ec8b42e054` | `FP-UI-9BCB89D44699` | ui | `src/components/layout/PropertiesPanel.tsx:256` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d47ec9ed029fdb0a` | `FP-UI-FF83ECA455FD` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:739` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d4b04279e8e24cc2` | `FP-UI-685871FD7686` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:180` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d4c6311bbe27b1ad` | `FP-UI-40C456B18A02` | ui | `src/components/geography/WorldMapPanel.tsx:167` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d4e259a7e022bcb7` | `FP-UI-7EEADACB6525` | ui | `src/components/editor/RichEditor.tsx:940` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d4ef5abe09bba389` | `FP-UI-5840788DC104` | ui | `src/pages/HomePage.tsx:493` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d520d05e0a82455d` | `FP-UI-4D5259778527` | ui | `src/components/shared/CompositionInput.tsx:42` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d54e6230c78d8a50` | `FP-UI-17CC98DB20E3` | ui | `src/components/relations/CharacterRelationPanel.tsx:217` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d574d4b969b3e626` | `FP-UI-8C2E1088FAC4` | ui | `src/components/editor/ChapterCandidateReview.tsx:95` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d5a689e192c62d1a` | `FP-UI-AAE615FB639D` | ui | `src/components/shared/PromptRunPanel.tsx:173` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d63ea9479fa5e1f2` | `FP-UI-DDA5A4218A6F` | ui | `src/components/data/DataManagementPanel.tsx:317` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d75ee98df96c3b0d` | `FP-UI-852A615E38C8` | ui | `src/components/project/ProjectInfoPanel.tsx:188` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d7a0904392406153` | `FP-UI-FDAA786CA494` | ui | `src/components/outline/OutlinePanel.tsx:490` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d7ac97485e906c93` | `FP-UI-AA42B1044C49` | ui | `src/components/shared/PromptRunPanel.tsx:302` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d7b4d0b413f144ec` | `FP-UI-E11FB0E5998E` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:258` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d7ef392f76f70a50` | `FP-UI-7C3212893400` | ui | `src/components/history/HistoryAgentWorkspace.tsx:121` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d812e99023a00c54` | `FP-UI-0911653A8B07` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:216` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d825c2f6c2e7deb4` | `FP-UI-AAD54351DA8D` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:341` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d86f419b06702b16` | `FP-UI-5F751290DAA6` | ui | `src/components/geography/WorldMapPanel.tsx:147` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d8ac1d3099a21a07` | `FP-UI-4586DD2F7318` | ui | `src/components/settings/prompt/PromptTemplateList.tsx:88` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d8ad26fbb8aadb5b` | `FP-UI-5283049F63FB` | ui | `src/components/history/HistoryChapterPicker.tsx:28` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d900a247ea7e8eeb` | `FP-UI-82A2F58A0370` | ui | `src/components/world-group/WorldGroupOverview.tsx:278` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d9388c452f71ca60` | `FP-UI-0974D5D6BC6A` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:733` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d93e135857809e3d` | `FP-UI-AB9B91A3E201` | ui | `src/components/relations/CharacterRelationPanel.tsx:332` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d94b96b35f64b24f` | `FP-UI-3A76DBB3A4EB` | ui | `src/components/data/CloudBackupCard.tsx:147` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d96aef643230f456` | `FP-UI-54CA05CE10BC` | ui | `src/components/editor/RichEditor.tsx:812` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d981ba8364d393c3` | `FP-UI-9C11800C7057` | ui | `src/components/editor/NotePanel.tsx:113` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d9af51d558f422d4` | `FP-UI-A0D83A97A340` | ui | `src/components/outline/DetailedOutlinePanel.tsx:340` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d9bec135bee5de7e` | `FP-UI-76C5888570F3` | ui | `src/components/codex/CodexPanel.tsx:349` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d9e86b6e421c231c` | `FP-UI-F45487672F9B` | ui | `src/components/state/StatePanel.tsx:238` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d9f46def4fe6ef70` | `FP-UI-9CA68AABFBF8` | ui | `src/components/location/LocationPanel.tsx:216` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:d9f50a12f04d560e` | `FP-UI-BA09EB4181E9` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:288` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:da16767f2bedc05a` | `FP-UI-F58CCC2A7B96` | ui | `src/components/history/HistoryPanel.tsx:359` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:da19223eae403dd1` | `FP-UI-C9A2B96C0DCF` | ui | `src/components/editor/RichEditor.tsx:957` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:da3d8fbbb5826a81` | `FP-UI-17C286AE9D80` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:525` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:da9b7845c8c9299d` | `FP-UI-EF5F9C5ECF19` | ui | `src/components/settings/prompt/PromptExamplesEditor.tsx:157` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:daa0064cc39b06a8` | `FP-UI-BA3637FF2BE5` | ui | `src/components/data/DataManagementPanel.tsx:255` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:daa0b3e0ca7012f7` | `FP-UI-EF6967D2DA1F` | ui | `src/components/outline/OutlineChapterTree.tsx:226` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:daa5483b10a3941e` | `FP-UI-4C8B3681CBD5` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:361` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dab50bb7f2e52dce` | `FP-UI-B401D8E79311` | ui | `src/components/character/CharacterDimensionFields.tsx:185` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:daccdab077f626fe` | `FP-UI-AAAE184DCE34` | ui | `src/components/data/DataManagementPanel.tsx:373` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dadb8389cc547fec` | `FP-UI-907A365FEC73` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:335` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dae1d30f2ffd9240` | `FP-UI-921D7D0F5B79` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:832` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:daebd0e85efc5aee` | `FP-UI-EED9DE2250E2` | ui | `src/pages/HomePage.tsx:372` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:db1c494123ea2045` | `FP-UI-2FDF2EE4873D` | ui | `src/components/outline/DetailedOutlinePanel.tsx:565` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:db1ec9b95d690ce9` | `FP-UI-68682808F9C5` | ui | `src/components/rules/CreativeRulesPanel.tsx:368` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:db4b947c4d8f77cd` | `FP-UI-0D86B3DE6A2E` | ui | `src/components/system/ImportDocPanel.tsx:662` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:db50f9868676a584` | `FP-UI-5AB809F16334` | ui | `src/components/outline/StoryArcPanel.tsx:193` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:db62aa5b9a4becc6` | `FP-UI-205BAB991C20` | ui | `src/components/codex/CodexPanel.tsx:533` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dbac0dd55a89f6c5` | `FP-UI-09940BCE3890` | ui | `src/components/outline/ScenePanel.tsx:203` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dc0754b9443e439b` | `FP-UI-CC0B15421A0F` | ui | `src/components/settings/prompt/PromptWorkflowsPanel.tsx:188` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dc501e49b43d9862` | `FP-UI-6A69BBC50DD8` | ui | `src/components/rules/CreativeRulesPanel.tsx:153` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dc81d019a73455a0` | `FP-UI-7D611F4867B6` | ui | `src/components/history/HistoryTimelineEventCard.tsx:297` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dcafc0a274f600ed` | `FP-UI-5615DA8EB0A2` | ui | `src/pages/HomePage.tsx:147` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dd2c1299d3ab4ae8` | `FP-UI-E9CBD861D7DD` | ui | `src/components/shared/InlineEdit.tsx:123` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dd2ce3a33b61fdbc` | `FP-UI-521B404D7B6A` | ui | `src/components/project/ReferencePanel.tsx:335` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dd45f5f911eb8265` | `FP-UI-6F7A16BCB858` | ui | `src/components/rules/CreativeRulesPanel.tsx:268` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dd6ce7ea30b4b34e` | `FP-UI-71833867B3F2` | ui | `src/components/system/VersionHistoryPanel.tsx:90` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dd798e0d36cbd293` | `FP-UI-E9E81B8ED4AF` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:396` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dd79b9d3718d2dfe` | `FP-UI-46DCB1E882F5` | ui | `src/components/history/HistoryKeywordCard.tsx:197` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dd9bce41be5b26b0` | `FP-UI-F1098F8D95A2` | ui | `src/pages/WorkspacePage.tsx:289` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ddbd9721457696a7` | `FP-UI-D2B22DD581A1` | ui | `src/components/state/StatePanel.tsx:135` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:de3faaedcb1ed836` | `FP-UI-F1D6B9E935D2` | ui | `src/components/worldview/WorldRulesPanel.tsx:462` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:de6f5c55eada30ce` | `FP-UI-366C0EF98277` | ui | `src/components/outline/OutlineChapterTree.tsx:276` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dec645bba1a7e662` | `FP-UI-3CA2E36D6B3C` | ui | `src/components/outline/OutlinePanel.tsx:468` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:defa18a0896f2e9d` | `FP-UI-83446A946F9C` | ui | `src/components/state/StatePanel.tsx:246` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:df01723ea3f71380` | `FP-UI-471847D90A5B` | ui | `src/components/editor/ChapterEditor.tsx:1713` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:df0da310be83a47e` | `FP-UI-7DD39D354B9F` | ui | `src/components/world-group/WorldGroupOverview.tsx:122` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:df1454d6ba93d55c` | `FP-UI-7BEFD5C9D8D5` | ui | `src/components/layout/Sidebar.tsx:125` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:df85307c08555642` | `FP-UI-0F487CCF56E1` | ui | `src/components/editor/FindReplacePanel.tsx:268` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dfbf21daa901a739` | `FP-UI-7FD18E8DD4E1` | ui | `src/components/character/CharacterNPCPanel.tsx:103` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dfd0100370e26437` | `FP-UI-5317DCA00CA3` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:230` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:dfe6168ddbe03b48` | `FP-UI-9372683D6530` | ui | `src/components/character/CharacterPanel.tsx:382` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e01a5473fff2a0fb` | `FP-UI-0DC610EFD5E1` | ui | `src/components/outline/OutlinePanel.tsx:492` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e027afd14187a94a` | `FP-UI-85E17E147B79` | ui | `src/components/world-group/WorldGroupSwitcher.tsx:32` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e071c2e08d424dd3` | `FP-UI-F0FC85F00124` | ui | `src/components/history/HistoryTimelineEventCard.tsx:248` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e0819076a5d98e87` | `FP-UI-75EBCA0898B0` | ui | `src/components/history/HistoryOverviewTab.tsx:27` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e08b19174ee3dec7` | `FP-UI-B4461320C6A7` | ui | `src/components/shared/PromptRunPanel.tsx:178` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e0a7bdee16366817` | `FP-UI-34C6021F3289` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:175` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e12641bde0d3b50e` | `FP-UI-78BDEE65F715` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:343` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e1865d92a4cb12f1` | `FP-UI-372E11083463` | ui | `src/components/system/ImportDocPanel.tsx:702` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e1d0701c9dfc4f0d` | `FP-UI-3168390E4CB9` | ui | `src/components/outline/OutlinePanel.tsx:439` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e1e9c2fac1458b1f` | `FP-UI-E27B2D3CA71E` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:192` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e1f936ba279d9f76` | `FP-UI-BBEFA690BCED` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:295` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e2022c094243373b` | `FP-UI-68B50F7ED80F` | ui | `src/components/codex/CodexPanel.tsx:763` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e217932a9d347a35` | `FP-UI-DF8AE07454A8` | ui | `src/components/character/CharacterSupplementAction.tsx:96` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e22f414ec4acf06f` | `FP-UI-2495E117F62E` | ui | `src/components/character/CharacterNPCPanel.tsx:107` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e29b95cd60edc1c8` | `FP-UI-7138FC6B8267` | ui | `src/pages/HomePage.tsx:443` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e2d9321f134d2aa5` | `FP-UI-6CBFE5B5DFA0` | ui | `src/components/character/CharacterAxesPicker.tsx:72` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e31b94f1967c14e3` | `FP-UI-B1AD83701AB0` | ui | `src/components/shared/AutoResizeTextarea.tsx:60` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e342d5027fe430f9` | `FP-UI-EF033553552B` | ui | `src/components/codex/CodexPanel.tsx:445` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e35136d64ccc44dc` | `FP-UI-BF70A00FD617` | ui | `src/components/outline/StoryArcPanel.tsx:275` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e37ca5f6ab0fd2a8` | `FP-UI-A7E393BD249D` | ui | `src/components/settings/prompt/PromptManagerPanel.tsx:282` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e3898dc222ae2b12` | `FP-UI-2585474ED9D1` | ui | `src/components/character/CharacterNPCPanel.tsx:86` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e3931cb400c0adc1` | `FP-UI-1457EAEF1944` | ui | `src/components/codex/CodexPanel.tsx:454` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e3b76324d02b0d25` | `FP-UI-E0786E462DB3` | ui | `src/components/history/HistoryPanel.tsx:356` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e408cc39cc760737` | `FP-UI-518041E99715` | ui | `src/components/relations/CharacterRelationPanel.tsx:444` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e4874688a5f177b6` | `FP-UI-16CC8B4E4CEB` | ui | `src/components/worldview/WorldRulesPanel.tsx:394` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e4e604be1033bec0` | `FP-UI-43C6E2C738F9` | ui | `src/components/editor/ChapterEditor.tsx:1576` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e55846c925926985` | `FP-UI-EC6A2B4367F5` | ui | `src/components/shared/AIStreamOutput.tsx:94` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e567d27ac88eb949` | `FP-UI-0E8A864309C2` | ui | `src/components/geography/WorldTreeSidebar.tsx:214` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e57596a461f7e8dc` | `FP-UI-B112972AD644` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:235` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e5a0fe0a1beed9b2` | `FP-UI-5692408A1024` | ui | `src/components/history/HistoryKeywordCard.tsx:173` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e5a3abb94cf6eaed` | `FP-UI-D16270A9C2D4` | ui | `src/components/system/import/ImportConfirmModal.tsx:265` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e5eca896473ca995` | `FP-UI-4C085CD6A5D2` | ui | `src/components/outline/StoryArcPanel.tsx:411` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e64566227fb33f1c` | `FP-UI-B75B37E36C9B` | ui | `src/components/timeline/StoryTimelinePanel.tsx:205` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e6735b751411c44b` | `FP-UI-AA2410FEC5E4` | ui | `src/components/editor/FloatingToolbar.tsx:60` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e676bb5c5afab58a` | `FP-UI-1C5AB3E52373` | ui | `src/components/items/InventoryPanel.tsx:317` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e679568f7c0508c5` | `FP-UI-ABF92010FA2D` | ui | `src/components/data/DataManagementPanel.tsx:289` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e6c9decea3b0f8ea` | `FP-UI-45F03A534C5F` | ui | `src/components/editor/NotePanel.tsx:108` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e6f34c35b8429e63` | `FP-UI-E80869F3806C` | ui | `src/components/data/CloudBackupCard.tsx:164` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e6f4ffcb352d7982` | `FP-UI-1E6C120DA59D` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:243` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e6f66c9760b1a8ed` | `FP-UI-57339F962E3C` | ui | `src/components/shared/PromptRunPanel.tsx:150` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e70ff92741496106` | `FP-UI-49BCAC7142FB` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:576` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e721133c4979a599` | `FP-UI-35837F68ECF0` | ui | `src/components/worldview/WorldRulesPanel.tsx:325` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e7261e8293876cb7` | `FP-UI-D901551D98D5` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:353` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e75b963d50ba2ee5` | `FP-UI-EC48CC630AE3` | ui | `src/components/guide/WelcomeGuide.tsx:170` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e784a0e553f486b9` | `FP-UI-DC579FB0D886` | ui | `src/components/world-group/WorldGroupOverview.tsx:286` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e78f405bf6f73078` | `FP-UI-61ABF8CD7AF9` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:747` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e7c48d8a5287db97` | `FP-UI-6E351FD0654C` | ui | `src/components/worldview/WorldRulesPanel.tsx:555` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e7ec281b5c5d9b42` | `FP-UI-5DEF783EF7F2` | ui | `src/components/project/ProjectInfoPanel.tsx:115` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e81423f0b4347d4b` | `FP-UI-AA0EB2C5A8C5` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:388` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e85e8fdb8f033d0f` | `FP-UI-CEE10F08590F` | ui | `src/components/system/import/ImportUnfinishedBanner.tsx:65` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e885a83971174c1c` | `FP-UI-4A6BDAFE5180` | ui | `src/components/geography/GeographyPanel.tsx:176` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e8e6d8d25759ee74` | `FP-UI-616019988F93` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:323` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e9389c36e00f9e6a` | `FP-UI-2A2BFC4BD71D` | ui | `src/components/migration/FirstRunMigration.tsx:185` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e99883bbd8fb2599` | `FP-UI-E02672CCEF6B` | ui | `src/components/editor/FindReplacePanel.tsx:260` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e9bbd7260ee91b3d` | `FP-UI-166F613CE63F` | ui | `src/components/worldview/StoryCorePanel.tsx:131` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:e9ca7e99187fe8a4` | `FP-UI-EB0DB8126C3C` | ui | `src/components/editor/EmotionBeatCard.tsx:206` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ea1db368b4a204a0` | `FP-UI-529288220839` | ui | `src/components/codex/CodexPanel.tsx:479` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ea5157e5b6f41a5d` | `FP-UI-B7A035BD7FD2` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:461` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ea58fe90c099fe98` | `FP-UI-BD90A77F00A9` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:223` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:eac160f657c3d1da` | `FP-UI-B7D3F9437237` | ui | `src/components/outline/OutlinePanel.tsx:472` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:eaf0ad3724a059b5` | `FP-UI-4825351169C1` | ui | `src/components/outline/OutlineVolumeSidebar.tsx:79` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:eb2629e7dd44e74b` | `FP-UI-E3F6860B9BB6` | ui | `src/components/character/CharacterPanel.tsx:278` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:eb72795568fce75c` | `FP-UI-51A4C84EA5B4` | ui | `src/components/codex/CodexPanel.tsx:532` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:eb791c5c0794494a` | `FP-UI-975C675BA424` | ui | `src/components/worldview/WorldRulesPanel.tsx:463` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:eb7997ba8be21952` | `FP-UI-76DC2DBCC78B` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:154` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ebb5cf37131655f3` | `FP-UI-3F43FB3E77AE` | ui | `src/components/character/CharacterPanel.tsx:562` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ebcc7292c1c403f1` | `FP-UI-2E3E1AD74B5E` | ui | `src/components/editor/ChapterEditor.tsx:1599` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ebe8315b90ea864e` | `FP-UI-5AC95173FBD3` | ui | `src/components/project/ProjectInfoPanel.tsx:72` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ebfb30d18238257d` | `FP-UI-3767F50255BD` | ui | `src/components/outline/StoryArcPanel.tsx:191` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ec281ad6221c06bd` | `FP-UI-07E3BE66E54B` | ui | `src/components/editor/ChapterMemoryPanel.tsx:39` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ec2d455c5dd839df` | `FP-UI-5736D4C63602` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:524` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ed3ad04c47e1a7dc` | `FP-UI-80F7E20A01F2` | ui | `src/components/timeline/StoryTimelinePanel.tsx:143` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ed3cc732ac03c023` | `FP-UI-F9BE4819F36B` | ui | `src/components/system/VersionHistoryPanel.tsx:158` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ed8db4ea1c98744f` | `FP-UI-242894F7D679` | ui | `src/components/outline/OutlinePanel.tsx:485` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ed94eb7bbb733dca` | `FP-UI-8C3384CE52BA` | ui | `src/components/outline/StoryArcPanel.tsx:262` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:edd4f8b450969bdb` | `FP-UI-F1F4F0D30B45` | ui | `src/components/settings/prompt/PromptParametersEditor.tsx:141` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ede57581127f091c` | `FP-UI-47BC6FA609B0` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:330` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ee2fe6d2b99668bf` | `FP-UI-DBAA07173ADC` | ui | `src/components/history/HistoryPanel.tsx:401` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ee34722f38d4974a` | `FP-UI-7DCA92C522B5` | ui | `src/components/outline/OutlineVolumeDetail.tsx:153` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ee423bd6d31ce368` | `FP-UI-E6179546282D` | ui | `src/components/items/InventoryPanel.tsx:308` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ee589b8754968d98` | `FP-UI-B14DFFA60CBE` | ui | `src/components/editor/ChapterEditor.tsx:1720` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ee7174c57c39aa9d` | `FP-UI-30051ECD20E1` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:159` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:eec47fff2c4f55c7` | `FP-UI-65C22370C633` | ui | `src/components/shared/CompositionInput.tsx:80` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:eee1dabcc68187bf` | `FP-UI-0022CC57026F` | ui | `src/components/character/CharacterDimensionPicker.tsx:35` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ef260b784a1c753f` | `FP-UI-05A4B348056C` | ui | `src/pages/HomePage.tsx:476` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ef26df787c6a5199` | `FP-UI-B57C4588C3C9` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:841` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ef9e2abee7e9ca45` | `FP-UI-1ED70530B59E` | ui | `src/components/character/CharacterNPCPanel.tsx:80` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:efc9bc9737ba04bb` | `FP-UI-CFFA4E01A658` | ui | `src/components/editor/FindReplacePanel.tsx:305` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:efefe9613a674101` | `FP-UI-1ADA5070300E` | ui | `src/components/editor/ChaptersListPanel.tsx:208` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:eff55d5a8ce2383b` | `FP-UI-97254DEBE4AB` | ui | `src/components/settings/prompt/PromptTemplateEditor.tsx:308` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f02a9f851d27810b` | `FP-UI-0F1F03E3BB31` | ui | `src/components/shared/CompositionInput.tsx:36` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f02ab251eb8cf13b` | `FP-UI-2D49ED3181F1` | ui | `src/components/system/ImportDocPanel.tsx:505` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f03aa061102cdb1f` | `FP-UI-A0747747E2D1` | ui | `src/components/outline/DetailedOutlinePanel.tsx:557` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f062cac0d4b60082` | `FP-UI-637E8CD01EDE` | ui | `src/components/outline/OutlinePanel.tsx:408` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f0c64617c2baea78` | `FP-UI-96D5CCC77EC7` | ui | `src/components/outline/OutlinePanel.tsx:441` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f14da440b975597d` | `FP-UI-3AECE287A081` | ui | `src/components/shared/AIStreamOutput.tsx:257` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f1666aef7e144849` | `FP-UI-1CCD786A066C` | ui | `src/components/outline/StoryArcPanel.tsx:433` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f1d9a7931a1c74a2` | `FP-UI-0465AF8E0732` | ui | `src/components/settings/AIConfigPanel.tsx:618` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f1e72f40bfaa47bd` | `FP-UI-BB38DFAFF444` | ui | `src/components/worldview/WorldviewNaturalPanel.tsx:357` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f2196ce6a5993dfc` | `FP-UI-CEBE36BC9A35` | ui | `src/components/relations/CharacterRelationPanel.tsx:471` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f21cfa95f4e2fd99` | `FP-UI-5A55A905838A` | ui | `src/components/world-group/WorldGroupOverview.tsx:342` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f226880a7bffd74c` | `FP-UI-533A7823581C` | ui | `src/components/state/StateDiffModal.tsx:114` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f25b555a2a786dfe` | `FP-UI-6DB628958E08` | ui | `src/components/data/DataManagementPanel.tsx:420` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f286986eca7b88a6` | `FP-UI-BD95007D32D2` | ui | `src/components/geography/WorldMapVoronoi.tsx:426` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f2bc502ce3349bbf` | `FP-UI-7D1D705D67E2` | ui | `src/components/history/HistoryTimelineEventCard.tsx:227` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f2d0168286561687` | `FP-UI-22C03A7D2F6E` | ui | `src/components/codex/CodexPanel.tsx:737` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f2e77dcdc2418cf2` | `FP-UI-B8E199FDA4D9` | ui | `src/components/geography/WorldMapVoronoi.tsx:390` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f30c66e3d4a3ce96` | `FP-UI-3B651474E3A7` | ui | `src/components/geography/WorldMapVoronoi.tsx:456` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f3371cd4d9ed15b1` | `FP-UI-24F18E0FE528` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:318` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f3bf96b45610e9b9` | `FP-UI-E7837FA414B6` | ui | `src/components/style/StyleLearningPanel.tsx:171` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f3f40b3d3953e458` | `FP-UI-29C0791B0D8E` | ui | `src/components/codex/CodexPanel.tsx:561` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f408aae047c25775` | `FP-UI-D3502EB4C390` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:252` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f419a3e529991c74` | `FP-UI-D4D46FC39DF6` | ui | `src/components/rules/CreativeRulesPanel.tsx:205` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f41de9fb6a5cc838` | `FP-UI-0EDC54CDD370` | ui | `src/components/rules/CreativeRulesPanel.tsx:195` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f43dad66e5a67815` | `FP-UI-62C77BABC95B` | ui | `src/components/codex/CodexPanel.tsx:633` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f44eb81870ad7d09` | `FP-UI-CBFBF4D1898D` | ui | `src/components/outline/OutlinePanel.tsx:405` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f472af2b9ead2c2e` | `FP-UI-BBB54B9ED568` | ui | `src/components/settings/UsageStatsPage.tsx:93` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f473e3dfecaade9e` | `FP-UI-BE24002EA175` | ui | `src/components/outline/OutlineChapterTree.tsx:130` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f48d6da8121960ba` | `FP-UI-D7BE30B310A2` | ui | `src/components/system/ImportDocPanel.tsx:598` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f49b0a071c522ed1` | `FP-UI-C9EB02B25F30` | ui | `src/components/shared/InlineEdit.tsx:135` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f4afa0294a0f48f7` | `FP-UI-E560F2572929` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:424` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f4b46f91e8e54654` | `FP-UI-8766A279E3D1` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:371` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f4d86e1ed04a8b66` | `FP-UI-FECC30E73363` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:269` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f50a63f97ea7b7c0` | `FP-UI-0BC8A6C36DD0` | ui | `src/components/geography/GeographyPanel.tsx:192` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f5b5d572814e6e5e` | `FP-UI-EB8AFC9EA575` | ui | `src/components/editor/ChaptersListPanel.tsx:140` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f5b802edd867fe9a` | `FP-UI-F28AB0CE1489` | ui | `src/components/project/AnalysisReportViewer.tsx:229` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f5ec7611d3827272` | `FP-UI-29EA009E3FD5` | ui | `src/components/codex/CodexPanel.tsx:560` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f611b5fed6fd92b3` | `FP-UI-49CC641A057E` | ui | `src/components/system/import/ImportConfirmModal.tsx:90` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f62e089a1a9d3031` | `FP-UI-BB4C7BFC74DE` | ui | `src/components/system/ImportDocPanel.tsx:714` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f6ba9d7b2dec80d5` | `FP-UI-7E60D78EA114` | ui | `src/components/editor/RichEditor.tsx:848` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f7064ab588e794a2` | `FP-UI-6F512EDF30F6` | ui | `src/components/timeline/StoryTimelinePanel.tsx:212` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f71b83cde7423e78` | `FP-UI-5A5B7F0B155D` | ui | `src/components/editor/ChapterFactCandidateWorkspace.tsx:145` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f7a5ecd2c3bb528b` | `FP-UI-217F5139592C` | ui | `src/components/settings/AIConfigPanel.tsx:412` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f7fdcc725ef9ed3d` | `FP-UI-68652D6AA142` | ui | `src/pages/HomePage.tsx:330` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f816645c4204eda6` | `FP-UI-CAFE90DF5949` | ui | `src/components/editor/ChapterEditor.tsx:1681` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f841f1fbadb7633f` | `FP-UI-60200E28DED9` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:477` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f8760c6592cb9015` | `FP-UI-46A3E472F8D0` | ui | `src/components/system/VersionHistoryPanel.tsx:149` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f890ca9628ab1151` | `FP-UI-09EDB6558D35` | ui | `src/pages/WorkspacePage.tsx:172` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f8f480d68f3d8f47` | `FP-UI-DE1FF39A9E6E` | ui | `src/components/history/HistoryAgentWorkspace.tsx:177` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f926ad5183619376` | `FP-UI-7C0CDFB0D081` | ui | `src/pages/HomePage.tsx:183` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f933e12de5a7a9a4` | `FP-UI-DF91A4001E76` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:808` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f9599c288bd532c3` | `FP-UI-304586F8E1B6` | ui | `src/components/editor/ChapterEditor.tsx:1818` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f96536ec603840ce` | `FP-UI-DC1C3F766412` | ui | `src/components/history/HistoryTimelineEventCard.tsx:191` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:f98aef49f3253270` | `FP-UI-F93E8A009413` | ui | `src/components/guide/WelcomeGuide.tsx:193` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fa196144ee5372f3` | `FP-UI-9D7B68EBC883` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:452` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fa4e947376265049` | `FP-UI-B2F9F2141279` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:582` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fa5f77a0354efd45` | `FP-UI-FF17032726F5` | ui | `src/components/editor/ChaptersListPanel.tsx:157` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fa9f5f4a38c05b06` | `FP-UI-4B4FD4D9EC36` | ui | `src/components/shared/InlineEdit.tsx:46` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fab61bbdc3d17caa` | `FP-UI-51BA79E6B222` | ui | `src/components/geography/GeographyPanel.tsx:313` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fac3055871e2d99e` | `FP-UI-C6F706402DAC` | ui | `src/components/settings/prompt/WorkflowRunner.tsx:565` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fad96a6f182c0fd6` | `FP-UI-8E79BA7B71AC` | ui | `src/components/character/CharacterSupplementAction.tsx:145` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fae83e2b948ed86f` | `FP-UI-4084596A9147` | ui | `src/pages/HomePage.tsx:218` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:faf1e6f86da6e21f` | `FP-UI-C8BE3D165062` | ui | `src/components/outline/OutlineChapterTree.tsx:109` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:faf59fda2cd99a96` | `FP-UI-85AA02AC18EF` | ui | `src/components/settings/prompt/WorkflowEditor.tsx:154` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fb36b8560030dac2` | `FP-UI-9E2FD60614B9` | ui | `src/components/outline/OutlineGenerationResultPanel.tsx:52` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fb5dcc413660891a` | `FP-UI-74F0A4BC0401` | ui | `src/components/outline/OutlineVolumeSidebar.tsx:133` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fb6056d16b43da38` | `FP-UI-FFF21676313A` | ui | `src/components/project/ReferencePanel.tsx:410` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fb79e2f7b520d968` | `FP-UI-83FB6BA1350E` | ui | `src/components/editor/ChapterEditor.tsx:1777` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fb96fdeecca98445` | `FP-UI-D027BFDEC696` | ui | `src/components/outline/OutlineVolumeDetail.tsx:213` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fbf0350618c8bef6` | `FP-UI-7B0124D5DDE8` | ui | `src/components/foreshadow/ForeshadowPanel.tsx:445` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fbf8437f92918566` | `FP-UI-88DE07724610` | ui | `src/pages/WorkspacePage.tsx:229` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fc1cbe8c7dd11a03` | `FP-UI-1173BE3B6FB1` | ui | `src/components/foreshadow/ForeshadowKanban.tsx:71` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fc37d8ea66541da2` | `FP-UI-F0965DFCD86B` | ui | `src/components/geography/WorldTreeSidebar.tsx:203` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fc7c72c4e92c318d` | `FP-UI-378BF3E8FDF4` | ui | `src/components/worldview/PowerSystemPanel.tsx:68` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fc947b352ac16779` | `FP-UI-46440C24DDA1` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:372` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fcaaf2f28beae601` | `FP-UI-9DA7AE610E51` | ui | `src/components/editor/EmotionBeatCard.tsx:179` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fcc1556586986b37` | `FP-UI-5D16CE6594F4` | ui | `src/components/geography/WorldTreeSidebar.tsx:198` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fcd5e94aa5b601d6` | `FP-UI-1D7DDF79F888` | ui | `src/components/editor/ChapterEditor.tsx:1620` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fcf002400f595911` | `FP-UI-6C02E1ED06E9` | ui | `src/components/worldview/WorldRulesPanel.tsx:468` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fcff23a0ec24118e` | `FP-UI-6ED1638C9BD8` | ui | `src/components/outline/CharacterDrivenPlotPanel.tsx:313` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fd0b448e364529b5` | `FP-UI-74B1FEE39FAE` | ui | `src/components/character/CharacterPanel.tsx:549` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fd1299b682eb88a8` | `FP-UI-351AE5AC5FEE` | ui | `src/components/outline/OutlineVolumeSidebar.tsx:113` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fd1b745d0d713cfb` | `FP-UI-D0AD1BC77E37` | ui | `src/components/worldview/WorldviewOriginPanel.tsx:512` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fd404556286a8794` | `FP-UI-BEC8E1C6467B` | ui | `src/components/outline/StoryArcPanel.tsx:166` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fd5c2abb5983207d` | `FP-UI-17A53EB868BE` | ui | `src/components/state/StatePanel.tsx:101` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fd68cb8246d68e24` | `FP-UI-BB93C40E3E28` | ui | `src/components/worldview/WorldviewHumanityPanel.tsx:164` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fdc8226cbce30cb1` | `FP-UI-95BBF051A7D4` | ui | `src/components/state/StatePanel.tsx:139` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fe0e99ab97ac7bda` | `FP-UI-7D0EEA9A4B30` | ui | `src/components/outline/StoryArcPanel.tsx:135` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fe8f069a3e9ee445` | `FP-UI-31236B896873` | ui | `src/components/codex/CodexPanel.tsx:660` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fe9964ba449192b3` | `FP-UI-E9C8847F2486` | ui | `src/components/history/HistoryOverviewTab.tsx:39` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fed1dd539c678f96` | `FP-UI-00FA16BD3AC5` | ui | `src/components/editor/ChapterAIAssistantPanel.tsx:831` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:fed4d445ac27f9a8` | `FP-UI-0D6A5B64A965` | ui | `src/components/editor/FindReplacePanel.tsx:348` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ffa875ebc7041c27` | `FP-UI-9622FEE5BF23` | ui | `src/components/system/import/ImportUnfinishedBanner.tsx:76` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
| `ui:ffba6f0225390fca` | `FP-UI-644F82D0AC31` | ui | `src/components/editor/FindReplacePanel.tsx:251` | REGISTERED_M1 | npm test + M1 synthetic desktop contract |
