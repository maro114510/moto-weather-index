const section = "space-y-3";
const h2 = "font-semibold text-2xl text-blue-700";
const list = "ml-4 list-decimal space-y-2 text-slate-700";

export function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-center font-bold text-3xl">利用規約</h1>

      <section className={section}>
        <h2 className={h2}>第1条（適用）</h2>
        <p className="text-slate-700 leading-relaxed">
          本規約は、ツーリング日和指数（以下「本サービス」）の利用に関し、本サービスを利用するすべてのユーザーと運営者との間に適用されます。
        </p>
      </section>

      <section className={section}>
        <h2 className={h2}>第2条（禁止事項）</h2>
        <ol className={list}>
          <li>法令または公序良俗に違反する行為</li>
          <li>本サービスの運営を妨害する行為</li>
          <li>他のユーザー、第三者または運営者の権利・利益を侵害する行為</li>
          <li>本サービスの内容の無断転載・無断利用</li>
          <li>本サービスによって取得した情報の営利目的での利用</li>
          <li>その他、運営者が不適切と判断する行為</li>
        </ol>
      </section>

      <section className={section}>
        <h2 className={h2}>第3条（サービスの変更・中断・終了）</h2>
        <ol className={list}>
          <li>
            運営者は、事前の通知なく、本サービスの内容を変更、追加、または中断・終了することがあります。
          </li>
          <li>
            本サービスの中断・終了によってユーザーに生じた損害について、運営者は責任を負いません。
          </li>
        </ol>
      </section>

      <section className={section}>
        <h2 className={h2}>第4条（免責事項）</h2>
        <ol className={list}>
          <li>
            本サービスが提供する情報（天気情報・指数等）は、正確性・完全性を保証するものではありません。
          </li>
          <li>
            天気情報はOpen-Meteoが提供するもので、取得できない要素がある場合は、取得できた要素だけで指数を算出します。
          </li>
          <li>
            情報に基づいてユーザーが行った行動（ツーリング等）によって生じた損害やトラブルについて、運営者は責任を負いません。
          </li>
        </ol>
      </section>

      <section className={section}>
        <h2 className={h2}>第5条（知的財産権）</h2>
        <p className="text-slate-700 leading-relaxed">
          本サービスに関連するコンテンツの知的財産権は、運営者または正当な権利者に帰属します。天気データの帰属はOpen-Meteoに従います。
        </p>
      </section>

      <section className={section}>
        <h2 className={h2}>第6条（個人情報の取扱い）</h2>
        <p className="text-slate-700 leading-relaxed">
          運営者は、利用によって取得するユーザーの情報を、プライバシーポリシーに従い適切に取り扱います。
        </p>
      </section>

      <section className={section}>
        <h2 className={h2}>第7条（規約の変更）</h2>
        <p className="text-slate-700 leading-relaxed">
          運営者は、必要に応じて本規約を変更することができます。変更後の規約は、本サービス上に掲示した時点から効力を生じます。
        </p>
      </section>

      <section className={section}>
        <h2 className={h2}>第8条（準拠法）</h2>
        <p className="text-slate-700 leading-relaxed">
          本規約の解釈及び適用は、日本法に準拠します。
        </p>
      </section>
    </div>
  );
}
