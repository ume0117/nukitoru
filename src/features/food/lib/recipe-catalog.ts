// ============================================================
// recipe-catalog.ts
//
// MISSION 2.11 PHASE B — 静的レシピカタログ（第一弾）。
//
// PHASE Aで定義した Recipe 型を使った独立のデータ層。
// mock-meal-provider.ts の既存CATALOG（5品・候補生成ロジック）とは
// まだ接続しない（このPHASEでは候補生成アルゴリズムを一切変更しない）。
//
// 各Recipeの安全上の注意:
// - allergyRelevantIngredients() は requiredIngredients + seasonings のみを見る。
//   arrangements.addIngredients はこの集合に含まれない
//   （アレンジのために基本料理そのものを除外しない設計を維持する）。
// - steps は「○分加熱すれば安全」「これで食中毒を防げます」等の安全断定を
//   一切含めず、常に具体的な行動として記述する。
// - requiredIngredients / seasonings は canonicalizeIngredientName() を通した際に
//   同一料理内で重複しないよう記述する（例: 豚肉と豚こまを同時に書かない）。
//   豚肉・豚ひき肉・鶏肉等、部位や挽き肉が異なるものは意図的に別名のまま扱う。
//
// MISSION 2.11 PHASE D.2 — Recipe Ingredient Integrity（水・湯の扱い）:
// 水・湯は各家庭に常にあるとみなす基礎媒体として扱い、requiredIngredients /
// seasoningsには含めない（買い足しが必要な食材ではないため）。stepsの中で
// 「水を加える」「湯を沸かす」等と書くことは許可する。だし・片栗粉・カレー
// ルー等、パントリー在庫として意識される食材はこの例外に含めず、必ず
// requiredIngredientsまたはseasoningsへ明記する（Reality Gate参照）。
//
// 米 / ごはんの区別（PHASE D.2で確定）:
// 「米」= 生米（炊飯が必要）。「ごはん」= 炊飯済み。互いに別canonicalであり、
// 「米」を入力したユーザーへ炊飯済み前提の短時間レシピを出さない。
// 炊飯工程を含むRecipe（塩むすび・のり塩おにぎり）は requiredIngredients に
// 「米」を使い、炊飯器をequipmentへ含め、現実的なcookingTimeMinutesを設定する。
// 炊飯済みのごはんを使うだけの丼・朝食系Recipeは requiredIngredients に
// 「ごはん」を使う。
//
// MISSION 2.11 PHASE D.3 — Ingredient & Seasoning Amount Foundation:
// requiredIngredients / seasonings は { name, amount } のRecipeIngredient配列。
// amountは常に「servingsBase人数分の基準量」。value:number/unit:stringへの
// 過剰な構造化はせず、日本語の自然な分量表現（大さじ1と1/2、1/2個、少々、
// 適量 等）をそのまま文字列として保持する。amountはcanonicalization・
// allergy判定・A/B候補判定のいずれにも一切使わない（.nameのみを使う）。
// 自動人数換算（今日の人数に応じた分量の自動倍率計算）はここでも行わない。
//
// MISSION 2.11 PHASE D.4 — Cooking Liquid Foundation:
// steps中で「水を加えて煮る」等と書くだけでは絶対量が分からず再現できない
// Recipeに対し、cookingLiquids（水・湯のみ）で基準量を明示する。
// requiredIngredients/seasoningsとは別枠とし、候補判定・Stock照合・
// allergy判定のいずれにも使わない（水を買い足し食材として扱わないため）。
// 「具材が浸る程度の水」等、steps内に既に相対量が明記済みのRecipeや、
// ゆでこぼす湯（パスタ等、味に影響しない）には追加しない。
// ============================================================

import type { Recipe } from '@/features/food/types'

export const RECIPE_CATALOG: Recipe[] = [
  // ------------------------------------------------------------
  // ごはん・丼
  // ------------------------------------------------------------
  {
    id: 'shio-musubi',
    name: '塩むすび',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '米', amount: '1合' }],
    seasonings: [{ name: '塩', amount: 'ひとつまみ' }],
    cookingTimeMinutes: 60,
    servingsBase: 2,
    tags: ['ごはん', '時短', '子ども向け'],
    equipment: ['炊飯器', 'ボウル', 'ラップ'],
    steps: [
      '米を研いで炊飯器で炊く',
      '炊き上がったごはんをボウルに移す',
      '塩を加え、全体に軽く混ぜる',
      'ラップにごはんをのせて包む',
      '好みの形にやさしく握る',
    ],
    notes: ['炊飯器の機種や米の量により炊き上がりまでの時間は前後します。'],
    // MISSION 2.11 PHASE D.7-B — 塩「少々」→「ひとつまみ」に訂正（sirogohan.comの材料欄に
    // 明記の実際の表記に合わせた。CURRENT: 少々 / SOURCE: sirogohan-siomusubi-2026
    // 「塩...ひとつまみ」/ DECISION: ひとつまみへ変更 / WHY: source本文を再読し「少々」
    // という語が一切登場せず「ひとつまみ」表記のみだったため / EVIDENCE TYPE: direct）。
    //
    // MISSION 2.11 PHASE D.7-B.1 — Evidence Range Integrity Fixにより、cookingTimeMinutes
    // の扱いを訂正。日立公式のcooking time Evidenceは最後まで「40〜60分」というrangeで
    // あり、それをexact値（50分や60分）に収縮させることはEvidenceの直接支持ではない。
    // Recipe.cookingTimeMinutes=60（rangeの中央値50分＋sirogohan.comが明示する握り工程10分）
    // は「NUKITORU Product Decision」として`verification.productDecisions`に別途記録し、
    // fieldVerificationsのcookingTimeMinutesはsupportType='range'のまま
    // （=Evidence解決済みとしてカウントしない）。この結果、Critical Fieldが1件でも
    // 未解決（range）のためVERIFIED条件を満たさなくなり、status='verified'から
    // 'review'へ差し戻す（VERIFIED維持を目的にした緩和は行わない）。
    verification: {
      status: 'review',
      sourceIds: [
        'maff-rice-weight-2026',
        'tabechoku-rice-servings-2026',
        'hitachi-rice-cooker-time-2026',
        'sirogohan-siomusubi-2026',
      ],
      recipeIdentity: {
        canonicalDish: '塩むすび',
        variant: '具・アレンジなしの基本の塩むすび（塩のみ）',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的・シンプルな塩味',
        coreMethod: '米を炊飯器で炊き、塩を混ぜて握る',
        definingIngredients: ['米', '塩'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
        { field: 'ingredientAmounts', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
        { field: 'seasonings', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'seasoningAmounts', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        {
          field: 'cookingTimeMinutes',
          sourceIds: ['hitachi-rice-cooker-time-2026', 'sirogohan-siomusubi-2026'],
          supportType: 'range',
          derivation:
            'Evidence Factは「日立公式・白米ふつうコース40〜60分」というrangeのみ（＋sirogohan.comの握り工程10分は直接事実）。Recipeのcookingtime=60はこのrangeから選んだ代表値であり、Evidence直接支持ではなくProduct Decision（下記productDecisions参照）。',
          evidenceRange: { min: 40, max: 60, unit: '分' },
        },
        {
          field: 'servingsBase',
          sourceIds: ['maff-rice-weight-2026', 'tabechoku-rice-servings-2026'],
          supportType: 'derived',
          derivation:
            'MAFF: 米1合(150g)は炊飯で2.2〜2.3倍(約330〜340g)になる、という直接事実。tabechoku: 「2人分なら1〜1.5合が目安」と1合を2人分の下限として直接明記。両者を組み合わせ、1合=2人分は妥当という結論。',
        },
        { field: 'criticalSteps', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'equipment', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'allergyIdentity', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
      ],
      productDecisions: [
        {
          field: 'cookingTimeMinutes',
          value: '60分',
          reason:
            '日立公式range（白米ふつう40〜60分）の中央値50分に、sirogohan.com（専門家）が明示する握り工程10分を加算。特定の炊飯器機種・モードを仮定しない場合の代表値としてNUKITORUが採用した。安全側（やや長め）の見積もりであり、実際の炊飯器によっては短く済む場合がある。',
          referenceSourceIds: ['hitachi-rice-cooker-time-2026', 'sirogohan-siomusubi-2026'],
        },
      ],
      reviewNotes: [
        'cookingTimeMinutesのEvidence FactはrangeであるためCritical Fieldが未解決。VERIFIEDから差し戻しREVIEWとした（PHASE D.7-B.1: Evidence Range Integrity Fix）。他のfield（食材・分量・調味料・人数・工程・器具）はdirect/derivedで解決済み。',
        'MISSION 2.16 Batch 2 — sirogohan-siomusubi-2026 の本文を再確認した。塩は「ひとつまみ」'
          + '表記（数値なし）でNUKITORUの現行表記と一致。握りは炊きたての温かいごはんが前提。'
          + '調理時間は「10分 ※ご飯を炊く時間を除きます」と明記されており、専門家source自身が'
          + '「組み立て時間」と「炊飯時間」を分けている。NUKITORUの cookingTimeMinutes=60 は炊飯を'
          + '含めたProduct Decision（日立range中央値50分＋握り10分）であり、この分離方針と整合する。'
          + 'From-Now-to-Table（MISSION 2.15）の household-dependent timing を Recipe Evidence に'
          + '転用していないことも確認。塩を数値化しない方針（「ひとつまみ」のまま保持）を維持。'
          + 'DECISION: 変更なし。Recipe factは健全だが cookingTimeMinutes が range/Product Decision '
          + 'のため VERIFIED 不可、REVIEW維持 / EVIDENCE TYPE: 塩=direct（ひとつまみ）、'
          + 'cookingTime=range（未解決のまま）。',
      ],
      hasUnsupportedInference: false,
    },
  },
  {
    id: 'onigiri-nori',
    name: 'のり塩おにぎり',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '米', amount: '1合' },
      { name: 'のり', amount: '2枚' },
    ],
    seasonings: [{ name: '塩', amount: 'ひとつまみ' }],
    cookingTimeMinutes: 60,
    servingsBase: 2,
    tags: ['ごはん', '時短', '子ども向け'],
    equipment: ['炊飯器', 'ボウル', 'ラップ'],
    steps: [
      '米を研いで炊飯器で炊く',
      '炊き上がったごはんをボウルに移す',
      '塩を加え、全体に軽く混ぜる',
      'ラップにごはんをのせて包み、好みの形にやさしく握る',
      'のりを巻いて完成',
    ],
    notes: ['炊飯器の機種や米の量により炊き上がりまでの時間は前後します。'],
    // 塩「少々」→「ひとつまみ」は塩むすびと同根拠。cookingTimeMinutes 60分は
    // PHASE D.7-B.1のEvidence Range Integrity Fixにより、Evidence直接支持ではなく
    // Product Decisionとして扱う（下記productDecisions参照。塩むすびと同じ扱い）。
    verification: {
      status: 'review',
      sourceIds: [
        'maff-rice-weight-2026',
        'tabechoku-rice-servings-2026',
        'hitachi-rice-cooker-time-2026',
        'sirogohan-siomusubi-2026',
      ],
      recipeIdentity: {
        canonicalDish: '塩むすび（のり巻き）',
        variant: '塩むすびにのりを巻いた基本のおにぎり',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的・シンプルな塩味＋のりの風味',
        coreMethod: '米を炊飯器で炊き、塩を混ぜて握り、のりを巻く',
        definingIngredients: ['米', '塩', 'のり'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
        { field: 'ingredientAmounts', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
        { field: 'seasonings', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'seasoningAmounts', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        {
          field: 'cookingTimeMinutes',
          sourceIds: ['hitachi-rice-cooker-time-2026', 'sirogohan-siomusubi-2026'],
          supportType: 'range',
          derivation:
            'shio-musubiと同じEvidence Fact（日立公式rangeの40〜60分＋sirogohan.comの握り工程10分）。Recipeのcookingtime=60はrangeからの代表値でありEvidence直接支持ではない（下記productDecisions参照）。',
          evidenceRange: { min: 40, max: 60, unit: '分' },
        },
        {
          field: 'servingsBase',
          sourceIds: ['maff-rice-weight-2026', 'tabechoku-rice-servings-2026'],
          supportType: 'derived',
          derivation: 'shio-musubiと同じ導出（MAFF換算＋tabechokuの「1合で2人分」明記の組み合わせ）。',
        },
        { field: 'criticalSteps', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'equipment', sourceIds: ['sirogohan-siomusubi-2026'], supportType: 'direct' },
        { field: 'allergyIdentity', sourceIds: ['maff-rice-weight-2026'], supportType: 'direct' },
      ],
      productDecisions: [
        {
          field: 'cookingTimeMinutes',
          value: '60分',
          reason: 'shio-musubiと同じ理由（日立公式rangeの中央値50分＋握り工程10分、特定機種非仮定の代表値）。',
          referenceSourceIds: ['hitachi-rice-cooker-time-2026', 'sirogohan-siomusubi-2026'],
        },
      ],
      reviewNotes: [
        'CURRENT: のり2枚 / SOURCE A: （なし） / SOURCE B: （なし） / DECISION: 変更なし（現状維持） / WHY: 複数のnori専門店・レシピサイトを調査したが「おにぎり1個につきのり何枚」を明記した信頼できるsourceが見つからなかった（味匠七福屋のページも枚数を明記していないことを再確認済み） / EVIDENCE TYPE: NOT_FOUND。',
        'cookingTimeMinutesもEvidence FactがrangeのためCritical Field未解決（PHASE D.7-B.1）。のり2枚のNOT_FOUNDと合わせ、複数の理由でVERIFIEDにはできない。',
        'MISSION 2.16 Batch 2 — 海苔の枚数を再調査した。海苔専門店（飯塚海苔店・深谷商店・'
          + '伊勢屋海苔店等）の情報では、おにぎりには全形を3分割した「3切」を1枚（＝全形1/3枚）'
          + '使うのが一般的、と分かった。ただしこれらは海苔のサイズ規格の解説であって「1合分の'
          + 'おにぎりに全形何枚」を述べるレシピsourceではない。信頼できるレシピsourceで「のり◯枚」'
          + 'を明示したものは今回も見つからず（enomusubi等はブログ）。DECISION: 変更なし（HOLD）。'
          + '「のり2枚（全形）」は米1合ぶんのおにぎり3〜4個に対しやや多めだが、規格解説から'
          + '逆算した数値を採用するのは推測にあたるため据え置く。塩「ひとつまみ」・時間の扱いは'
          + 'shio-musubiと同じ（再確認済み） / EVIDENCE TYPE: のり枚数=NOT_FOUND（継続）。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'maguro-don',
    name: 'まぐろ丼',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '2杯分' },
      { name: 'マグロ', amount: '200g' },
    ],
    seasonings: [{ name: 'しょうゆ', amount: '大さじ1' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['丼', '魚', '生食'],
    equipment: ['包丁', 'まな板', '丼'],
    steps: [
      'ごはんを丼によそう',
      'マグロを食べやすい大きさに切る',
      'マグロをごはんにのせる',
      'しょうゆを添える',
    ],
    notes: ['生食用として販売されている魚を使用してください。購入後は早めに食べてください。'],
    arrangements: [
      { id: 'maguro-don-egg-yolk', label: '卵黄をのせる', addIngredients: ['卵'] },
      { id: 'maguro-don-nori', label: 'きざみのりを散らす', addIngredients: ['のり'] },
    ],
    verification: {
      status: 'review',
      sourceIds: ['kamada-maguro-zukedon-2026', 'orangepage-magurodon-2026'],
      recipeIdentity: {
        canonicalDish: 'まぐろ丼',
        variant: '漬けない・刺身をそのままのせて醤油を添える方式（漬け丼ではない）',
        servingsBasis: 2,
        intendedTasteProfile: '素材の味を活かした、食卓で醤油を各自の好みで使うシンプルな刺身丼',
        coreMethod: 'マグロを切ってごはんにのせ、しょうゆは添えるのみ（漬け込まない）',
        definingIngredients: ['マグロ', 'ごはん'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['kamada-maguro-zukedon-2026'], supportType: 'variant' },
        { field: 'ingredientAmounts', sourceIds: ['kamada-maguro-zukedon-2026'], supportType: 'variant' },
        { field: 'servingsBase', sourceIds: ['kamada-maguro-zukedon-2026'], supportType: 'variant' },
      ],
      reviewNotes: [
        'CURRENT: requiredIngredients=マグロ200g・ごはん2杯分(2人分) / SOURCE A: kamada-maguro-zukedon-2026「刺身用マグロ200g・ごはん2人分」/ DECISION: 変更なし（現状維持） / WHY: 魚種・重量・人数はSourceと一致するが、Sourceは「漬け丼」variant（さしみ醤油大さじ2+みりん大さじ1に漬け込む）でありNUKITORUの「そのままのせて添える」variantとは調理法(coreMethod)が異なるため、Recipe Identity不一致によりVARIANT SUPPORTと判定し「解決済み」としてはカウントしない / EVIDENCE TYPE: variant。',
        'CURRENT: seasonings=しょうゆ大さじ1（添える用）/ SOURCE A: 同上（漬け込み用の分量） / DECISION: 変更なし / WHY: 「添えるだけ」variantの具体的な分量を明記した信頼できるsourceが見つからなかった（食卓で各自使う分のため定量化が難しい可能性がある）。漬け込み用の分量をそのまま流用するのはvariant混同にあたるため採用しない / EVIDENCE TYPE: NOT_FOUND。',
        '1 sourceのみで、かつ独立した第2のsourceも見つかっていない。',
        'MISSION 2.12 PHASE B — 「漬け込まずそのまま乗せて醤油を添える」というNUKITORUの'
          + 'variantに一致する専門家/メーカー/公的機関sourceを再調査したが（「刺身丼 基本」'
          + '「まぐろ丼 漬けない」等で検索）、見つかったのは引き続き漬け丼variantのみ'
          + '（クックパッド等の匿名投稿を除く）。REVIEWを維持する。',
        'MISSION 2.16 — Verified Starter Set Evidence Resolution Batch 1。SOURCE B: '
          + 'orangepage-magurodon-2026（オレンジページnet／浜内千波・4人分）まぐろ刺身300g・'
          + 'たれ＝しょうゆ大さじ6＋酒大さじ2＋みりん大さじ2に7〜8mm厚に切って30分以上漬け込む。'
          + 'キッコーマン「まぐろ series」・味の素パーク・白ごはん.com・鎌田醤油も再確認したが、'
          + 'いずれも漬け（marinated）またはたれ和え、もしくはアボカド/長芋等の別トッピング前提で、'
          + 'NUKITORUの「切ってのせ、しょうゆは各自が添えるだけ・漬け込まない」identityを直接'
          + '裏付けるTier1〜3 sourceは今回も得られなかった。DECISION: 変更なし（現状維持） / '
          + 'WHY: Section 15B「漬け／非漬けのEvidenceを混ぜない」に従い、漬け丼sourceの分量を'
          + 'NUKITORUの非漬けvariantへ流用しない。非漬けvariantのしょうゆは「食卓で各自が使う」'
          + '性質上exact定量が困難であり、Section 8によりseasonings=しょうゆ大さじ1という現行の'
          + 'exact値はEvidence裏付けを欠いたまま（NOT_FOUND）。REVIEWを維持する / EVIDENCE '
          + 'TYPE: C（recipe identity mismatch＝漬け丼群）＋ E（非漬けvariantの分量NOT_FOUND）。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'tori-soboro-don',
    name: '鶏そぼろ丼',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '2杯分' },
      { name: '鶏ひき肉', amount: '200g' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: '砂糖', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['丼', '肉', '時短'],
    equipment: ['フライパン', '菜箸'],
    steps: [
      'フライパンに鶏ひき肉、しょうゆ、砂糖、みりんを入れる',
      '中火にかけ、ほぐしながら肉の色が完全に変わるまで炒める',
      'ごはんを丼によそい、そぼろをのせる',
    ],
    notes: ['ひき肉は中心まで色が変わっていることを確認してください。'],
    verification: {
      status: 'review',
      sourceIds: [
        'kikkoman-torisoborodon-2026',
        'sirogohan-torisoboro-2026',
        'kyounoryouri-torisoboro-2026',
        'kyounoryouri-torisoborodon-oba-2026',
      ],
      recipeIdentity: {
        canonicalDish: '鶏そぼろ丼',
        variant: 'みそ・卵を使わないシンプルな3種調味料（しょうゆ・砂糖・みりん）そぼろ',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的な甘辛味',
        coreMethod: '鶏ひき肉を調味料とともにフライパンで炒め煮する（二色丼の卵そぼろは作らない）',
        definingIngredients: ['鶏ひき肉', 'ごはん'],
      },
      fieldVerifications: [
        {
          field: 'requiredIngredients',
          sourceIds: ['kikkoman-torisoborodon-2026', 'sirogohan-torisoboro-2026'],
          supportType: 'direct',
        },
        {
          field: 'ingredientAmounts',
          sourceIds: ['kikkoman-torisoborodon-2026', 'sirogohan-torisoboro-2026'],
          supportType: 'direct',
        },
        { field: 'servingsBase', sourceIds: ['kikkoman-torisoborodon-2026'], supportType: 'variant' },
      ],
      reviewNotes: [
        'CURRENT: 鶏ひき肉200g / SOURCE A: キッコーマン公式(2人分・200g) / SOURCE B: 白ごはん.com(専門家・作りやすい分量・200g) / DECISION: 変更なし / WHY: 両source独立に200gで一致 / EVIDENCE TYPE: direct。',
        'CURRENT: しょうゆ大さじ1と1/2・砂糖大さじ1・みりん大さじ1 / SOURCE A: キッコーマン公式「二色丼」みそ大さじ2+砂糖大さじ2+しょうゆ大さじ1+しょうが汁小さじ2（卵そぼろ別添え、Recipe Identityが異なるためvariant supportのみ）/ SOURCE B: 白ごはん.com（専門家）しょうゆ大さじ3+砂糖大さじ3〜4+酒大さじ1（みそなし、NUKITORUと同じRecipe Identityだが酒でなくみりんを使う点が異なる）/ DECISION: 変更なし（保留） / WHY: SOURCE Bは同一variantで直接比較可能だが、酒→みりんの代替が1:1で成立するという確証がなく、単純平均も禁止されているため、しょうゆ・砂糖を約2倍に引き上げる修正は「未検証のderivation」になってしまう。人間による代替比率の判断が必要なためREVIEW維持 / EVIDENCE TYPE: SOURCE Aはvariant、SOURCE Bはderived候補だが未確定のためNOT_FOUND相当として扱う。',
        '独立した2つの組織（キッコーマン・白ごはん.com）からのsourceは得られているが、鶏ひき肉200gの一致以外はvariant不一致またはderivation未確定のため、Critical Fieldの一部がRESOLVEDにならずVERIFIED不可。',
        'MISSION 2.14 — First 10 Families Starter Set Evidence Resolution。SOURCE C: '
          + 'kyounoryouri-torisoboro-2026（NHKきょうの料理・栗原はるみ、専門家、作りやすい'
          + '分量）鶏ひき肉200g・しょうゆ大さじ3・みりん大さじ2・砂糖大さじ2・酒大さじ1'
          + '（みりんと酒の両方を使用）。DECISION: 変更なし（現状維持） / WHY: 鶏ひき肉200gは'
          + '3source目でも一致し直接支持を強化した。一方、しょうゆ:みりん:砂糖の比率'
          + '（3:2:2）はNUKITORUの比率（1.5:1:1）とちょうど2倍の関係にあり数値的には'
          + '目を引くが、「同じ比率を半分の濃さで使う」という前提はどのsourceも明示して'
          + 'おらず、これをderivationとして採用することはEVIDENCE_POLICY.mdが禁止する'
          + '「暗黙のassumption」に該当する。さらに栗原レシピは酒とみりんを両方使用しており'
          + '、NUKITORUの「酒を使わずみりんのみ」というcoreMethodとも完全には一致しない'
          + '（3つ目の異なる調味料構成）。数値の一致に見える偶然だけでderivationを断定'
          + 'しないため、しょうゆ・砂糖・みりんの分量は引き続きREVIEW対象のまま維持する '
          + '/ EVIDENCE TYPE: 引き続きNOT_FOUND相当（複数variantの中で確定できず）。',
        'MISSION 2.16 Batch 2 — 最優先候補として4 sourceを再精査した。SOURCE B '
          + '（sirogohan・作りやすい分量）醤油大3:砂糖大3〜4:酒大1、火にかける前に生肉と混ぜ'
          + '中火でほぐしながら煮汁を飛ばす。SOURCE C（栗原はるみ・つくりやすい分量）'
          + 'しょうゆ大3:みりん大2:砂糖大2:酒大1、調味料を先に煮立ててから肉を入れる。'
          + 'SOURCE D: kyounoryouri-torisoborodon-oba-2026（NHKきょうの料理／大庭英子・2人分・'
          + '茶碗2杯）鶏ひき肉200g・しょうゆ大3:酒大2:みりん大2:砂糖大1.5:水大3:しょうが小1、'
          + '生肉と調味料を火前に混ぜ→中火→弱火で約8分（ただし炒り卵入りの二色丼）。'
          + 'CONCLUSION: 鶏ひき肉200gは4 sourceで一致するが（＝Commander指摘どおり、これは'
          + 'recipe-level corroborationではない）、調味料はいずれのsourceも200gあたりしょうゆ大3'
          + '前後＋酒を使い、NUKITORU（しょうゆ大1と1/2・砂糖大1・みりん大1・酒なし）はどの'
          + 'sourceともおおよそ半量かつ構成が違う。「なぜこの分量か」をNUKITORUは説明できない。'
          + 'また「200g＝2人分」を明示するのは二色丼のSOURCE Dのみで、NUKITORUと同一identity'
          + '（卵なし）のB/Cは「作りやすい分量」でservingsを述べていない。DECISION: 変更なし'
          + '（HOLD）。sourceが互いに矛盾し、NUKITORUのidentity（酒なし・みりんのみ）に一致する'
          + 'sourceもないため、特定sourceへ寄せる修正はidentity drift＋恣意的採用になる。'
          + 'seasoning/seasoningAmountsは引き続きfieldVerification無し（＝未解決）のまま / '
          + 'EVIDENCE TYPE: E（seasonings NOT_FOUND）＋ 鶏肉量のみ複数source一致。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'gyudon',
    name: '牛丼',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '2杯分' },
      { name: '牛肉', amount: '200g' },
      { name: '玉ねぎ', amount: '1/2個' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ2' },
      { name: 'みりん', amount: '大さじ3' },
      { name: '砂糖', amount: '大さじ1' },
      { name: '酒', amount: '100ml' },
    ],
    cookingLiquids: [{ name: '水', amount: '100ml' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 30,
    servingsBase: 2,
    tags: ['丼', '肉'],
    equipment: ['包丁', 'まな板', '鍋', '丼'],
    steps: [
      '玉ねぎを薄切りにする',
      '鍋にしょうゆ、みりん、砂糖、酒、水を入れて煮立たせる',
      '玉ねぎを加えて煮る',
      '牛肉を加え、色が変わるまで煮る',
      'ごはんを丼によそい、具をのせる',
    ],
    // MISSION 2.11 PHASE D.7-B — Evidence Resolution Protocolにより修正。
    // CURRENT: 玉ねぎ1個・みりん大さじ2・酒なし・cookingLiquidsなし(steps「水少々」)・
    // cookingTimeMinutes20分 / SOURCE A: kikkoman-gyudon-2026「基本の牛丼」(2人分)
    // 玉ねぎ1/2個(100g)・みりん大さじ3・料理の清酒1/2カップ(100ml)・水1/2カップ(100ml)・
    // 調理時間約30分 / DECISION: 玉ねぎ1/2個・みりん大さじ3・酒100ml(seasonings新設)・
    // cookingLiquids水100ml・cookingTimeMinutes30分へ変更、steps内「水少々」は構造化
    // フィールドと重複するため「水」に統一 / WHY: キッコーマン公式が牛肉200g・しょうゆ
    // 大さじ2・砂糖大さじ1という一致部分に加え、他の全fieldを具体的数値で明記しており、
    // 現行値より明らかに正確。単一source(独立した第2source未確認)のためVERIFIEDには
    // しないが、値そのものはDIRECT SUPPORTとして採用する / EVIDENCE TYPE: direct。
    // MISSION 2.12 PHASE B — 独立した第2source（白ごはん.com/専門家）を実際に調査。
    // CURRENT: 玉ねぎ1/2個・みりん大さじ3・酒100ml・水100ml / SOURCE B:
    // sirogohan-gyudon-2026「丼もので人気No.1牛丼」(2〜3人分) 牛肉250g・玉ねぎ1/2個
    // (約150g)・しょうゆ大さじ4(60ml)・みりん50ml・砂糖大さじ3・酒50ml・水200ml、
    // 調理時間30分 / DECISION: 変更なし（現状維持） / WHY: SOURCE B（専門家）は
    // Recipe Identity（基本の牛丼・つゆだくでない甘辛煮）はKikkomanと概ね一致するが、
    // 人数比を揃えても砂糖(約3倍)・しょうゆ(約2倍)・水(約2倍)がKikkomanと大きく異なり、
    // 単純平均は禁止されているため、どちらが「正しい」かをAIが決めることはできない /
    // EVIDENCE TYPE: CONFLICT（Kikkoman=direct基準値, sirogohanとの間で数値相違）。
    verification: {
      status: 'review',
      sourceIds: ['kikkoman-gyudon-2026', 'sirogohan-gyudon-2026', 'orangepage-gyudon-2026'],
      recipeIdentity: {
        canonicalDish: '牛丼',
        variant: '基本の牛丼（つゆだくでない、家庭の甘辛煮）',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的な甘辛味',
        coreMethod: '牛肉と玉ねぎを、しょうゆ・みりん・砂糖・酒・水の煮汁で煮る',
        definingIngredients: ['牛肉', '玉ねぎ', 'ごはん'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['kikkoman-gyudon-2026'], supportType: 'direct' },
        { field: 'ingredientAmounts', sourceIds: ['kikkoman-gyudon-2026'], supportType: 'direct' },
        { field: 'seasonings', sourceIds: ['kikkoman-gyudon-2026'], supportType: 'direct' },
        {
          field: 'seasoningAmounts',
          sourceIds: ['kikkoman-gyudon-2026'],
          supportType: 'direct',
          variantRelation: 'conflicting-within-variant',
        },
        {
          field: 'cookingLiquids',
          sourceIds: ['kikkoman-gyudon-2026'],
          supportType: 'direct',
          variantRelation: 'conflicting-within-variant',
        },
        { field: 'cookingTimeMinutes', sourceIds: ['kikkoman-gyudon-2026'], supportType: 'direct' },
      ],
      reviewNotes: [
        'MISSION 2.12 PHASE B — 独立した第2source（白ごはん.com、専門家）を実査した結果、'
          + '同じ「基本の牛丼」variantでありながら、砂糖(Kikkoman大さじ1 vs sirogohan大さじ3)・'
          + 'しょうゆ(大さじ2 vs 大さじ4)・水(100ml vs 200ml)がservings差を考慮しても大きく食い違うこと'
          + 'が判明した（詳細はコード内コメント参照）。平均化・どちらか一方の恣意的採用はせず、'
          + '両立場をCONFLICTとして記録しREVIEWを維持する。',
        'MISSION 2.13 — Evidence Variant Foundationの分類基準に照らして再確認した。'
          + 'Kikkoman・sirogohanのどちらも「基本の牛丼」と自称するのみで、cooking-method/'
          + 'sauce-base等の意味のある調理上の次元を明示的に区別していないため、'
          + 'isEstablishedVariant()の条件を満たさない。よってこれは正当なvariantの相違では'
          + 'なく「A. likely true conflict」（同一Recipe Identity・同一variant内の真の'
          + '数値矛盾）として分類する。数値の食い違いだけを理由にvariantを新設しない。',
        'MISSION 2.14 — First 10 Families Starter Set Evidence Resolution。味の素パーク'
          + 'の牛丼レシピ2件を追加調査した。「本格牛丼」は青ねぎ・牛肩ロース・ほんだし使用'
          + '（玉ねぎ不使用）で別definingIngredient。「甘辛つゆだく基本の牛丼」は玉ねぎを'
          + '使うがだし少量入り・酒と砂糖を使わないという、Kikkomanともsirogohanとも異なる'
          + '第3の組み合わせだった。DECISION: 変更なし（現状維持） / WHY: 調査するたびに'
          + '異なる調味料構成（だしの有無・酒/砂糖の有無・比率）が見つかっており、牛丼という'
          + '料理自体が家庭・メーカーごとに正当に幅広いvariationを持つことが追加調査でも'
          + '再確認された。Kikkomanの具体的な組み合わせ（だしなし・しょうゆ+みりん+砂糖+酒）'
          + 'を独立に裏付けるsourceはまだ見つからないため、CONFLICT/不十分な独立裏付けの'
          + 'ままREVIEWを維持する。',
        'MISSION 2.16 — Verified Starter Set Evidence Resolution Batch 1。SOURCE C: '
          + 'orangepage-gyudon-2026（オレンジページnet／上田淳子・2人分）牛こま切れ肉200g・'
          + '玉ねぎ1個・砂糖大さじ1（牛肉にもみ込む）・煮汁＝3倍濃縮めんつゆ大さじ3＋水1/2カップ、'
          + 'フライパン＋ふたで玉ねぎを5分煮てから牛肉を2分。だし/しょうゆ/みりん/酒は個別'
          + '計量せず「めんつゆ」に集約。DECISION: 変更なし（現状維持） / WHY: Kikkoman'
          + '（しょうゆ+みりん+砂糖+酒+水を個別計量）・sirogohan（別比率）・上田淳子（めんつゆ）・'
          + 'Ajinomoto（だし入り・酒/砂糖なし）と、権威あるsourceを開くたびに調味の構成そのものが'
          + '異なる。これは牛丼という料理が家庭・メーカーごとに正当な幅を持つことの再確認であり、'
          + 'Section 9/15Cに従い平均化・多数決・新しいsource優先・偽variant新設はいずれも行わない。'
          + 'NUKITORUはKikkoman単独processに整合しているが、その調味量を独立に裏付けるsourceは'
          + '今回も得られず、同一identity内のtrue conflictとしてREVIEWを維持する / EVIDENCE '
          + 'TYPE: 引き続きA（likely true conflict）＋ F（独立裏付け不足）。',
      ],
      hasUnsupportedInference: false,
    },
  },
  {
    id: 'oyako-don',
    name: '親子丼',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '2杯分' },
      { name: '鶏肉', amount: '1/2枚（100〜120g）' },
      { name: '卵', amount: '3個' },
      { name: '玉ねぎ', amount: '1/2個' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ2' },
      { name: 'みりん', amount: '大さじ3' },
    ],
    cookingLiquids: [{ name: '水', amount: '150ml' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['丼', '肉', '卵'],
    equipment: ['包丁', 'まな板', 'フライパン', '丼'],
    steps: [
      '鶏肉を一口大に切り、玉ねぎを薄切りにする',
      'フライパンにしょうゆ、みりん、水、玉ねぎ、鶏肉を入れて煮る',
      '鶏肉の中心まで火が通ったら、溶き卵を回し入れる',
      '卵が好みの固さになったら火を止め、ごはんにのせる',
    ],
    notes: ['鶏肉は中心まで白く火が通っていることを確認してください。'],
    // MISSION 2.11 PHASE D.7-B — Evidence Resolution Protocolにより修正。
    // CURRENT: 鶏肉200g・卵2個・みりん大さじ2・cookingTimeMinutes20分 / SOURCE A:
    // kikkoman-oyakodon-2026「基本の親子丼」(2人分) 鶏もも肉1/2枚(100〜120g)・卵3個・
    // みりん大さじ3・調理時間約15分 / DECISION: 鶏肉「1/2枚（100〜120g）」(source表記の
    // rangeをそのまま維持し、point-selectionを行わない)・卵3個・みりん大さじ3・
    // cookingTimeMinutes15分へ変更 / WHY: しょうゆ大さじ2・玉ねぎ1/2個・水150mlは既に
    // 完全一致しており、キッコーマン公式は責任あるメーカーレシピとして他のfieldも高い
    // 信頼性を持つため採用。鶏肉量は「100〜120g」というsourceのrange表記をそのまま
    // Recipeのamount文字列として保持し、独自の代表値選定は行わない（rangeそのものを
    // そのまま複製しているため、point-selectionを伴うrange supportではなくdirect
    // support として扱う） / EVIDENCE TYPE: direct。
    // MISSION 2.12 PHASE B — 独立した第2/第3sourceを実際に調査。
    // SOURCE B: ajinomoto-oyakodon-2026（味の素パーク公式・2人分）鶏もも肉100g・卵2個・
    // 玉ねぎ1/2個(100g)・しょうゆ大さじ1・みりん大さじ1・砂糖大さじ1/2・水3/4カップ+
    // ほんだし小さじ1、調理時間15分。SOURCE C: sirogohan-oyakodon-2026（専門家・2人分）
    // 鶏もも肉100g・卵4個・玉ねぎ1/8個(だし汁ベースのvariant)・しょうゆ大さじ2〜2.5・
    // みりん大さじ4・だし汁大さじ4・砂糖小さじ2、調理時間20分。
    // DECISION: 変更なし（現状維持） / WHY: 玉ねぎ量・調理時間はKikkomanと一致するが、
    // 卵個数（3個 vs Ajinomoto2個 vs sirogohan4個）・しょうゆ/みりん比率が3source間で
    // 食い違う。特にAjinomoto・sirogohanは「だし（ほんだし/だし汁）＋砂糖」を使う
    // coreMethodであり、Kikkoman/NUKITORUの「だしなし・砂糖なし」のcoreMethodとは
    // 前提が異なるvariantのため、直接比較・平均化はしない / EVIDENCE TYPE:
    // AjinomotoはCONFLICT（同一variant内での卵個数相違）、sirogohanはVARIANT
    // （coreMethod相違＝だし使用の有無）。
    verification: {
      status: 'review',
      sourceIds: [
        'kikkoman-oyakodon-2026',
        'ajinomoto-oyakodon-2026',
        'sirogohan-oyakodon-2026',
        'hinode-mirin-oyakodon-2026',
        'honmirin-oyakodon-2026',
      ],
      recipeIdentity: {
        canonicalDish: '親子丼',
        variant: '基本の親子丼（つゆだく・だし重ねタイプではない、だし・砂糖を使わない）',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的な甘辛味、卵はとろとろ半熟',
        coreMethod: '鶏肉・玉ねぎをしょうゆ・みりん・水で煮て、溶き卵でとじる（だし・砂糖は使わない）',
        definingIngredients: ['鶏肉', '卵', 'ごはん'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['kikkoman-oyakodon-2026'], supportType: 'direct' },
        { field: 'ingredientAmounts', sourceIds: ['kikkoman-oyakodon-2026'], supportType: 'direct' },
        {
          field: 'seasonings',
          sourceIds: ['kikkoman-oyakodon-2026'],
          supportType: 'direct',
          variantRelation: 'conflicting-within-variant',
        },
        {
          field: 'seasoningAmounts',
          sourceIds: ['kikkoman-oyakodon-2026'],
          supportType: 'direct',
          variantRelation: 'conflicting-within-variant',
        },
        { field: 'cookingLiquids', sourceIds: ['kikkoman-oyakodon-2026'], supportType: 'direct' },
        { field: 'cookingTimeMinutes', sourceIds: ['kikkoman-oyakodon-2026'], supportType: 'direct' },
      ],
      reviewNotes: [
        'MISSION 2.12 PHASE B — 独立した第2source（味の素パーク公式）を実査した結果、'
          + '玉ねぎ量・調理時間はKikkomanと一致する一方、卵個数（Kikkoman/NUKITORU3個 vs '
          + 'Ajinomoto2個）としょうゆ・みりんの比率が食い違うことが判明した。第3source'
          + '（白ごはん.com）はだし汁・砂糖を使う別coreMethodのvariantであり、直接比較の対象外'
          + '（詳細はコード内コメント参照）。平均化・恣意的採用はせずCONFLICTとして記録し'
          + 'REVIEWを維持する。',
        'MISSION 2.13 — Evidence Variant Foundationの分類基準に照らして再分類した。'
          + 'sirogohan/Ajinomotoの「だし＋砂糖を使う」coreMethodは、cooking-method/'
          + 'sauce-base次元でKikkoman/NUKITORUの「だしなし」coreMethodと明確に異なり、'
          + '「C. recipe identity mismatch」（別Recipe Identity。単純な数値conflictではない）'
          + 'として分類する。一方、Kikkoman単独source内の卵個数・しょうゆ/みりん量は、'
          + '同一Recipe Identity内で独立した第2sourceによる裏付けがまだ得られていない状態'
          + 'であり、これはisEstablishedVariant()の条件（意味のある次元＋2独立source or '
          + '権威ある情報源の明示）を満たさないため、正当なvariantとして確立しない。',
        'MISSION 2.14 — First 10 Families Starter Set Evidence Resolution。「だしなし」'
          + 'identityへの独立した裏付けを求めて追加調査した。SOURCE D: hinode-mirin-'
          + 'oyakodon-2026（みりんメーカー公式・2人分）鶏もも肉150g・卵2個・玉ねぎ1/2個・'
          + 'みりん大さじ4・しょうゆ大さじ2・だし汁100ml（砂糖なし）、調理時間15分。'
          + 'SOURCE E: honmirin-oyakodon-2026（全国味淋協会・2人分）本みりん30cc・'
          + 'しょうゆ30cc・だし汁120cc・鶏もも肉100g・玉ねぎ1/2個・卵2個（黄金比 '
          + 'みりん1:しょうゆ1:だし4）。DECISION: 変更なし（現状維持） / WHY: 独立した'
          + '4つのsource（Ajinomoto・sirogohan・Hinode・全国味淋協会）が揃って「だし使用」の'
          + 'coreMethodを示しており、「だしなし」というKikkoman/NUKITORUのRecipe Identity'
          + 'は依然としてKikkoman単独でしか裏付けられていないことが、追加調査によって'
          + 'むしろ強化された。多数のsourceが別variantを支持するからといって、NUKITORUの'
          + 'Recipe Identityを多数派へ変更する（identity drift）ことはしない——Section 8'
          + '「Prefer REVIEW over identity drift」に従い、現状のRecipe Identity・内容は'
          + '変更せずREVIEWのまま維持する / EVIDENCE TYPE: 引き続きC（recipe identity '
          + 'mismatch、だし使用variant群）+ F（Kikkoman単独source、独立裏付け不足）。',
        'MISSION 2.16 — Verified Starter Set Evidence Resolution Batch 1。既存SOURCE A '
          + '（kikkoman-oyakodon-2026 = washoku/020）の本文を再度開いて確認: 2人分・鶏もも肉'
          + '1/2枚(100〜120g)・卵3個・玉ねぎ1/2個(100g)・〈A〉水3/4カップ＋しょうゆ大さじ2＋'
          + '本みりん大さじ3・砂糖なし・だしなし（水のみ）・約15分。NUKITORUの全fieldが今も'
          + 'このKikkomanレシピと一致する（水150ml≒3/4カップも一致）ことを再確認した。ただし'
          + '(1) Kikkoman本文は鶏肉に小麦粉をまぶし、玉ねぎを先に煮てから肉を加える手順で、'
          + 'NUKITORUの「調味料・玉ねぎ・鶏肉を一度に入れて煮る」簡略手順とは調理sequenceが'
          + '異なるためcriticalStepsは direct とは言い切れない。(2) 「だしなし・砂糖なし」'
          + 'identityは追加調査（Ajinomoto／白ごはん.com／日の出みりん／全国味淋協会＝すべて'
          + 'だし使用）でもKikkoman単独のまま。DECISION: 変更なし（現状維持・facts正確） / '
          + 'WHY: 単一Tier2 sourceかつ独立裏付けなし、coherenceReview未実施のため、'
          + 'Section 17のVERIFIED要件を満たさない。identity driftを避けREVIEWを維持する / '
          + 'EVIDENCE TYPE: 引き続きF（単独source）＋ 手順のsupportType要再検討。',
      ],
      hasUnsupportedInference: false,
    },
  },
  {
    id: 'natto-gohan',
    name: '納豆ごはん',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '1杯分' },
      { name: '納豆', amount: '1パック' },
    ],
    seasonings: [{ name: 'しょうゆ', amount: '小さじ1' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['ごはん', '時短', '朝食'],
    equipment: ['茶碗'],
    steps: ['ごはんを茶碗によそう', '納豆にしょうゆを混ぜる', 'ごはんにのせる'],
    verification: {
      status: 'review',
      sourceIds: [],
      recipeIdentity: {
        canonicalDish: '納豆ごはん',
        variant: '付属タレを使わず、しょうゆで代用する場合',
        servingsBasis: 1,
        intendedTasteProfile: '家庭的なしょうゆ味',
        coreMethod: '納豆にしょうゆを混ぜてごはんにのせる',
        definingIngredients: ['納豆', 'ごはん'],
      },
      reviewNotes: [
        'CURRENT: しょうゆ小さじ1 / SOURCE A: （なし） / SOURCE B: （なし） / DECISION: 変更なし（現状維持） / WHY: 「納豆1パックに対してしょうゆ何杯」という代用分量を明記した公的機関・メーカー・専門家によるsourceが再調査でも見つからなかった（和食ごよみ等の個人ブログはヒットしたが、具体的な代用分量の記載はなく、専門家性も明確でないため採用しない）。多くのレシピは納豆付属のタレを使う前提で、しょうゆ代用時の量は「お好みで」とされることが多い / EVIDENCE TYPE: NOT_FOUND。',
        '安全性・アレルギーに関わる問題はないためBLOCKEDにはせず、分量未検証としてREVIEWに留める。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'tuna-mayo-don',
    name: 'ツナマヨ丼',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '1杯分' },
      { name: 'ツナ', amount: '1缶（70g）' },
    ],
    seasonings: [
      { name: 'マヨネーズ', amount: '大さじ2' },
      { name: 'しょうゆ', amount: '小さじ1/2' },
    ],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: 'マヨネーズ' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 1,
    tags: ['丼', '時短'],
    equipment: ['ボウル', '丼'],
    steps: [
      'ツナの油を軽くきる',
      'ボウルでツナとマヨネーズ、しょうゆを混ぜる',
      'ごはんにのせる',
    ],
    // MISSION 2.11 PHASE D.7-B — Evidence Resolution Protocol再監査。
    // D.7-Aで根拠として使ったキユーピー公式X(旧Twitter)投稿は、再監査でWebFetchが
    // HTTP 402で本文を取得できないことが判明した。「Source本文を確認できない」場合は
    // 使用禁止のため、そのSourceに基づく判断（しょうゆの補正）は撤回する。
    // CURRENT: ツナ1缶（サイズ不明）・マヨネーズ大さじ1 / SOURCE A: kewpie-tunamayo-2026
    // 「1/2缶(35g)にマヨネーズ大さじ1・めんつゆ小さじ1、1人分」(本文確認済み) / SOURCE B:
    // seikatuchiebukuro-tuna-can-size-2026「ツナ缶は一般的に1缶70g」(本文確認済み) /
    // DECISION: 「ツナ1缶」を「1缶（70g）」に明記し、マヨネーズを大さじ1→大さじ2へ変更。
    // しょうゆは変更しない（現状維持） / WHY: 缶サイズはSOURCE Bで70gが標準と直接確認済み。
    // マヨネーズは35g→大さじ1という単一の事実を70g(2倍)に比例計算しただけで、
    // マヨネーズという同一製品内の比例のためvariant差の影響を受けない(derived)。
    // 一方、しょうゆについてはSOURCE Aが「めんつゆ」を使用しており、NUKITORUの
    // 「しょうゆ」とは製品variantが異なる（めんつゆは出汁・みりん等で希釈されているため
    // 同じ小さじ数でも塩味の強さが異なり、単純換算できない）。X投稿の「しょうゆ大さじ1/2」
    // という情報は本文確認ができず不採用のため、しょうゆの分量はNOT_FOUNDのまま
    // 変更しない / EVIDENCE TYPE: マヨネーズ=derived、しょうゆ=NOT_FOUND。
    verification: {
      status: 'review',
      sourceIds: [
        'kewpie-tunamayo-2026',
        'seikatuchiebukuro-tuna-can-size-2026',
        'orangepage-tunamayodon-2026',
        'kurashiru-tunamayodon-2026',
        'hoteifoods-tunamayodon-2026',
      ],
      recipeIdentity: {
        canonicalDish: 'ツナマヨ丼',
        variant: 'しょうゆで味を引き締めるツナマヨ（めんつゆ使用ではない）',
        servingsBasis: 1,
        intendedTasteProfile: '家庭的なマヨネーズのコクとしょうゆの塩味',
        coreMethod: 'ツナの油をきり、マヨネーズ・しょうゆと和えてごはんにのせる',
        definingIngredients: ['ツナ', 'マヨネーズ'],
      },
      fieldVerifications: [
        {
          field: 'requiredIngredients',
          sourceIds: ['seikatuchiebukuro-tuna-can-size-2026'],
          supportType: 'direct',
        },
        {
          field: 'seasonings',
          sourceIds: ['kewpie-tunamayo-2026'],
          supportType: 'derived',
          derivation:
            'キユーピー公式「1/2缶(35g)にマヨネーズ大さじ1」という直接事実を、缶サイズ70g(2倍)に比例計算してマヨネーズ大さじ2とした。マヨネーズという同一製品内の比例計算のためvariant差の影響を受けない。',
        },
      ],
      reviewNotes: [
        'requiredIngredients/seasoningsの一部（マヨネーズ）はDIRECT/DERIVEDで解決したが、しょうゆの分量はNOT_FOUNDのまま（詳細はコード内コメント参照）。すべてのcritical fieldが解決していないためVERIFIEDにはしない。',
        '独立した第2のsourceとしてseikatuchiebukuro-tuna-can-size-2026（缶サイズ）を追加したが、キユーピー社という単一メーカーへの依存自体は解消していない。',
        'MISSION 2.16 Batch 2 — identityを起点に4 sourceを実査した。SOURCE C: '
          + 'orangepage-tunamayodon-2026（オレンジページnet／長谷川よし子・4人分）ツナ缶165g・'
          + 'マヨ大3・しょうゆ大1・練りわさび小1/2、ボウルでツナ＋マヨ＋しょうゆ＋わさびを'
          + '混ぜてごはんへ（1人分換算 ツナ約41g・マヨ約小2.25・しょうゆ約小0.75・わさび入り）。'
          + 'SOURCE D: kurashiru-tunamayodon-2026（クラシル・1人前・監修者記載なし）ごはん150g・'
          + 'ツナ油漬け70g（汁ごと＝油をきらない）・玉ねぎ1/4個・マヨ大2・のり適量（しょうゆなし）。'
          + 'SOURCE E: hoteifoods-tunamayodon-2026（ホテイフーズ・1人分）分量表記なし、ツナ＋'
          + 'めんつゆを混ぜ→マヨは格子がけ→刻み海苔＋あさつき。CONCLUSION: (1) 「ツナ70g＋'
          + 'マヨ大さじ2」はSOURCE D（クラシル）が独立に一致し、従来の「キユーピー35g×2の比例'
          + '(derived)」より裏付けは強まった。ただしクラシルは監修者なしのother-trustedで、'
          + '油をきらず玉ねぎを加える別処理。(2) しょうゆ小さじ1/2は依然どのsourceとも一致せず'
          + '（Kewpie/Hoteiはめんつゆ、クラシルはしょうゆなし、オレンジページはしょうゆ＋わさびで'
          + '1人分換算≒小0.75）。(3) 油をきる/きらない、混ぜる/格子がけ、薬味の有無もsource間で'
          + '不一致。DECISION: 変更なし（HOLD）。マヨ大さじ2は裏付けが増したがsingle other-trusted'
          + 'かつ処理差があり、Decision 1（単独ソース不可・品質と独立性を要件とする）に照らして'
          + 'seasoningsのsupportTypeはderivedのまま据え置く。しょうゆ小さじ1/2は引き続きNOT_FOUND '
          + '/ EVIDENCE TYPE: マヨ=derived（裏付け強化）、しょうゆ=NOT_FOUND、process=source間不一致。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'curry-rice',
    name: 'カレーライス',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '4杯分' },
      { name: '豚肉', amount: '300g' },
      { name: '玉ねぎ', amount: '2個' },
      { name: 'にんじん', amount: '1本' },
      { name: 'じゃがいも', amount: '2個' },
    ],
    seasonings: [{ name: 'カレールー', amount: '1箱（4皿分）' }],
    cookingLiquids: [{ name: '水', amount: '650ml' }],
    ingredientChecks: [{ ingredientName: 'カレールー' }],
    cookingTimeMinutes: 40,
    servingsBase: 4,
    tags: ['煮込み', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋', 'お玉'],
    steps: [
      '玉ねぎ、にんじん、じゃがいも、豚肉を一口大に切る',
      '鍋で豚肉を炒め、色が変わったら玉ねぎ、にんじん、じゃがいもを加えて炒める',
      '水を加えて具材が柔らかくなるまで煮込む',
      '火を止めてカレールーを溶かし入れる',
      '再び弱火にかけ、とろみがつくまで煮る',
      'ごはんを皿に盛り、カレーをかける',
    ],
    notes: ['豚肉は中心まで色が変わっていることを確認してください。'],
    verification: {
      status: 'review',
      sourceIds: ['housefoods-vermont-curry-2026'],
      recipeIdentity: {
        canonicalDish: 'カレーライス',
        variant: '豚肉使用・具だくさん・市販ルー使用（メーカー非指定、「1箱=4皿分」の製品を想定）',
        servingsBasis: 4,
        intendedTasteProfile: '家庭的・子ども向けの甘口〜中辛',
        coreMethod: '豚肉と野菜を炒めてから煮込み、市販ルーで仕上げる',
        definingIngredients: ['豚肉', '玉ねぎ', 'カレールー'],
      },
      fieldVerifications: [
        { field: 'cookingLiquids', sourceIds: ['housefoods-vermont-curry-2026'], supportType: 'variant' },
      ],
      reviewNotes: [
        'CURRENT: 水650ml・玉ねぎ2個・にんじん1本・じゃがいも2個(4皿分) / SOURCE A: housefoods-vermont-curry-2026「バーモントカレー」基本レシピ6皿分(ルー1/2箱=115g、牛肉250g、玉ねぎ中2個、にんじん中1/2本、じゃがいも中1・1/2個、水850ml) / DECISION: 変更なし（現状維持） / WHY: SOURCE Aを4皿分に比例換算すると水約567ml・玉ねぎ約1.3個・にんじん約1/3本・じゃがいも約1個となり、NUKITORU現行値はすべてこれより多め。しかしSOURCE Aは牛肉ベースでNUKITORUは豚肉ベースという食材差があり、かつ「ルー1/2箱=115g」という特定商品サイズを前提にしているのに対しNUKITORUの「1箱（4皿分）」は商品を特定していないため、Recipe Identity（ルー製品）が異なりVARIANT SUPPORTと判定。単純な比例換算による補正はvariant混同にあたるため採用しない / EVIDENCE TYPE: variant。',
        'カレールーは製品によって「1箱=何皿分」の設計が大きく異なり（ハウス食品の230g箱は今回の基準レシピで実質12皿相当）、特定商品を仮定しない限り水量をVERIFIEDにできない。これはPHASE D.5のProduct Check Alert（カレールー）の設計思想とも整合する。',
        '安全上の問題はないためBLOCKEDにはせず、product-dependentな水量としてREVIEWに留める。',
      ],
      hasUnsupportedInference: true,
    },
  },

  // ------------------------------------------------------------
  // 肉の主菜
  // ------------------------------------------------------------
  {
    id: 'pork-cabbage-miso-stirfry',
    name: '豚肉とキャベツの味噌炒め',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '豚肉', amount: '200g' },
      { name: 'キャベツ', amount: '1/4個' },
    ],
    seasonings: [
      { name: '味噌', amount: '大さじ1' },
      { name: '砂糖', amount: '小さじ1' },
      { name: '酒', amount: '大さじ1' },
    ],
    ingredientChecks: [{ ingredientName: '味噌' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['炒め物', '時短'],
    equipment: ['包丁', 'まな板', 'フライパン'],
    steps: [
      'キャベツを一口大に切る',
      'フライパンで豚肉を炒め、中心まで色が変わったらキャベツを加える',
      '味噌、砂糖、酒を混ぜたたれを加えて炒め合わせる',
    ],
    notes: ['豚肉は中心まで色が変わっていることを確認してください。'],
    verification: {
      status: 'review',
      sourceIds: ['marukawamiso-pork-cabbage-2026', 'delishkitchen-pork-cabbage-2026'],
      recipeIdentity: {
        canonicalDish: '豚肉とキャベツの味噌炒め',
        variant: '汁気のない乾いた炒め物（だし・とろみなし、しめじ/もやし/しょうがを加えない）',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的な味噌のコク',
        coreMethod: '豚肉を炒めてからキャベツを加え、味噌だれで炒め合わせる',
        definingIngredients: ['豚肉', 'キャベツ', '味噌'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['delishkitchen-pork-cabbage-2026'], supportType: 'variant' },
        { field: 'seasonings', sourceIds: ['delishkitchen-pork-cabbage-2026'], supportType: 'variant' },
      ],
      reviewNotes: [
        'CURRENT: 豚肉200g・味噌大さじ1・砂糖小さじ1・酒大さじ1 / SOURCE A: delishkitchen-pork-cabbage-2026（2人分・豚肉200g・酒大さじ1・砂糖小さじ1・みそ大さじ1と1/2、Recipe Identityがほぼ同一のvariant）/ SOURCE B: marukawamiso-pork-cabbage-2026（味噌メーカー公式・4人前・だし200cc/しめじ/もやし/しょうが入りの「汁気のある」別variant）/ DECISION: 変更なし（現状維持） / WHY: SOURCE Aは豚肉・砂糖・酒が完全一致し味噌もほぼ近い（大さじ1 vs 1と1/2）ため現行値は妥当な範囲内。SOURCE Bは具材構成が異なる別Recipe Identityのためvariant supportに留め、比較対象にしない / EVIDENCE TYPE: SOURCE Aはdirect、SOURCE Bはvariant。',
        'SOURCE A（DELISH KITCHEN）は運営体制上「専門家監修」の明記がなくother-trusted相当のため、同一variantでのTier1/2 sourceによる独立裏付けにはまだ至っていない。',
        'MISSION 2.16 Batch 2 — SOURCE A（delishkitchen-pork-cabbage-2026, URL 204011258012239082）'
          + 'の本文を再度開いて確認したところ、現在の掲載内容が過去の記録と食い違っていた。'
          + '現行の材料表: 豚バラ薄切り200g・キャベツ4枚・にんにく1かけ・サラダ油大さじ1・'
          + '酒大さじ1・みりん大さじ1・砂糖小さじ1・みそ大さじ1と1/2、監修「佐藤ゆか（管理栄養士／'
          + '食育スペシャリスト）」明記。過去のreviewNoteが記録した「酒大1・砂糖小1・みそ大1と1/2」'
          + 'にはみりん・にんにく・油が含まれておらず、監修者なしと記載していた点も現状と異なる。'
          + 'CONCLUSION: レシピプラットフォームのURLは内容が改訂され得る（mutable Evidence）。'
          + '現行SOURCE Aは NUKITORU（味噌大さじ1・みりんなし・にんにくなし・油記載なし・豚肉の'
          + '部位未指定）と、味噌量・みりん有無・にんにく有無で一致しない。DECISION: Recipe fact'
          + 'は変更なし（HOLD、材料・分量・手順は据え置き）。ただしEvidence記録の正確性のため、'
          + 'requiredIngredients と seasonings の fieldVerification.supportType を direct → variant '
          + 'へ訂正した（BEFORE: direct / EVIDENCE: 現行delishkitchen本文が味噌大1.5・みりん・'
          + 'にんにくを含みNUKITORUと不一致 / AFTER: variant / REASON: 同一料理圏だが具体的な'
          + '調味構成が異なり「解決済み」とは言えないため）。同一identity（汁気なし・だしなし）の'
          + 'Tier1/2独立sourceは今回も得られず、味噌大さじ1の根拠は説明できない（NOT_FOUND） / '
          + 'EVIDENCE TYPE: E（味噌量NOT_FOUND）＋ mutable-source limitation（下記構造的知見）。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'tori-teriyaki',
    name: '鶏の照り焼き',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '鶏もも肉', amount: '300g' }],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' },
      { name: '酒', amount: '大さじ1' },
      { name: '砂糖', amount: '小さじ1' },
      { name: '塩', amount: '少々' },
      { name: 'サラダ油', amount: '小さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['焼き物', '子ども向け'],
    equipment: ['フライパン'],
    preparation: [
      {
        text: '調理の約30分前に鶏もも肉を冷蔵庫から出し、室温に戻す',
        passiveWait: true,
        duration: { kind: 'approximate', minutes: 30 },
      },
      { text: '鶏もも肉の余分な脂肪を除く' },
      { text: '筋の多いところや厚いところに切り目を入れる' },
      { text: '縦半分に切り、1切れを3等分にする（計6切れ）' },
      { text: 'しょうゆ・みりん・酒・砂糖・塩を混ぜ合わせて、たれを作っておく' },
    ],
    steps: [
      'フライパンにサラダ油小さじ1を入れ、鶏もも肉を皮目を下にして並べ、中火で2〜3分焼く',
      '焼き色がついたら返し、ふたをして弱めの中火で3〜4分蒸し焼きにする',
      'ふたを取り、ペーパータオルで溶け出た脂を拭く',
      'あらかじめ混ぜ合わせたたれを回し入れる',
      '強めの中火で煮詰めながら、照りが出るまでからめる',
    ],
    notes: ['鶏もも肉は中心まで火が通っていることを確認してください。'],
    verification: {
      // MISSION 2.26 — NUKITORU FOOD 初の Recipe Evidence VERIFIED。
      // Recipe body（食材・分量・人数・調味・下ごしらえ・工程・器具・アレルゲン識別・process整合）が
      // Evidence 要件を満たす。Product Time は Decision B により別 dimension（productTimeStatus='review'）。
      status: 'verified',
      sourceIds: [
        'kikkoman-toriteriyaki-2026',
        'sshoyu-toriteriyaki-2026',
        'sirogohan-toriteriyaki-2026',
        'kyounoryouri-toriteriyaki-kawano-2026',
        // allergyIdentity（derived）が使う allergen Evidence（MISSION 2.25）
        'caa-food-allergy-labeling-2026',
        'kikkoman-shoyu-allergen-2026',
        'sanj-glutenfree-shoyu-2026',
      ],
      recipeIdentity: {
        canonicalDish: '鶏の照り焼き',
        variant:
          '小麦粉をまぶさず、サラダ油少量で鶏もも肉を皮目から焼き、返してふたをして弱めの中火で3〜4分蒸し焼きにし、溶け出た脂を拭いてから、しょうゆ・みりん・酒を同量ずつ＋砂糖少々＋塩少々の合わせだれ（事前に混ぜる）を加えて、強めの中火で照りが出るまで煮からめるフライパン調理の照り焼き。焼く前に鶏肉を切り分ける。',
        servingsBasis: 2,
        // MISSION 2.22: taste 推論を避け、合わせだれの構成を事実として記述するに留める（「効かせ」「ごく少量」「家庭的」は除去）
        intendedTasteProfile: 'しょうゆ・みりん・酒を同量ずつ、砂糖と塩は少量の合わせだれで仕上げる照り焼き',
        coreMethod:
          '皮目から焼いて返し、ふたをして蒸し焼きにし、溶け出た脂を拭いてから、事前に合わせたたれを加えて照りが出るまで煮からめる',
        definingIngredients: ['鶏もも肉'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'], supportType: 'direct' },
        { field: 'ingredientAmounts', sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'], supportType: 'direct' },
        { field: 'servingsBase', sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'], supportType: 'direct' },
        { field: 'seasonings', sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'], supportType: 'direct' },
        { field: 'seasoningAmounts', sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'], supportType: 'direct' },
        { field: 'criticalSteps', sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'], supportType: 'direct' },
        { field: 'equipment', sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'], supportType: 'direct' },
        { field: 'preparation', sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'], supportType: 'direct' },
        {
          // MISSION 2.26 — allergyIdentity は「Recipe source が食材を証明」＋「日本の食品表示制度と
          // 製造者アレルギー表示、NUKITORU の default-generic-risk policy が ingredient→allergen 関係を証明」
          // の組み合わせ＝derived。NHK は allergen 分類を確立しないため direct[NHK] にはしない。
          field: 'allergyIdentity',
          sourceIds: [
            'caa-food-allergy-labeling-2026',
            'kikkoman-shoyu-allergen-2026',
            'sanj-glutenfree-shoyu-2026',
          ],
          supportType: 'derived',
          derivation:
            'Recipe の食材同定（鶏もも肉・しょうゆ・みりん・酒・砂糖・塩・サラダ油）は NHK source が直接確立。'
            + '各食材の allergen-relevant identity を、日本の食品表示制度（消費者庁: 小麦=特定原材料/義務、'
            + '大豆・鶏肉=特定原材料に準ずるもの/推奨）と製造者公式アレルギー表示、NUKITORU の '
            + 'default-generic-risk policy（ingredient-allergens.ts）で評価した: '
            + '(a) しょうゆ → 小麦・大豆 = default-generic-risk（標準的市販こいくちしょうゆが小麦・大豆を'
            + 'アレルギー物質として表示。小麦不使用のグルテンフリーしょうゆも実在するため generic は fail-safe に'
            + '小麦・大豆関連として HARD EXCLUDE）。'
            + '(b) みりん（本みりん・みりん風とも）・(c) 酒（料理の清酒）= 製造者公式でアレルギー特定原材料等の表示なし。'
            + '(d) 砂糖・(e) 塩 = 特定原材料等に非該当。'
            + '(f) サラダ油 = 精製油脂で残存タンパクが検出限界以下 → 大豆アレルゲン表示不要（公式ルール）→ 除外対象にしない。'
            + '(g) 鶏もも肉 = 鶏肉（準ずる）。ingredient-taxonomy.ts が「鶏肉」アレルギーを鶏もも肉へ HARD EXCLUDE 済み。'
            + '結論: 全7食材の allergen-relevant identity は評価済みで、判断根拠は上記 source と policy に traceable。',
        },
      ],
      coherenceReview: {
        status: 'coherent',
        sourceProcessNotes: [
          {
            sourceId: 'kyounoryouri-toriteriyaki-kawano-2026',
            equipment: 'フライパン',
            fatOrOil: 'サラダ油小さじ1',
            lid: '皮目に焼き色がついて返したあと、片面だけふたをして弱めの中火で3〜4分蒸し焼き',
            heatSequence: '中火で皮目2〜3分→返してふたをして弱めの中火3〜4分→ふたを取り強めの中火で照りが出るまで煮からめ',
            flip: '皮目に焼き色がついたら1回返す',
            seasoningSequence: 'しょうゆ・みりん・酒・砂糖・塩を事前に混ぜ、溶け出た脂を拭いたあとに回し入れる',
            preparationSequence: '約30分前に室温に戻す→余分な脂肪を除く→筋の多い/厚いところに切り目→縦半分から3等分→たれを混ぜる',
          },
        ],
        reviewedDimensions: [
          'equipment',
          'fat-or-oil',
          'lid',
          'heat-sequence',
          'flip-or-turn',
          'seasoning-sequence',
          'major-preparation-sequence',
        ],
        rationale:
          'Recipe body は NHKきょうの料理・河野雅子「鶏の照り焼き」という単一sourceの単一processだけで構成され、複数sourceのprocess事実を混成していないためcoherent。corroborating source（味の素KK・日本ハム・DELISH KITCHEN・白ごはん.com）は独立裏付けの比較にのみ使い、Recipe factは輸入していない。coherent はVERIFIED・安全・美味・authentic・publishable を意味しない（status は review のまま）。',
      },
      timeVerification: {
        sourceStatedTotal: {
          value: { kind: 'exact', minutes: 15 },
          sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'],
          // MISSION 2.26 — NHK は「調理時間15分 ※鶏肉を常温に戻す時間は除く」と明記。
          // 除外スコープ（約30分の restingMinutes）を machine-readable に保持する。
          // これは value と足さない（15+30=45 のような arithmetic は一切しない。Decision B / Section 5）。
          excludes: [
            {
              kind: 'restingMinutes',
              value: { kind: 'approximate', minutes: 30 },
              sourceIds: ['kyounoryouri-toriteriyaki-kawano-2026'],
            },
          ],
        },
        // Decision B: Product elapsed time は未確定。source displayed time（15分）や legacy
        // cookingTimeMinutes を確定値として表示・filter・ranking に使わない（productCookingTimeMinutes=null）。
        productTimeStatus: 'review',
      },
      // MISSION 2.26 — 未解決の Recipe-Evidence 問題は残っていない（Decision B のもと、未確定 Product Time は
      // Recipe-Evidence 問題ではない）。監査履歴・source比較・provenance・explainability は provenanceNotes へ。
      reviewNotes: [],
      provenanceNotes: [
        'MISSION 2.18 Batch 3 — 初回のEvidence Resolution（この recipe には従来 verification ブロックが無かった）。'
          + '5件のTier2/3 sourceを実際に開いて確認。RecipeIdentityは全source一致で「鶏もも肉・皮つき」。'
          + '2.18時点では requiredIngredients「鶏肉」やたれ等の unsupported legacy fact を HOLD（Commander判断事項）'
          + 'としていたが、MISSION 2.20（Preparation/Time foundation）・MISSION 2.21（Ingredient taxonomy foundation）'
          + '完成後の MISSION 2.19E-RESUME-2 で、NHK（河野雅子）を primary process anchor として実際に修正した。'
          + '下記の SOURCE A〜D 観測サマリ（2.19A訂正版）は Evidence 記録としてそのまま保持する。',
        'MISSION 2.19A — 上記4 sourceの観測サマリを2026-08-30に開き直して訂正（Evidence metadata訂正のみ・'
          + 'Recipe factは一切不変）。掲載レシピ自体に実質的変化（source drift）は無い。訂正した Batch 3 の'
          + '観測欠陥は: (SOURCE A) 「返して脂をふく」→実際は「余分な脂を半分程度拭き取る」、断定「ふたなし」→'
          + '実際はふたの記載なし（source silence）。(SOURCE B) 工程から「火をとめて油をふく→醤油とみりんを'
          + '加える→すぐに火をつけて煮絡める」「最後に2cm幅に切る」が欠落、断定「ふたなし」→記載なし、運営'
          + '記述が不正確。(SOURCE C) 断定「ふたなし」→実際は火通り不足時のみ条件付きで蓋をして蒸し焼き、'
          + '「調理時間20分」に「※常温に戻す時間を除く」の注記が欠落。(SOURCE D) 未記載の「骨なし」を記載して'
          + 'いた→骨の有無は記載なし、総調理時間「15分（※鶏肉を常温に戻す時間を除く）」が欠落。'
          + 'いずれも fingerprint が変わるが、これは「観測レコードの訂正」であって source drift ではない。'
          + 'fingerprint不一致は A=掲載内容の変化 か B=観測表現の訂正 のどちらでも起こり得る（今回はB）。',
        'MISSION 2.19A 監査履歴の訂正: Batch 3 の「皮目を下に4〜5分」はキッコーマン原文どおりで欠陥ではない。'
          + 'キッコーマンは2つの別工程時間を持つ: 皮目の焼き=4〜5分／たれの煮からめ=3〜4分。'
          + 'MISSION 2.19 の再検証で「4〜5分は転記ミス（5mm由来）」とした解釈自体が誤りであり、'
          + 'ここで撤回する。2工程の時間は別個の process fact として保持する。'
          + 'Commanderの事実指示（3〜4分へ）よりも実際に開いた source（4〜5分）を優先した。',
        'SOURCE A: kikkoman-toriteriyaki-2026（監修:小田真規子）観測サマリ 訂正版（2026-08-30再観測・'
          + 'fingerprint入力・SHA-256=b4954ed9e6600cb63e015959e0e86fded1a55f1a27fb4af64186f3b674b0d22d）: '
          + '「2人分|鶏もも肉大1枚250g(皮の明記なし・皮目を下に焼く)|小麦粉大さじ1|サラダ油小さじ2|ピーマン2個|'
          + '合わせだれ=生しょうゆ大さじ1と1/2+本みりん大さじ2|砂糖の記載なし|酒の記載なし|'
          + '下ごしらえ=余分な脂肪を除く+筋を切る+厚みを均一+4等分+ペーパータオルで余分な水分を取る+'
          + '下処理の20分ほどで室温に戻す|工程=小麦粉をまぶす→油を中火で2分ほど熱す→皮目を下に中火で4〜5分→'
          + 'ピーマンは焼き色後に取り出す→肉を返して余分な脂を半分程度拭き取る→中央をあけて合わせだれを注ぐ→'
          + '3〜4分たれが大さじ2〜3残るまで煮からめる|ふたの記載なし|調理時間約20分|監修小田真規子」。',
        'SOURCE B: sshoyu-toriteriyaki-2026（職人醤油＝other-trusted）観測サマリ 訂正版（2026-08-30再観測・'
          + 'SHA-256=54a3b65dde243c941448820282277e3c3800318cdc423a1c3d3fa398d97c5e31）: '
          + '「2人分|鶏もも肉2枚(皮の明記なし・皮目を下に焼く)|醤油(濃口/溜)大さじ2+みりん大さじ2(1対1)|'
          + '砂糖の記載なし|サラダ油少々|酒適量|小麦粉なし|下ごしらえ=余分な脂を除く+厚いところに切り目を入れる+'
          + '酒をふっておく|工程=油を中火で熱す→皮目を下に焼き色→裏返して同様→火をとめて余分な油をふきとる→'
          + 'よく混ぜた醤油とみりんを加える→すぐに火をつけてたれに肉を煮絡める→鶏肉を2cm幅に切って盛る|'
          + 'ふたの記載なし|たれは焼き色後に投入・事前によく混ぜる|'
          + '運営=職人醤油(醤油の知識・レシピ・生産者紹介の教育メディアと通販を兼ねるサイト)」。',
        'SOURCE C: sirogohan-toriteriyaki-2026（白ごはん.com/冨田ただすけ、professional）観測サマリ 訂正版'
          + '（2026-08-30再観測・SHA-256=973d8cd746e5222d7b06f5e097b722e2dd965b93e9666bab986edaa3a4f95df9）: '
          + '「1〜2人分|鶏もも肉1枚約300g|たれ=砂糖大さじ1/2+醤油大さじ1と1/2+みりん大さじ1と1/2+'
          + '酒大さじ1と1/2|油をひかない|塩をしない|小麦粉なし|下ごしらえ=できれば20〜30分常温に戻す+'
          + '余分な脂や皮を切り落とす+皮目をフォークや包丁の切っ先で何度かつく+たれを事前に合わせる|'
          + '工程=油をひかず皮目から焼き始める→3〜4分かけてじっくり皮目を焼く→裏返して2〜3分→'
          + '合わせたたれを加えて煮つめる→たれを皮に何度もかけるのを繰り返す|'
          + 'ふたは基本使わないが火通りが不十分な場合のみ裏返して火を弱め蓋をして蒸し焼き|'
          + '調理時間20分※常温に戻す時間を除く|サイト=白ごはん.com」。',
        'SOURCE D: kyounoryouri-toriteriyaki-kawano-2026（NHKきょうの料理/河野雅子、professional）観測サマリ'
          + ' 訂正版（2026-08-30再観測・SHA-256=9fdc33d901d00ac75b3fd9cf867e9a56a0fe9caea8dc137e0eb006e2d3b63401）: '
          + '「2人分|鶏もも肉(大)1枚300g(骨の有無の記載なし・皮を下にして焼く)|スナップえんどう100g|'
          + '合わせだれA=しょうゆ大さじ1+酒大さじ1+みりん大さじ1+砂糖小さじ1+塩少々|サラダ油小さじ1|小麦粉なし|'
          + '下ごしらえ=調理する約30分前に常温に戻す+余分な脂肪を除く+筋の多いところや厚いところに切り目+'
          + '縦半分に切り1切れを3等分|工程=サラダ油小さじ1を中火で熱す→鶏肉を皮を下に2〜3分→'
          + '焼き色がついたら返してふたをして弱めの中火で3〜4分→ペーパータオルで溶け出た脂を拭く→'
          + '混ぜておいたAを回し入れる→強めの中火で煮詰めながら照りが出るまでからめる|ふたあり(返した後・片面のみ)|'
          + '調理時間15分※鶏肉を常温に戻す時間は除く|講師河野雅子」。',
        'MISSION 2.19E-RESUME-2 — NHK（SOURCE D / kyounoryouri-toriteriyaki-kawano-2026 / 講師 河野雅子）を '
          + 'PRIMARY PROCESS ANCHOR として Recipe body を修正。Recipe body の全 critical fact は NHK 1 source の '
          + '1 process だけから取り、corroborating source（味の素KK・日本ハム・DELISH KITCHEN・白ごはん.com）は '
          + '独立裏付けの比較にのみ用いた（多数決・平均・midpoint・serving scaling による fact 確立・cross-source '
          + '合成はしていない。corroborator を全て取り除いても NHK Recipe として成立する）。',
        'BEFORE → ANCHOR → CORROBORATION → AFTER: '
          + '(1) requiredIngredients 鶏肉300g → NHK「鶏もも肉（大）1枚300g」→ 白ごはん.com が独立に「約300g・もも1枚」'
          + '（direct corroboration）→ AFTER 鶏もも肉300g（MISSION 2.21 taxonomy: 鶏もも肉在庫=MATCH / 鶏むね肉=NO MATCH / '
          + '鶏肉generic=NOT exact match / 鶏肉アレルギー=HARD EXCLUDE）。 '
          + '(2) servingsBase 2 → NHK 2人分 → 味の素KK/職人醤油/キッコーマンも2人分（compatible）→ AFTER 2（不変）。 '
          + '(3) seasonings しょうゆ大さじ1と1/2・みりん大さじ1と1/2・砂糖大さじ1・酒なし・塩なし → '
          + 'NHK 合わせだれA「しょうゆ大さじ1＋みりん大さじ1＋酒大さじ1＋砂糖小さじ1＋塩少々」→ AFTER そのまま採用。 '
          + 'soy:mirin:sake=1:1:1 は5 source（NHK/味の素KK/日本ハム/DELISH/白ごはん.com）が ratio で一致、'
          + '絶対量 大さじ1 は 味の素KK が independent exact corroboration。砂糖 小さじ1 は NHK exact anchor で、'
          + '独立 source は「少量の砂糖が入る」ことのみ compatible-range 支持（白ごはん.com 大さじ1/2、味の素KK 大さじ2/3）'
          + '＝ independent exact corroboration ではない。塩 少々 は NHK-SPECIFIC（たれに塩を入れる独立裏付けは無い。'
          + '味の素KK/DELISH は肉に下味の塩、白ごはん.com は明示的に塩なし）。 '
          + '(4) cooking oil: 既存schemaに合わせ seasonings に「サラダ油 小さじ1」を保存（オリーブオイル/バターと同じ扱い）。'
          + 'NHK exact anchor。味の素KK も同 process で小さじ1（independent exact）。白ごはん.com の zero-oil は別 variant で輸入しない。 '
          + '(5) 小麦粉: NHK/職人醤油/白ごはん.com/味の素KK/日本ハム すべて小麦粉なし（キッコーマンのみ flour variant で別）。'
          + '「小麦粉なし」を表すための架空 ingredient は追加していない。 '
          + '(6) equipment 「フライパン・菜箸」→ NHK/全 source フライパン（direct）。菜箸はどの source も明示しない '
          + 'unsupported legacy inference のため除去 → AFTER 「フライパン」。 '
          + '(7) preparation（旧: 無し）→ NHK anchor の5工程を Recipe.preparation として追加（下記）。 '
          + '(8) steps 旧3工程（簡略化）→ NHK anchor の5工程へ置換（皮目→返してふた蒸し焼き→脂を拭く→たれ→照り煮からめ）。',
        'PREPARATION（MISSION 2.20 Recipe.preparation・cooking steps と別枠）: '
          + '(1)「調理の約30分前に室温に戻す」passiveWait=true・duration=approximate 30分（TimeValue の approximate で '
          + '「約30分」を忠実に保持。exact化しない）。NHK anchor。白ごはん.com が「できれば20〜30分」で compatible '
          + '（independent exact ではない）。味の素KK/日本ハム/DELISH は言及なし（source silence であって否定的 Evidence ではない）。 '
          + '(2) 余分な脂肪を除く（NHK。職人醤油/白ごはん.com/キッコーマンも実施）。 '
          + '(3) 筋の多いところ・厚いところに切り目（NHK。キッコーマン/職人醤油も切り目/筋を切る）。 '
          + '(4) 縦半分→1切れ3等分（NHK-SPECIFIC の焼く前カット。味の素KK/DELISH/職人醤油は焼いた後に切る）。 '
          + '(5) たれを事前に混ぜる（NHK。味の素KK/DELISH/白ごはん.com も事前混合）。 '
          + '工程2〜5に Evidence にない所要時間は付けていない。',
        'CRITICAL STEP FACTS: 皮目を下に中火で2〜3分（NHK anchor。白ごはん.com 3〜4分・キッコーマン4〜5分・DELISH 4〜5分 '
          + 'は compatible range であって universal exact ではない）。返してふたをして弱めの中火で3〜4分蒸し焼き '
          + '（NHK anchor。DELISH が弱火3分で近接・味の素KK は7分。process-family としては味の素KK/日本ハム/DELISH が '
          + '「返したあとふたをして蒸し焼き」で corroborate、正確な分数は compatible range）。溶け出た脂を拭いてから '
          + 'たれを回し入れる（全 source が脂を拭く・4 source がたれを後入れ）。最後の照り煮からめ工程に Evidence にない '
          + '所要時間は付けていない（NHK は分数を示していない）。',
        'ABSOLUTE NO-IMPORT: ほんだし（味の素KK）・蜂蜜/水（日本ハム）・小麦粉/片栗粉（キッコーマン）・zero-oil や '
          + 'spoon-basting や conditional lid（白ごはん.com）・他 source の調理時間・他 source の付け合わせ野菜、いずれも '
          + 'Recipe へ入れていない。NHK の「スナップえんどう100g」は別ゆでの付け合わせ（source-side accompaniment）であり '
          + 'core chicken-teriyaki Recipe Identity の一部ではないため requiredIngredients に加えない（MISSION 2.19D 判定どおり）。',
        'PRODUCT TIME（MISSION 2.20 firewall）: verification.timeVerification.productTimeStatus = "review"。'
          + 'legacy cookingTimeMinutes=15 はデータ上残すが、productCookingTimeMinutes(tori-teriyaki) は null を返し、'
          + 'strict max-time フィルタ・ranking・estimatedMinutes・「約15分」表示のいずれでも確定値として使わない '
          + '（Recipe Detail は「調理時間の目安：確認中」）。15 を 20/45/17 等へ推測変更していない。',
        'SOURCE_TIME_SCOPE_LIMITATION = YES: NHK の掲載時間は「15分」で、かつ「※鶏肉を常温に戻す時間（約30分）は除く」と '
          + '明記されている。現行 SourceStatedTotalTime schema には exclusion-scope フィールドが無いため、'
          + 'sourceStatedTotal.value = exact 15分（sourceIds=NHK）として保存しつつ、除外スコープはこの reviewNote に記録する: '
          + '"NHK displayed time is 15 minutes and explicitly excludes approximately 30 minutes for returning the chicken to room temperature."。'
          + 'bare 15 を完全な Product elapsed time として扱わない（productTimeStatus=review のためこの limitation は Correction を block しない）。',
        'hasUnsupportedInference = true のまま維持。UNSUPPORTED_INFERENCE_SEMANTICS_LIMITATION = YES: '
          + 'Recipe body の食材・分量・調味・工程・下ごしらえ・器具は全て NHK anchor による direct 支持であり '
          + '「AIが発明した値」は残っていない。それでも true を維持する理由は、cookingTimeMinutes の Product elapsed '
          + 'time としての scope が未確定（productTimeStatus=review）で、確定した critical time fact が無いため。'
          + '現行 boolean は「独立 corroboration 不足」と「Evidence なしの推測」を区別できないが、'
          + '本 MISSION では global semantics を変えず、現行の文書化された意味（未解決の critical fact が残る＝true）に従う。',
        'PROCESS COHERENCE: coherenceReview.status = "coherent"。Recipe body は NHK 単一 source の単一 process のみで '
          + '構成され、器具・油・ふた/蒸し焼き・加熱順・返し・調味順・下ごしらえ順のいずれも同一 process 内で整合する。'
          + 'corroborator から Recipe fact を輸入していない。coherent は VERIFIED / 安全 / 美味 / authentic / publishable を '
          + '意味しない（status は review、hasUnsupportedInference=true、isRecipePublishable=false）。',
        'STATUS: verification.status = "review" を維持。isRecipePublishable(tori-teriyaki) = false（status≠verified・'
          + 'hasUnsupportedInference=true・productTimeStatus=review・cookingTimeMinutes の fieldVerification 無し、の複数の gate で false）。'
          + 'VERIFIED 化はしていない。VERIFIED 適格性の評価は別の Commander 承認 MISSION。',
        'FUTURE_SECOND_VARIANT_CANDIDATE = YES: 職人醤油（SOURCE B）＋ 白扇酒造 の「しょうゆ:みりん≒1:1・砂糖なし・'
          + 'たれに酒を入れず酒は下味のみ・ふたなし」variant は独立 Evidence のある別 variant。本 MISSION では実装しない '
          + '（新 Recipe / 新 architecture を作らない）。',
        'MISSION 2.22（VERIFIED Eligibility Gap Audit）— metadata wording のみ整理（culinary fact は不変）: '
          + '(a) recipeIdentity.variant から provenance 文「NHKきょうの料理・河野雅子の製法をprimary process anchorとする」を除去 '
          + '（provenance は sourceIds / fieldVerifications / coherenceReview.rationale / この reviewNotes が担う。variant は '
          + 'culinary process identity のみを記述する）。(b) intendedTasteProfile から taste 推論（「効かせ」「ごく少量」「家庭的」）を '
          + '除去し、合わせだれの構成を事実として記述するに留めた。Recipe の分量・工程・下ごしらえ・source anchor・status は一切不変。',
        'MISSION 2.25（Japan Allergen Evidence）— 全7 ingredient の allergen identity を、日本の食品表示制度と '
          + '製造者公式アレルギー表示を実際に開いて評価（推測なし）。'
          + '(1) しょうゆ → 小麦・大豆: 標準的な市販こいくちしょうゆ（キッコーマン「しょうゆ」K050505）が原材料・'
          + 'アレルギー物質に小麦・大豆を明示。小麦不使用のグルテンフリーしょうゆ（サンジルシ醸造）も実在するため '
          + 'ingredient-allergens.ts に default-generic-risk として記録し、「小麦」「大豆」アレルギー登録で fail-safe に '
          + 'HARD EXCLUDE（小麦=特定原材料/義務、大豆=特定原材料に準ずるもの/推奨。出典: 消費者庁 食物アレルギー表示情報）。'
          + '(2) みりん: 本みりん（マンジョウ K100505）・みりん風調味料（キッコーマンこってりん G511505）とも '
          + 'アレルギー特定原材料等の表示なし。(3) 酒（料理の清酒 マンジョウ K102005）: 表示なし（米・米こうじ・醸造アルコール）。'
          + '(4) 砂糖・(5) 塩: 特定原材料等に非該当。(6) サラダ油: 大豆油を含むが精製油脂で残存タンパクが検出限界以下のため '
          + '大豆アレルゲン表示不要（公式ルール。日本マーガリン工業会/消費者庁の数ppm閾値）→ HARD EXCLUDE 対象にしない。'
          + '(7) 鶏もも肉: 鶏肉（特定原材料に準ずるもの/推奨）。MISSION 2.21 taxonomy が「鶏肉」アレルギーを既に HARD EXCLUDE。',
        'MISSION 2.26（First VERIFIED Finalization）— status review → verified。'
          + '(a) Decision B（Commander承認）: Recipe Evidence VERIFIED ≠ Product Time VERIFIED。'
          + 'isRecipePublishable から productTimeStatus ブロックを削除し、applicableFieldsFor は '
          + 'productTimeStatus=review/unknown の Recipe で cookingTimeMinutes を非該当にした（legacy 44 Recipe は挙動不変）。'
          + '(b) allergyIdentity を derived fieldVerification として追加（MISSION 2.25 の全7食材評価が根拠）。'
          + 'allergen Evidence source は非プロセス系のため coherenceReview.sourceProcessNotes への記載を要求しない '
          + '（NON_PROCESS_COHERENCE_FIELDS）。process field の source（NHK）は引き続き coherence 対象。'
          + '(c) sourceStatedTotal.excludes に NHK の「約30分 常温戻しを除く」を machine-readable に記録（15+30 の計算はしない）。'
          + '(d) 解決済みの監査履歴・source比較・provenance を reviewNotes → provenanceNotes へ移動。reviewNotes=[]。'
          + '(e) hasUnsupportedInference: true → false。Recipe body（食材・分量・調味・下ごしらえ・工程・器具・identity）に '
          + '未支持の推測値は残っていない（全て NHK direct または NHK+allergen policy derived）。'
          + 'Product Time が未確定であることは hasUnsupportedInference の対象外（productTimeStatus が表現する）。'
          + '(f) PRACTICAL_COOK_VALIDATION: NOT YET PERFORMED（現行 policy では Recipe Evidence VERIFIED を block しない。'
          + '将来の Beta Quality Gate では Commander 判断まで block すべき）。'
          + '(g) FUTURE_SECOND_VARIANT_CANDIDATE = YES（職人醤油＋白扇酒造。本 MISSION でも未実装）。'
          + 'VERIFIED が意味するのは Recipe Evidence の検証のみ。allergen-free / time verified / taste guaranteed / '
          + 'NHK 公式提携 のいずれも意味しない。',
      ],
      hasUnsupportedInference: false,
    },
  },
  {
    id: 'buta-shogayaki',
    name: '豚の生姜焼き',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '豚肉', amount: '200g' },
      { name: '玉ねぎ', amount: '1/2個' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: 'みりん', amount: '大さじ1' },
      { name: 'しょうが', amount: '小さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['焼き物'],
    equipment: ['包丁', 'まな板', 'フライパン'],
    steps: [
      '玉ねぎを薄切りにする',
      'フライパンで豚肉と玉ねぎを炒める',
      '豚肉の中心まで色が変わったら、しょうゆ、みりん、しょうがを加えてからめる',
    ],
    notes: ['豚肉は中心まで色が変わっていることを確認してください。'],
    verification: {
      status: 'review',
      sourceIds: ['kikkoman-butashogayaki-2026', 'sirogohan-butashogayaki-2026'],
      recipeIdentity: {
        canonicalDish: '豚の生姜焼き',
        variant:
          '玉ねぎを一緒に炒める、漬け込みなしの生姜焼き（豚肉と玉ねぎを炒めてから、しょうゆ・みりん・しょうがのたれをからめる。砂糖・酒は使わない）',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的なしょうがの効いた甘辛味',
        coreMethod: '豚肉と玉ねぎをフライパンで炒め、火が通ってからしょうゆ・みりん・しょうがのたれをからめる（下味の漬け込みはしない）',
        definingIngredients: ['豚肉', '玉ねぎ'],
      },
      fieldVerifications: [
        {
          field: 'ingredientAmounts',
          sourceIds: ['sirogohan-butashogayaki-2026'],
          supportType: 'direct',
        },
        { field: 'servingsBase', sourceIds: ['kikkoman-butashogayaki-2026', 'sirogohan-butashogayaki-2026'], supportType: 'direct' },
        { field: 'equipment', sourceIds: ['sirogohan-butashogayaki-2026'], supportType: 'direct' },
        {
          field: 'requiredIngredients',
          sourceIds: ['sirogohan-butashogayaki-2026'],
          supportType: 'variant',
        },
        {
          field: 'seasoningAmounts',
          sourceIds: ['sirogohan-butashogayaki-2026'],
          supportType: 'variant',
          variantRelation: 'conflicting-within-variant',
        },
        {
          field: 'criticalSteps',
          sourceIds: ['sirogohan-butashogayaki-2026'],
          supportType: 'variant',
        },
      ],
      reviewNotes: [
        'MISSION 2.18 Batch 3 — 初回のEvidence Resolution（この recipe には従来 verification ブロックが無かった）。'
          + 'Tier2/3 sourceを2件開いて確認（ニチレイフーズのページはHTTP 403で本文を取得できず不採用）。'
          + '2 source間で「玉ねぎの有無」「みりんの有無」「漬け込みの有無」「たれの構成」がいずれも異なり、'
          + 'NUKITORUのたれ（しょうゆ大さじ1と1/2・みりん大さじ1・しょうが小さじ1・砂糖なし・酒なし）は'
          + 'どちらのsourceとも一致しない。',
        'SOURCE A: kikkoman-butashogayaki-2026（基本の和食）観測サマリ（fingerprint入力・'
          + 'SHA-256=a89b66f661a2ae210e8879131c1a25adab1103b368fa658850614541b9ed91b3）: '
          + '「2人分|豚肩ロース肉しょうが焼き用250〜300g|玉ねぎなし|しょうが3かけ分すりおろしで1かけA下味と'
          + '2かけBたれ|しょうゆ大さじ2|砂糖大さじ1|酒=小さじ2Aと大さじ1B|みりんなし|油大さじ1/2|小麦粉なし|'
          + '下ごしらえ=ペーパーで余分な水気をふく+Aのしょうがと酒を絡めて5分置く|筋切りの記載なし|'
          + '工程=中火で2〜3分動かさず焼く→返して30秒〜1分→Bのたれを中央に加える→火を強めて煮立ててから'
          + '絡める→フライパンの底が見えるまで煮つめる|ふたなし|調理時間約20分|監修記載なし」。',
        'SOURCE B: sirogohan-butashogayaki-2026（白ごはん.com/冨田ただすけ、professional）観測サマリ'
          + '（SHA-256=f20f0246cc13aa31ee186c90977ed679c0c1e22792cb10a638b1261eb70d1fce）: '
          + '「2人分|豚ロース肉生姜焼き用200gで4〜6枚|玉ねぎ1/4個2mm薄切り|たれ=しょうゆ大さじ2+みりん大さじ1+'
          + '酒大さじ1+砂糖小さじ2+しょうがすりおろしとしぼり汁20〜30g+ケチャップ小さじ1+ごま油小さじ1/2+'
          + 'こしょう少々|油小さじ1|小麦粉なし|下ごしらえ=1cm間隔で筋切り+しょうがとにんにくをすりおろす+'
          + 'みりんと酒としぼり汁で10分漬け込む2〜3回返す|工程=油を熱し玉ねぎを先に炒める→豚肉を加える→'
          + '両面を焼く→たれを加えて約2分からめる|ふたなし|著者冨田ただすけ」。',
        'FIELD-BY-FIELD: (1) ingredientAmounts=豚肉200g → SOURCE B（200g・同一の玉ねぎ入りidentity）が'
          + '直接一致（direct、ただし単独source）。SOURCE A は肩ロース250〜300gで別。(2) servingsBase=2 → '
          + '両source2人分（direct）。(3) equipment=フライパン → 両source（direct）。(4) requiredIngredients'
          + '（豚肉＋玉ねぎ）→ 玉ねぎ入りは SOURCE B が支持するが SOURCE A は玉ねぎなし。玉ねぎ量も'
          + 'NUKITORU 1/2個 vs SOURCE B 1/4個 で2倍差 → variant。(5) seasoningAmounts → みりん大さじ1は'
          + 'SOURCE B と一致するが、しょうゆ（大さじ1と1/2 vs 大さじ2）・砂糖（なし vs 小さじ2）・酒（なし vs '
          + '大さじ1）・しょうが（小さじ1 vs すりおろし20〜30g）が不一致、かつSOURCE Bはケチャップ/ごま油も'
          + '使う → variant / conflicting-within-variant。(6) criticalSteps → NUKITORUは漬け込みなし・豚肉と'
          + '玉ねぎを一緒に炒める。SOURCE B は10分漬け込み＋玉ねぎを先に炒めてから豚肉、と順序も前処理も'
          + '異なる → variant。',
        'PREPARATION AUDIT: SOURCE A は「水気をふく＋しょうがと酒で5分下味」、SOURCE B は「1cm間隔の筋切り＋'
          + 'すりおろし＋10分漬け込み」。いずれもNUKITORUには無い。Section 9に従い、Evidence支持のある下ごしらえ'
          + '（筋切り・漬け込み・下味）を勝手に追加しない（HOLD）。「漬け込み時間」を現行schemaで'
          + 'cookingTimeMinutesや stepsと分けて表現できない点は構造的制約として記録（新モデルは作らない）。',
        'PROCESS COHERENCE: 2 source は互いに別process（漬け込みの有無・玉ねぎの有無・調味構成）。'
          + '混成しない。NUKITORUの「漬け込みなし・玉ねぎと一緒に炒める」coreMethodは SOURCE B の'
          + '「玉ねぎ入り」という点だけ共有し、他は不一致。coherenceReviewは未実施。',
        'DECISION: Recipe fact は全て変更なし（HOLD）。CANDIDATE CHANGES（未実施・Commander判断）: '
          + '(a) requiredIngredients「豚肉」→「豚ロース肉」（SOURCE B）／部位名変更はSection 17 freezeの'
          + '候補ロジックへ影響し得るため保留。(b) 玉ねぎ 1/2個 → 1/4個（SOURCE B）は単独source・かつ'
          + 'SOURCE Bのたれ全体が別構成のため寄せない。(c) たれ（しょうゆ大1.5/みりん大1/しょうが小1）は'
          + 'どのsourceとも一致せず、SOURCE B へ寄せると砂糖・酒・ケチャップ・ごま油の追加＝別レシピ化に'
          + 'なるため行わない。 / EVIDENCE TYPE: seasoningAmounts=A（source間conflict）＋E（NOT_FOUND）、'
          + 'requiredIngredients=B/C（玉ねぎ有無のvariant＋部位未確定）、F（同一identityの独立裏付けは'
          + 'SOURCE B 単独）。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'nikujaga',
    name: '肉じゃが',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '牛肉', amount: '200g' },
      { name: 'じゃがいも', amount: '3個' },
      { name: 'にんじん', amount: '1本' },
      { name: '玉ねぎ', amount: '1個' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ2' },
      { name: 'みりん', amount: '大さじ2' },
      { name: '砂糖', amount: '大さじ1' },
    ],
    cookingLiquids: [{ name: '水', amount: '350ml' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 30,
    servingsBase: 3,
    tags: ['煮込み', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋'],
    steps: [
      'じゃがいも、にんじん、玉ねぎを一口大に切る',
      '鍋で牛肉を炒め、色が変わったら野菜を加えて炒める',
      '水、しょうゆ、みりん、砂糖を加える',
      '具材が柔らかくなるまで煮る',
    ],
  },
  {
    id: 'mabo-tofu',
    name: '麻婆豆腐',
    type: 'main',
    cuisine: 'chinese',
    requiredIngredients: [
      { name: '豆腐', amount: '1丁' },
      { name: '豚ひき肉', amount: '150g' },
    ],
    seasonings: [
      { name: '味噌', amount: '大さじ1' },
      { name: 'しょうゆ', amount: '大さじ1' },
      { name: '豆板醤', amount: '小さじ1' },
    ],
    cookingLiquids: [{ name: '水', amount: '100ml' }],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: '味噌' },
      { ingredientName: '豆板醤' },
    ],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['中華', '辛め'],
    equipment: ['フライパン', 'まな板', '包丁'],
    steps: [
      '豆腐を一口大に切る',
      'フライパンで豚ひき肉を中心まで色が変わるまで炒める',
      '味噌、しょうゆ、豆板醤を加えて炒め合わせる',
      '豆腐と水を加えて軽く煮る',
    ],
    notes: ['ひき肉は中心まで色が変わっていることを確認してください。'],
    arrangements: [{ id: 'mabo-tofu-negi', label: '仕上げにねぎを散らす', addIngredients: ['ねぎ'] }],
  },
  {
    id: 'tori-karaage',
    name: '鶏の唐揚げ',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '鶏肉', amount: '300g' },
      { name: '片栗粉', amount: '大さじ3' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: 'しょうが', amount: '小さじ1' },
      { name: '油', amount: '適量（揚げ油）' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 25,
    servingsBase: 2,
    tags: ['揚げ物', '子ども向け'],
    equipment: ['包丁', 'まな板', 'ボウル', 'フライパンまたは鍋', 'バット'],
    steps: [
      '鶏肉を一口大に切り、しょうゆとしょうがに漬け込む',
      '片栗粉をまぶす',
      '油で揚げ、中心まで火が通るまで加熱する',
      '油をきってバットに取り出す',
    ],
    notes: ['鶏肉は切って中心まで火が通っていることを確認してください。'],
  },
  {
    id: 'gyuniku-tamanegi-itame',
    name: '牛肉と玉ねぎの炒め物',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '牛肉', amount: '200g' },
      { name: '玉ねぎ', amount: '1個' },
    ],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: '砂糖', amount: '大さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['炒め物', '時短'],
    equipment: ['包丁', 'まな板', 'フライパン'],
    steps: [
      '玉ねぎを薄切りにする',
      'フライパンで牛肉と玉ねぎを炒める',
      '牛肉の色が変わったら、しょうゆと砂糖を加えて炒め合わせる',
    ],
  },

  // ------------------------------------------------------------
  // 魚の主菜
  // ------------------------------------------------------------
  {
    id: 'sake-meuniere',
    name: '鮭のムニエル',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '鮭', amount: '2切れ' },
      { name: '小麦粉', amount: '大さじ2' },
    ],
    seasonings: [
      { name: '塩', amount: '小さじ1/2' },
      { name: 'こしょう', amount: '少々' },
      { name: 'バター', amount: '大さじ1' },
    ],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['焼き物'],
    equipment: ['フライパン', 'バット'],
    steps: [
      '鮭に塩こしょうをして小麦粉を薄くまぶす',
      'フライパンにバターを熱し、鮭を並べる',
      '両面をこんがり焼き、中心まで火を通す',
    ],
    notes: ['鮭は中心まで火が通っていることを確認してください。'],
  },
  {
    id: 'saba-misoni',
    name: 'サバの味噌煮',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'サバ', amount: '2切れ' }],
    seasonings: [
      { name: '味噌', amount: '大さじ2' },
      { name: '砂糖', amount: '大さじ1' },
      { name: 'しょうが', amount: '1かけ' },
      { name: '酒', amount: '大さじ2' },
    ],
    cookingLiquids: [{ name: '水', amount: '200ml' }],
    ingredientChecks: [{ ingredientName: '味噌' }],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['煮物'],
    equipment: ['フライパンまたは鍋'],
    steps: [
      '鍋に水、酒、しょうがを入れて煮立たせる',
      'サバを入れて中火で煮る',
      '味噌と砂糖を溶き入れ、煮汁をかけながらさらに煮る',
      '中心まで火が通ったら完成',
    ],
    notes: ['サバは中心まで火が通っていることを確認してください。'],
  },
  {
    id: 'sake-shioyaki',
    name: '鮭の塩焼き',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '鮭', amount: '1切れ' }],
    seasonings: [{ name: '塩', amount: '少々' }],
    cookingTimeMinutes: 7,
    servingsBase: 1,
    tags: ['焼き物', '時短'],
    equipment: ['両面焼きグリル'],
    steps: [
      '鮭に軽く塩をふる',
      'グリルを中火で3分予熱する',
      '鮭の皮目を上にして並べ入れ、4分焼く',
      '火を止め、グリルの扉を少し開けて3分置く',
      '中心まで火が通ったら完成',
    ],
    notes: ['鮭は中心まで火が通っていることを確認してください。'],
    // MISSION 2.12 PHASE B — First 10 Families Starter Set Evidence Resolution（履歴）。
    // CURRENT: cookingTimeMinutes=15分 / SOURCE A: oishikenko-sakeshioyaki-2026
    // （管理栄養士監修・1人分）鮭1切れ(70g)・塩0.6g、グリルまたはトースターで7〜8分 /
    // SOURCE B: kikkoman-sakeyakikata-2026（キッコーマン公式）フライパン(油+酒使用・
    // ふた使用)で4〜5分、両面グリルで4分+余熱3分、片面グリルで3分+2〜3分 /
    // DECISION（当時）: 15分→8分（rangeからのProduct Decision）。EVIDENCE TYPE（当時）:
    // cookingTimeMinutes=range。
    // MISSION 2.13 — Evidence Variant Foundation（履歴）。kikkoman-sakeyakikata-2026自身が
    // 「フライパン法（油・酒・ふた使用）」「グリル法（無油）」を明示的に別methodとして
    // 提示しており、isEstablishedVariant()の条件（cooking-method次元＋1件の権威ある
    // 情報源による明示）を満たす正当なvariantとして確立し、NUKITORUを「グリル法（無油）」
    // へ紐付けた。ただしこの時点ではグリル法内部でも「両面焼き」と「片面焼き」が未分離で
    // 7〜8分というrangeのまま残っていた。equipmentも「フライパンまたはグリル」のまま
    // 2つのvariantを1つのfieldへ併記しており、将来的に一方へ確定させる必要がある、と
    // 設計上の課題として記録していた。
    // MISSION 2.14 — First 10 Families Starter Set Evidence Resolution（sake-shioyaki
    // 特別監査）。CURRENT: equipment=フライパンまたはグリル・cookingTimeMinutes=8分
    // （rangeからのProduct Decision）/ EVIDENCE: kikkoman-sakeyakikata-2026を再調査し、
    // 「両面焼きグリル」の場合に限り「中火で4分焼く」「火を止めて扉を少し開け3分置く」
    // という2つの直接事実（どちらも単一の値でrangeではない）が明示されていることを確認した
    // （片面焼きグリルは引き続き「2〜3分」というrangeを含むため対象外のまま）。
    // AFTER: equipmentを「両面焼きグリル」へ絞り込み（フライパン・片面焼きグリルの選択肢を
    // 除去）、cookingTimeMinutesを8分→7分（4分+3分の合算値、予熱3分は準備段階として
    // 含めない）へ変更 / REASON: MISSION 2.13で残っていた「equipmentが2variantを併記
    // したまま」という設計課題を、Evidence上exact値へ解決できる「両面焼きグリル」variant
    // へ一本化することで解消した。この4分・3分はrangeの中央値選択ではなく、単一の直接事実
    // 2件の機械的合算（derived）である。oishikenko-sakeshioyaki-2026（Tier3専門家）の
    // 「グリルまたはトースターで7〜8分」は7分と矛盾しない独立した補強情報として扱う。
    // 塩・食材量・人数はoishikenko-sakeshioyaki-2026のまま変更なし。
    //
    // MISSION 2.14 — SAKE-SHIOYAKI EVIDENCE CORRECTION（上記VERIFIED判定を撤回）。
    // 上記の時点でkikkoman-sakeyakikata-2026のページ全体（下ごしらえ〜グリル手順まで）を
    // 生HTMLで再確認したところ、キッコーマンの「両面焼きグリル」プロセスは実際には
    // 2段階の塩手順を含むことが判明した：(1) 下ごしらえとして鮭の重さの1%の塩をふり
    // 常温で15〜30分置いて水分を抜く（フライパン・グリル共通の前段階）、(2) グリルへ
    // 入れる直前にさらに鮭の重さの0.3%ほどの「化粧塩」を追加でふる（グリル固有の
    // 追加ステップ、樋口氏のコメントにより明記）。一方oishikenko-sakeshioyaki-2026は
    // 「水分を拭き取って塩をふり、そのまま焼く」という1段階のみのシンプルな塩手順で
    // あり、15〜30分の放置工程も1%/0.3%の分割もない。NUKITORUの現在のsteps（「鮭に
    // 軽く塩をふる」を最初の1ステップとするのみ）は、上記どちらのsourceの実際の
    // 手順とも文字通りには一致しない、簡略化されたhybridである。cookingTimeMinutes/
    // equipmentはkikkomanの「両面焼きグリル」という特定プロセス（1%塩+15〜30分放置が
    // 前提）に紐づく事実である一方、seasonings/seasoningAmountsはoishikenkoの
    // 「放置なし」という異なるプロセスの事実であり、この2つを1つのRecipeとして
    // 組み合わせることは「異なるvariant/contextを跨いだsourceの合成」に該当する
    // （hiyayakko特別監査で確立した禁止パターンと同種）。cookingTimeMinutes=7分
    // （4分+3分の合算・予熱除外）というderivation自体は引き続き正当であり撤回しない。
    // しかしseasonings/seasoningAmounts/criticalStepsはこのprocess不整合が解消される
    // までEvidence上「解決済み」として扱えない。よってstatusをVERIFIEDからREVIEWへ
    // 差し戻す（VERIFIED維持を目的にした緩和は行わない。Prefer REVIEW over identity
    // drift）。equipmentの「両面焼きグリル」への絞り込み・variantIdentity自体は
    // 引き続き正当な発見として維持する。
    verification: {
      status: 'review',
      sourceIds: ['kikkoman-sakeyakikata-2026', 'oishikenko-sakeshioyaki-2026'],
      recipeIdentity: {
        canonicalDish: '鮭の塩焼き',
        variant:
          '油・酒・ふたを使わない、両面焼きグリルによる基本の塩焼き（下味用の1%塩＋化粧塩等の凝った下処理はしない）',
        servingsBasis: 1,
        intendedTasteProfile: '素材の味を活かした、塩のみのシンプルな塩焼き',
        coreMethod: '鮭に塩をふり、両面焼きグリルで予熱後4分焼いてから3分置く（油・酒・ふたなし）',
        definingIngredients: ['鮭'],
        // MISSION 2.13/2.14 — Evidence Variant Foundation。kikkoman-sakeyakikata-2026自身が
        // 「フライパン法（油・酒・ふた使用）」「両面焼きグリル法（無油・4分+3分の合算＝
        // exact値）」「片面焼きグリル法（無油・3分+2〜3分＝range含む）」を明示的に別methodと
        // して提示しており、isEstablishedVariant()の条件（cooking-method次元＋1件の権威ある
        // 情報源による明示）を満たす正当なvariantである。NUKITORUは「両面焼きグリル法」へ
        // 紐付ける（isRecipePublishable()の判定には一切影響しない。純粋な分類メタデータ）。
        variantIdentity: {
          variantId: 'sake-shioyaki-grill-no-oil',
          canonicalDishId: 'sake-shioyaki',
          label: '両面焼きグリル法（無油）',
          preparationStyle: '両面焼きグリルで、油を使わず予熱→4分焼く→3分置く',
          definingCharacteristics: [
            '油を使わない（無油）',
            'フライパン+油+酒+ふたによる蒸し焼き方式ではない',
            '両面焼きグリル（片面焼きグリルの2〜3分rangeとは異なり、4分+3分の合算という単一の値が明示される）',
          ],
        },
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['oishikenko-sakeshioyaki-2026'], supportType: 'direct' },
        { field: 'ingredientAmounts', sourceIds: ['oishikenko-sakeshioyaki-2026'], supportType: 'direct' },
        {
          // MISSION 2.14 CORRECTION: oishikenkoの「放置なし・1段階塩」プロセスの事実であり、
          // kikkomanの「1%塩+15〜30分放置+追加0.3%化粧塩」という両面焼きグリルの実プロセスとは
          // 別のprocessに属する。どちらのvariant/processに正式に紐づくか未確定のため
          // supportTypeは付与しない（=Evidence解決済みとして扱わない）。
          field: 'seasonings',
          sourceIds: ['oishikenko-sakeshioyaki-2026'],
          variantRelation: 'unresolved-between-variants',
        },
        {
          field: 'seasoningAmounts',
          sourceIds: ['oishikenko-sakeshioyaki-2026'],
          variantRelation: 'unresolved-between-variants',
        },
        {
          field: 'cookingTimeMinutes',
          sourceIds: ['kikkoman-sakeyakikata-2026'],
          supportType: 'derived',
          derivation:
            'kikkoman-sakeyakikata-2026の生HTML本文で確認した、「両面焼きグリル」について'
              + '明示された2つの直接事実（中火で4分焼く／火を止めて扉を少し開けて3分置く）を'
              + '機械的に合算した値（活火4分＋余熱3分=7分）。予熱3分は準備段階でありこの値には'
              + '含めない。この2つの数値（4分・3分）はどちらも単一の値でありrangeではないため、'
              + 'range内の代表値選択・Product Decision・片面焼きグリルのrange・フライパン法の'
              + '時間のいずれも一切使用していない正当なderivation。'
              + 'oishikenko-sakeshioyaki-2026の「グリルまたはトースターで7〜8分」はこの7分と'
              + '矛盾しない（7は7〜8の範囲内）独立した補強情報として扱う。',
          variantRelation: 'variant-specific',
          variantId: 'sake-shioyaki-grill-no-oil',
        },
        { field: 'servingsBase', sourceIds: ['oishikenko-sakeshioyaki-2026'], supportType: 'direct' },
        {
          // MISSION 2.14 CORRECTION: 以前はsupportType='direct'としていたが、NUKITORUの
          // 現在のsteps（「鮭に軽く塩をふる」のみ）はkikkoman（1%塩+15〜30分放置+追加0.3%
          // 化粧塩を含む複数ステップ手順）ともoishikenko（水分を拭き取って直前に塩をふる、
          // という1段階手順）とも文字通り一致しない簡略化されたhybridであり、direct支持は
          // 不正確な分類だった。訂正しsupportTypeを外す（=未解決）。
          field: 'criticalSteps',
          sourceIds: ['kikkoman-sakeyakikata-2026', 'oishikenko-sakeshioyaki-2026'],
          variantRelation: 'unresolved-between-variants',
        },
        {
          field: 'equipment',
          sourceIds: ['kikkoman-sakeyakikata-2026'],
          supportType: 'direct',
          variantRelation: 'variant-specific',
          variantId: 'sake-shioyaki-grill-no-oil',
        },
        { field: 'allergyIdentity', sourceIds: ['oishikenko-sakeshioyaki-2026'], supportType: 'direct' },
      ],
      reviewNotes: [
        'MISSION 2.14 CORRECTION: kikkoman-sakeyakikata-2026の生HTML全文を再確認した結果、'
          + '「両面焼きグリル」プロセスは実際には(1)下ごしらえとして1%塩を15〜30分置く、'
          + '(2)グリル投入直前に追加で0.3%の化粧塩をふる、という2段階の塩手順を含むことが'
          + '判明した。一方oishikenko-sakeshioyaki-2026は放置なしの1段階の塩手順のみで、'
          + '両者は同じ「グリルで焼く鮭」という結果は共有していても、途中のprocessが異なる。'
          + 'NUKITORUの現在のsteps・seasonings/seasoningAmountsはoishikenko側の簡略な'
          + 'processの事実に基づく一方、cookingTimeMinutes/equipmentはkikkoman側の'
          + '「両面焼きグリル」という特定processに基づく事実であり、この2つを1つの'
          + 'Recipeとして組み合わせることは異なるprocess/variantを跨いだsourceの合成に'
          + '該当する（hiyayakko特別監査で確立した禁止パターンと同種）。cookingTimeMinutes'
          + '=7分（4分+3分の合算・予熱除外）自体のderivationは正当であり撤回しないが、'
          + 'seasonings/seasoningAmounts/criticalStepsがこのprocess不整合の下では'
          + 'Evidence解決済みとして扱えないため、Recipe全体としてはVERIFIEDの条件を'
          + '満たさずREVIEWのまま維持する。',
      ],
      hasUnsupportedInference: false,
      // MISSION 2.14B — Recipe Coherence Review。上記reviewNotesで既に記録した
      // process不整合を、Coherence Review構造として明示的に記録する。
      coherenceReview: {
        status: 'incoherent',
        sourceProcessNotes: [
          {
            sourceId: 'kikkoman-sakeyakikata-2026',
            equipment: '両面焼きグリル',
            fatOrOil: 'なし（無油）',
            liquidOrWater: 'なし',
            lid: '該当なし（グリル）',
            heatSequence: '予熱3分（中火）→4分焼く→火を止め扉を少し開けて3分置く',
            flip: 'なし',
            restOrResidualHeat: '火を止めてから3分（余熱）',
            seasoningSequence: '下ごしらえで1%塩を15〜30分置き水分を拭き取り、グリル投入直前に'
              + 'さらに0.3%の化粧塩を追加する2段階手順',
            preparationSequence: '1%塩→15〜30分常温放置→水分を拭き取る→予熱→追加の化粧塩→焼く',
          },
          {
            sourceId: 'oishikenko-sakeshioyaki-2026',
            equipment: '魚焼きグリルまたはオーブントースター',
            fatOrOil: 'なし',
            liquidOrWater: 'なし',
            lid: '該当なし',
            heatSequence: '7〜8分焼く（range、放置なしの1段階手順）',
            flip: '本文に記載なし',
            restOrResidualHeat: '本文に記載なし',
            seasoningSequence: '水分を拭き取って直前に塩を振る、放置なしの1段階手順',
            preparationSequence: '水分を拭き取る→塩を振る→すぐに焼く',
          },
        ],
        reviewedDimensions: ['equipment', 'heat-sequence', 'rest-or-residual-heat', 'seasoning-sequence', 'major-preparation-sequence'],
        rationale:
          'equipmentは両面焼きグリルへ絞り込み済みで一致し、cookingTimeMinutes'
            + '（4分+3分=7分、予熱除外）はkikkoman単独の直接事実2件の合算として正当。'
            + 'しかしseasoning-sequence/major-preparation-sequenceでは、kikkomanの'
            + '「1%塩を15〜30分放置してから追加の化粧塩」という2段階processと、'
            + 'oishikenkoの「放置なしで直前に1回だけ塩を振る」という1段階processが'
            + '両立しない。NUKITORUの現在のseasonings/criticalStepsはoishikenko側の'
            + '1段階processに基づく一方、equipment/cookingTimeMinutesはkikkoman側の'
            + '2段階processが前提の「両面焼きグリル」method内の事実であり、この2つを'
            + '1つのRecipeとして組み合わせることはprocess不整合にあたる。'
            + 'よってincoherentと判定する。',
      },
    },
  },
  {
    id: 'maguro-yamakake',
    name: 'まぐろの山かけ',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'マグロ', amount: '150g' },
      { name: '長芋', amount: '150g' },
    ],
    seasonings: [{ name: 'しょうゆ', amount: '大さじ1' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['生食', '時短'],
    equipment: ['包丁', 'まな板', 'おろし器'],
    steps: [
      '長芋の皮をむき、すりおろす',
      'マグロを食べやすい大きさに切る',
      '器にマグロを盛り、長芋をかける',
      'しょうゆをかける',
    ],
    notes: ['生食用として販売されている魚を使用してください。'],
  },
  {
    id: 'tuna-daikon-salad',
    name: 'ツナと大根のサラダ',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ツナ', amount: '1缶' },
      { name: '大根', amount: '1/4本' },
    ],
    seasonings: [{ name: 'マヨネーズ', amount: '大さじ2' }],
    ingredientChecks: [{ ingredientName: 'マヨネーズ' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['サラダ', '時短', '生食'],
    equipment: ['包丁', 'まな板', 'ボウル'],
    steps: ['大根を千切りにする', 'ツナの油を軽くきる', 'ボウルで大根、ツナ、マヨネーズを和える'],
  },

  // ------------------------------------------------------------
  // 卵・豆腐系
  // ------------------------------------------------------------
  {
    id: 'medama-yaki',
    name: '目玉焼き',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '卵', amount: '1個' }],
    seasonings: [{ name: '油', amount: '小さじ1と1/2' }],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['朝食', '時短', '子ども向け'],
    equipment: ['フライパン'],
    steps: ['フライパンに油を熱する', '卵を割り入れる', '好みの固さになるまで焼く'],
    // MISSION 2.12 PHASE B — First 10 Families Starter Set Evidence Resolution。
    // CURRENT: 油 小さじ1 / SOURCE A: kyounoryouri-medamayaki-2026（NHKみんなのきょうの
    // 料理・瀬田金行シェフ監修、2人分）卵2個・サラダ油大さじ1・調理時間10分（1個ずつ
    // 順に焼く方式）/ SOURCE B: kikkoman-medamayaki-tips-2026（キッコーマン公式）
    // 油少々・弱火で3〜4分 / DECISION: 油を小さじ1→小さじ1と1/2へ変更 / WHY: SOURCE Aの
    // 「2個で大さじ1」を卵1個あたりへ機械的に等分（大さじ1/2＝小さじ1と1/2）。卵の個数と
    // 油の量は同一調理法内で線形に扱って妥当（片面焼きのまま個数だけが変わる）。SOURCE B
    // の「油少々」は数値化されていないが小さじ1と1/2という少量と矛盾しない。
    // cookingTimeMinutesは変更なし（5分） / WHY: SOURCE Aの卵1個あたりの実質加熱時間は
    // 本文「弱めの中火で3分ほど」+初期の予熱・卵を割り入れる時間を合わせて5分程度が妥当な
    // 範囲であり、SOURCE Bの「3〜4分」（弱火加熱のみ、予熱等含まず）とも整合する。
    // どちらのSourceも複数の異なる調理器具・条件によるrangeを示しているわけではなく、
    // 単一の調理法の中での近似のため、rangeとしてではなくderivedとして扱う /
    // EVIDENCE TYPE: 油=derived、cookingTimeMinutes=derived、その他=direct。
    //
    // MISSION 2.14A/2.14B — Recipe Process Coherence Audit & Correction（上記VERIFIED
    // 判定を撤回）。両sourceの生HTML本文を再確認した結果、以下が判明した。
    // (1) SOURCE A（NHK）の実際のレシピは最終ステップで「塩、こしょう各少々をふって
    // 食べる」と明示しており、seasonings=[油]のみという「塩味なし」識別を積極的に
    // 否定する（矛盾する）。SOURCE B（キッコーマン「基本」method）は塩・こしょうに
    // 一切言及しないが、これは沈黙であり「塩を使わない」ことのEvidenceにはならない
    // （MISSION 2.14B新設のSOURCE SILENCE原則: 情報源の沈黙は否定的事実の根拠にならない）。
    // よってseasonings/seasoningAmountsをdirect/derivedとして扱っていたのは誤り。
    // (2) NUKITORUのcriticalSteps（油を熱する→卵を割り入れる→好みの固さまで焼く）は
    // 両sourceが共通して明示する「卵は先にボウルへ割り入れてからフライパンへ入れる」
    // という工程を欠いている。さらに火加減もNHK（強火→白身が変わり始めたら弱めの
    // 中火で3分ほど）とキッコーマン（中火で予熱→卵を入れたら弱火にして3〜4分）で
    // 異なるsequenceであり、NUKITORUのstepsはどちらとも文字通り一致しないため
    // directの根拠にならない。
    // (3) cookingTimeMinutes=5のderivationは、NHKの「3分ほど」（弱めの中火のactive
    // 加熱のみ、予熱を含まない）に「予熱・卵を割り入れる工程」というNUKITORU独自の
    // 追加時間を足した上で、それをキッコーマンの「3〜4分」（予熱を含まないactive
    // 加熱のみ）と「整合する」と比較しており、scopeの異なる時間（予熱込み vs
    // 予熱抜き）を同一のものとして扱ってしまっている。cookingTimeMinutesの意味論が
    // Recipe横断で確定するまで、scopeの異なる時間を混在させたderivationはVERIFIEDの
    // 根拠にできない（EVIDENCE_POLICY.md「cookingTimeMinutes意味論ポリシー」参照）。
    // equipment（フライパン・ふたなし・水なし）自体の識別は両source一致しており
    // 維持する。Recipe factは一切変更しない（油小さじ1と1/2・cookingTimeMinutes=5分・
    // steps・equipment、すべて元のまま）。statusをVERIFIEDからREVIEWへ差し戻す。
    verification: {
      status: 'review',
      sourceIds: ['kyounoryouri-medamayaki-2026', 'kikkoman-medamayaki-tips-2026'],
      recipeIdentity: {
        canonicalDish: '目玉焼き',
        variant: '片面焼き・水を使わない基本の目玉焼き（蒸し焼きバージョンではない）',
        servingsBasis: 1,
        intendedTasteProfile: '黄身が半熟〜好みの固さの、シンプルな塩味なしの目玉焼き（油と卵のみ）',
        coreMethod: 'フライパンに油を熱し、卵を割り入れて水を使わず好みの固さまで焼く',
        definingIngredients: ['卵'],
      },
      fieldVerifications: [
        {
          field: 'requiredIngredients',
          sourceIds: ['kyounoryouri-medamayaki-2026'],
          supportType: 'direct',
        },
        {
          field: 'ingredientAmounts',
          sourceIds: ['kyounoryouri-medamayaki-2026'],
          supportType: 'derived',
          derivation: 'NHK「2人分・卵2個」＝1人分1個という1:1の卵数比率をそのまま適用。',
        },
        {
          // MISSION 2.14B CORRECTION: NHKの実レシピは「塩、こしょう各少々」を明示的な
          // finishing stepとして含んでおり、「塩味なし」を積極的に否定する。キッコーマン
          // 「基本」methodは塩・こしょうに一切言及しないが、これは沈黙でありSOURCE
          // SILENCE原則によりnegative evidenceにならない。よってdirect支持を撤回。
          field: 'seasonings',
          sourceIds: ['kyounoryouri-medamayaki-2026', 'kikkoman-medamayaki-tips-2026'],
          variantRelation: 'unresolved-between-variants',
        },
        {
          field: 'seasoningAmounts',
          sourceIds: ['kyounoryouri-medamayaki-2026'],
          variantRelation: 'unresolved-between-variants',
        },
        {
          // MISSION 2.14B CORRECTION: derivationがNHKの「3分ほど」（予熱抜きのactive
          // 加熱のみ）にNUKITORU独自の予熱時間見積もりを加算した上で、それをキッコーマン
          // の「3〜4分」（同じく予熱抜きのactive加熱のみ）と「整合する」と比較しており、
          // 異なるscope（予熱込み vs 予熱抜き）の時間を同一視していた。cookingTimeMinutes
          // の意味論がRecipe横断で確定するまで、この混在derivationはEvidence解決済みと
          // 扱えない。
          field: 'cookingTimeMinutes',
          sourceIds: ['kyounoryouri-medamayaki-2026', 'kikkoman-medamayaki-tips-2026'],
        },
        {
          field: 'servingsBase',
          sourceIds: ['kyounoryouri-medamayaki-2026'],
          supportType: 'derived',
          derivation: 'NHK「2人分・卵2個」から、卵1個＝1人分という比率を採用。',
        },
        {
          // MISSION 2.14B CORRECTION: 両sourceが共通して明示する「卵を先にボウルへ
          // 割り入れてからフライパンへ入れる」という工程をNUKITORUのstepsは欠いており、
          // 火加減のsequence（NHK: 強火→白身が変わり始めたら弱めの中火3分／
          // キッコーマン: 中火で予熱→卵を入れたら弱火にして3〜4分）も両source間で
          // 一致しない。NUKITORUのstepsはどちらとも文字通り一致しない簡略化された
          // hybridであり、direct支持は不正確な分類だった。
          field: 'criticalSteps',
          sourceIds: ['kyounoryouri-medamayaki-2026', 'kikkoman-medamayaki-tips-2026'],
        },
        { field: 'equipment', sourceIds: ['kyounoryouri-medamayaki-2026'], supportType: 'direct' },
        { field: 'allergyIdentity', sourceIds: ['kyounoryouri-medamayaki-2026'], supportType: 'direct' },
      ],
      reviewNotes: [
        'MISSION 2.14A/2.14B CORRECTION: 両source（NHKみんなのきょうの料理・キッコーマン）'
          + 'の生HTML本文を再確認した結果、(1) seasonings=[油]のみという「塩味なし」識別を'
          + 'NHKの実レシピ（塩・こしょうを明示的なfinishing stepとして含む）が積極的に'
          + '否定していること、(2) キッコーマンの沈黙はSOURCE SILENCE原則により「塩を'
          + '使わない」ことのEvidenceにならないこと、(3) NUKITORUのcriticalStepsが'
          + '両sourceに共通する「ボウルへ先に割り入れる」工程を欠き、火加減sequenceも'
          + '両source間で一致しないこと、(4) cookingTimeMinutes=5のderivationが予熱込み'
          + '（NHK+独自見積もり）と予熱抜き（キッコーマン）という異なるscopeの時間を'
          + '同一視していたこと、が判明した。equipment（フライパン・ふたなし・水なし）の'
          + '識別自体は両source一致しており正当。Recipe factは一切変更せず、'
          + 'seasonings/seasoningAmounts/criticalSteps/cookingTimeMinutesのEvidence'
          + '解決状態のみを訂正し、statusをVERIFIEDからREVIEWへ差し戻す。',
      ],
      hasUnsupportedInference: false,
      coherenceReview: {
        status: 'incoherent',
        sourceProcessNotes: [
          {
            sourceId: 'kyounoryouri-medamayaki-2026',
            equipment: 'フライパン',
            fatOrOil: 'サラダ油大さじ1/2（1個あたり）',
            liquidOrWater: 'なし（本文の水+ふた併用は備考欄の別法として明示的に区別）',
            lid: 'なし',
            heatSequence: '強火で熱し卵投入→白身の色が変わり始めたら弱めの中火にして3分間ほど',
            flip: 'なし',
            restOrResidualHeat: '本文に記載なし',
            seasoningSequence: '仕上げに塩・こしょう各少々をふって食べる（明示的なfinishing step）',
            preparationSequence: '卵を器に割り入れてからフライパンへ',
          },
          {
            sourceId: 'kikkoman-medamayaki-tips-2026',
            equipment: 'フライパン',
            fatOrOil: '油少々（未数値化）',
            liquidOrWater: 'なし（水+ふたの「蒸し焼き」は同ページ内の別named methodとして明示的に区別）',
            lid: 'なし',
            heatSequence: '中火で予熱→卵を入れたら弱火にし、弱火にしてから3〜4分（予熱を含まない）',
            flip: 'なし（「ターンオーバー」は別named method）',
            restOrResidualHeat: '本文に記載なし',
            seasoningSequence: 'この「基本」method内では言及なし（言及なし＝塩不使用の根拠にはしない）',
            preparationSequence: '卵を器に割り入れてからフライパンへ',
          },
        ],
        reviewedDimensions: ['equipment', 'lid', 'liquid-or-water', 'heat-sequence', 'seasoning-sequence', 'major-preparation-sequence'],
        rationale:
          '両sourceともequipment/lid/liquid-or-water/major-preparation-sequence'
            + '（ボウルへ先に割り入れる）は一致し、この4次元は矛盾しない1つのprocessを'
            + '構成する。しかしheat-sequence（NHKの強火→弱めの中火 vs キッコーマンの'
            + '中火予熱→弱火）とseasoning-sequence（NHKは明示的に塩・こしょうを使う vs '
            + 'キッコーマンは言及なし＝SOURCE SILENCE原則により肯定にも否定にもならない）'
            + 'の2次元で、NUKITORUの現在のRecipe（塩・こしょうなし、火加減未指定）が'
            + 'どちらのsourceの実際のprocessとも一致しない独自のhybridになっている。'
            + 'よってincoherentと判定する。equipment等が個別に一致することは、'
            + 'seasoning/heat-sequenceの不一致をrescueしない。',
      },
    },
  },
  {
    id: 'tamagoyaki',
    name: '卵焼き',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '卵', amount: '3個' }],
    seasonings: [
      { name: '砂糖', amount: '大さじ1' },
      { name: 'しょうゆ', amount: '小さじ1' },
      { name: '油', amount: '適量' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['朝食', '子ども向け'],
    equipment: ['卵焼き用フライパン', '菜箸', '包丁', 'まな板'],
    steps: [
      '卵を溶き、砂糖としょうゆを混ぜる',
      'フライパンに薄く油をひき、卵液を少量流し入れて焼く',
      '端から巻きながら残りの卵液も同様に焼き重ねる',
      '中心まで火が通ったら取り出して切る',
    ],
  },
  {
    id: 'tofu-tamago-soup',
    name: '豆腐と卵のスープ',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '卵', amount: '1個' },
      { name: '豆腐', amount: '1/2丁' },
    ],
    seasonings: [
      { name: 'だしの素', amount: '小さじ1' },
      { name: 'しょうゆ', amount: '小さじ1' },
    ],
    cookingLiquids: [{ name: '水', amount: '400ml' }],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: 'だしの素' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['汁物', '時短'],
    equipment: ['鍋'],
    steps: [
      '鍋に水とだしの素を入れて煮立たせる',
      '豆腐を一口大に切って加える',
      'しょうゆで味を調える',
      '溶き卵を回し入れ、卵に火が通ったら火を止める',
    ],
  },
  {
    id: 'hiyayakko',
    name: '冷奴',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '豆腐', amount: '1/2丁' }],
    seasonings: [{ name: 'しょうゆ', amount: '小さじ1' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['時短', '夏'],
    equipment: ['包丁', 'まな板'],
    steps: ['豆腐を食べやすい大きさに切る', '器に盛り、しょうゆをかける'],
    arrangements: [
      { id: 'hiyayakko-negi', label: 'ねぎをのせる', addIngredients: ['ねぎ'] },
      { id: 'hiyayakko-katsuobushi', label: 'かつお節をのせる', addIngredients: ['かつお節'] },
    ],
    // MISSION 2.12 PHASE B — First 10 Families Starter Set Evidence Resolution。
    // CURRENT: 豆腐1/2丁(1人分)・しょうゆ小さじ1 / SOURCE A: ajinomoto-hiyayakko-2026
    // （味の素パーク公式）絹ごし豆腐1丁・4人分、しょうゆは「適量」（数値なし）/
    // DECISION: 変更なし（現状維持） / WHY: 豆腐の人数比はSOURCE A（1丁/4人＝1/4丁/人）と
    // NUKITORU（1/2丁/1人）で2倍の開きがあるが、豆腐ブロックのサイズ・銘柄自体が製品により
    // 大きく異なるため、比率の一致・不一致だけで結論を出せない。しょうゆはSOURCE Aを含め
    // 調査した複数のメーカー公式・専門家サイトのいずれも「適量」表記でありexactな標準比率
    // が存在しない（お好みで量を調整する調味料であるため）/ EVIDENCE TYPE: 豆腐量=CONFLICT
    // （製品サイズ差の可能性があり結論不能）、しょうゆ=NOT_FOUND。
    verification: {
      status: 'review',
      sourceIds: [
        'ajinomoto-hiyayakko-2026',
        'oishikenko-hiyayakko-2026',
        'kubara-hiyayakko-yakumi-2026',
        'kurashiru-hiyayakko-simple-2026',
      ],
      recipeIdentity: {
        canonicalDish: '冷奴',
        variant: '基本の冷奴（薬味なし、しょうゆのみ）',
        servingsBasis: 1,
        intendedTasteProfile: '豆腐そのものの味を活かした、しょうゆのみのシンプルな冷奴',
        coreMethod: '豆腐を切って器に盛り、しょうゆをかける（加熱調理なし）',
        definingIngredients: ['豆腐'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['ajinomoto-hiyayakko-2026'], supportType: 'variant' },
        { field: 'criticalSteps', sourceIds: ['ajinomoto-hiyayakko-2026'], supportType: 'direct' },
      ],
      reviewNotes: [
        'CURRENT: 豆腐1/2丁(1人分) / SOURCE A: ajinomoto-hiyayakko-2026（絹ごし豆腐1丁・'
          + '4人分＝1/4丁/人）/ DECISION: 変更なし（現状維持） / WHY: 豆腐1丁の重量は製品'
          + 'により大きく異なり（300g〜400g等）、比率の単純比較では結論できない。同一製品を'
          + '仮定しない限り解決不能なためCONFLICT扱いのままREVIEWとする / EVIDENCE TYPE: '
          + 'CONFLICT。',
        'CURRENT: しょうゆ小さじ1 / SOURCE A: 「適量」（数値なし）/ DECISION: 変更なし / '
          + 'WHY: 調査した複数のメーカー公式サイトがいずれも「適量」表記で、しょうゆの'
          + 'exact標準量を明記した信頼できるsourceが見つからなかった（お好みで調整する'
          + '調味料であるため） / EVIDENCE TYPE: NOT_FOUND。',
        'MISSION 2.13 — Evidence Variant Foundationの分類基準に照らして再分類する。'
          + '豆腐量については、対立する2件の独立sourceが存在するわけではなく、根拠のある'
          + 'source（Ajinomoto、1/4丁/人）とNUKITORU側の無根拠な既存値（1/2丁/人）の'
          + '食い違いに過ぎないため、PHASE Bの「CONFLICT」表記は精度を欠いていた。'
          + '正しくは「E. NOT_FOUND/under-specified」（豆腐1丁の重量が製品により大きく'
          + '異なるため、特定製品を仮定しない限り根拠のあるratioを確定できない）として'
          + '再分類する。しょうゆ量も同様にE（推測禁止・確定不能）。isEstablishedVariant()'
          + 'の条件（意味のある次元＋複数独立source or 権威ある情報源の明示）を満たさない'
          + 'ため、variantとしても確立しない。',
        'MISSION 2.14 — First 10 Families Starter Set Evidence Resolution（hiyayakko特別'
          + '監査）。SOURCE B: oishikenko-hiyayakko-2026（管理栄養士監修・1人分・低ナトリウム'
          + '献立）絹ごし豆腐1/4丁(80g)・しょうゆ小さじ1/2(3g)・ねぎ/しょうが少量、という'
          + '"適量ではないexactな数値"が初めて見つかった。DECISION: 変更なし（現状維持） / '
          + 'WHY: SOURCE Bは実在するexact値だが、豆腐量がNUKITORU現行値の半分（1/4丁 vs '
          + '1/2丁）という異なる前提（同レシピは糖尿病向け低栄養管理コンテキストであり、'
          + '通常の家庭用「1人前」より少なめに設計されている可能性が高い）であるため、'
          + 'しょうゆ小さじ1/2だけを豆腐1/2丁の分量に無断で組み合わせることは、'
          + '異なるcontext間で都合の良い数値だけを合成する行為（Section 14 "must NOT '
          + 'combine sources across incompatible variants"）に該当し禁止される。したがって'
          + 'NUKITORU自身の「1人前＝豆腐1/2丁」という前提に対応する、しょうゆのexact値は'
          + '依然として見つかっていない / EVIDENCE TYPE: A/E混在（exact値は存在するが'
          + '別contextのため、NUKITORUのcontextに対する値としては引き続き未確定）。',
        'MISSION 2.16 — Verified Starter Set Evidence Resolution Batch 1。SOURCE C: '
          + 'kubara-hiyayakko-yakumi-2026（久原本家/茅乃舎・2人分）木綿または絹ごし豆腐1丁・'
          + '調味料[A]＝茅乃舎だし1袋＋醤油小さじ1＋ごま油大さじ1、青ねぎ/みょうが/青しそ/生姜。'
          + 'SOURCE D: kurashiru-hiyayakko-simple-2026（クラシル・2人前）絹ごし豆腐200g・'
          + 'しょうゆ小さじ2（本文に「しょうゆの量は、お好みで調整して」と明記）・小ねぎ5g・'
          + 'すりおろし生姜小さじ1。DECISION: 変更なし（現状維持） / WHY: (1) SOURCE Cの'
          + '醤油小さじ1は「だし＋ごま油＋4種薬味」という複合ドレッシングの一部であり、'
          + 'NUKITORUの「薬味なし・しょうゆのみ」variantへ転用するとSection 10/12が禁じる'
          + 'incompatible-variant合成になる。(2) SOURCE Dは薬味入りである上、source自身が'
          + 'しょうゆ量を「お好みで調整」＝実質「適量」と位置づけており、Section 8により'
          + 'exact Evidenceとして扱えない（かつ監修者記載なしのother-trusted単独source）。'
          + '(3) 豆腐量も1丁/2人・200g/2人・1丁/4人と依然ばらつき、「1丁」の重量差により'
          + '確定不能。再調査でもしょうゆ・豆腐量のexact Evidenceは同一identityで得られず、'
          + 'REVIEWを維持する / EVIDENCE TYPE: 引き続きE（NOT_FOUND/under-specified）。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'iritamago',
    name: '炒り卵',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '卵', amount: '2個' }],
    seasonings: [
      { name: '砂糖', amount: '小さじ1' },
      { name: '塩', amount: '少々' },
    ],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['朝食', '時短'],
    equipment: ['フライパン', '菜箸'],
    steps: [
      '卵を溶き、砂糖と塩を混ぜる',
      'フライパンで弱火にかけながら菜箸でかき混ぜる',
      '好みの固さになったら火を止める',
    ],
  },

  // ------------------------------------------------------------
  // 副菜
  // ------------------------------------------------------------
  {
    id: 'ninjin-shirishiri',
    name: 'にんじんしりしり',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'にんじん', amount: '1本' },
      { name: '卵', amount: '1個' },
    ],
    seasonings: [
      { name: '油', amount: '小さじ1' },
      { name: 'しょうゆ', amount: '小さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['副菜', '時短'],
    equipment: ['包丁', 'まな板', 'フライパン'],
    steps: [
      'にんじんを細切りにする',
      'フライパンで油を熱し、にんじんを炒める',
      'しんなりしたら溶き卵を加えて炒め合わせる',
    ],
  },
  {
    id: 'kinoko-butter-itame',
    name: 'きのこのバター炒め',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'きのこ', amount: '200g' }],
    seasonings: [
      { name: 'バター', amount: '大さじ1' },
      { name: 'しょうゆ', amount: '小さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['副菜', '時短'],
    equipment: ['フライパン'],
    steps: ['きのこを食べやすい大きさにほぐす', 'フライパンでバターを熱し、きのこを炒める', 'しょうゆで味を調える'],
  },
  {
    id: 'jagaimo-nikkorogashi',
    name: 'じゃがいもの煮っころがし',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'じゃがいも', amount: '3個' }],
    seasonings: [
      { name: 'しょうゆ', amount: '大さじ1と1/2' },
      { name: 'みりん', amount: '大さじ1' },
      { name: '砂糖', amount: '大さじ1' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['副菜', '煮物'],
    equipment: ['包丁', 'まな板', '鍋'],
    steps: [
      'じゃがいもを一口大に切る',
      '鍋にじゃがいもと具材が浸る程度の水を入れて火にかける',
      '柔らかくなってきたらしょうゆ、みりん、砂糖を加える',
      '煮汁が少なくなるまで煮詰める',
    ],
  },
  {
    id: 'daikon-asazuke',
    name: '大根の浅漬け',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '大根', amount: '1/4本' }],
    seasonings: [
      { name: '塩', amount: '小さじ1/2' },
      { name: '酢', amount: '大さじ1' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['副菜', '時短', '生食'],
    equipment: ['包丁', 'まな板', 'ボウル'],
    steps: ['大根を薄切りにする', 'ボウルに大根、塩、酢を入れて軽く揉む', '10分ほどおいて味をなじませる'],
  },
  {
    id: 'cabbage-asazuke',
    name: 'キャベツの浅漬け',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'キャベツ', amount: '1/4個' }],
    seasonings: [{ name: '塩', amount: '小さじ1/2' }],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['副菜', '時短', '生食'],
    equipment: ['包丁', 'まな板', 'ボウル'],
    steps: ['キャベツを一口大にちぎる', 'ボウルに入れ、塩を振って軽く揉む', '10分ほどおいて味をなじませる'],
  },
  {
    id: 'ninjin-glace',
    name: 'にんじんのグラッセ',
    type: 'side',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'にんじん', amount: '1本' }],
    seasonings: [
      { name: 'バター', amount: '大さじ1' },
      { name: '砂糖', amount: '大さじ1' },
    ],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['副菜', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋'],
    steps: [
      'にんじんを食べやすい大きさに切る',
      '鍋ににんじん、バター、砂糖、ひたる程度の水を入れて煮る',
      '柔らかくなり、水分が少なくなるまで煮詰める',
    ],
  },

  // ------------------------------------------------------------
  // 汁物
  // ------------------------------------------------------------
  {
    id: 'tofu-miso-soup',
    name: '豆腐の味噌汁',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '豆腐', amount: '1/2丁' }],
    seasonings: [
      { name: 'だしの素', amount: '小さじ1' },
      { name: '味噌', amount: '大さじ1と1/2' },
    ],
    cookingLiquids: [{ name: '水', amount: '400ml' }],
    ingredientChecks: [
      { ingredientName: '味噌' },
      { ingredientName: 'だしの素' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['汁物', '時短'],
    equipment: ['鍋'],
    steps: [
      '鍋に水とだしの素を入れて煮立たせる',
      '豆腐を一口大に切って加える',
      '煮立ったら火を弱め、味噌を溶き入れる',
    ],
    // MISSION 2.12 PHASE B — First 10 Families Starter Set Evidence Resolution。
    // CURRENT: 水400ml・味噌大さじ1と1/2(2人分) / SOURCE A: yamaki-misoshiru-2026
    // （ヤマキ公式・2人分）だし400ml・味噌大さじ2・具は油揚げ1/2枚+乾燥わかめ+長ねぎ
    // （豆腐は使わない）/ SOURCE B: marukome-misoshiru-faq-2026（マルコメ公式FAQ）
    // 1杯あたり味噌大さじ1(17g):お湯160ccが目安 / DECISION: 変更なし（現状維持） /
    // WHY: 水量400mlはSOURCE Aと一致するが、SOURCE Aは豆腐ではなく油揚げを使う別の
    // definingIngredientのvariantであり、直接比較の対象にできない。一方、味噌:水の
    // 比率で見るとSOURCE B（2人分換算で大さじ2:320ml、約160ml/大さじ1）とSOURCE A
    // （2人分で大さじ2:400ml、約200ml/大さじ1）はメーカー間で比率自体が食い違っており、
    // 平均化は禁止されているため水量400mlをVERIFIEDの根拠にはできない /
    // EVIDENCE TYPE: cookingLiquids(水)=CONFLICT（メーカー間の味噌:水比率相違）、
    // requiredIngredients(豆腐)=SOURCE Aとの関係ではVARIANT（具材が油揚げで異なる）。
    verification: {
      status: 'review',
      sourceIds: [
        'yamaki-misoshiru-2026',
        'marukome-misoshiru-faq-2026',
        'marukome-tofu-wakame-basic-2026',
        'kobayashi-tofu-misoshiru-2026',
      ],
      recipeIdentity: {
        canonicalDish: '味噌汁',
        variant: '豆腐のみを具とする味噌汁（油揚げ・わかめ・ねぎ等は加えない）',
        servingsBasis: 2,
        intendedTasteProfile: '家庭的なだし＋味噌のシンプルな味噌汁',
        coreMethod: '水とだしの素を煮立て、豆腐を加えてから味噌を溶き入れる',
        definingIngredients: ['豆腐', '味噌'],
      },
      fieldVerifications: [
        { field: 'requiredIngredients', sourceIds: ['yamaki-misoshiru-2026'], supportType: 'variant' },
        {
          field: 'cookingLiquids',
          sourceIds: ['yamaki-misoshiru-2026', 'marukome-misoshiru-faq-2026'],
          supportType: 'direct',
          variantRelation: 'conflicting-within-variant',
        },
      ],
      reviewNotes: [
        'CURRENT: 水400ml・味噌大さじ1と1/2 / SOURCE A: ヤマキ公式（2人分・だし400ml・'
          + '味噌大さじ2、ただし具は油揚げでありNUKITORUの豆腐とはdefiningIngredientが'
          + '異なるvariant）/ SOURCE B: マルコメ公式FAQ（1杯＝大さじ1:160cc、2人分換算で'
          + '大さじ2:320ml）/ DECISION: 変更なし / WHY: ヤマキとマルコメで味噌:水の比率'
          + '自体が異なり（200ml/大さじ vs 160ml/大さじ）、平均化は禁止されているため'
          + '水400mlをEvidence直接支持として採用できない。CONFLICTとしてREVIEWを維持する '
          + '/ EVIDENCE TYPE: CONFLICT。',
        'MISSION 2.13 — Evidence Variant Foundationの分類基準に照らすと、本Recipeには'
          + '性質の異なる2つの問題が混在している。(1) 具材（豆腐 vs ヤマキの油揚げ）は'
          + 'major-ingredient-structureが異なる「C. recipe identity mismatch」。'
          + '(2) 味噌:水比率（ヤマキ200ml/大さじ vs マルコメ160ml/大さじ）は、具材に'
          + '依存しないはずの一般的比率でありながらメーカー間で食い違う「A. likely true '
          + 'conflict」（variant-independentなfieldでのconflict）。いずれもisEstablishedVariant()'
          + 'の条件を満たさずvariantとして確立しないため、数値を選ばずREVIEWを維持する。',
        'MISSION 2.14 — First 10 Families Starter Set Evidence Resolution。SOURCE C: '
          + 'marukome-tofu-wakame-basic-2026（マルコメ公式「基本のレシピ」・豆腐とわかめの'
          + 'おみそ汁、2人分）味噌32g・水320ml・豆腐1/4丁・わかめ2g。これはマルコメの'
          + 'FAQ簡易目安（大さじ1:160cc）よりやや厳密な自社実レシピの数値であり、味噌:水比率'
          + 'は320/32=10（FAQの160/17≈9.4とほぼ一致し、マルコメ社内では整合）。DECISION: '
          + '変更なし（現状維持） / WHY: マルコメ社内の比率（約9.4〜10）はヤマキの比率'
          + '（400/36≈11.1）と依然として異なり、メーカー間の相違は解消しない。また豆腐量も'
          + 'このマルコメレシピでは1/4丁/2人分（1/8丁/人）と、NUKITORU現行値（1/2丁/2人分'
          + '＝1/4丁/人）の半分であり、わかめ等の副材あり／なしという別variantのため単純'
          + '比較できない。CONFLICT/recipe identity mismatchの両方が追加調査でも解消しない'
          + 'ためREVIEWを維持する / EVIDENCE TYPE: 引き続きA（メーカー間conflict）+ C'
          + '（具材構成の相違）。',
        'MISSION 2.16 — Verified Starter Set Evidence Resolution Batch 1。SOURCE D: '
          + 'kobayashi-tofu-misoshiru-2026（小林食品「和食の旨み」／元料理人・2人分）'
          + '絹ごしまたは木綿豆腐1/4丁・水400ml・粉末だし大さじ1・味噌大さじ2・長ねぎ1/4本。'
          + '手順: だしを煮立て→火を弱め味噌を溶く→豆腐を加え弱火で約1分→味噌投入後は'
          + '沸騰させない。DECISION: 変更なし（現状維持） / WHY: (1) 水400mlは一致するが、'
          + '味噌はSOURCE D・ヤマキ・マルコメFAQ換算がいずれも「大さじ2/400ml/2人分」付近で、'
          + 'NUKITORU現行値（大さじ1と1/2）はどのsourceとも一致しない。ただしメーカー間の'
          + '味噌:水比率は依然食い違い（ヤマキ約11:1 vs マルコメ約9〜10:1）、Section 8/9により'
          + '「大さじ2」を選んで採用することは禁止される。(2) 豆腐量はSOURCE D・マルコメとも'
          + '1/4丁/2人分で、NUKITORU現行値（1/2丁/2人分）の半分。(3) SOURCE Dは「味噌→豆腐」'
          + 'の順で味噌投入後は沸騰させない手順であり、NUKITORUの「豆腐→煮立ったら味噌」手順'
          + 'とはsequence・加熱管理が異なる。複数のだし系統（かつおだし/だし入り味噌/粉末だし）'
          + 'を1つのprocessへ混成しない（Section 15E）。味噌量・豆腐量ともにdirect Evidenceで'
          + '確定できずREVIEWを維持する / EVIDENCE TYPE: 引き続きA（メーカー間conflict）＋ '
          + 'C（具材量・構成の相違）。なお味噌大さじ2への変更はCommander判断の候補として記録。',
      ],
      hasUnsupportedInference: true,
    },
  },
  {
    id: 'vegetable-soup',
    name: '野菜スープ',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'キャベツ', amount: '1/4個' },
      { name: 'にんじん', amount: '1/2本' },
      { name: '玉ねぎ', amount: '1個' },
    ],
    seasonings: [{ name: 'コンソメ', amount: '1個（固形）' }],
    cookingLiquids: [{ name: '水', amount: '600ml' }],
    ingredientChecks: [{ ingredientName: 'コンソメ' }],
    cookingTimeMinutes: 20,
    servingsBase: 3,
    tags: ['汁物', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋'],
    steps: [
      'キャベツ、にんじん、玉ねぎを食べやすい大きさに切る',
      '鍋に切った野菜と水、コンソメを入れて煮る',
      '野菜が柔らかくなるまで煮込む',
    ],
  },
  {
    id: 'tonjiru',
    name: '豚汁',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: '豚肉', amount: '150g' },
      { name: '大根', amount: '1/4本' },
      { name: 'にんじん', amount: '1/2本' },
    ],
    seasonings: [{ name: '味噌', amount: '大さじ2' }],
    cookingLiquids: [{ name: '水', amount: '600ml' }],
    ingredientChecks: [{ ingredientName: '味噌' }],
    cookingTimeMinutes: 25,
    servingsBase: 3,
    tags: ['汁物'],
    equipment: ['包丁', 'まな板', '鍋'],
    steps: [
      '豚肉、大根、にんじんを一口大に切る',
      '鍋で豚肉を炒め、色が変わったら大根とにんじんを加えて炒める',
      '水を加えて具材が柔らかくなるまで煮る',
      '火を弱めて味噌を溶き入れる',
    ],
    notes: ['豚肉は中心まで色が変わっていることを確認してください。'],
  },
  {
    id: 'jagaimo-potage',
    name: 'じゃがいものポタージュ',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'じゃがいも', amount: '2個' },
      { name: '玉ねぎ', amount: '1/2個' },
      { name: '牛乳', amount: '200ml' },
    ],
    seasonings: [{ name: 'コンソメ', amount: '1個（固形）' }],
    cookingLiquids: [{ name: '水', amount: '300ml' }],
    ingredientChecks: [{ ingredientName: 'コンソメ' }],
    cookingTimeMinutes: 25,
    servingsBase: 3,
    tags: ['汁物', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋', 'マッシャーまたはミキサー'],
    steps: [
      'じゃがいもと玉ねぎを薄切りにする',
      '鍋で炒め、水とコンソメを加えて柔らかくなるまで煮る',
      '粗熱をとってつぶすかミキサーにかける',
      '牛乳を加えて温める',
    ],
  },
  {
    id: 'kakitama-jiru',
    name: 'かきたま汁',
    type: 'soup',
    cuisine: 'japanese',
    requiredIngredients: [{ name: '卵', amount: '1個' }],
    seasonings: [
      { name: 'だしの素', amount: '小さじ1' },
      { name: 'しょうゆ', amount: '小さじ1' },
      { name: '片栗粉', amount: '小さじ2' },
    ],
    cookingLiquids: [{ name: '水', amount: '400ml' }],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: 'だしの素' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 2,
    tags: ['汁物', '時短'],
    equipment: ['鍋'],
    steps: [
      '鍋に水とだしの素を入れて煮立たせ、しょうゆで味を調える',
      '片栗粉を同量の水で溶き、鍋に加えてとろみをつける',
      '溶き卵を回し入れ、卵に火が通ったら火を止める',
    ],
  },

  // ------------------------------------------------------------
  // 麺
  // ------------------------------------------------------------
  {
    id: 'shoyu-udon',
    name: '醤油うどん',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'うどん', amount: '1玉' }],
    seasonings: [
      { name: 'だしの素', amount: '小さじ1' },
      { name: 'しょうゆ', amount: '小さじ2' },
    ],
    cookingLiquids: [{ name: '水', amount: '350ml' }],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: 'だしの素' },
    ],
    cookingTimeMinutes: 10,
    servingsBase: 1,
    tags: ['麺', '時短'],
    equipment: ['鍋'],
    steps: ['鍋に水とだしの素を入れて煮立たせ、しょうゆで味を調える', 'うどんを加えて温める'],
  },
  {
    id: 'niku-udon',
    name: '肉うどん',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'うどん', amount: '2玉' },
      { name: '豚肉', amount: '100g' },
    ],
    seasonings: [
      { name: 'だしの素', amount: '小さじ2' },
      { name: 'しょうゆ', amount: '大さじ1' },
    ],
    cookingLiquids: [{ name: '水', amount: '700ml' }],
    ingredientChecks: [
      { ingredientName: 'しょうゆ' },
      { ingredientName: 'だしの素' },
    ],
    cookingTimeMinutes: 15,
    servingsBase: 2,
    tags: ['麺'],
    equipment: ['鍋'],
    steps: [
      '鍋に水とだしの素を入れて煮立たせ、しょうゆで味を調える',
      '豚肉を加えて中心まで色が変わるまで煮る',
      'うどんを加えて温める',
    ],
    notes: ['豚肉は中心まで色が変わっていることを確認してください。'],
    arrangements: [{ id: 'niku-udon-negi', label: 'ねぎをのせる', addIngredients: ['ねぎ'] }],
  },
  {
    id: 'napolitan',
    name: 'ナポリタン',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'パスタ', amount: '160g' },
      { name: '玉ねぎ', amount: '1/2個' },
    ],
    seasonings: [
      { name: 'ケチャップ', amount: '大さじ4' },
      { name: '油', amount: '大さじ1' },
    ],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['麺', '子ども向け'],
    equipment: ['包丁', 'まな板', '鍋', 'フライパン'],
    steps: [
      'パスタを表示時間通りにゆでる',
      '玉ねぎを薄切りにする',
      'フライパンで玉ねぎを炒め、ゆでたパスタを加える',
      'ケチャップを加えて炒め合わせる',
    ],
  },
  {
    id: 'kinoko-pasta',
    name: 'きのこパスタ',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'パスタ', amount: '160g' },
      { name: 'きのこ', amount: '150g' },
    ],
    seasonings: [
      { name: 'オリーブオイル', amount: '大さじ2' },
      { name: 'しょうゆ', amount: '小さじ2' },
    ],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 20,
    servingsBase: 2,
    tags: ['麺', '時短'],
    equipment: ['鍋', 'フライパン'],
    steps: [
      'パスタを表示時間通りにゆでる',
      'きのこを食べやすい大きさにほぐす',
      'フライパンでオリーブオイルときのこを炒める',
      'ゆでたパスタとしょうゆを加えて和える',
    ],
  },

  // ------------------------------------------------------------
  // 朝食・軽食
  // ------------------------------------------------------------
  {
    id: 'butter-toast',
    name: 'バタートースト',
    type: 'other',
    cuisine: 'japanese',
    requiredIngredients: [{ name: 'パン', amount: '1枚' }],
    seasonings: [{ name: 'バター', amount: '適量' }],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['朝食', '時短'],
    equipment: ['トースター'],
    steps: ['パンをトースターで焼く', 'バターを塗る'],
  },
  {
    id: 'tamago-kake-gohan',
    name: '卵かけごはん',
    type: 'main',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'ごはん', amount: '1杯分' },
      { name: '卵', amount: '1個' },
    ],
    seasonings: [{ name: 'しょうゆ', amount: '少々' }],
    ingredientChecks: [{ ingredientName: 'しょうゆ' }],
    cookingTimeMinutes: 5,
    servingsBase: 1,
    tags: ['朝食', '時短'],
    equipment: ['茶碗'],
    steps: ['ごはんを茶碗によそう', '卵を割り入れる', 'しょうゆをかけて混ぜる'],
  },
  {
    id: 'tuna-sandwich',
    name: 'ツナサンド',
    type: 'other',
    cuisine: 'japanese',
    requiredIngredients: [
      { name: 'パン', amount: '2枚' },
      { name: 'ツナ', amount: '1/2缶' },
    ],
    seasonings: [{ name: 'マヨネーズ', amount: '大さじ1' }],
    ingredientChecks: [{ ingredientName: 'マヨネーズ' }],
    cookingTimeMinutes: 10,
    servingsBase: 1,
    tags: ['朝食', '時短'],
    equipment: ['包丁', 'まな板'],
    steps: ['ツナの油を軽くきり、マヨネーズと混ぜる', 'パンにはさむ', '食べやすい大きさに切る'],
  },
]

/** MISSION 2.11 PHASE D — Recipe Detail画面が、MealSuggestion.recipeIdから元のRecipeを再検索するために使う */
export function getRecipeById(id: string): Recipe | undefined {
  return RECIPE_CATALOG.find((recipe) => recipe.id === id)
}
