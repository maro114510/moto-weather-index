const section = "space-y-3";
const h2 = "font-semibold text-2xl text-blue-700";
const list = "ml-4 list-disc space-y-2 text-slate-700";

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-center font-bold text-3xl">プライバシーポリシー</h1>
      <p className="text-slate-700 leading-relaxed">
        ツーリング日和指数（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報を適切に取り扱います。本ポリシーでは、本サービスにおけるユーザー情報の取扱いを説明します。
      </p>

      <section className={section}>
        <h2 className={h2}>1. 取得する情報</h2>
        <ul className={list}>
          <li>端末の位置情報（ユーザーの明示的な同意がある場合のみ）</li>
          <li>検索した地名と、選択した地点の座標</li>
        </ul>
      </section>

      <section className={section}>
        <h2 className={h2}>2. 位置情報の取扱い</h2>
        <ul className={list}>
          <li>
            位置情報は、その場所の天気とツーリング指数を表示する目的でのみ利用します。
          </li>
          <li>
            指数を算出するため、座標は本サービスと、天気の提供元であるOpen-Meteoへ送信されます。
          </li>
          <li>
            本サービスは座標を履歴として保存しません。サーバーに保存しません。座標は、同じ地点への再問い合わせを減らす目的で、近接する地点と共有する形で短時間だけキャッシュされます。
          </li>
          <li>
            座標はユーザーの端末（ブラウザ）に最大24時間保存され、その後削除されます。設定画面からいつでも削除や同意の撤回ができます。
          </li>
          <li>位置情報を第三者に提供することはありません。</li>
        </ul>
      </section>

      <section className={section}>
        <h2 className={h2}>3. その他の情報取得について</h2>
        <ul className={list}>
          <li>
            氏名、メールアドレスなど、個人を特定できる情報は取得・保存しません。
          </li>
          <li>アカウント登録はなく、利用履歴も保存しません。</li>
        </ul>
      </section>

      <section className={section}>
        <h2 className={h2}>4. 情報の第三者提供</h2>
        <p className="text-slate-700 leading-relaxed">
          法令に基づく場合を除き、取得した情報を第三者に提供することはありません。ただし、指数の算出に必要な座標と地名の検索語は、前項のとおりOpen-Meteoへ送信されます。
        </p>
      </section>

      <section className={section}>
        <h2 className={h2}>5. プライバシーポリシーの変更</h2>
        <p className="text-slate-700 leading-relaxed">
          運営者は、必要に応じて本ポリシーを変更することがあります。変更後の内容は本サービス上に掲載した時点から効力を生じます。
        </p>
      </section>

      <section className={section}>
        <h2 className={h2}>6. お問い合わせ</h2>
        <p className="text-slate-700 leading-relaxed">
          お問い合わせ先メールアドレス：atsuki.nohira@stelzen.dev
        </p>
      </section>
    </div>
  );
}
