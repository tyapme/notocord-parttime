"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { User, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SelectField } from "@/components/select-field";
import { ShiftRequestModalFrame } from "@/components/shift-request-modal-frame";

const ROLE_LABELS: Record<Role, string> = {
  staff: "アルバイト",
  reviewer: "レビュアー",
  admin: "管理者",
};

export function AdminScreen() {
  const users = useAppStore((s) => s.users);
  const currentUserId = useAppStore((s) => s.currentUser?.id ?? "");
  const addUser = useAppStore((s) => s.addUser);
  const updateUser = useAppStore((s) => s.updateUser);
  const toggleActiveUser = useAppStore((s) => s.toggleActiveUser);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<User | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("staff");
  const [newRequestType, setNewRequestType] = useState<"fix" | "flex">("fix");
  const [error, setError] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const requestType = newRole === "staff" ? newRequestType : "fix";
    addUser({ name: newName.trim(), email: newEmail.trim(), role: newRole, requestType }).then((ok) => {
      if (!ok) {
        setError("作成に失敗しました");
        return;
      }
      setNewName(""); setNewEmail(""); setNewRole("staff"); setNewRequestType("fix");
      setShowAdd(false);
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    const requestType = editing.role === "staff" ? editing.requestType : "fix";
    updateUser(editing.id, { name: editing.name, email: editing.email, role: editing.role, requestType }).then((ok) => {
      if (!ok) {
        setError("更新に失敗しました");
        return;
      }
      setEditing(null);
    });
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">ユーザー管理</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{users.length}名</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setError(null); }}
          className="button-primary px-4 text-sm"
        >
          追加
        </button>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div
            key={u.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border px-4 py-4 transition-colors",
              !u.active ? "border-border bg-muted/30 opacity-60" : "border-border bg-card"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <p className={cn("text-sm font-semibold", !u.active ? "text-muted-foreground line-through" : "text-foreground")}>
                  {u.name}
                </p>
                <span className={cn(
                  "text-[10px] font-bold rounded-md px-1.5 py-0.5 tracking-wide",
                  u.role === "admin" ? "bg-primary/10 text-primary"
                    : u.role === "reviewer" ? "bg-foreground/8 text-foreground"
                      : "bg-muted text-muted-foreground"
                )}>
                  {ROLE_LABELS[u.role].toUpperCase()}
                </span>
                {u.role === "staff" && (
                  <span className={cn(
                    "text-[10px] font-bold rounded-md px-1.5 py-0.5 tracking-wide",
                    u.requestType === "flex" ? "bg-accent/40 text-accent-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {u.requestType === "flex" ? "FLEX" : "FIX"}
                  </span>
                )}
                {!u.active && (
                  <span className="text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-[var(--status-rejected-bg)] text-[var(--status-rejected)] tracking-wide">
                    無効
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">{u.email}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => { setEditing({ ...u }); setError(null); }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                編集
              </button>
              {u.id !== currentUserId && (
                <button
                  onClick={() => setConfirmDisable(u)}
                  className={cn(
                    "text-xs font-medium transition-colors",
                    !u.active
                      ? "text-muted-foreground hover:text-[var(--status-approved)]"
                      : "text-muted-foreground hover:text-[var(--status-rejected)]"
                  )}
                >
                  {!u.active ? "有効化" : "無効化"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add modal */}
      {showAdd && (
        <Modal title="ユーザーを追加" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-4">
            <Field label="氏名">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="山田 太郎" className="input-base" />
            </Field>
            <Field label="メールアドレス">
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required placeholder="user@example.com" className="input-base" />
            </Field>
            <Field label="ロール">
              <SelectField
                label=""
                className="space-y-0"
                value={newRole}
                onChange={(v) => {
                  const nextRole = v as Role;
                  setNewRole(nextRole);
                  if (nextRole !== "staff") setNewRequestType("fix");
                }}
                options={[
                  { value: "staff", label: "アルバイト" },
                  { value: "reviewer", label: "レビュアー" },
                  { value: "admin", label: "管理者" },
                ]}
              />
            </Field>
            {newRole === "staff" && (
              <Field label="申請タイプ">
                <SelectField
                  label=""
                  className="space-y-0"
                  value={newRequestType}
                  onChange={(v) => setNewRequestType(v as "fix" | "flex")}
                  options={[
                    { value: "fix", label: "Fix" },
                    { value: "flex", label: "Flex" },
                  ]}
                />
              </Field>
            )}
            {error && <p className="text-xs font-medium text-[var(--status-rejected)]">{error}</p>}
            <div className="pt-1">
              <button type="submit" className="button-primary w-full text-sm">追加</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title="ユーザーを編集" onClose={() => setEditing(null)}>
          <form onSubmit={handleUpdate} className="space-y-4">
            <Field label="氏名">
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required className="input-base" />
            </Field>
            <Field label="メールアドレス">
              <input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} required className="input-base" />
            </Field>
            <Field label="ロール">
              <SelectField
                label=""
                className="space-y-0"
                value={editing.role}
                onChange={(v) => {
                  const nextRole = v as Role;
                  setEditing({
                    ...editing,
                    role: nextRole,
                    requestType: nextRole === "staff" ? editing.requestType : "fix",
                  });
                }}
                options={[
                  { value: "staff", label: "アルバイト" },
                  { value: "reviewer", label: "レビュアー" },
                  { value: "admin", label: "管理者" },
                ]}
              />
            </Field>
            {editing.role === "staff" && (
              <Field label="申請タイプ">
                <SelectField
                  label=""
                  className="space-y-0"
                  value={editing.requestType}
                  onChange={(v) => setEditing({ ...editing, requestType: v as "fix" | "flex" })}
                  options={[
                    { value: "fix", label: "Fix" },
                    { value: "flex", label: "Flex" },
                  ]}
                />
              </Field>
            )}
            {error && <p className="text-xs font-medium text-[var(--status-rejected)]">{error}</p>}
            <div className="pt-1">
              <button type="submit" className="button-primary w-full text-sm">保存</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Disable confirm */}
      {confirmDisable && (
        <Modal title={confirmDisable.active ? "アカウントを無効化" : "アカウントを有効化"} onClose={() => setConfirmDisable(null)}>
          <p className="text-sm text-muted-foreground mb-5">
            {confirmDisable.active
              ? `${confirmDisable.name} のアカウントを無効化します。無効化するとログインできなくなります。`
              : `${confirmDisable.name} のアカウントを有効化します。`}
          </p>
          <div>
            <button
              onClick={() => { toggleActiveUser(confirmDisable.id, !confirmDisable.active); setConfirmDisable(null); }}
              className={cn(
                "button-primary w-full text-sm",
                confirmDisable.active
                  ? "bg-[var(--status-rejected-bg)] text-[var(--status-rejected)] border-border"
                  : "bg-[var(--status-approved-bg)] text-[var(--status-approved)] border-border"
              )}
            >
              {confirmDisable.active ? "無効化する" : "有効化する"}
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <ShiftRequestModalFrame
      onClose={onClose}
      header={<p className="text-sm font-bold text-foreground">{title}</p>}
      bodyClassName="px-5 py-5"
      maxWidthClassName="max-w-sm"
    >
      {children}
    </ShiftRequestModalFrame>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
