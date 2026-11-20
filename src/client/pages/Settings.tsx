import { ConsentCard } from "../components/ConsentCard";

export function SettingsPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-bold text-3xl text-slate-900">現在地の設定</h1>
      <p className="text-slate-600">
        現在地の利用、保存した座標の削除、同意の撤回を管理できます。
      </p>
      <ConsentCard />
    </section>
  );
}
