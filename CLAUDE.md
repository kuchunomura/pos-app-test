# POS レジ アプリ

## 概要
屋外施設向けのシンプルなPOSレジ。単一HTMLファイル（`index.html`）で完結。  
**公開URL**: https://kuchunomura.github.io/pos-app-test

## 動作環境
- **ターゲット**: iPad 第6世代（iOS 15以下）の Safari
- ビルドツール・フレームワーク・npmなし
- 外部ライブラリなし（CDN含む）
- ES2017以前の構文を使うこと（async/awaitはOK、Optional chaining `?.` はiOS15でサポート済み）

## ファイル構成
```
index.html   # すべてのHTML/CSS/JSを含む単一ファイル
```

## データ永続化
- **localStorage** (`ld()` / `sv()` 関数): 設定・商品・売上データ
- **IndexedDB** (`openDB()`, `restoreFromIDB()`): バックアップ用
- `KEYS` オブジェクトにすべてのlocalStorageキーを定義（line 680）

## 主要な状態変数（グローバル）
| 変数 | 説明 |
|---|---|
| `items` | 商品マスタ（`DEFAULT_ITEMS` がデフォルト） |
| `cats` | カテゴリマスタ（`DEFAULT_CATS` がデフォルト） |
| `cart` | 現在のカート（配列） |
| `activeDiscount` | 選択中の割引キー（`''` or `'mura'` etc.） |
| `discountItems` | 割引・予約サイト設定リスト |
| `holds` | 保留スロット（10件） |
| `sales` | 売上履歴 |

## 割引システム
| key | 種別 | 動作 |
|---|---|---|
| `mura` | discount | レンタル以外を半額。`free_mura:true` または `id==='i_bbq'` の商品は無料 |
| `stay_guest` | discount | 宿泊者割引（`STAY_GUEST_DISC_IDS` 対象） |
| `rakuten` / `jalan` / `sou` | paid | 宿泊商品を支払済み表示 |
| `pass_day` / `pass_night` | paid | 年間パス |

割引ロジックの変更は必ず以下2関数を同期させること:
- `getDiscountedPrice(item)` (line 1186) — 商品ボタンの価格表示
- `recalcCartPrices()` (line 1305) — カート内価格の再計算

## カテゴリと商品
- 宿泊カテゴリ: `STAY_CAT_IDS = ['cat_stay','cat_stay_tree','cat_stay_dome','cat_stay_tent','cat_stay_hm']`
- 宿泊時に無料になる商品: `STAY_FREE_IDS = ['i_bbq']`
- 商品の `free_mura` フラグ: `true` なら村民割引で無料

## 主要な関数
| 関数 | 説明 |
|---|---|
| `renderPOS()` | 商品エリア再描画 |
| `renderCart()` | カートエリア再描画 |
| `renderDiscountBar()` | 割引ボタン再描画 |
| `addToCart(item, cat)` | カートに追加 |
| `recalcCartPrices()` | カート全体の価格再計算 |
| `getDiscountedPrice(item)` | 割引後価格を返す |
| `confirmPayment()` | 支払確定・売上記録 |
| `switchTab(t)` | タブ切り替え |
| `sv(k, v)` / `ld(k)` | localStorage 書き込み/読み込み |

## UI構造
- **タブ**: POS / 売上 / タイマー / コンボ / 設定
- **POSタブ**: 左（商品グリッド）＋ 右（カート・保留）
- 商品グリッド: カテゴリ別 4列グリッド

## コーディング規約
- iPad Safari 互換を最優先。最新JS構文（`??=` など）は使わない
- CSSは `<style>` タグ内に直接記述。`var(--accent)` などCSS変数を使う
- コメントは日本語でOK
- 変更後は必ず `recalcCartPrices()` と `renderCart()` / `renderPOS()` を呼ぶ

## デプロイ
```bash
git add index.html
git commit -m "変更内容"
git push origin main
```
GitHub Pages が自動更新される（数分かかる場合あり）。

